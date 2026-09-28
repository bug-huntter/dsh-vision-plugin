/**
 * Vision plugin browser half.
 *
 * DSH 0.1.2-alpha removed `@deepseek-ai/dsh-client-runtime` and the
 * `settingsNamespace` helper; DSH 0.1.7-rc.2 removed the `settingsScope`
 * service and forbids nested `ctx.inject()` on dynamic client halves. This
 * half therefore keeps its own tiny store and binds its settings form through
 * the `configForms` service (`ctx.configForms.get(ns)` — the per-namespace
 * `ConfigFormController`), declaring every dependency at the top level.
 */
import { VISION_PLUGIN_NAMESPACE } from '../constants.ts'
import type { VisionPluginSettings } from '../index.ts'
import { normalizeKeyFormat } from '../authHeaders.ts'
import { commitOps, draftValue, type SettingsPathOp } from './commitSettings.ts'
import { testVisionConnection, type TestOutcome, type TestValues } from './testConnection.ts'
import {
  VisionModelsSection,
  type VisionModelsSectionInjected,
  type VisionModelsSectionState,
} from './VisionModelsSection.tsx'
import { en, zh, type VisionPluginKey } from './locales.ts'

const NS = 'vision-plugin'

type ScopeStatus = 'loading' | 'ready' | 'unavailable'

/**
 * The client settings-form snapshot (structural subset of
 * `ConfigFormController.getSnapshot()`): status / merged value / writability /
 * revision fence — the same shape the pre-0.1.7 `settingsScope` exposed.
 */
interface SettingsScopeSnapshot<T> {
  status: ScopeStatus
  value: T | undefined
  writable: boolean
  revision?: number | undefined
}

/**
 * The bound settings form handle (structural subset of
 * `ConfigFormController`): observable snapshot plus the atomic-mutation write
 * faces. `mutate` settles a REFUSED write normally (it re-reads Host state),
 * and `set` is the per-field face on the same controller.
 */
interface VisionSettingsScope<T> {
  getSnapshot(): SettingsScopeSnapshot<T>
  subscribe(listener: () => void): () => void
  /** One atomic namespace mutation; every op shares a single revision fence. */
  mutate(ops: readonly SettingsPathOp[], expectedRevision?: number): Promise<boolean>
  /** One field write (the per-field face; kept for older builds). */
  set(field: string, value: unknown): Promise<boolean>
}

/** Minimal observable used by the injected section component. */
interface Observable<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

type Store<T> = Observable<T> & { set(next: T): void }

