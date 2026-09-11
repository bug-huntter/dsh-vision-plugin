/**
 * Regression test for the 识图模型配置 save path.
 *
 * The bug this locks down: DSH's client settings contract settles a REFUSED
 * write normally — the bound scope re-reads Host state and resolves without
 * throwing. The section used to `await scope.set(...)` inside a try/catch and
 * then unconditionally `drafts.clear()`, so a refusal (in practice a stale
 * revision fence: `settings/conflict`) did all of this at once:
 *   • showed no error, because nothing threw;
 *   • reverted every field to the stored value;
 *   • disabled the 保存 button, because no draft was dirty any more.
 * The user saw "test is green, then it just cannot save".
 *
 * Usage: node test/commit-settings.test.mjs
 */
import * as esbuild from 'esbuild'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const bundled = await esbuild.build({
  stdin: {
    contents: "export { commitOps, draftValue, hasLanded } from './src/client/commitSettings.ts'\n",
    resolveDir: root,
    sourcefile: 'commit-settings-test-entry.ts',
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'es2022',
  write: false,
})

const { commitOps, draftValue, hasLanded } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
)

/**
 * A fake bound settings scope.
 *
 * `verdicts` mirrors the Host per attempt: an attempt the Host refuses is NOT
 * an exception — it settles normally after a recovery read that refreshes the
 * revision fence, which is what makes the retry inside commitOps able to win.
 * `null` means every attempt is accepted.
 */
function fakeScope({ stored, revision = 1, verdicts = null, apply = true }) {
  const state = { stored: { ...stored }, revision }
  const calls = []
  return {
    state,
    calls,
    async mutate(ops) {
      calls.push({ ops: JSON.parse(JSON.stringify(ops)), revision: state.revision })
      const accepted = verdicts === null ? true : (verdicts[calls.length - 1] ?? false)
      if (!accepted) return // refused: settles without throwing
      state.revision += 1
      if (!apply) return // accepted by the fence but never stored (pathological)
      for (const op of ops) state.stored[op.path[0]] = op.value
    },
    getSnapshot: () => ({ status: 'ready', value: { ...state.stored }, revision: state.revision }),
  }
}

const plan = [
  { op: 'set', path: ['apiKey'], value: 'sk-or-v1-typed' },
  { op: 'set', path: ['modelId'], value: 'deepseek/deepseek-v4.1-flash' },
]

