import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Plugin roots and executable paths may be symlinks. Imports must remain inert.
export function isMain(url) {
  try { return fileURLToPath(url) === realpathSync(process.argv[1]) }
  catch { return false }
}
