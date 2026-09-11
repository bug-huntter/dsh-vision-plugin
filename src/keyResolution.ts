/**
 * Vision-model API key resolution.
 *
 * Kept in its own module (rather than inline in the plugin entry) so the rule
 * can be exercised by the local regression test `test/key-resolution.test.mjs`:
 * getting it subtly wrong only shows up as an opaque provider 401 at
 * transcription time, which is exactly the class of bug this module locks down.
 *
 * v1.2.0: the key has exactly ONE source — the API Key field. The two former
 * indirect sources are gone, because both could silently substitute a key the
 * user never chose:
 *
 *   • `apiKeyEnv` — a field labelled as an environment-variable *name* but read
 *     by users as "the key". It also outranked the literal key, so a stale
 *     reference resolved to an unrelated credential.
 *   • route reuse — the credential of whichever LLM route happened to share the
 *     Base URL and register first. With two OpenRouter routes configured, this
 *     replaced a perfectly good key typed into the settings page with a
 *     35-character key belonging to another provider, and surfaced as
 *     `401 Missing Authentication header` with no error message that could
 *     explain it.
 *
 * An empty key is now reported as `未携带 API Key` (see `transcribeImage`),
 * pointing the user at the one field that can fix it, instead of papering the
 * failure over with some other route's credential.
 */

/** Which configuration supplied the key used for a transcription request. */
export type VisionKeySource = 'apiKey' | 'none'

export interface VisionKeyResolution {
  /** Key to send with the request; empty when the field was not filled. */
  key: string
  /** Where the key came from. Carries no key material, so it is safe to log. */
  source: VisionKeySource
}

/** The subset of the plugin settings that participates in key resolution. */
export interface VisionKeySettings {
  /** The one field an API key may come from. */
  apiKey?: string
}

/**
 * Resolve the API key for one transcription call. Never throws: an unfilled
 * field resolves to `source: 'none'`, and the caller turns that into an
 * actionable notice.
 * @param settings - current plugin settings.
 * @returns the key to send (possibly empty) and where it came from.
 */
export function resolveVisionKey(settings: VisionKeySettings | undefined): VisionKeyResolution {
  // Surrounding whitespace is dropped — `Bearer  sk-…` is rejected by
  // aggregators as a missing header — and a whitespace-only value counts as
  // unfilled rather than as a key.
  const key = settings?.apiKey?.trim() ?? ''
  return key.length === 0 ? { key: '', source: 'none' } : { key, source: 'apiKey' }
}
