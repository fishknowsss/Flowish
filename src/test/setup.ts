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
