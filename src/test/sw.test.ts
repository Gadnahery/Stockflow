// @vitest-environment node
/**
 * Service-worker behaviour test. Runs public/sw.js in a sandbox with a fake Cache API and a
 * switchable network, to prove the installed app launches OFFLINE — including the exact failure
 * that produced a blank white screen (a deploy happening between two launches).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import vm from 'vm'

const ORIGIN = 'https://app.test'
const SW_SOURCE = fs.readFileSync(process.env.SW_FILE || path.resolve(__dirname, '../../public/sw.js'), 'utf8')

type Files = Record<string, string>
const world = { online: true, server: {} as Files }

const abs = (r: unknown) => new URL(typeof r === 'string' ? r : (r as { url: string }).url, ORIGIN).toString()

class FakeCache {
  store = new Map<string, Response>()
  async match(r: unknown, opts?: { ignoreSearch?: boolean }) {
    const k = abs(r)
    if (opts?.ignoreSearch) {
      for (const [kk, v] of this.store) if (kk.split('?')[0] === k.split('?')[0]) return v.clone()
      return undefined
    }
    return this.store.get(k)?.clone()
  }
  async put(r: unknown, res: Response) { this.store.set(abs(r), res.clone()) }
  async addAll(reqs: unknown[]) {
    const got = await Promise.all(reqs.map(async (r) => {
      const res = await fakeFetch(r)
      if (!res.ok) throw new TypeError('addAll failed: ' + abs(r))
      return [r, res] as const
    }))
    for (const [r, res] of got) await this.put(r, res)
  }
  async keys() { return [...this.store.keys()].map((k) => ({ url: k })) }
  async delete(r: unknown) { return this.store.delete(abs(r)) }
}
const caches = new (class {
  map = new Map<string, FakeCache>()
  async open(n: string) { if (!this.map.has(n)) this.map.set(n, new FakeCache()); return this.map.get(n)! }
  async keys() { return [...this.map.keys()] }
  async delete(n: string) { return this.map.delete(n) }
  async match(r: unknown, opts?: { ignoreSearch?: boolean }) {
    for (const c of this.map.values()) { const hit = await c.match(r, opts); if (hit) return hit }
    return undefined
  }
})()

async function fakeFetch(r: unknown): Promise<Response> {
  if (!world.online) throw new TypeError('Failed to fetch (offline)')
  const url = new URL(abs(r))
  const p = url.pathname === '/' ? '/index.html' : url.pathname
  if (url.origin === ORIGIN && p in world.server) return new Response(world.server[p], { status: 200 })
  if (url.origin !== ORIGIN) return new Response('remote:' + url.pathname, { status: 200 })
  return new Response('nope', { status: 404 })
}

// A real service worker resolves relative URLs against its own origin; Node's Request does not.
class SWRequest extends Request {
  constructor(input: string | Request, init?: RequestInit) {
    super(typeof input === 'string' ? new URL(input, ORIGIN).toString() : input, init)
  }
}

function loadSW(build: string, precache: string[] | null) {
  const handlers: Record<string, (e: unknown) => void> = {}
  let skipped = false
  const self = {
    location: { origin: ORIGIN },
    clients: { claim: async () => undefined },
    skipWaiting: () => { skipped = true },
    addEventListener: (t: string, f: (e: unknown) => void) => { handlers[t] = f },
  }
  const code = precache
    ? SW_SOURCE.replace('/*__SF_PRECACHE__*/ []', JSON.stringify(precache)).replace('__SF_BUILD__', build)
    : SW_SOURCE // un-built dev copy keeps its placeholders
  vm.runInNewContext(code, { self, caches, fetch: fakeFetch, Request: SWRequest, Response, URL, console })
  const fire = async (type: string, init: Record<string, unknown> = {}) => {
    let p: Promise<unknown> | undefined
    const ev: Record<string, unknown> = { ...init, responded: false, waitUntil: (x: Promise<unknown>) => { p = x }, respondWith: (x: Promise<unknown>) => { ev.responded = true; p = x } }
    handlers[type](ev)
    const value = p ? await p : undefined
    return { ev, value }
  }
  return {
    skipped: () => skipped,
    install: () => fire('install'),
    activate: () => fire('activate'),
    message: (type: string) => fire('message', { data: { type } }),
    nav: async (p: string) => (await fire('fetch', { request: { method: 'GET', url: ORIGIN + p, mode: 'navigate' } })).value as Response,
    get: (u: string) => fire('fetch', { request: { method: 'GET', url: u.startsWith('http') ? u : ORIGIN + u, mode: 'cors' } }),
    post: (u: string) => fire('fetch', { request: { method: 'POST', url: u, mode: 'cors' } }),
  }
}

