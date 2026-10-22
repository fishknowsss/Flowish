import '@testing-library/jest-dom/vitest'

// Node exposes its own Web Storage globals; browser tests must use jsdom's
// origin-scoped Storage, including Storage.prototype spies and storage events.
const browserWindow = (globalThis as typeof globalThis & {
  jsdom: { window: Window }
}).jsdom.window
for (const name of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    get: () => browserWindow[name],
  })
}

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
}

if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
  }
}

if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (callback) => {
    callback(performance.now())
    return 0
  }
}

// jsdom has no layout, ResizeObserver, or scrolling implementation.
globalThis.ResizeObserver = class {
  private callback: ResizeObserverCallback
  constructor(callback: ResizeObserverCallback) { this.callback = callback }
  observe(target: Element) {
    this.callback([{ target, contentRect: { width: 600 } } as ResizeObserverEntry], this as unknown as ResizeObserver)
  }
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

HTMLElement.prototype.scrollTo = function scrollTo(options: ScrollToOptions | number = {}, y?: number) {
  this.scrollLeft = typeof options === 'number' ? options : options.left ?? this.scrollLeft
  this.scrollTop = typeof options === 'number' ? y ?? 0 : options.top ?? this.scrollTop
}

window.matchMedia = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => true,
})
