/**
 * Regression test for the DSH runtime context contract.
 *
 * Cordis passes a context to `ctx.inject()` callbacks. Services are read from
 * that context (`ctx.get('llm')`); they are not attached as `ctx.llm`. Reading
 * `callbackContext.llm` silently skips the image pipeline while leaving the
 * settings UI and connection test working.
 */
import * as esbuild from 'esbuild'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const schemaStub = {
  name: 'schema-stub',
  setup(build) {
    build.onResolve({ filter: /^@deepseek-ai\/schemastery$/ }, () => ({
      path: 'schemastery-stub',
      namespace: 'vision-test-stubs',
    }))
    build.onResolve({ filter: /^@deepseek-ai\/cordis$/ }, () => ({
      path: 'cordis-stub',
      namespace: 'vision-test-stubs',
    }))
    build.onLoad({ filter: /.*/, namespace: 'vision-test-stubs' }, (args) => {
      if (args.path === 'schemastery-stub') {
        return {
          contents: `
            const schema = () => ({
              default() { return this },
              volatile() { return this },
              min() { return this },
            })
            export default { object: schema, boolean: schema, string: schema, number: schema }
          `,
          loader: 'js',
        }
      }
      return {
        contents: "export const symbols = { original: Symbol('original') }",
        loader: 'js',
      }
    })
  },
}

const bundled = await esbuild.build({
  entryPoints: [resolve(root, 'src/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'es2022',
  write: false,
  plugins: [schemaStub],
})

const runtimeModule = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
)
const apply = runtimeModule.apply

const registeredProviders = []
const adapterRequests = []
class FakeLlm {
  async resolveModelInfo() {
    return { inputModalities: ['text'] }
  }

  async listModels() {
    return []
  }

  streamWithRegistration() {
    return []
  }

  async *adapterStream(options) {
    adapterRequests.push(options)
  }

  registerConfigurableProviders(entries) {
    registeredProviders.push(...entries)
    return () => {}
  }
}

const llm = new FakeLlm()
const volatile = (value) => ({ get: () => value })
const originalStream = FakeLlm.prototype.streamWithRegistration
const originalAdapterStream = FakeLlm.prototype.adapterStream
const injections = []
const effects = []
const callbackContext = {
  get(name) {
    if (name === 'llm') return llm
    if (name === 'attachments') {
      return {
        async readImage() {
          return { data: new Uint8Array([1, 2, 3]) }
        },
      }
    }
    throw new Error(`unexpected service lookup: ${name}`)
  },
  effect(dispose, label) {
    const cleanup = dispose()
    effects.push({ cleanup, label })
    return cleanup
  },
}
const rootContext = {
  inject(dependencies, callback) {
    injections.push(dependencies)
    callback(callbackContext)
  },
}

apply(rootContext, {
  enabled: volatile(true),
  baseUrl: volatile('https://example.test/v1'),
  modelId: volatile('vision-model'),
  apiKey: volatile('test-key'),
  keyFormat: volatile('openai'),
})

globalThis.fetch = () => {
  return Promise.resolve({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify({ choices: [{ message: { content: 'visible text: DSH vision regression' } }] }),
  })
}

const imageOptions = {
  messages: [{
    role: 'user',
    content: [{
      type: 'image',
      attachment: {
        attachmentId: 'sha256:1234567890',
        mediaType: 'image/png',
        bytes: 3,
        width: 1,
        height: 1,
      },
    }],
  }],
}
for await (const _chunk of llm.adapterStream(imageOptions)) {
  // Exhaust the boundary so the final adapter request is recorded.
}

const failures = []
const check = (condition, message) => {
  if (!condition) failures.push(message)
}

check(
  typeof runtimeModule.default === 'function' && runtimeModule.default === apply,
  'the plugin entry must default-export the executable plugin function for DSH loader.unwrapExports()',
)
check(
  runtimeModule.default?.Config === runtimeModule.Config,
  'the default plugin export must expose the same Config schema as the named export',
)
check(
  JSON.stringify(injections) === JSON.stringify([['llm', 'attachments'], ['llm']]),
  `unexpected inject dependencies: ${JSON.stringify(injections)}`,
)
check(
  Object.hasOwn(llm, 'resolveModelInfo'),
  'the model capability patch was not installed from ctx.get("llm")',
)
check(
  Object.hasOwn(Object.getPrototypeOf(llm), 'streamWithRegistration') && llm.streamWithRegistration !== originalStream,
  `the image transcription patch was not installed on the shared LLM prototype; effects=${JSON.stringify(effects.map((effect) => effect.label))}, typeof=${typeof llm.streamWithRegistration}`,
)
check(
  Object.hasOwn(Object.getPrototypeOf(llm), 'adapterStream') && llm.adapterStream !== originalAdapterStream,
  'the final adapterStream transcription boundary was not installed',
)
check(
  adapterRequests.length === 1
    && adapterRequests[0].messages[0].content[0].type === 'text'
    && adapterRequests[0].messages[0].content[0].text.includes('DSH vision regression')
    && !JSON.stringify(adapterRequests[0]).includes('"type":"image"'),
  `adapterStream did not replace the image before DSH projection: ${JSON.stringify(adapterRequests)}`,
)
check(
  registeredProviders.length === 1 && registeredProviders[0].settingsNs === 'vision-plugin',
  `settings namespace registration is wrong: ${JSON.stringify(registeredProviders)}`,
)
check(
  effects.some((effect) => effect.label === 'vision-plugin: image transcription boundary'),
  'the image transcription patch did not register its disposal effect',
)

if (failures.length > 0) {
  for (const failure of failures) console.error(`✗ ${failure}`)
  process.exit(1)
}

console.log('✓ ctx.inject callbacks resolve llm through the injected context')
console.log('✓ the plugin default export is the executable apply function carrying Config')
console.log('✓ image capability and transcription patches install on the shared LLM service')
console.log('✓ adapterStream rewrites images before DSH text-only projection')
console.log('✓ DSH volatile config references are resolved through get()')
console.log('✓ configurable settings provider is registered from ctx.get("llm")')
