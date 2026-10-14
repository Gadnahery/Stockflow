import 'fake-indexeddb/auto'

// jsdom gaps used by the app
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }),
})
class Noop { observe() {} unobserve() {} disconnect() {} }
;(globalThis as unknown as Record<string, unknown>).ResizeObserver = Noop
;(globalThis as unknown as Record<string, unknown>).IntersectionObserver = Noop
window.scrollTo = () => undefined
Element.prototype.scrollTo = () => undefined
Element.prototype.scrollIntoView = () => undefined
URL.createObjectURL = () => 'blob:test'
URL.revokeObjectURL = () => undefined
