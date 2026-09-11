/**
 * Browser-side connectivity / image-support test for the vision model endpoint.
 *
 * Runs entirely in the browser — DSH has no generic client-to-host RPC for
 * third-party plugins (`dsh-api-remotes` only forwards a host→client event
 * allowlist), so this is the only mechanism that works across DSH versions.
 *
 * The key sent here is exactly the key the host sends: since v1.2.0 the API Key
 * field is the ONLY key source (no `apiKeyEnv` indirection, no reuse of a route
 * sharing the Base URL), and the same `authHeaders` mapping produces the
 * request headers on both sides. A pass/fail here is therefore representative
 * for the whole pipeline.
 */
import { authHeaders, keyFormatHint, type KeyFormat } from '../authHeaders.ts'

/** A small 32x32 solid PNG sent to the model to prove image input works. */
const TEST_IMAGE_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAK0lEQVR4nO3OIQEAAAwEoetfeovxBoGnq1tKQEBAQEBAQEBAQEBAQEBgHXhUDfhqRFDd3gAAAABJRU5ErkJggg=='

export type TestCategory = 'ok' | 'transient' | 'unverifiable' | 'config'

export interface TestOutcome {
  /** Whether the probe actually succeeded. */
  ok: boolean
  /** Whether the save may proceed (ok/transient/unverifiable) or is blocked (config). */
  canSave: boolean
  /** HTTP status, or 0 for transport-level failures. */
  status: number
  category: TestCategory
  message: string
}

export interface TestValues {
  baseUrl: string
  modelId: string
  apiKey: string
  keyFormat: KeyFormat
}

function extractErrorMessage(body: string): string | undefined {
  try {
    const p = JSON.parse(body) as { error?: { message?: string } | string; message?: string }
    const d = typeof p.error === 'string' ? p.error : p.error?.message ?? p.message
    return d !== undefined && d.length > 0 ? d : undefined
  } catch {
    return body.length > 0 ? body.slice(0, 200) : undefined
  }
}

async function readContent(body: string): Promise<string> {
  try {
    const j = JSON.parse(body) as { choices?: { message?: { content?: unknown; reasoning_content?: unknown } }[] }
    const m = j?.choices?.[0]?.message
    const parts: unknown[] = [m?.content, m?.reasoning_content].filter((v) => v !== undefined)
    const render = (c: unknown): string =>
      typeof c === 'string'
        ? c
        : Array.isArray(c)
          ? c.map((x) => (x as { text?: unknown })?.text ?? '').join('')
          : ''
    return parts.map(render).join('\n').trim()
  } catch {
    return ''
  }
}

/**
 * A 2xx from an OpenAI-compatible endpoint that received an image payload
 * proves both connectivity and image acceptance — an unsupported model would
 * answer 4xx/5xx, not 200. Reasoning models (e.g. glm-5-3-flash) and tiny
 * `max_tokens` can legitimately yield an empty `content` (output lands in
 * `reasoning_content`), so we never block the save on an empty completion.
 */

/**
 * Probe `POST {baseUrl}/chat/completions` with a tiny embedded image and a
 * "Reply with exactly: OK" prompt. A missing key is reported before any
 * request is sent — it is the one failure the plugin can name exactly, and the
 * same message the host uses when transcription finds no key.
 */
export async function testVisionConnection(values: TestValues, timeoutMs = 20000): Promise<TestOutcome> {
  const base = values.baseUrl.replace(/\/+$/, '')
  if (base.length === 0) {
    return { ok: false, canSave: false, status: 0, category: 'config', message: 'Base URL 为空' }
  }
  const modelId = values.modelId.trim()
  if (modelId.length === 0) {
    return { ok: false, canSave: false, status: 0, category: 'config', message: 'Model ID 为空' }
  }
  if (values.apiKey.trim().length === 0) {
    return {
      ok: false, canSave: false, status: 0, category: 'config',
      message: `未携带 API Key：请在「API Key」字段填写密钥（当前密钥格式：${values.keyFormat}）`,
    }
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...authHeaders(values.keyFormat, values.apiKey),
  }
  let response: Response
  try {
    response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelId,
        max_tokens: 16,
        temperature: 0,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: TEST_IMAGE_DATA_URL } },
            { type: 'text', text: 'Reply with exactly: OK' },
          ],
        }],
      }),
      signal: controller.signal,
    })
  } catch (error: unknown) {
    const timedOut = controller.signal.aborted
    return timedOut
      ? { ok: false, canSave: true, status: 0, category: 'transient', message: `连接超时（超过 ${timeoutMs / 1000} 秒）` }
      : {
          ok: false, canSave: true, status: 0, category: 'unverifiable',
          message: `浏览器无法直连（可能是跨域限制或网络问题）：${String(error)}。跨域限制只影响浏览器测试；保存后服务端实际识图仍按其网络环境请求。`,
        }
  } finally {
    clearTimeout(timeout)
  }
  const body = await response.text().catch(() => '')
  const status = response.status
  if (response.ok) {
    const content = await readContent(body)
    const empty = content.trim().length === 0
    const note = empty
      ? '（模型返回空内容——可能为推理型模型或输出被截断；HTTP 200 已证明连接与图片输入正常）'
      : '，模型可接收图片'
    return { ok: true, canSave: true, status, category: 'ok', message: `连接成功（HTTP ${status}）${note}` }
  }
  const message = extractErrorMessage(body) ?? `HTTP ${status}`
  if (status === 429 || status >= 500) {
    return { ok: false, canSave: true, status, category: 'transient', message: `${message}（临时限流/上游错误，配置本身通常有效）` }
  }
  if (status === 401 || status === 403) {
    return {
      ok: false, canSave: false, status, category: 'config',
      message: `${message}（已按「${values.keyFormat}」格式携带密钥但被拒绝——请确认 API Key 与「密钥格式」匹配、密钥有效且未欠费）${keyFormatHint(values.apiKey)}`,
    }
  }
  return { ok: false, canSave: false, status, category: 'config', message }
}
