import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import crypto from 'crypto'
import type { Plugin } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const electron = process.env.ELECTRON === '1'

/** Lists every file of this build inside dist/sw.js so the service worker can precache the whole app. */
function sfPrecache(): Plugin {
  let outDir = 'dist'
  const SKIP = new Set(['/sw.js', '/robots.txt', '/sitemap.xml', '/og-default.png'])
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name)
      return e.isDirectory() ? walk(full) : [full]
    })
  return {
    name: 'sf-sw-precache',
    apply: 'build',
    configResolved(c) { outDir = path.resolve(c.root, c.build.outDir) },
    closeBundle() {
      const swPath = path.join(outDir, 'sw.js')
      if (electron || !fs.existsSync(swPath)) return
      const files = walk(outDir)
        .map((f) => '/' + path.relative(outDir, f).split(path.sep).join('/'))
        .filter((u) => !SKIP.has(u) && !u.endsWith('.map') && !u.startsWith('/api/'))
        .sort()
      const hash = crypto.createHash('sha1')
      for (const u of files) hash.update(u).update(fs.readFileSync(path.join(outDir, u)))
      const build = hash.digest('hex').slice(0, 12)
      let sw = fs.readFileSync(swPath, 'utf8')
      sw = sw.replace('/*__SF_PRECACHE__*/ []', JSON.stringify(files)).replace('__SF_BUILD__', build)
      fs.writeFileSync(swPath, sw)
    },
  }
}

export default defineConfig({
  base: electron ? './' : '/',
  plugins: [react(), sfPrecache()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
})
