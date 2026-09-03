/**
 * Vision Plugin Tab — registered into `settings.plugins.tab` as a new tab
 * "Image Recognition" inside the Plugins settings section.
 *
 * Contains an interactive toggle switch to enable/disable image recognition.
 * Uses inline styles — no CSS module imports (avoids build complexity).
 */
import { type ReactNode } from 'react'
import type {
  HostObservable, InjectFace, PropsRuntime,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { VisionPluginKey } from './locales.ts'

/**
 * Injected business face. `hooks.enabled` carries the live enable state;
 * `hooks.saving` tracks whether a write is in flight; `hooks.failed` is
 * true when the last write failed; `onToggle` performs the write. Everything
 * inside `hooks` arrives as `use<Name>` hooks.
 */
export interface VisionPluginsTabInjected {
  hooks: {
    enabled: HostObservable<boolean>
    saving: HostObservable<boolean>
    failed: HostObservable<boolean>
    writable: HostObservable<boolean>
  }
  t: (key: VisionPluginKey) => string
  onToggle: () => void
}

/** Composed component props. */
export type VisionPluginsTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & InjectFace<VisionPluginsTabInjected>

/** Shared inline style objects. */
const styles = {
  tab: { padding: '8px 0' },
  card: {
    border: '1px solid var(--dsw-alias-border-l2)',
    borderRadius: '12px',
    background: 'var(--dsw-alias-bg-layer-3)',
    transition: 'border-color 0.16s, background 0.16s',
  },
  cardBody: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '14px 16px',
  },
  cardInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: '15px',
    fontWeight: 600,
    lineHeight: 1.4,
    color: 'var(--dsw-alias-label-primary)',
    margin: 0,
  },
  cardDesc: {
    fontSize: '13px',
    lineHeight: 1.5,
    color: 'var(--dsw-alias-label-tertiary)',
    margin: 0,
  },
  controls: { flex: 'none', display: 'flex', alignItems: 'center', gap: '8px' },
  failed: { fontSize: '12px', color: 'var(--dsw-alias-label-error)', lineHeight: 1.5 },
  toggle: { position: 'relative', display: 'inline-block', cursor: 'pointer' } as Record<string, string | number>,
  toggleInput: { position: 'absolute', opacity: 0, width: 0, height: 0 } as Record<string, string | number>,
  toggleTrack: {
    display: 'block',
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    background: 'var(--dsw-alias-bg-module-platform)',
    transition: 'background 0.2s',
    border: '1px solid var(--dsw-alias-border-l2)',
    position: 'relative',
  },
  toggleThumb: {
    position: 'absolute',
    top: '2px',
    left: '2px',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: 'white',
    transition: 'transform 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  },
  toggleTrackChecked: {
    display: 'block',
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    background: 'var(--dsw-alias-brand-primary)',
    transition: 'background 0.2s',
    border: '1px solid var(--dsw-alias-brand-primary)',
    position: 'relative',
  },
  toggleThumbChecked: {
    position: 'absolute',
    top: '2px',
    left: '2px',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: 'white',
    transition: 'transform 0.2s',
    transform: 'translateX(20px)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  },
}

/**
 * Render the "Image Recognition" tab in the Plugins settings section.
 * A toggle card with an interactive switch.
 */
export function VisionPluginsTab(props: VisionPluginsTabProps): ReactNode {
  const { t, useEnabled, useSaving, useFailed, useWritable, onToggle } = props
  const enabled = useEnabled(e => e)
  const saving = useSaving(s => s)
  const failed = useFailed(f => f)
  const writable = useWritable(w => w)

  const trackStyle = enabled ? styles.toggleTrackChecked : styles.toggleTrack
  const thumbStyle = enabled ? styles.toggleThumbChecked : styles.toggleThumb
  const disabled = saving || !writable
  const disabledStyle = disabled ? { ...styles.toggle, opacity: 0.5, cursor: 'default' } : styles.toggle

  return (
    <div style={styles.tab}>
      <div style={styles.card}>
        <div style={styles.cardBody}>
          <div style={styles.cardInfo}>
            <h3 style={styles.cardTitle}>{t('tab.label')}</h3>
            <p style={styles.cardDesc}>{t('tab.description')}</p>
          </div>
          <div style={styles.controls}>
            {failed ? <p style={styles.failed}>{t('saveFailed')}</p> : null}
            {!writable ? <p style={styles.failed}>{t('readOnly')}</p> : null}
            <label style={disabledStyle}>
              <input
                type="checkbox"
                style={styles.toggleInput}
                checked={enabled}
                disabled={disabled}
                onChange={onToggle}
              />
              <span style={trackStyle}>
                <span style={thumbStyle} />
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}