/**
 * Regression test for vision-plugin API key precedence.
 *
 * The bug this locks down: a host can register several LLM routes on one Base
 * URL (two OpenRouter providers, say). Route-key reuse used to outrank the
 * literal `apiKey` field, so the key the user had just typed into
 * 设置 → 识图模型配置 was silently replaced by whichever route registered
 * first — surfacing as `401 Missing Authentication header` from the aggregator
 * even though the settings page held a perfectly good key.
 *
 * Usage: node test/key-resolution.test.mjs
 */
import * as esbuild from 'esbuild'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// `@deepseek-ai/cordis` is a peer dependency and is not installed in this
// workspace, so it is aliased to a stub. resolveVisionKey only reads
// `symbols.original` off it, and an undefined lookup falls back to the object
// handed in — which is the fake llm the cases below build.
const stubCordis = {
  name: 'stub-cordis',
  setup(build) {
    build.onResolve({ filter: /^@deepseek-ai\/cordis$/ }, () => ({ path: 'cordis', namespace: 'cordis-stub' }))
    build.onLoad({ filter: /.*/, namespace: 'cordis-stub' }, () => ({
      contents: 'export const symbols = { original: Symbol.for("cordis.original") }\nexport default { symbols }\n',
      loader: 'js',
    }))
  },
}

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
  plugins: [stubCordis],
})

const { resolveVisionKey } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
)

const VISION_BASE = 'https://openrouter.ai/api/v1'

/** Credentials service resolving only the given refs, like the host's store. */
const credentialsFor = (refs) => ({
  resolve: async (ref) => (ref in refs ? { value: refs[ref] } : undefined),
})

/**
 * A fake llm runtime with two routes on the SAME Base URL — the exact shape
 * that exposed the bug. The first route's credential is the "wrong" key.
 */
function llmWithRoutes(routes = [
  ['openrouter', { apiKeyEnv: 'OPENROUTER_API_KEY', piProvider: { baseUrl: VISION_BASE } }],
  ['open-dsh', { apiKeyEnv: 'OPEN_DSH_API_KEY', piProvider: { baseUrl: VISION_BASE } }],
]) {
  const keys = { OPENROUTER_API_KEY: 'sk-route-openrouter', OPEN_DSH_API_KEY: 'sk-or-v1-route-opendsh' }
  return {
    adapters: new Map([['pi-ai', {
      adapter: {
        config: {
          profiles: () => new Map(routes),
          // Mirrors the host adapter: resolve the profile's own apiKeyEnv ref.
          resolveApiKey: async (_provider, profile) => keys[profile?.apiKeyEnv],
        },
      },
    }]]),
  }
}

const ctxWith = (refs = {}) => ({ get: (name) => (name === 'credentials' ? credentialsFor(refs) : undefined) })

const cases = [
  {
    name: 'the typed API Key wins over route reuse (the reported bug)',
    settings: { baseUrl: VISION_BASE, apiKey: 'sk-or-v1-typed', apiKeyEnv: '' },
    llm: llmWithRoutes(),
    ctx: ctxWith(),
    expected: { key: 'sk-or-v1-typed', source: 'apiKey' },
  },
  {
    name: 'surrounding whitespace is stripped from the typed key',
    settings: { baseUrl: VISION_BASE, apiKey: '  sk-or-v1-typed\n', apiKeyEnv: '' },
    llm: llmWithRoutes(),
    ctx: ctxWith(),
    expected: { key: 'sk-or-v1-typed', source: 'apiKey' },
  },
  {
    name: 'apiKeyEnv still outranks the typed key (documented priority)',
    settings: { baseUrl: VISION_BASE, apiKey: 'sk-or-v1-typed', apiKeyEnv: 'GOOD_CRED' },
    llm: llmWithRoutes(),
    ctx: ctxWith({ GOOD_CRED: 'sk-or-v1-from-credential' }),
    expected: { key: 'sk-or-v1-from-credential', source: 'apiKeyEnv' },
  },
  {
    name: 'an unresolvable apiKeyEnv falls through to the typed key',
    settings: { baseUrl: VISION_BASE, apiKey: 'sk-or-v1-typed', apiKeyEnv: 'MISSING_CRED' },
    llm: llmWithRoutes(),
    ctx: ctxWith(),
    expected: { key: 'sk-or-v1-typed', source: 'apiKey' },
  },
  {
    name: 'route reuse still works when neither explicit field is set',
    settings: { baseUrl: VISION_BASE, apiKey: '', apiKeyEnv: '' },
    llm: llmWithRoutes(),
    ctx: ctxWith(),
    expected: { key: 'sk-route-openrouter', source: 'route', provider: 'openrouter' },
  },
  {
    name: 'a whitespace-only key counts as unset and does not preempt route reuse',
    settings: { baseUrl: VISION_BASE, apiKey: '   ', apiKeyEnv: '' },
    llm: llmWithRoutes(),
    ctx: ctxWith(),
    expected: { key: 'sk-route-openrouter', source: 'route', provider: 'openrouter' },
  },
  {
    name: 'Base URL matching ignores case and a trailing slash',
    settings: { baseUrl: 'HTTPS://OpenRouter.ai/api/v1/', apiKey: '', apiKeyEnv: '' },
    llm: llmWithRoutes(),
    ctx: ctxWith(),
    expected: { key: 'sk-route-openrouter', source: 'route', provider: 'openrouter' },
  },
  {
    name: 'routes without a credential reference are not reused',
    settings: { baseUrl: VISION_BASE, apiKey: '', apiKeyEnv: '' },
    llm: llmWithRoutes([['openrouter', { apiKeyEnv: '', piProvider: { baseUrl: VISION_BASE } }]]),
    ctx: ctxWith(),
    expected: { key: '', source: 'none' },
  },
  {
    name: 'nothing configured anywhere resolves to an empty key',
    settings: { baseUrl: VISION_BASE, apiKey: '', apiKeyEnv: '' },
    llm: {},
    ctx: ctxWith(),
    expected: { key: '', source: 'none' },
  },
]

let failed = 0
for (const testCase of cases) {
  const actual = await resolveVisionKey(testCase.ctx, testCase.settings, testCase.llm)
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
