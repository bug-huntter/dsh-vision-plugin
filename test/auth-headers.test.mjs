/**
 * Regression test for the 密钥格式 (key format) → request-header mapping.
 *
 * Both halves send the key through this one function: the host while
 * transcribing, and the settings page's connectivity test. Getting a header
 * name wrong is invisible until a provider answers an opaque 401, so each
 * format is pinned here — including the two cases that produced the original
 * confusion: an empty key must send NO auth header at all (the host then
 * reports 未携带 API Key instead of making the request), and whitespace must
 * never leak into the header value.
 *
 * Usage: node test/auth-headers.test.mjs
 */
import * as esbuild from 'esbuild'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const bundled = await esbuild.build({
  stdin: {
    contents: "export { authHeaders, normalizeKeyFormat, keyFormatHint, KEY_FORMATS, DEFAULT_KEY_FORMAT } from './src/authHeaders.ts'\n",
    resolveDir: root,
    sourcefile: 'auth-headers-test-entry.ts',
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'es2022',
  write: false,
})

const { authHeaders, normalizeKeyFormat, keyFormatHint, KEY_FORMATS, DEFAULT_KEY_FORMAT } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
)

const key = 'sk-or-v1-abc123'

const cases = [
  {
    name: 'openai sends Authorization: Bearer (OpenAI / OpenRouter / ARK / DeepSeek)',
    run: () => authHeaders('openai', key),
    expected: { authorization: `Bearer ${key}` },
  },
  {
    name: 'anthropic sends x-api-key plus the required anthropic-version',
    run: () => authHeaders('anthropic', key),
    expected: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
  },
  {
    name: 'gemini sends x-goog-api-key',
    run: () => authHeaders('gemini', key),
    expected: { 'x-goog-api-key': key },
  },
  {
    name: 'azure sends api-key',
    run: () => authHeaders('azure', key),
    expected: { 'api-key': key },
  },
  {
    name: 'an empty key sends no auth header at all (host reports 未携带 API Key)',
    run: () => authHeaders('openai', ''),
    expected: {},
  },
  {
    name: 'a whitespace-only key sends no auth header (Bearer  sk-… is rejected as missing)',
    run: () => authHeaders('openai', '   \n '),
    expected: {},
  },
  {
    name: 'whitespace is stripped from the header value, not just the empty check',
    run: () => authHeaders('openai', `  ${key}\n`),
    expected: { authorization: `Bearer ${key}` },
  },
  {
    name: 'the format menu and its default are what the settings schema stores',
    run: () => [KEY_FORMATS.join(','), DEFAULT_KEY_FORMAT],
    expected: ['openai,anthropic,gemini,azure', 'openai'],
  },
]

const normalizations = [
  ['openai', 'openai'],
  ['anthropic', 'anthropic'],
  ['gemini', 'gemini'],
  ['azure', 'azure'],
  ['', 'openai'],
  [undefined, 'openai'],
  ['OpenAI', 'openai'],
  ['bogus', 'openai'],
  [42, 'openai'],
]

const hints = [
  ['sk-or-v1-abc123', ''],
  ['"sk-or-v1-abc123"', 'quoted'],
  ["'sk-or-v1-abc123'", 'quoted'],
  ['  sk-or-v1-abc123  ', ''],
]

let failed = 0
for (const testCase of cases) {
  const actual = testCase.run()
  const ok = JSON.stringify(actual) === JSON.stringify(testCase.expected)
  if (!ok) failed += 1
  console.log(`${ok ? '✓' : '✗'} ${testCase.name}`)
  if (!ok) {
    console.log(`    expected ${JSON.stringify(testCase.expected)}`)
    console.log(`    actual   ${JSON.stringify(actual)}`)
  }
}

for (const [input, expected] of normalizations) {
  const actual = normalizeKeyFormat(input)
  const ok = actual === expected
  if (!ok) failed += 1
  console.log(`${ok ? '✓' : '✗'} normalizeKeyFormat(${JSON.stringify(input)}) === ${JSON.stringify(expected)}`)
  if (!ok) console.log(`    actual   ${JSON.stringify(actual)}`)
}

for (const [input, expected] of hints) {
  const actual = keyFormatHint(input)
  const ok = expected === 'quoted' ? actual.length > 0 : actual === ''
  if (!ok) failed += 1
  console.log(`${ok ? '✓' : '✗'} keyFormatHint(${JSON.stringify(input)}) ${expected === 'quoted' ? 'warns about quotes' : 'stays silent'}`)
  if (!ok) console.log(`    actual   ${JSON.stringify(actual)}`)
}

const total = cases.length + normalizations.length + hints.length
console.log(`\n${total - failed}/${total} passed`)
process.exit(failed === 0 ? 0 : 1)
