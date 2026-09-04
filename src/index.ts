/**
 * Host-side entry for the vision plugin: registers the settings namespace and,
 * while image recognition is enabled, routes image content through the
 * configured vision model.
 *
 * A deployment's main model may be text-only, so sending raw images fails
 * upstream (the provider answers 404 "no endpoints that support image input").
 * The plugin therefore does two things while `enabled` is on:
 *
 * 1. Capability advertisement: patches the shared `llm` service so its model
 *    capability queries report `image` support, which is what admits inbound
 *    images past the host's image-admission guard on any model.
 * 2. Image transcription: the request boundary is patched so that, BEFORE
 *    the `llm/stream` waterfall, every image block of a user message is
 *    replaced by a text transcription produced by the configured vision model
 *    (one OpenAI-compatible chat-completions call per image), and the main
 *    model only ever sees text.
 *
 * When disabled, the capability patch is restored and no transcription runs;
 * a model that natively declares multimodal input passes images through as-is.
 */
import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { symbols } from '@deepseek-ai/cordis'
import type {
  ContentBlock,
  GenerateOptions,
  LlmRuntime,
  LlmResolvedModelInfo,
  Message,
  StreamChunk,
} from '@deepseek-ai/dsh-llm'
import type { Context, SettingsScope } from '@deepseek-ai/cordis'
import { VISION_PLUGIN_NAMESPACE } from './constants.ts'

export interface VisionPluginSettings {
  /** Whether image recognition is enabled. */
  enabled: boolean
  /** Base URL of the vision model API (OpenAI-compatible). */
  baseUrl: string
  /** Model identifier to use for vision tasks. */
  modelId: string
  /** API key for authenticating with the vision model provider (or a credential/env reference via apiKeyEnv). */
  apiKey: string
  /** Environment variable or credential reference holding the API key; wins over a literal apiKey when set and resolvable. */
  apiKeyEnv: string
  /** Optional override of the transcription instruction sent with each image. */
  prompt?: string
  /** Transcription request timeout in milliseconds. */
  timeoutMs?: number
}

const VisionPluginSettingsSchema: z<VisionPluginSettings> = z.object({
  enabled: z.boolean().default(false),
  baseUrl: z.string().default(''),
  modelId: z.string().default(''),
  apiKey: z.string().default(''),
  apiKeyEnv: z.string().default(''),
  prompt: z.string().default(''),
  timeoutMs: z.number().default(120000),
})

const DEFAULT_TRANSCRIBE_PROMPT =
  'Transcribe and describe this image faithfully. Include all visible text verbatim (OCR). '
  + 'Then briefly describe any other relevant content such as diagrams, charts, UI elements, people, or the scene. '
  + 'Reply with only the transcription and description, without preamble.'

const TRANSCRIPTION_PREFIX = '[Image transcription]'

type Modality = 'text' | 'image' | 'audio'
function withImage(modalities: readonly Modality[] | undefined): Modality[] | undefined {
  if (modalities === undefined || modalities.includes('image')) return modalities
  return [...modalities, 'image']
}

function errorMessage(value: unknown): string {
  if (!(value instanceof Error)) return String(value)
  const cause = value.cause as { code?: unknown; errno?: unknown; syscall?: unknown; address?: unknown; port?: unknown } | undefined
  const causeParts = cause === undefined ? [] : [
    typeof cause.code === 'string' ? `code=${cause.code}` : undefined,
    typeof cause.errno === 'string' || typeof cause.errno === 'number' ? `errno=${cause.errno}` : undefined,
    typeof cause.syscall === 'string' ? `syscall=${cause.syscall}` : undefined,
    typeof cause.address === 'string' ? `address=${cause.address}` : undefined,
    typeof cause.port === 'number' ? `port=${cause.port}` : undefined,
  ].filter((part): part is string => part !== undefined)
  return causeParts.length === 0 ? value.message : `${value.message} (${causeParts.join(', ')})`
}

function messageHasImage(content: readonly ContentBlock[]): boolean {
  return content.some((block): boolean => {
    if (block.type === 'image') return true
    if (block.type === 'tool-result') return messageHasImage((block as { content: readonly ContentBlock[] }).content)
    return false
  })
}

/** Durable image reference as stored in an image content block. */
interface ImageRef {
  attachmentId: string
  mediaType: string
  bytes: number
  width: number
  height: number
  name?: string
}

