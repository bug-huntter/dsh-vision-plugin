/**
 * API-key authentication schemes — the settings page's 密钥格式 field.
 *
 * The transport is always the OpenAI-compatible
 * `POST {baseUrl}/chat/completions` call; what differs between providers is how
 * the key is presented. The settings page therefore asks for the KEY FORMAT
 * instead of an environment-variable name: an env name is a second, invisible
 * key source that could resolve to a credential the user never chose (see the
 * route-reuse bug in v1.1.3 / the removal in v1.2.0), whereas the format field
 * only ever describes the key the user typed.
 *
 * Shared by both halves so the browser-side connectivity test sends exactly
 * what the host sends.
 */

/** Supported formats, in menu order. The value is what gets stored. */
export const KEY_FORMATS = ['openai', 'anthropic', 'gemini', 'azure'] as const

/** One supported key format. */
export type KeyFormat = (typeof KEY_FORMATS)[number]

/** Format assumed when the setting is absent or unrecognized. */
export const DEFAULT_KEY_FORMAT: KeyFormat = 'openai'

/** Version header the native Anthropic API requires alongside `x-api-key`. */
const ANTHROPIC_VERSION = '2023-06-01'

/**
 * Narrow any stored value to a supported format.
 *
 * Deliberately tolerant: the schema stores this as a plain string, so a
 * hand-edited `settings.yaml` typo degrades to the default instead of making
 * the namespace fail validation (which would reject every later write with
 * `settings/rejected` — a trap, not a safeguard).
 * @param value - value read from settings.
 * @returns a supported format, defaulting to `openai`.
 */
export function normalizeKeyFormat(value: unknown): KeyFormat {
  return typeof value === 'string' && (KEY_FORMATS as readonly string[]).includes(value)
    ? (value as KeyFormat)
    : DEFAULT_KEY_FORMAT
}

/**
 * Authentication headers for one format.
 *
 * An empty key yields no authentication header at all — that is the
 * "未携带 API Key" case, which callers report with an actionable message
 * instead of sending an unauthenticated request and surfacing a raw provider
 * 401. Surrounding whitespace is stripped: `Bearer  sk-…` (a pasted trailing
 * newline, say) is rejected by aggregators as a missing header.
 * @param format - key format from settings.
 * @param key - the API key as typed.
 * @returns the headers to merge into the request.
 */
export function authHeaders(format: KeyFormat, key: string): Record<string, string> {
  const trimmed = key.trim()
  if (trimmed.length === 0) return {}
  switch (format) {
    case 'anthropic':
      return { 'x-api-key': trimmed, 'anthropic-version': ANTHROPIC_VERSION }
    case 'gemini':
      return { 'x-goog-api-key': trimmed }
    case 'azure':
      return { 'api-key': trimmed }
    default:
      return { authorization: `Bearer ${trimmed}` }
  }
}

/**
 * Whether an API key looks like it was pasted with quotes around it, which
 * providers reject. Reported as a hint, never as a rewrite.
 * @param key - the API key as typed.
 * @returns a user-facing hint, or an empty string.
 */
export function keyFormatHint(key: string): string {
  const trimmed = key.trim()
  const quoted = trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))
  if (quoted || trimmed.includes('"')) return '（提示：API Key 似乎带了引号——粘贴时带入引号会导致鉴权失败）'
  return ''
}
