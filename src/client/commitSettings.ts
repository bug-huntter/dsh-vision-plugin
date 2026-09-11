/**
 * Settings write path for the 识图模型配置 section.
 *
 * The DSH client settings contract settles a REFUSED write normally: when the
 * Host rejects a mutation (a stale revision fence, a schema refusal, ...) the
 * bound scope re-reads Host state and resolves *without throwing* — see
 * `SettingsScope.mutate` in `@deepseek-ai/dsh-client-ui-settings`
 * ("a rejected or failed latest write reloads Host state instead").
 *
 * A caller that only guards with try/catch therefore cannot tell a saved
 * section from a discarded one. This section used to clear its drafts either
 * way, so a refused write wiped the user's input, reverted every field to the
 * stored values, and disabled the 保存 button (nothing dirty) while showing no
 * error at all — exactly the reported "填完测试是绿的，然后保存不了".
 *
 * This module makes the outcome decidable: plan the edits, send them as ONE
 * atomic mutation (so all fields share a single revision fence and a partial
 * save is impossible), then verify the Host-resolved section actually carries
 * them — retrying once, because a refused attempt's recovery read has already
 * refreshed the revision fence that caused it.
 */

/** One path-addressed edit in the shape the settings wire accepts. */
export interface SettingsPathOp {
  op: 'set' | 'unset'
  path: readonly string[]
  value?: unknown
}

/**
 * Structural subset of the bound client settings scope this module needs.
 *
 * `mutate` is the current contract (one atomic namespace mutation sharing a
 * single revision fence). `set` is the older per-field face, kept as a fallback
 * so the section still writes on DSH builds whose scope predates `mutate` — the
 * outcome is reported by verification either way, never by an exception.
 */
export interface SettingsWriteScope<T> {
  mutate?(ops: readonly SettingsPathOp[], expectedRevision?: number): Promise<void>
  set?(field: string, value: unknown): Promise<void>
  getSnapshot(): SettingsWriteSnapshot<T>
}

/** Structural subset of the scope snapshot this module needs. */
export interface SettingsWriteSnapshot<T> {
  status: 'loading' | 'ready' | 'unavailable'
  value: T | undefined
  revision?: number | undefined
}

/** Outcome of one committed write, for the caller's error surface. */
export interface CommitOutcome {
  /** True only when the Host section verifiably carries every planned edit. */
  ok: boolean
  /** Atomic mutations sent: 0 for an empty plan, 1, or 2 after the retry. */
  attempts: number
  /** False when the last snapshot could not answer (loading / no section). */
  verified: boolean
}

/**
 * Coerce one draft's raw input into the JSON shape the namespace schema
 * expects. The section edits everything as text, so the boolean and numeric
 * fields are converted here rather than at each call site.
 * @param field - namespace field being edited.
 * @param text - raw input value.
 * @returns the value to store.
 */
export function draftValue(field: string, text: string): unknown {
  if (field === 'enabled') return text === 'true'
  if (field === 'maxRetries') {
    const parsed = Number(text)
    // An emptied numeric field falls back to the schema default instead of NaN.
    return text.trim() === '' || Number.isNaN(parsed) ? 3 : parsed
  }
  return text
}

/** JSON-shaped deep equality, used to compare stored values with intent. */
function jsonEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (typeof left !== 'object' || typeof right !== 'object' || left === null || right === null) return false
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((item, index) => jsonEqual(item, right[index]))
  }
  const a = left as Record<string, unknown>
  const b = right as Record<string, unknown>
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every(key => jsonEqual(a[key], b[key]))
}

/**
 * Whether every planned edit is visible in the Host-resolved section.
 * @param snapshot - current scope snapshot.
 * @param ops - the edits just sent.
 * @returns true when all landed, false when the section contradicts them, and
 *   undefined when it cannot answer (not ready / no section accepted yet).
 */
export function hasLanded<T>(
  snapshot: SettingsWriteSnapshot<T>,
  ops: readonly SettingsPathOp[],
): boolean | undefined {
  if (snapshot.status !== 'ready' || snapshot.value === undefined) return undefined
  const section = snapshot.value as Record<string, unknown>
  return ops.every(op => jsonEqual(section[op.path[0] ?? ''], op.value))
}

/**
 * Send the plan on whichever write face the bound scope exposes.
 * @param scope - bound settings scope for the namespace.
 * @param ops - ordered edits.
 */
async function writeOps<T>(scope: SettingsWriteScope<T>, ops: readonly SettingsPathOp[]): Promise<void> {
  if (typeof scope.mutate === 'function') {
    await scope.mutate(ops)
    return
  }
  if (typeof scope.set === 'function') {
    for (const op of ops) await scope.set(op.path[0] ?? '', op.value)
    return
  }
  throw new Error('vision-plugin: the bound settings scope exposes neither mutate() nor set()')
}

/**
 * Write the plan, then confirm it landed.
 *
 * A refused mutation resolves normally, so the verification read — not an
 * exception — is what reports failure. The retry exists because the dominant
 * refusal is a stale revision fence, which the refused attempt's own recovery
 * read refreshes; a second refusal is reported so the caller can keep the
 * user's drafts and say so instead of silently discarding them.
 * @param scope - bound settings scope for the namespace.
 * @param ops - ordered edits; a later op observes an earlier one.
 * @returns whether the section carries the edits, and how many attempts it took.
 */
export async function commitOps<T>(
  scope: SettingsWriteScope<T>,
  ops: readonly SettingsPathOp[],
): Promise<CommitOutcome> {
  if (ops.length === 0) return { ok: true, attempts: 0, verified: true }
  await writeOps(scope, ops)
  if (hasLanded(scope.getSnapshot(), ops) === true) return { ok: true, attempts: 1, verified: true }
  await writeOps(scope, ops)
  const verified = hasLanded(scope.getSnapshot(), ops)
  return { ok: verified === true, attempts: 2, verified: verified !== undefined }
}
