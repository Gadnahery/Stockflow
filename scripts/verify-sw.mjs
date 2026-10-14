// Fails the build if the service worker would not be able to start the app offline.
import fs from 'fs'
import path from 'path'

const dist = path.resolve('dist')
const fail = (m) => { console.error('✖ verify-sw: ' + m); process.exit(1) }

const sw = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8')
if (sw.includes('__SF_BUILD__') || sw.includes('/*__SF_PRECACHE__*/')) fail('sw.js placeholders were not replaced')
const list = JSON.parse(sw.match(/const PRECACHE_URLS = (\[.*\])/)[1])
const build = sw.match(/const BUILD = '([0-9a-f]+)'/)?.[1]
if (!build) fail('sw.js has no build id')

if (!list.includes('/index.html')) fail('/index.html is not precached')
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const refs = [...html.matchAll(/(?:src|href)="(\/[^"#?]+)"/g)].map((m) => m[1]).filter((u) => /\.(js|css)$/.test(u))
if (refs.length === 0) fail('index.html references no scripts?')
for (const r of refs) if (!list.includes(r)) fail(`index.html needs ${r} but it is not precached`)

const assets = fs.readdirSync(path.join(dist, 'assets')).map((f) => '/assets/' + f).filter((f) => !f.endsWith('.map'))
const missing = assets.filter((a) => !list.includes(a))
if (missing.length) fail(`assets missing from precache: ${missing.slice(0, 5).join(', ')}`)
for (const u of list) if (!fs.existsSync(path.join(dist, u))) fail(`precache lists ${u} but the file does not exist`)

const kb = Math.round(list.reduce((t, u) => t + fs.statSync(path.join(dist, u)).size, 0) / 1024)
console.log(`✔ verify-sw: build ${build} — ${list.length} files (${kb} kB) precached; index.html scripts all included`)
