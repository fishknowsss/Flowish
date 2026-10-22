import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CardPager } from './CardPager'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('data-motion')
})

const cards = Array.from({ length: 10 }, (_, i) => <article key={i}><button>编辑日期 {i + 1}</button></article>)

describe('CardPager', () => {
  it('keeps offscreen cards mounted for search and reflects the snapped page', () => {
    const { rerender } = render(<CardPager label="日期" columns={4} minCardWidth={104}>{cards}</CardPager>)
    const first = screen.getByRole('group', { name: '日期第 1 页' })
    const second = screen.getByRole('group', { name: '日期第 2 页' })
    expect(within(first).getAllByRole('button')).toHaveLength(8)
    expect(within(second).getAllByRole('button')).toHaveLength(2)
    expect(screen.getByRole('button', { name: '编辑日期 10' })).toBeInTheDocument()
    const viewport = screen.getByRole('region')
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 600 })
    fireEvent.scroll(viewport, { target: { scrollLeft: 600 } })
    expect(screen.getByRole('status')).toHaveTextContent('2 / 2')
    expect(screen.getByRole('button', { name: '日期下一页' })).toBeDisabled()

    rerender(<CardPager label="日期" columns={4} minCardWidth={104}>{cards.slice(0, 2)}</CardPager>)
    expect(screen.getByRole('status')).toHaveTextContent('1 / 1')
    expect(viewport.scrollLeft).toBe(0)
  })

  it('supports keyboard paging and the in-app reduced motion preference', () => {
    render(<CardPager label="日期" columns={4} minCardWidth={104}>{cards}</CardPager>)
    const viewport = screen.getByRole('region')
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 600 })
    const scroll = vi.spyOn(viewport, 'scrollTo')
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({ width: 600 } as DOMRect)
    document.documentElement.dataset.motion = 'reduce'
    fireEvent.keyDown(viewport, { key: 'End' })
    expect(scroll).toHaveBeenLastCalledWith({ left: 600, behavior: 'instant' })
    fireEvent.keyDown(screen.getByRole('button', { name: '编辑日期 1' }), { key: 'ArrowRight' })
    expect(scroll).toHaveBeenCalledTimes(1)
  })

  it('ignores height-only observation so content growth cannot interrupt a page turn', () => {
    let notify: (entries: { contentRect: { width: number; height: number } }[]) => void
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: typeof notify) { notify = callback }
      observe() { notify([{ contentRect: { width: 600, height: 200 } }]) }
      disconnect() {}
    })
    render(<CardPager label="日期" columns={4} minCardWidth={104}>{cards}</CardPager>)
    const viewport = screen.getByRole('region')
    const scroll = vi.spyOn(viewport, 'scrollTo')
    notify!([{ contentRect: { width: 600, height: 300 } }])
    expect(scroll).not.toHaveBeenCalled()
  })
})