const cases = [
  {
    name: 'a landed write reports success on the first attempt',
    run: async () => {
      const scope = fakeScope({ stored: { apiKey: '', modelId: '' } })
      return { outcome: await commitOps(scope, plan), calls: scope.calls.length }
    },
    expected: { outcome: { ok: true, attempts: 1, verified: true }, calls: 1 },
  },
  {
    name: 'the reported bug: a refused first write is retried and then lands',
    // The page holds a stale revision, the first attempt conflicts, the
    // recovery read refreshes the fence, the retry wins — so the user's edit is
    // saved instead of being discarded with no error.
    run: async () => {
      const scope = fakeScope({ stored: { apiKey: '', modelId: '' }, verdicts: [false, true] })
      return { outcome: await commitOps(scope, plan), stored: scope.state.stored, calls: scope.calls.length }
    },
    expected: {
      outcome: { ok: true, attempts: 2, verified: true },
      stored: { apiKey: 'sk-or-v1-typed', modelId: 'deepseek/deepseek-v4.1-flash' },
      calls: 2,
    },
  },
  {
    name: 'a permanently refused write is REPORTED, not silently swallowed',
    run: async () => {
      const scope = fakeScope({ stored: { apiKey: 'old', modelId: 'old' }, verdicts: [false, false] })
      const outcome = await commitOps(scope, plan)
      return { outcome, stored: scope.state.stored, calls: scope.calls.length }
    },
    expected: {
      outcome: { ok: false, attempts: 2, verified: true },
      stored: { apiKey: 'old', modelId: 'old' },
      calls: 2,
    },
  },
  {
    name: 'a partial landing is not success (every planned edit must be visible)',
    run: () => commitOps(fakeScope({ stored: { apiKey: '', modelId: '' }, apply: false }), plan),
    expected: { ok: false, attempts: 2, verified: true },
  },
  {
    name: 'an unreadable snapshot is reported as unverified, not as success',
    run: () => {
      const scope = fakeScope({ stored: {}, verdicts: [false, false] })
      scope.getSnapshot = () => ({ status: 'loading', value: undefined, revision: undefined })
      return commitOps(scope, plan)
    },
    expected: { ok: false, attempts: 2, verified: false },
  },
  {
    name: 'an empty plan is a no-op success that never touches the wire',
    run: async () => {
      const scope = fakeScope({ stored: {} })
      return { outcome: await commitOps(scope, []), calls: scope.calls.length }
    },
    expected: { outcome: { ok: true, attempts: 0, verified: true }, calls: 0 },
  },
  {
    name: 'hasLanded reports an unavailable snapshot as undefined',
    run: () => hasLanded({ status: 'unavailable', value: undefined }, plan),
    expected: undefined,
  },
  {
    name: 'hasLanded compares nested values, not just top-level fields',
    run: () => hasLanded(
      { status: 'ready', value: { prompt: { a: [1, 2] } } },
      [{ op: 'set', path: ['prompt'], value: { a: [1, 2] } }],
    ),
    expected: true,
  },
  {
    name: 'hasLanded notices a field the Host dropped',
    run: () => hasLanded(
      { status: 'ready', value: { apiKey: 'sk-or-v1-typed' } },
      plan,
    ),
    expected: false,
  },
  {
    name: 'a scope with only per-field set() still writes and verifies (older DSH contract)',
    run: async () => {
      const stored = { apiKey: '', modelId: '' }
      const scope = {
        async set(field, value) { stored[field] = value },
        getSnapshot: () => ({ status: 'ready', value: { ...stored }, revision: 1 }),
      }
      return { outcome: await commitOps(scope, plan), stored: { ...stored } }
    },
    expected: {
      outcome: { ok: true, attempts: 1, verified: true },
      stored: { apiKey: 'sk-or-v1-typed', modelId: 'deepseek/deepseek-v4.1-flash' },
    },
  },
  {
    name: 'a scope with no write face reports a hard error instead of pretending to save',
    run: async () => {
      const scope = { getSnapshot: () => ({ status: 'ready', value: {} }) }
      try {
        await commitOps(scope, plan)
        return 'no error'
      } catch (error) {
        return String(error.message).includes('neither mutate() nor set()') ? 'threw' : String(error)
      }
    },
    expected: 'threw',
  },
]

const coercions = [
  ['enabled', 'true', true],
  ['enabled', 'false', false],
  ['maxRetries', '5', 5],
  ['maxRetries', '0', 0],
  ['maxRetries', '', 3],
  ['maxRetries', 'abc', 3],
  ['apiKey', '  sk-or-v1-typed  ', '  sk-or-v1-typed  '],
  ['fallbackModelId', '', ''],
]

let failed = 0
for (const testCase of cases) {
  const actual = await testCase.run()
  const ok = JSON.stringify(actual) === JSON.stringify(testCase.expected)
  if (!ok) failed += 1
  console.log(`${ok ? '✓' : '✗'} ${testCase.name}`)
  if (!ok) {
    console.log(`    expected ${JSON.stringify(testCase.expected)}`)
    console.log(`    actual   ${JSON.stringify(actual)}`)
  }
}

for (const [field, text, expected] of coercions) {
  const actual = draftValue(field, text)
  const ok = Object.is(actual, expected)
  if (!ok) failed += 1
  console.log(`${ok ? '✓' : '✗'} draftValue(${field}, ${JSON.stringify(text)}) === ${JSON.stringify(expected)}`)
  if (!ok) console.log(`    actual   ${JSON.stringify(actual)}`)
}

const total = cases.length + coercions.length
console.log(`\n${total - failed}/${total} passed`)
process.exit(failed === 0 ? 0 : 1)
