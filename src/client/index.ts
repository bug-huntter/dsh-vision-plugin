/**
 * Vision Plugin browser half: registers the "Image Recognition" plugins tab
 * (with an interactive toggle) and the "Vision Model Config" settings section
 * (with full model parameter configuration).
 *
 * Settings scope lifecycle (load + invalidation) is handled by
 * ctx.settingsScope.bind(), which wires connection/reset and
 * settings/document-updated listeners, initial load, and disposal.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the settings slot declarations and the locale plugin's
// Context merge (ctx.locale) into this program.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { VISION_PLUGIN_NAMESPACE } from '../constants.ts'
import type { VisionPluginSettings } from '../index.ts'
import { VisionPluginsTab, type VisionPluginsTabInjected } from './VisionPluginsTab.tsx'
import {
  VisionModelsSection,
  type VisionModelsSectionInjected,
  type VisionModelsSectionState,
} from './VisionModelsSection.tsx'
import { en, zh, type VisionPluginKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Vision plugin's settings surfaces copy. */
    'vision-plugin': VisionPluginKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'vision-plugin'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']

/** Local drafts for the section editor. */
interface DraftEntry {
  text: string
  dirty: boolean
}

/** Build a snapshot from the scope snapshot and local drafts. */
function buildState(
  scopeSnapshot: ReturnType<SettingsScope<VisionPluginSettings>['getSnapshot']>,
  drafts: Map<string, DraftEntry>,
  saving: boolean,
  failed: boolean,
): VisionModelsSectionState {
  const value = scopeSnapshot.value as VisionPluginSettings | undefined
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

/**
 * Register the dictionaries, the plugins tab, and the settings section.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'vision-plugin: dictionaries')

  const t = ctx.locale.bind(NS) as (key: VisionPluginKey) => string

  // --- Settings scope (bound via ctx.settingsScope for lifecycle integration) ---
  const scope = ctx.settingsScope.bind<VisionPluginSettings>({ namespace: VISION_PLUGIN_NAMESPACE })

  const drafts = new Map<string, DraftEntry>()
  let saving = false
  let failed = false

  // Projection store (composes scope snapshot + local draft state into a single observable)
  const publishSnapshot = (): VisionModelsSectionState =>
    buildState(scope.getSnapshot(), drafts, saving, failed)
  const store = createSnapshotStore(publishSnapshot())
  const publish = (): void => { store.set(publishSnapshot()) }
  scope.subscribe(() => { publish() })

  // --- Section actions ---
  const editSection = (field: string, text: string): void => {
    drafts.set(field, { text, dirty: true })
    failed = false
    publish()
  }

  const discardSection = (): void => {
    drafts.clear()
    failed = false
    publish()
  }

  const saveSection = async (): Promise<void> => {
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
      await scope.load()
      drafts.clear()
    } catch (error: unknown) {
      failed = true
      // eslint-disable-next-line no-console
      console.error('vision-plugin: failed to save section', error)
    } finally {
      saving = false
      publish()
    }
  }

  // --- Tab toggle ---
  const onToggle = (): void => {
    const snapshot = publishSnapshot()
    if (snapshot.saving || !snapshot.writable) return
    const current = snapshot.enabled
    saving = true
    failed = false
    publish()
    scope.set('enabled', !current)
      .then(() => scope.load())
      .catch((error: unknown) => {
        failed = true
        // eslint-disable-next-line no-console
        console.error('vision-plugin: failed to toggle enabled state', error)
      })
      .finally(() => {
        saving = false
        publish()
      })
  }

  // --- Section inject face ---
  const sectionInjected = (): VisionModelsSectionInjected => ({
    hooks: {
      settings: {
        getSnapshot: () => store.getSnapshot(),
        subscribe: (listener) => store.subscribe(listener),
      },
    },
    t,
    edit: editSection,
    discard: discardSection,
    save: saveSection,
  })

  // --- Tab inject face ---
  const tabInjected = (): VisionPluginsTabInjected => ({
    hooks: {
      enabled: {
        getSnapshot: () => store.getSnapshot().enabled,
        subscribe: (listener) => store.subscribe(listener),
      },
      saving: {
        getSnapshot: () => store.getSnapshot().saving,
        subscribe: (listener) => store.subscribe(listener),
      },
      failed: {
        getSnapshot: () => store.getSnapshot().failed,
        subscribe: (listener) => store.subscribe(listener),
      },
      writable: {
        getSnapshot: () => store.getSnapshot().writable,
        subscribe: (listener) => store.subscribe(listener),
      },
    },
    t,
    onToggle,
  })

  // --- Register tab ---
  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'vision-plugin',
    order: 100,
    label: () => t('tab.label'),
    inject: tabInjected,
  }, VisionPluginsTab))

  // --- Register section ---
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'vision-models',
    order: 60,
    label: () => t('section.nav'),
    inject: sectionInjected,
  }, VisionModelsSection))
}

export type { VisionPluginKey }