/** Collect the image references of one message in request order. */
function collectImageRefs(content: readonly ContentBlock[], out: ImageRef[]): void {
  for (const block of content) {
    if (block.type === 'image') {
      out.push(block.attachment as ImageRef)
      continue
    }
    if (block.type === 'tool-result' && (block as { content?: unknown }).content !== undefined) {
      collectImageRefs((block as { content: readonly ContentBlock[] }).content, out)
    }
  }
}

/**
 * Replace image blocks with text blocks. `nextTranscription` is called once per
 * image in request order and returns the replacement text; non-image blocks
 * pass through unchanged. Returns the original array when nothing changed.
 */
function mapBlocksReplacingImages(
  content: readonly ContentBlock[],
  nextTranscription: () => string,
): ContentBlock[] | undefined {
  let changed = false
  const result: ContentBlock[] = []
  for (const block of content) {
    if (block.type === 'image') {
      result.push({ type: 'text', text: nextTranscription() })
      changed = true
    } else if (block.type === 'tool-result' && (block as { content?: unknown }).content !== undefined) {
      const inner = mapBlocksReplacingImages(
        (block as { content: readonly ContentBlock[] }).content,
        nextTranscription,
      )
      if (inner === undefined) {
        result.push(block)
      } else {
        result.push({ ...(block as object), content: inner } as ContentBlock)
        changed = true
      }
    } else {
      result.push(block)
    }
  }
  return changed ? result : undefined
}

/**
 * Resolve the API key for one transcription call: a named credential/env
 * reference wins when set and resolvable, then the literal `apiKey`.
 */
/**
 * Resolve the API key for transcription calls, in priority order:
 * (1) a resolvable `apiKeyEnv` credential reference or environment variable;
 * (2) reuse of a registered LLM provider route whose configured endpoint
 *     matches `baseUrl` - its stored credential is resolved through the
 *     adapter own credential seam (settings.yaml credentials are reused,
 *     never duplicated);
 * (3) the literal `apiKey`.
 */
