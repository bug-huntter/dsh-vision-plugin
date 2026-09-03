/**
 * Package invariants: validates that this package consumable as intended.
 * The host loader checks this before activation.
 */
import type { Context } from '@deepseek-ai/cordis'

export function apply(ctx: Context): void {
  // Empty — the host-side schema registration in src/index.ts is sufficient.
  // This file exists to maintain the invariant entry that the package's
  // package.json exports contract expects.
}