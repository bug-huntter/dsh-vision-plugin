/**
 * Dependency-free shared constants.
 *
 * This module must NOT import any Node/host-only packages (e.g.
 * `@deepseek-ai/schemastery`, `@deepseek-ai/dsh-settings`) — the browser
 * client half imports from here, and pulling host-only deps into the client
 * bundle makes the platform's web module table reject their runtime `require`.
 */

/** Durable settings namespace for the vision plugin. */
export const VISION_PLUGIN_NAMESPACE = 'vision-plugin'