const extras: Files = { '/manifest.json': '{}', '/favicon.svg': 'svg', '/icon-512.png': 'png', '/apple-touch-icon.png': 'png' }
const site = (v: number): Files => ({
  ...extras,
  '/index.html': `<html><script src="/assets/app-${v}.js"></script><link href="/assets/app-${v}.css"></html>`,
  [`/assets/app-${v}.js`]: `js v${v}`,
  [`/assets/app-${v}.css`]: `css v${v}`,
  [`/assets/chunk-${v}.js`]: `lazy chunk v${v}`,
  '/icon-192.png': 'png',
})
const list = (v: number) => Object.keys(site(v))

beforeEach(() => {
  caches.map.clear()
  world.online = true
  world.server = site(1)
})

describe('service worker — offline launch', () => {
  it('launches fully offline after install, including lazy chunks never visited', async () => {
    const sw = loadSW('b1', list(1))
    await sw.install(); await sw.activate()
    world.online = false
    for (const route of ['/', '/pos', '/products', '/login']) {
      expect(await (await sw.nav(route)).text()).toContain('app-1.js')
    }
    expect(await ((await sw.get('/assets/app-1.js?x=1')).value as Response).text()).toBe('js v1')
    expect(await ((await sw.get('/assets/chunk-1.js')).value as Response).text()).toBe('lazy chunk v1')
  })

  it('REGRESSION (blank white screen): a deploy between two launches must not break the next offline launch', async () => {
    const sw = loadSW('b1', list(1))
    await sw.install(); await sw.activate()
    // user is online, server already has deploy #2, but this installed version is still #1
    world.server = site(2)
    const html = await (await sw.nav('/')).text()
    expect(html).toContain('app-1.js') // page and scripts stay a matched pair
    expect(html).not.toContain('app-2.js')
    world.online = false // close app, lose signal, reopen
    const offline = await (await sw.nav('/')).text()
    expect(offline).toContain('app-1.js')
    expect(await ((await sw.get('/assets/app-1.js')).value as Response).text()).toBe('js v1')
  })

  it('updates in the background, waits for the user, then switches cleanly', async () => {
    const v1 = loadSW('b1', list(1))
    await v1.install(); await v1.activate()
    world.server = site(2)
    const v2 = loadSW('b2', list(2))
    await v2.install()
    expect(v2.skipped()).toBe(false) // no surprise reload mid-sale
    world.online = false
    expect(await (await v1.nav('/')).text()).toContain('app-1.js') // old version still launches
    await v2.message('SKIP_WAITING'); expect(v2.skipped()).toBe(true)
    await v2.activate()
    expect([...(await caches.keys())]).toEqual(['sf-shell-b2']) // old build cleaned up
    expect(await (await v2.nav('/')).text()).toContain('app-2.js')
    expect(await ((await v2.get('/assets/chunk-2.js')).value as Response).text()).toBe('lazy chunk v2')
  })

  it('a failed install keeps the previous version working', async () => {
    const v1 = loadSW('b1', list(1))
    await v1.install(); await v1.activate()
    world.server = { ...site(2) }; delete world.server['/assets/chunk-2.js'] // deploy missing a file
    const v2 = loadSW('b2', list(2))
    await expect(v2.install()).rejects.toThrow()
    world.online = false
    expect(await (await v1.nav('/')).text()).toContain('app-1.js')
  })

  it('never intercepts API, auth, sync or write requests', async () => {
    const sw = loadSW('b1', list(1)); await sw.install(); await sw.activate()
    expect((await sw.get('https://abc.supabase.co/rest/v1/products')).ev.responded).toBe(false)
    expect((await sw.get('https://abc.supabase.co/auth/v1/token')).ev.responded).toBe(false)
    expect((await sw.get('/api/harakapay/status')).ev.responded).toBe(false)
    expect((await sw.post('/assets/app-1.js')).ev.responded).toBe(false)
  })

  it('shows product photos from Supabase Storage offline after one online view', async () => {
    const sw = loadSW('b1', list(1)); await sw.install(); await sw.activate()
    const photo = 'https://abc.supabase.co/storage/v1/object/public/product-images/biz/egg.jpg'
    await sw.get(photo)
    await new Promise((r) => setTimeout(r, 10))
    world.online = false
    expect(await ((await sw.get(photo)).value as Response).text()).toBe('remote:/storage/v1/object/public/product-images/biz/egg.jpg')
  })

  it('the un-built dev copy does not cache or intercept anything', async () => {
    const sw = loadSW('', null)
    await sw.install()
    expect((await sw.get('/assets/x.js')).ev.responded).toBe(false)
    expect(await caches.keys()).toEqual([])
  })
})
