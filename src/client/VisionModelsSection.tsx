/**
 * Vision Model Configuration section — a settings page where users configure
 * the base_url, model_id, and api_key for the vision model.
 *
 * Uses inline styles only (no CSS module imports) to avoid build complexity
 * with esbuild / standalone bundling.
 */
import { useId, useSyncExternalStore, type ReactNode } from 'react'
import type { VisionPluginKey } from './locales.ts'

/** The projected state the section renders from. */
export interface VisionModelsSectionState {
  status: 'loading' | 'ready' | 'unavailable'
  writable: boolean
  enabled: boolean
  baseUrl: string
  modelId: string
  apiKey: string
  apiKeyEnv: string
  dirty: boolean
  saving: boolean
  failed: boolean
}

/** Injected business face: the section's own observable store plus actions. */
export interface VisionModelsSectionInjected {
  store: {
    getSnapshot(): VisionModelsSectionState
    subscribe(listener: () => void): () => void
  }
  t: (key: VisionPluginKey) => string
  edit: (field: string, text: string) => void
  discard: () => void
  save: () => void
}

/** Composed component props. */
export type VisionModelsSectionProps = VisionModelsSectionInjected

/** Shared inline style objects. */
const s = {
  section: { padding: '24px 0' },
  heading: { fontSize: '18px', fontWeight: 600, lineHeight: 1.4, color: 'var(--dsw-alias-label-primary)', margin: '0 0 8px' },
  intro: { fontSize: '13px', lineHeight: 1.5, color: 'var(--dsw-alias-label-tertiary)', margin: '0 0 24px' },
  toggleRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
    padding: '12px 0', borderBottom: '1px solid var(--dsw-alias-border-l2)', marginBottom: '24px',
  },
  toggleInfo: { display: 'flex', flexDirection: 'column', gap: '4px' },
  toggleLabel: { fontSize: '15px', fontWeight: 600, lineHeight: 1.4, color: 'var(--dsw-alias-label-primary)' },
  toggleDesc: { fontSize: '13px', lineHeight: 1.5, color: 'var(--dsw-alias-label-tertiary)' },
  toggle: { position: 'relative', display: 'inline-block', flex: 'none', cursor: 'pointer' } as Record<string, string | number>,
  toggleInput: { position: 'absolute', opacity: 0, width: 0, height: 0 } as Record<string, string | number>,
  toggleTrack: {
    display: 'block', width: '44px', height: '24px', borderRadius: '12px',
    background: 'var(--dsw-alias-bg-module-platform)', transition: 'background 0.2s',
    border: '1px solid var(--dsw-alias-border-l2)', position: 'relative',
  },
  toggleThumb: {
    position: 'absolute', top: '2px', left: '2px', width: '18px', height: '18px',
    borderRadius: '50%', background: 'white', transition: 'transform 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  },
  toggleTrackChecked: {
    display: 'block', width: '44px', height: '24px', borderRadius: '12px',
    background: 'var(--dsw-alias-brand-primary)', transition: 'background 0.2s',
    border: '1px solid var(--dsw-alias-brand-primary)', position: 'relative',
  },
  toggleThumbChecked: {
    position: 'absolute', top: '2px', left: '2px', width: '18px', height: '18px',
    borderRadius: '50%', background: 'white', transition: 'transform 0.2s',
    transform: 'translateX(20px)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  },
  field: { marginBottom: '20px' },
  label: {
    display: 'block', fontSize: '14px', fontWeight: 500, lineHeight: 1.5,
    color: 'var(--dsw-alias-label-primary)', marginBottom: '6px',
  },
  input: {
    width: '100%', boxSizing: 'border-box', border: '1px solid var(--dsw-alias-border-l2)',
    borderRadius: '8px', padding: '8px 12px', font: 'inherit', fontSize: '14px',
    lineHeight: 1.5, color: 'var(--dsw-alias-label-primary)',
    background: 'var(--dsw-alias-bg-layer-3)', transition: 'border-color 0.16s', outline: 'none',
  },
  hint: { margin: '4px 0 0', fontSize: '12px', lineHeight: 1.5, color: 'var(--dsw-alias-label-tertiary)' },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px',
    paddingTop: '16px', borderTop: '1px solid var(--dsw-alias-border-l2)', marginTop: '8px',
  },
  failed: { flex: 1, minWidth: 0, margin: 0, fontSize: '12px', lineHeight: 1.5, color: 'var(--dsw-alias-label-error)' },
  disabled: { opacity: 0.4, cursor: 'default' } as Record<string, string | number>,
}

function btn(base: Record<string, string | number>, disabled: boolean): Record<string, string | number> {
  return disabled ? { ...base, ...s.disabled } : base
}

/**
 * Render the vision model configuration page content column.
 */
