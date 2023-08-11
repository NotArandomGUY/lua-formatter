/* eslint @typescript-eslint/no-var-requires: 0 */

import { exec } from 'child_process'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { cwd } from 'process'

process.env['PKG_CACHE_PATH'] = join(cwd(), 'cache')
process.env['MAKE_JOB_COUNT'] = 8

/**
 * Execute command
 * @param {string} cmd 
 * @param {boolean} slient 
 * @returns {Promise<string>}
 */
function execCommand(cmd, slient = false) {
  return new Promise((res, rej) => {
    const cp = exec(cmd, { env: process.env, cwd: cwd() })

    if (!slient) {
      cp.stdout.pipe(process.stdout)
      cp.stderr.pipe(process.stderr)
    }

    cp.on('exit', () => res())
    cp.on('error', (err) => rej(err))
  })
}

(async () => {
  console.log('Building project...')
  await execCommand('tsc --incremental')

  console.log('Resolving alias...')
  await execCommand('tsc-alias')

  console.log('Preparing node binary...')
  await (await import('./prepNodeBin.mjs')).default()

  await mkdir(join(cwd(), 'dist'), { recursive: true })

  console.log('Packing executable...')
  await execCommand(`pkg . --compress Brotli -o "dist/lua-formatter" --build`, true)

  console.log('Build complete.')
})()