function createStore<T>(initial: T): Store<T> {
  let snapshot = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    set(next: T): void {
      snapshot = next
      for (const listener of [...listeners]) listener()
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

interface LocaleService {
  register(namespace: string, dicts: { zh: Record<string, string>; en: Record<string, string> }): unknown
  bind(namespace: string): (key: string) => string
}

interface SlotsService {
  inject(slot: string, register: () => unknown): void
  register(meta: Record<string, unknown>, component: unknown): unknown
}

interface ConfigFormsService {
  /**
   * Bind the shared settings form of one Host plugin entry. The namespace is
   * the profile entry id (`vision-plugin`), which is also what the host
   * exposure (`settingsNs`) and this module's schema export address.
   */
  get(namespace: string): VisionSettingsScope<unknown>
}

interface ClientContext {
  effect(callback: () => unknown, label?: string): void
  locale: LocaleService
  slots: SlotsService
  configForms: ConfigFormsService
}

/** Local drafts for the section editor. */
interface DraftEntry {
  text: string
  dirty: boolean
}

/** Build a snapshot from the scope snapshot and local drafts. */
function buildState(
  scopeSnapshot: SettingsScopeSnapshot<VisionPluginSettings>,
  drafts: Map<string, DraftEntry>,
  saving: boolean,
  failed: boolean,
  testing: boolean,
  testResult: TestOutcome | null,
): VisionModelsSectionState {
  const value = scopeSnapshot.value
  const enabledDraft = drafts.get('enabled')
  const baseUrlDraft = drafts.get('baseUrl')
  const modelIdDraft = drafts.get('modelId')
  const fallbackModelIdDraft = drafts.get('fallbackModelId')
  const maxRetriesDraft = drafts.get('maxRetries')
  const apiKeyDraft = drafts.get('apiKey')
  const keyFormatDraft = drafts.get('keyFormat')

  return {
    status: scopeSnapshot.status,
    writable: scopeSnapshot.writable,
    enabled: enabledDraft !== undefined ? enabledDraft.text === 'true' : (value?.enabled ?? false),
    baseUrl: baseUrlDraft?.text ?? value?.baseUrl ?? '',
    modelId: modelIdDraft?.text ?? value?.modelId ?? '',
    fallbackModelId: fallbackModelIdDraft?.text ?? value?.fallbackModelId ?? '',
    maxRetries: maxRetriesDraft?.text ?? String(value?.maxRetries ?? 3),
    apiKey: apiKeyDraft?.text ?? value?.apiKey ?? '',
    keyFormat: normalizeKeyFormat(keyFormatDraft?.text ?? value?.keyFormat),
    dirty: Array.from(drafts.values()).some(d => d.dirty),
    saving,
    failed,
    testing,
    testResult,
  }
}

/**
 * Required services (cordis fiber inject). `configForms` is provided by
 * dsh-client-ui-settings and replaces the removed `settingsScope` binder.
 */
export const inject = ['slots', 'locale', 'configForms']

/**
 * Register the dictionaries and the settings section, bound to the shared
 * config form of the plugin's profile entry.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(
    () => ctx.locale.register(NS, { zh, en } as { zh: Record<string, string>; en: Record<string, string> }),
    'vision-plugin: dictionaries',
  )

  const t = ctx.locale.bind(NS) as (key: VisionPluginKey) => string
  const scope = ctx.configForms.get<unknown>(VISION_PLUGIN_NAMESPACE) as unknown as VisionSettingsScope<VisionPluginSettings>
  const drafts = new Map<string, DraftEntry>()
  let saving = false
  let failed = false
  let testing = false
  let testResult: TestOutcome | null = null
  const store = createStore(buildState(scope.getSnapshot(), drafts, saving, failed, testing, testResult))
  const publish = (): void => {
    store.set(buildState(scope.getSnapshot(), drafts, saving, failed, testing, testResult))
  }
  const unsubscribeScope = scope.subscribe(publish)
  ctx.effect(() => () => unsubscribeScope(), 'vision-plugin: settings snapshot')

  /** Current effective values: draft overrides on top of the saved snapshot. */
  const draftValues = (): TestValues => {
    const value = scope.getSnapshot().value
    return {
      baseUrl: drafts.get('baseUrl')?.text ?? value?.baseUrl ?? '',
      modelId: drafts.get('modelId')?.text ?? value?.modelId ?? '',
      apiKey: drafts.get('apiKey')?.text ?? value?.apiKey ?? '',
      keyFormat: normalizeKeyFormat(drafts.get('keyFormat')?.text ?? value?.keyFormat),
    }
  }

  const edit = (field: string, text: string): void => {
    drafts.set(field, { text, dirty: true })
    failed = false
    publish()
  }

  const discard = (): void => {
    drafts.clear()
    failed = false
    publish()
  }

  /** Probe the vision endpoint with the current draft values (no persistence). */
  const test = async (): Promise<void> => {
    if (testing || saving) return
    testing = true
    testResult = null
    publish()
    try {
      testResult = await testVisionConnection(draftValues())
    } finally {
      testing = false
      publish()
    }
  }

  const save = async (): Promise<void> => {
    if (saving || !Array.from(drafts.values()).some(d => d.dirty)) return
    // Connectivity / image-support gate: run the probe against the current
    // drafts first. Hard configuration errors (bad base URL/model/key,
    // unsupported image input) block the save; transient (429/5xx/timeout)
    // and unverifiable (server-side key / CORS) outcomes warn but allow it.
    // Skipped entirely when the plugin ends up disabled.
    const willEnable = drafts.get('enabled') !== undefined
      ? drafts.get('enabled')!.text === 'true'
      : (scope.getSnapshot().value?.enabled ?? false)
    if (willEnable) {
      testing = true
      testResult = null
      publish()
      const outcome = await testVisionConnection(draftValues())
      testing = false
      testResult = outcome
      publish()
      if (!outcome.canSave) return
    }
    saving = true
    failed = false
    publish()
    try {
      // One atomic mutation: every dirty field shares a single revision fence,
      // so the section can never half-save. The drafts are cleared only after
      // the Host section verifiably carries the edits — a REFUSED write
      // settles without throwing (the form re-reads Host state instead), and
      // clearing on a refusal would throw the user's input away while showing
      // them nothing at all.
      const ops: SettingsPathOp[] = []
      for (const [field, draft] of drafts) {
        if (!draft.dirty) continue
        ops.push({ op: 'set', path: [field], value: draftValue(field, draft.text) })
      }
      const outcome = await commitOps(scope, ops)
      if (!outcome.ok) {
        failed = true
        console.error('vision-plugin: settings write did not land; drafts kept for the user to retry', {
          ops,
          outcome,
          revision: scope.getSnapshot().revision,
        })
        return
      }
      drafts.clear()
    } catch (error: unknown) {
      failed = true
      console.error('vision-plugin: failed to save section', error)
    } finally {
      saving = false
      publish()
    }
  }

  const sectionInjected = (): VisionModelsSectionInjected => ({
    store,
    t,
    edit,
    discard,
    save,
    test,
  })

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'vision-models',
    order: 60,
    label: () => t('section.nav'),
    inject: sectionInjected,
  }, VisionModelsSection))
}

export type { VisionPluginKey }