export function VisionModelsSection(props: VisionModelsSectionProps): ReactNode {
  const { store, t, edit, discard, save } = props
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const fieldId = useId()

  if (state.status !== 'ready') {
    return (
      <div style={s.section}>
        <p style={s.hint}>{t(state.status === 'loading' ? 'loading' : 'unavailable')}</p>
      </div>
    )
  }

  const dis = !state.writable || state.saving
  const trackSt = state.enabled ? s.toggleTrackChecked : s.toggleTrack
  const thumbSt = state.enabled ? s.toggleThumbChecked : s.toggleThumb
  const inputEnabled = { ...s.input, opacity: dis ? 0.5 : 1, cursor: dis ? 'default' : 'text' }

  return (
    <div style={s.section}>
      <h2 style={s.heading}>{t('section.title')}</h2>
      <p style={s.intro}>{t('section.description')}</p>

      {/* Enable toggle */}
      <div style={s.toggleRow}>
        <div style={s.toggleInfo}>
          <span style={s.toggleLabel}>{t('enabled.label')}</span>
          <span style={s.toggleDesc}>{t('enabled.description')}</span>
        </div>
        <label style={s.toggle}>
          <input
            type="checkbox" style={s.toggleInput}
            checked={state.enabled}
            disabled={!state.writable}
            onChange={(e) => { edit('enabled', e.target.checked ? 'true' : 'false') }}
          />
          <span style={trackSt}><span style={thumbSt} /></span>
        </label>
      </div>

      {/* Base URL */}
      <div style={s.field}>
        <label style={s.label} htmlFor={`${fieldId}-bu`}>{t('model.baseUrl')}</label>
        <input id={`${fieldId}-bu`} style={inputEnabled} type="text"
          value={state.baseUrl} placeholder={t('model.baseUrl.placeholder')}
          disabled={!state.writable}
          onChange={(e) => { edit('baseUrl', e.target.value) }} />
        <p style={s.hint}>{t('model.baseUrl.description')}</p>
      </div>

      {/* Model ID */}
      <div style={s.field}>
        <label style={s.label} htmlFor={`${fieldId}-mi`}>{t('model.modelId')}</label>
        <input id={`${fieldId}-mi`} style={inputEnabled} type="text"
          value={state.modelId} placeholder={t('model.modelId.placeholder')}
          disabled={!state.writable}
          onChange={(e) => { edit('modelId', e.target.value) }} />
        <p style={s.hint}>{t('model.modelId.description')}</p>
      </div>

      {/* API Key source (env / credential reference) */}
      <div style={s.field}>
        <label style={s.label} htmlFor={`${fieldId}-ake`}>{t('model.apiKeyEnv')}</label>
        <input id={`${fieldId}-ake`} style={inputEnabled} type="text"
          value={state.apiKeyEnv} placeholder={t('model.apiKeyEnv.placeholder')}
          disabled={!state.writable}
          onChange={(e) => { edit('apiKeyEnv', e.target.value) }} />
        <p style={s.hint}>{t('model.apiKeyEnv.description')}</p>
      </div>

      {/* API Key */}
      <div style={s.field}>
        <label style={s.label} htmlFor={`${fieldId}-ak`}>{t('model.apiKey')}</label>
        <input id={`${fieldId}-ak`} style={inputEnabled} type="password" autoComplete="off"
          value={state.apiKey} placeholder={t('model.apiKey.placeholder')}
          disabled={!state.writable}
          onChange={(e) => { edit('apiKey', e.target.value) }} />
        <p style={s.hint}>{t('model.apiKey.description')}</p>
      </div>

      {/* Actions */}
      <div style={s.footer}>
        {state.failed ? <p style={s.failed} role="status">{t('saveFailed')}</p> : null}
        <button type="button" style={btn(s.discardBtn, !state.dirty || state.saving)}
          disabled={!state.dirty || state.saving} onClick={discard}>
          {t('discard')}
        </button>
        <button type="button" style={btn(s.saveBtn, !state.dirty || state.saving)}
          disabled={!state.dirty || state.saving} onClick={save}>
          {t(state.saving ? 'saving' : 'save')}
        </button>
      </div>
    </div>
  )
}

// Button styles (defined after the component for readability)
s.discardBtn = {
  appearance: 'none', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: '8px',
  padding: '5px 14px', font: 'inherit', fontSize: '13px', lineHeight: 1.5, cursor: 'pointer',
  background: 'none', color: 'var(--dsw-alias-label-secondary)',
}
s.saveBtn = {
  appearance: 'none', border: '1px solid transparent', borderRadius: '8px',
  padding: '5px 14px', font: 'inherit', fontSize: '13px', lineHeight: 1.5, cursor: 'pointer',
  background: 'var(--dsw-alias-label-primary)', color: 'var(--dsw-alias-bg-layer-3)',
}
