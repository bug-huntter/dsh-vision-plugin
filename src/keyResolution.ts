/**
 * Vision-model API key resolution.
 *
 * Kept in its own module (rather than inline in the plugin entry) so the
 * precedence can be exercised by the local regression test
 * `test/key-resolution.test.mjs`: getting the order subtly wrong only shows up
 * as an opaque provider 401 at transcription time, which is exactly the bug
 * this module was extracted to lock down.
 *
 * Priority, first hit wins:
 *
 *   1. `apiKeyEnv` — an explicitly named credential / environment variable.
 *   2. `apiKey` — the literal key typed into 设置 → 识图模型配置.
 *   3. route reuse — the credential already registered for an LLM route whose
 *      Base URL matches the configured vision Base URL.
 *
 * Route reuse is a convenience fallback for deployments that configured
 * neither of the two explicit fields — never an override of them. A host can
 * easily register several providers on one Base URL (two OpenRouter routes,
 * say), and letting whichever route happened to register first win sent an
 * unrelated key and failed with `401 Missing Authentication header` even
 * though the settings page held a perfectly good key.
 */
import { symbols } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import type { LlmRuntime } from '@deepseek-ai/dsh-llm'

/** Which configuration supplied the key used for a transcription request. */
export type VisionKeySource = 'apiKeyEnv' | 'apiKey' | 'route' | 'none'

export interface VisionKeyResolution {
  /** Key to send with the request; empty when nothing resolved. */
  key: string
  /** Where the key came from. Carries no key material, so it is safe to log. */
  source: VisionKeySource
  /** Provider whose registered credential was reused, for `source: 'route'`. */
  provider?: string
}

/** The subset of the plugin settings that participates in key resolution. */
export interface VisionKeySettings {
  baseUrl: string
  apiKey: string
  apiKeyEnv: string
}

/** A registered route profile as read off the llm adapter. */
interface RouteProfile {
  apiKeyEnv?: string
  piProvider?: { baseUrl?: string }
}

/**
 * Resolve the API key for one transcription call. Never throws: an unresolvable
 * reference or an unreadable adapter falls through to the next source, and the
 * caller turns an empty key into an actionable hint.
 */
export async function resolveVisionKey(
  ctx: Context,
  settings: VisionKeySettings,
  llm: LlmRuntime,
): Promise<VisionKeyResolution> {
  const credentials = ctx.get('credentials') as
    { resolve: (ref: string) => Promise<{ value?: string } | undefined> } | undefined
  const resolveRef = async (ref: string): Promise<string | undefined> => {
    if (ref.length === 0) return undefined
    if (credentials !== undefined) {
      try {
        const hit = await credentials.resolve(ref)
        if (hit?.value !== undefined && hit.value.length > 0) return hit.value
      } catch (_unresolvable) {
        // A reference the credentials service refuses falls through to the
        // environment; an empty result is a misconfiguration, not a retry.
      }
    }
    const env = process.env[ref]
    return env !== undefined && env.length > 0 ? env : undefined
  }

  // 1. An explicitly named credential or environment variable.
  const fromEnv = await resolveRef(settings.apiKeyEnv)
  if (fromEnv !== undefined) return { key: fromEnv, source: 'apiKeyEnv' }

  // 2. The literal key typed into the settings field. Surrounding whitespace is
  //    dropped — `Bearer  sk-…` is rejected by aggregators as a missing header —
  //    and a whitespace-only value counts as unset rather than as a key.
  const literal = settings.apiKey.trim()
  if (literal.length > 0) return { key: literal, source: 'apiKey' }

  // 3. Last resort: reuse the credential registered for a route with the same
  //    Base URL (settings.yaml credentials are reused, never duplicated).
  const instance = llm[symbols.original] ?? llm
  const adaptersMap = Reflect.get(instance, 'adapters') as Map<string, { adapter?: unknown } | undefined> | undefined
  if (adaptersMap !== undefined) {
    const wantedBase = settings.baseUrl.replace(/\/+$/, '').toLowerCase()
    const candidates: Array<{ provider: string; resolve: () => Promise<string | undefined> }> = []
    for (const registration of adaptersMap.values()) {
      const adapter = (registration?.adapter ?? undefined) as {
        config?: {
          resolveApiKey?: (provider: string, profile: RouteProfile) => Promise<string | undefined>
          profiles?: () => Map<string, RouteProfile>
        }
      } | undefined
      const resolveApiKey = adapter?.config?.resolveApiKey
      const profiles = adapter?.config?.profiles
      if (typeof resolveApiKey !== 'function' || typeof profiles !== 'function') continue
      let routeProfiles: Map<string, RouteProfile> | undefined
      try {
        routeProfiles = profiles.call(adapter?.config)
      } catch (_unreadable) {
        continue
      }
      for (const [provider, profile] of routeProfiles) {
        const routeBase = (profile.piProvider?.baseUrl ?? '').replace(/\/+$/, '').toLowerCase()
        if (routeBase !== wantedBase) continue
        if ((profile.apiKeyEnv ?? '').length === 0) continue
        candidates.push({
          provider,
          resolve: async () => {
            try {
              const key = await resolveApiKey.call(adapter?.config, provider, profile)
              return key !== undefined && key.length > 0 ? key : undefined
            } catch (_unresolvable) {
              return undefined
            }
          },
        })
      }
    }
    for (const candidate of candidates) {
      const key = await candidate.resolve()
      if (key !== undefined) return { key, source: 'route', provider: candidate.provider }
    }
  }
  return { key: '', source: 'none' }
}
