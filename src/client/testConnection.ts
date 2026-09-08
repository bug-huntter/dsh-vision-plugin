/**
 * Browser-side connectivity / image-support test for the vision model endpoint.
 *
 * Runs entirely in the browser — DSH has no generic client-to-host RPC for
 * third-party plugins (`dsh-api-remotes` only forwards a host→client event
 * allowlist), so this is the only mechanism that works across DSH versions.
 *
 * Caveat: keys that the server resolves at request time (apiKeyEnv / route
 * reuse) cannot be reproduced here; auth-type failures with no literal key are
 * reported as "unverifiable" (save allowed with a warning) instead of blocking
 * the save.
 */

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
    const j = JSON.parse(body) as { choices?: { message?: { content?: unknown } }[] }
    const c = j?.choices?.[0]?.message?.content
    return typeof c === 'string'
      ? c
      : Array.isArray(c)
        ? c.map((x) => (x as { text?: unknown })?.text ?? '').join('')
        : ''
  } catch {
    return ''
  }
}

/**
 * Probe `POST {baseUrl}/chat/completions` with a tiny embedded image and a
 * "Reply with exactly: OK" prompt. A 2xx with non-empty content proves both
 * connectivity and image input support.
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
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (values.apiKey.length > 0) headers.authorization = `Bearer ${values.apiKey}`
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
    if (content.trim().length === 0) {
      return { ok: false, canSave: false, status, category: 'config', message: `HTTP ${status} 但返回内容为空——模型可能不支持图片输入或返回格式异常` }
    }
    return { ok: true, canSave: true, status, category: 'ok', message: `连接成功（HTTP ${status}），模型可接收图片` }
  }
  const message = extractErrorMessage(body) ?? `HTTP ${status}`
  if (status === 429 || status >= 500) {
    return { ok: false, canSave: true, status, category: 'transient', message: `${message}（临时限流/上游错误，配置本身通常有效）` }
  }
  if ((status === 401 || status === 403) && values.apiKey.length === 0) {
    return { ok: false, canSave: true, status, category: 'unverifiable', message: `${message}（密钥由服务端解析，浏览器无法验证鉴权；保存后实际使用时会按服务端解析的密钥鉴权）` }
  }
  return { ok: false, canSave: false, status, category: 'config', message }
}
