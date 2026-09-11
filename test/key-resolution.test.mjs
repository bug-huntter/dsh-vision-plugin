/**
 * Regression test for vision-plugin API key resolution.
 *
 * The bug class this locks down: the key used for a transcription request must
 * be the key the user typed into 设置 → 识图模型配置 — never something else that
 * happened to be reachable. Two former indirect sources are gone in v1.2.0:
 *
 *   • `apiKeyEnv`, an env/credential *name* in a field users read as "the key",
 *     which outranked the literal key;
 *   • route reuse, which substituted the credential of whichever LLM route
 *     shared the Base URL and registered first. With two OpenRouter routes
 *     configured, that replaced a good key with an unrelated 35-character key
 *     and surfaced as `401 Missing Authentication header`.
 *
 * Usage: node test/key-resolution.test.mjs
 */
import * as esbuild from 'esbuild'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const bundled = await esbuild.build({
  stdin: {
    contents: "export { resolveVisionKey } from './src/keyResolution.ts'\n",
    resolveDir: root,
    sourcefile: 'key-resolution-test-entry.ts',
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'es2022',
  write: false,
})

const { resolveVisionKey } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
)

const cases = [
  {
    name: 'the typed API Key is the key that gets sent',
    settings: { apiKey: 'sk-or-v1-typed', baseUrl: 'https://openrouter.ai/api/v1' },
    expected: { key: 'sk-or-v1-typed', source: 'apiKey' },
  },
  {
    name: 'surrounding whitespace is stripped (Bearer  sk-… reads as a missing header)',
    settings: { apiKey: '  sk-or-v1-typed\n' },
    expected: { key: 'sk-or-v1-typed', source: 'apiKey' },
  },
  {
    name: 'an empty field resolves to none — it is never filled in from elsewhere',
    settings: { apiKey: '' },
    expected: { key: '', source: 'none' },
  },
  {
    name: 'a whitespace-only field counts as unfilled',
    settings: { apiKey: '   ' },
    expected: { key: '', source: 'none' },
  },
  {
    name: 'missing settings resolve to none instead of throwing',
    settings: undefined,
    expected: { key: '', source: 'none' },
  },
  {
    name: 'a legacy apiKeyEnv value in the stored section can no longer supply a key',
    settings: { apiKey: '', apiKeyEnv: 'OPENROUTER_API_KEY' },
    expected: { key: '', source: 'none' },
  },
]

let failed = 0
for (const testCase of cases) {
  const actual = resolveVisionKey(testCase.settings)
  const ok = JSON.stringify(actual) === JSON.stringify(testCase.expected)
  if (!ok) failed += 1
  console.log(`${ok ? '✓' : '✗'} ${testCase.name}`)
  if (!ok) {
    console.log(`    expected ${JSON.stringify(testCase.expected)}`)
    console.log(`    actual   ${JSON.stringify(actual)}`)
  }
}

console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
