/**
 * sync.mjs — copy the built lib/ artifacts into every installed DSH profile.
 *
 * DSH installs this plugin via a `file:` dependency with `nodeLinker: hoisted`,
 * which copies (not symlinks) the package into each profile's node_modules.
 * Editing the workspace and running `node build.mjs` therefore does NOT update
 * what DSH actually loads — the artifacts must be re-copied into
 * `~/.dsh/profiles/<profile>/node_modules/@dsh/vision-plugin/lib/`.
 *
 * Usage: node sync.mjs   (run after `node build.mjs`)
 */
import { copyFileSync, existsSync, readdirSync, statSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ARTIFACTS = ['index.js', 'client.js', 'client.js.map']
const PLUGIN_DIR = resolve(__dirname)
const PROFILES_ROOT = join(homedir(), '.dsh', 'profiles')
const packageJson = JSON.parse(readFileSync(join(PLUGIN_DIR, 'package.json'), 'utf8'))
const PACKAGE_NAME = packageJson.name

function packagePath(root, packageName) {
  return join(root, 'node_modules', ...packageName.split('/'))
}

/** Files/directories that should never be copied into a profile copy. */
const DENY_LIST = new Set([
  'node_modules',
  '.git',
  'lib', // copied separately as ARTIFACTS
])

if (!existsSync(PROFILES_ROOT)) {
  console.log(`no DSH profiles directory at ${PROFILES_ROOT}; nothing to sync`)
  process.exit(0)
}

const profiles = readdirSync(PROFILES_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

function copyRecursive(src, dst) {
  const stat = statSync(src)
  if (stat.isDirectory()) {
    mkdirSync(dst, { recursive: true })
    for (const entry of readdirSync(src, { withFileTypes: true })) {
      if (DENY_LIST.has(entry.name)) continue
      copyRecursive(join(src, entry.name), join(dst, entry.name))
    }
  } else {
    copyFileSync(src, dst)
  }
}

let synced = 0
for (const profile of profiles) {
  const profileRoot = join(PROFILES_ROOT, profile)
  const target = packagePath(profileRoot, PACKAGE_NAME)
  if (!existsSync(target)) {
    const legacyTarget = packagePath(profileRoot, '@dsh/vision-plugin')
    if (existsSync(legacyTarget)) {
      console.log(`profile "${profile}" has legacy @dsh/vision-plugin; reinstall ${PACKAGE_NAME} before syncing`)
    }
    continue
  }

  // 1) Mirror all source/metadata files (src/, package.json, cordis.patch.yml, README, …)
  //    so any build/HMR path that reads src/ or package.json sees the latest workspace.
  copyRecursive(PLUGIN_DIR, target)

  // 2) Copy the freshly built artifacts explicitly to guarantee they win.
  const libDir = join(target, 'lib')
  mkdirSync(libDir, { recursive: true })
  for (const file of ARTIFACTS) {
    const src = join(PLUGIN_DIR, 'lib', file)
    if (!existsSync(src)) continue
    copyFileSync(src, join(libDir, file))
  }

  synced += 1
  console.log(`✓ synced workspace into profile "${profile}"`)
}

if (synced === 0) {
  console.log('no installed vision-plugin copies found; install it first with `dsh plugin add file:<path>`')
} else {
  console.log(`done: synced ${synced} profile(s). Restart DSH for changes to take effect.`)
}
