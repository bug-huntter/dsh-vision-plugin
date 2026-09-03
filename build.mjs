/**
 * build.mjs — standalone build script for @dsh/vision-plugin.
 *
 * Produces:
 *   lib/index.js        Node half (register settings namespace)
 *   lib/client.js       Browser bundle in DSH plugin format
 *
 * The web shell executes client bundles as classic scripts, so the post-build
 * check re-parses the artifact and verifies exactly one factory registration
 * — a corrupted or appended bundle fails the build instead of shipping.
 *
 * Usage: node build.mjs
 */
import * as esbuild from 'esbuild'
import { Script } from 'node:vm'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
const PACKAGE_NAME = pkg.name
const externals = Object.keys(pkg.peerDependencies ?? {})

const libDir = resolve(__dirname, 'lib')
if (!existsSync(libDir)) mkdirSync(libDir, { recursive: true })

// A stale artifact from an interrupted or appended build would poison the
// module table registration, so previous outputs are removed per build.
for (const file of ['index.js', 'client.js', 'client.js.map']) rmSync(resolve(libDir, file), { force: true })

// ── Node half ─────────────────────────────────────────────────────────────
await esbuild.build({
  entryPoints: [resolve(__dirname, 'src/index.ts')],
  outfile: resolve(__dirname, 'lib/index.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'es2022',
  external: externals,
  sourcemap: false,
})

// ── Browser client bundle ─────────────────────────────────────────────────
// DSH expects lib/client.js in the module-loader registration format:
//   window.__ModuleLoader__.load({ id: "<package>", factory: (require) => { ... } })
// Components use inline styles — no CSS module imports needed.
await esbuild.build({
  entryPoints: [resolve(__dirname, 'src/client/index.ts')],
  outfile: resolve(__dirname, 'lib/client.js'),
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: 'es2020',
  external: externals,
  sourcemap: true,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  banner: {
    js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_NAME)}, factory: (require) => { var module = { exports: {} }; var exports = module.exports;`,
  },
  footer: {
    js: 'return module.exports; } });',
  },
})

// ── Post-build check: classic-script parse + factory registration ─────────
const clientSource = readFileSync(resolve(__dirname, 'lib/client.js'), 'utf-8')
const registrations = clientSource.match(/window\.__ModuleLoader__\.load\(/g) ?? []
if (registrations.length !== 1) {
  throw new Error(`build: expected exactly one __ModuleLoader__ registration, found ${registrations.length}`)
}
new Script(clientSource, { filename: 'client.js' })
let registeredId
const sandbox = {
  window: {
    __ModuleLoader__: { load: (handoff) => { registeredId = handoff.id } },
  },
}
new Script(clientSource, { filename: 'client.js' }).runInNewContext(sandbox)
if (registeredId !== PACKAGE_NAME) {
  throw new Error(`build: client bundle registered as ${JSON.stringify(registeredId)}, expected ${JSON.stringify(PACKAGE_NAME)}`)
}

console.log('✓ built lib/index.js')
console.log('✓ built lib/client.js (classic-script parse + registration verified)')