async function resolveVisionKey(
  ctx: Context,
  settings: VisionPluginSettings,
  llm: LlmRuntime,
): Promise<string> {
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
  const fromEnv = await resolveRef(settings.apiKeyEnv)
  if (fromEnv !== undefined) return fromEnv
  const instance = llm[symbols.original] ?? llm
  const adaptersMap = Reflect.get(instance, 'adapters') as Map<string, { adapter?: unknown } | undefined> | undefined
  if (adaptersMap !== undefined) {
    const wantedBase = settings.baseUrl.replace(/\/+$/, '').toLowerCase()
    const candidates: Array<() => Promise<string | undefined>> = []
    for (const registration of adaptersMap.values()) {
      const adapter = (registration?.adapter ?? undefined) as {
        config?: {
          resolveApiKey?: (provider: string, profile: { apiKeyEnv?: string }) => Promise<string | undefined>
          profiles?: () => Map<string, { apiKeyEnv?: string; piProvider?: { baseUrl?: string } }>
        }
      } | undefined
      const resolveApiKey = adapter?.config?.resolveApiKey
      const profiles = adapter?.config?.profiles
      if (typeof resolveApiKey !== 'function' || typeof profiles !== 'function') continue
      let routeProfiles: Map<string, { apiKeyEnv?: string; piProvider?: { baseUrl?: string } }> | undefined
      try {
        routeProfiles = profiles.call(adapter?.config)
      } catch (_unreadable) {
        continue
      }
      for (const [provider, profile] of routeProfiles) {
        const routeBase = (profile.piProvider?.baseUrl ?? '').replace(/\/+$/, '').toLowerCase()
        if (routeBase !== wantedBase) continue
        if ((profile.apiKeyEnv ?? '').length === 0) continue
        candidates.push(async () => {
          try {
            const key = await resolveApiKey.call(adapter?.config, provider, profile)
            return key !== undefined && key.length > 0 ? key : undefined
          } catch (_unresolvable) {
            return undefined
          }
        })
      }
    }
    for (const candidate of candidates) {
      const key = await candidate()
      if (key !== undefined) return key
    }
  }
  return settings.apiKey
}
async function transcribeImage(
  data: Uint8Array,
  mediaType: string,
  apiKey: string,
  settings: VisionPluginSettings,
  signal: AbortSignal | undefined,
): Promise<string> {
  const base = settings.baseUrl.replace(/\/+$/, '')
  const url = `${base}/chat/completions`
  const dataUrl = `data:${mediaType};base64,${Buffer.from(data).toString('base64')}`
  const timeoutController = new AbortController()
  const timeout = setTimeout(() => timeoutController.abort(), settings.timeoutMs ?? 120000)
  const wire = signal === undefined ? timeoutController.signal : AbortSignal.any([timeoutController.signal, signal])
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (apiKey.length > 0) headers.authorization = `Bearer ${apiKey}`
    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: settings.modelId,
          max_tokens: 4096,
          temperature: 0,
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUrl } },
              { type: 'text', text: settings.prompt?.trim() !== '' ? settings.prompt.trim() : DEFAULT_TRANSCRIBE_PROMPT },
            ],
          }],
        }),
        signal: wire,
      })
    } catch (error: unknown) {
      throw new Error(`vision model fetch failed for ${url}: ${errorMessage(error)}`, { cause: error })
    }
    const body = await response.text()
    if (!response.ok) {
      throw new Error(`vision model request failed with HTTP ${response.status}: ${body.slice(0, 300)}`)
    }
    const parsed: unknown = JSON.parse(body)
    const content: unknown = (parsed as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content
    const text = typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.map((part) => (part as { text?: unknown })?.text ?? '').join('')
        : ''
    if (text.trim().length === 0) throw new Error('vision model returned an empty transcription')
    return text.trim()
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Patch the shared llm service so model capability queries report `image`
 * support while enabled; restore the originals (idempotently) when disabled or
 * on disposal. Reads of `ctx.llm` from other fibers re-resolve the same
 * instance each access, so the api-proxy's admission guard sees the patched
 * methods.
 */
function installImageGuardBypass(ctx: Context, scope: SettingsScope<VisionPluginSettings>, llm: LlmRuntime): void {
  const instance = llm[symbols.original] ?? llm
  const proto = Object.getPrototypeOf(instance)
  const originalResolve = Object.getOwnPropertyDescriptor(proto, 'resolveModelInfo')?.value
  if (typeof originalResolve !== 'function') return
  const originalList = Object.getOwnPropertyDescriptor(proto, 'listModels')?.value
  let active = false
  const activate = (): void => {
    if (active) return
    instance.resolveModelInfo = async (provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo> => {
      const info = await originalResolve.call(instance, provider, model, signal)
      const modalities = withImage(info.inputModalities)
      return modalities === info.inputModalities ? info : { ...info, inputModalities: modalities }
    }
    if (typeof originalList === 'function') {
      instance.listModels = async (provider: string): Promise<readonly LlmResolvedModelInfo[]> => {
        const models = await originalList.call(instance, provider)
        return models.map((model) => {
          const modalities = withImage(model.inputModalities)
          return modalities === model.inputModalities ? model : { ...model, inputModalities: modalities }
        })
      }
    }
    active = true
  }
  const deactivate = (): void => {
    if (!active) return
    delete instance.resolveModelInfo
    if (typeof originalList === 'function') delete instance.listModels
    active = false
  }
  const apply = (enabled: boolean): void => { enabled ? activate() : deactivate() }
  apply(scope.get().enabled)
  ctx.effect(() => {
    const unwatch = scope.watch((next) => apply(next.enabled))
    return () => {
      unwatch()
      deactivate()
    }
  }, 'vision-plugin: image capability advertisement')
}

/**
 * Rewrite a request's image blocks into vision-model transcriptions, yielding
 * the downstream chunks of the rewritten request. The patch wraps the
 * runtime's private `streamWithRegistration` — the seam every `stream` call
 * passes BEFORE it dispatches the `llm/stream` waterfall — so the
 * agent-loop's request-reconstruction invariant (a waterfall listener that
 * compares options against the durable session log) still sees a matching
 * request, and no waterfall listener observes a raw image version of a
 * rewritten call. The original request object is never mutated; loop-built
 * requests arrive deep-frozen.
 */
function installImageTranscription(ctx: Context, scope: SettingsScope<VisionPluginSettings>, llm: LlmRuntime): void {
  const instance = llm[symbols.original] ?? llm
  const originalStream = Reflect.get(instance, 'streamWithRegistration') as ((options: GenerateOptions, prepared?: unknown) => AsyncIterable<StreamChunk>) | undefined
  if (typeof originalStream !== 'function') return
  const stream = (options: GenerateOptions, prepared?: unknown): AsyncIterable<StreamChunk> => originalStream.call(instance, options, prepared)
  const transcribingStream = async function* (options: GenerateOptions, prepared?: unknown): AsyncGenerator<StreamChunk> {
    const settings = scope.get()
    const needsTranscription = settings.enabled
      && settings.baseUrl.length > 0
      && settings.modelId.length > 0
      && options.messages.some((message) => message.role === 'user' && messageHasImage(message.content))
    if (!needsTranscription) {
      yield* stream(options, prepared)
      return
    }
    const attachments = ctx.get('attachments') as { readImage: (ref: ImageRef, signal?: AbortSignal) => Promise<{ data: Uint8Array }> } | undefined
    try {
      if (options.signal?.aborted) {
        yield { type: 'finish', reason: { kind: 'aborted', failure: { message: 'aborted', code: 'ABORTED' } } }
        return
      }
      if (attachments === undefined) {
        // Without the durable attachment service the image bytes cannot be
        // read; pass the request through so the provider's own error names
        // the cause.
        yield* stream(options, prepared)
        return
      }
      const refs: ImageRef[] = []
      for (const message of options.messages) {
        if (message.role !== 'user') continue
        collectImageRefs(message.content, refs)
      }
      if (refs.length === 0) {
        yield* stream(options, prepared)
        return
      }
      const apiKey = await resolveVisionKey(ctx, settings, llm)
      const transcriptions = await Promise.all(refs.map((ref) =>
        attachments.readImage(ref, options.signal)
          .then((stored) => transcribeImage(stored.data, ref.mediaType, apiKey, settings, options.signal))))
      let cursor = 0
      const nextTranscription = (): string => {
        const text = transcriptions[cursor]
        if (text === undefined) throw new Error('vision transcription queue exhausted')
        cursor += 1
        return `${TRANSCRIPTION_PREFIX}\n${text}`
      }
      const transformed: Message[] = options.messages.map((message) => {
        if (message.role !== 'user') return message
        const content = mapBlocksReplacingImages(message.content, nextTranscription)
        return content === undefined ? message : { ...message, content }
      })
      yield* stream({ ...options, messages: transformed }, prepared)
    } catch (error: unknown) {
      yield {
        type: 'finish',
        reason: {
          kind: 'error',
          failure: { message: `vision-plugin: image transcription failed: ${errorMessage(error)}`, code: 'VISION_TRANSCRIBE_FAILED' },
        },
      }
    }
  } as (options: GenerateOptions, prepared?: unknown) => AsyncIterable<StreamChunk>
  ctx.effect(() => {
    Object.defineProperty(instance, 'streamWithRegistration', {
      value: (options: GenerateOptions, prepared?: unknown): AsyncIterable<StreamChunk> => {
        if (scope.get().enabled) return transcribingStream(options, prepared)
        return stream(options, prepared)
      },
      writable: true,
      configurable: true,
    })
    return () => {
      delete instance.streamWithRegistration
    }
  }, 'vision-plugin: image transcription boundary')
}

/** Register the settings namespace and arm the vision pipeline. */
export function apply(ctx: Context): void {
  // Register the namespace in its own inject so a failure in the LLM/attachment
  // patching phase never tears down the settings scope that the UI needs.
  let scope: SettingsScope<VisionPluginSettings> | undefined
  ctx.inject(['settings'], (settingsCtx) => {
    scope = settingsCtx.settings.register(settingsNamespace(VISION_PLUGIN_NAMESPACE), VisionPluginSettingsSchema)
  })

  // Image pipeline: needs settings (for the registered scope), llm, and the
  // durable attachment reader. Wrapped in try/catch so the UI remains usable
  // and the error is logged even if the runtime surface changes shape.
  ctx.inject(['settings', 'llm', 'attachments'], (both) => {
    if (scope === undefined) return
    try {
      installImageGuardBypass(both, scope, both.llm)
      installImageTranscription(both, scope, both.llm)
    } catch (error: unknown) {
      const logger = both.logger ?? ctx.logger
      logger?.error('vision-plugin: failed to install image pipeline patches', error)
    }
  })

  // Expose the settings namespace to the web configuration boundary. The
  // api-proxy's settings.mutate/update/replace only serve namespaces that are
  // registered through registerConfigurableProviders or the explicit
  // WEB/PRODUCT allowlists. Without this registration the settings page can
  // read the namespace (describe) but every write is refused with
  // "settings-not-exposed", which surfaces as "保存失败，请重试".
  ctx.inject(['settings', 'llm'], (both) => {
    const handle = both.llm.registerConfigurableProviders([{
      provider: 'vision-plugin-settings',
      displayName: '识图模型配置',
      settingsNs: VISION_PLUGIN_NAMESPACE,
      settingsPath: [],
    }])
    both.effect(() => handle, 'vision-plugin: settings namespace exposure')
  })
}

export { VISION_PLUGIN_NAMESPACE }




