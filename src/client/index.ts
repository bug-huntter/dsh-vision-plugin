/**
 * Vision plugin browser half.
 *
 * DSH 0.1.2-alpha removed `@deepseek-ai/dsh-client-runtime` and the
 * `settingsNamespace` helper. This half therefore keeps its own tiny store
 * and talks only to services current web shells provide (`locale`, `slots`,
 * and the `settingsScope` binder exposed by dsh-client-ui-settings).
 */
import { VISION_PLUGIN_NAMESPACE } from '../constants.ts'
import type { VisionPluginSettings } from '../index.ts'
import {
  VisionModelsSection,
  type VisionModelsSectionInjected,
  type VisionModelsSectionState,
} from './VisionModelsSection.tsx'
import { en, zh, type VisionPluginKey } from './locales.ts'

const NS = 'vision-plugin'

type ScopeStatus = 'loading' | 'ready' | 'unavailable'

/** The current client settings-scope snapshot (structural subset). */
interface SettingsScopeSnapshot<T> {
  status: ScopeStatus
  value: T | undefined
  writable: boolean
}

/** The current `ctx.settingsScope.bind()` owner handle (structural subset). */
interface VisionSettingsScope<T> {
  getSnapshot(): SettingsScopeSnapshot<T>
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<void>
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

interface ClientContext {
  effect(callback: () => unknown, label?: string): void
  locale: LocaleService
  slots: SlotsService
}

interface ScopeAwareContext extends ClientContext {
  settingsScope: {
    bind<T>(spec: { namespace: string }): VisionSettingsScope<T>
  }
}

interface InjectingClientContext extends ClientContext {
  inject(services: readonly string[], callback: (scoped: ScopeAwareContext) => void): void
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
): VisionModelsSectionState {
  const value = scopeSnapshot.value
  const enabledDraft = drafts.get('enabled')
  const baseUrlDraft = drafts.get('baseUrl')
  const modelIdDraft = drafts.get('modelId')
  const apiKeyDraft = drafts.get('apiKey')
  const apiKeyEnvDraft = drafts.get('apiKeyEnv')

  return {
    status: scopeSnapshot.status,
    writable: scopeSnapshot.writable,
    enabled: enabledDraft !== undefined ? enabledDraft.text === 'true' : (value?.enabled ?? false),
    baseUrl: baseUrlDraft?.text ?? value?.baseUrl ?? '',
    modelId: modelIdDraft?.text ?? value?.modelId ?? '',
    apiKey: apiKeyDraft?.text ?? value?.apiKey ?? '',
    apiKeyEnv: apiKeyEnvDraft?.text ?? value?.apiKeyEnv ?? '',
    dirty: Array.from(drafts.values()).some(d => d.dirty),
    saving,
    failed,
  }
}

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale']

/**
 * Register the dictionaries and the settings section. The scope is bound on
 * a nested inject so a shell without `settingsScope` simply skips the page
 * instead of blocking the whole plugin.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(
    () => ctx.locale.register(NS, { zh, en } as { zh: Record<string, string>; en: Record<string, string> }),
    'vision-plugin: dictionaries',
  )

  const t = ctx.locale.bind(NS) as (key: VisionPluginKey) => string
  const withInject = ctx as unknown as InjectingClientContext

  withInject.inject(['settingsScope'], (scoped) => {
    const scope = scoped.settingsScope.bind<VisionPluginSettings>({ namespace: VISION_PLUGIN_NAMESPACE })
    const drafts = new Map<string, DraftEntry>()
    let saving = false
    let failed = false
    const store = createStore(buildState(scope.getSnapshot(), drafts, saving, failed))
    const publish = (): void => {
      store.set(buildState(scope.getSnapshot(), drafts, saving, failed))
    }
    const unsubscribeScope = scope.subscribe(publish)
    ctx.effect(() => () => unsubscribeScope(), 'vision-plugin: settings snapshot')

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

    const save = async (): Promise<void> => {
      if (saving || !Array.from(drafts.values()).some(d => d.dirty)) return
      saving = true
      failed = false
      publish()
      try {
        for (const [field, draft] of drafts) {
          if (!draft.dirty) continue
          if (field === 'enabled') {
            await scope.set('enabled', draft.text === 'true')
          } else {
            await scope.set(field, draft.text)
          }
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
    })

    scoped.slots.inject('settings.section', () => scoped.slots.register({
      name: 'settings.section',
      id: 'vision-models',
      order: 60,
      label: () => t('section.nav'),
      inject: sectionInjected,
    }, VisionModelsSection))
  })
}

export type { VisionPluginKey }
