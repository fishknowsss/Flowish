import { Children, useEffect, useRef, useState, type ReactNode } from 'react'

import { ChevronLeftIcon, ChevronRightIcon } from './Icon'

interface CardPagerProps {
  label: string
  columns: number
  minCardWidth: number
  children: ReactNode
}

function reducedMotion() {
  return document.documentElement.dataset.motion === 'reduce' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Keep every page mounted: search, keyboard focus and drag ordering can reach it. */
export function CardPager({ label, columns: maxColumns, minCardWidth, children }: CardPagerProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(maxColumns)
  const [requestedPage, setRequestedPage] = useState(0)
  const pageRef = useRef(0)
  const items = Children.toArray(children)
  const pageSize = columns * 2
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const page = Math.min(requestedPage, pageCount - 1)

  useEffect(() => {
    const viewport = viewportRef.current!
    let previousWidth = 0
    const observer = new ResizeObserver(([entry]) => {
      if (Math.abs(entry.contentRect.width - previousWidth) < 0.1) return
      previousWidth = entry.contentRect.width
      setColumns(Math.max(1, Math.min(maxColumns, Math.floor((entry.contentRect.width + 8) / (minCardWidth + 8)))))
      viewport.scrollTo({ left: pageRef.current * entry.contentRect.width, behavior: 'instant' })
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [maxColumns, minCardWidth])

  useEffect(() => {
    const viewport = viewportRef.current!
    viewport.scrollTo({ left: Math.min(pageRef.current, pageCount - 1) * viewport.clientWidth, behavior: 'instant' })
  }, [columns, pageCount])

  useEffect(() => {
    const viewport = viewportRef.current!
    let frame = 0
    let previous = 0
    let offset = 0
    let velocity = 0
    const settle = (now: number) => {
      if (reducedMotion()) { frame = 0; viewport.style.translate = ''; return }
      const dt = Math.min((now - previous) / 1000 || 1 / 60, 1 / 30)
      previous = now
      velocity += (-260 * offset - 26 * velocity) * dt
      offset += velocity * dt
      viewport.style.translate = `${offset}px 0`
      if (Math.abs(offset) > 0.05 || Math.abs(velocity) > 0.1) frame = requestAnimationFrame(settle)
      else { frame = 0; viewport.style.translate = ''; previous = 0 }
    }
    const onWheel = (event: WheelEvent) => {
      if (reducedMotion() || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
      const atStart = viewport.scrollLeft <= 1 && event.deltaX < 0
      const atEnd = viewport.scrollLeft >= viewport.scrollWidth - viewport.clientWidth - 1 && event.deltaX > 0
      if (!atStart && !atEnd) return
      velocity = Math.max(-240, Math.min(240, velocity - Math.sign(event.deltaX) * Math.min(Math.abs(event.deltaX) * 3, 150)))
      if (!frame) { previous = performance.now(); frame = requestAnimationFrame(settle) }
    }
    viewport.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      viewport.removeEventListener('wheel', onWheel)
      cancelAnimationFrame(frame)
      viewport.style.translate = ''
    }
  }, [])

  const goTo = (next: number) => {
    const viewport = viewportRef.current!
    viewport.scrollTo({
      left: Math.max(0, Math.min(next, pageCount - 1)) * viewport.getBoundingClientRect().width,
      behavior: reducedMotion() ? 'instant' : 'smooth',
    })
  }

  return (
    <div className="card-pager" aria-label={`${label}分页`}>
      <div
        ref={viewportRef}
        className="card-page-viewport"
        tabIndex={0}
        role="region"
        aria-label={`${label}卡片，左右方向键翻页`}
        onScroll={(event) => {
          const viewport = event.currentTarget
          pageRef.current = Math.round(viewport.scrollLeft / viewport.clientWidth)
          setRequestedPage(pageRef.current)
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return
          const next = event.key === 'ArrowRight' ? page + 1 : event.key === 'ArrowLeft' ? page - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? pageCount - 1 : null
          if (next === null) return
          event.preventDefault()
          goTo(next)
        }}
      >
        {Array.from({ length: pageCount }, (_, index) => (
          <div className="card-page" data-columns={columns} role="group" aria-label={`${label}第 ${index + 1} 页`} key={index}>
            {items.slice(index * pageSize, (index + 1) * pageSize)}
          </div>
        ))}
      </div>
      <nav className="card-page-controls" aria-label={`${label}翻页`} hidden={items.length === 0}>
        <button className="icon-button compact" type="button" aria-label={`${label}上一页`} disabled={page === 0} onClick={() => goTo(page - 1)}><ChevronLeftIcon width={14} height={14} /></button>
        <span className="card-page-status" role="status" aria-live="polite">{page + 1} / {pageCount}<span className="card-page-total"> · {items.length} 项</span></span>
        <button className="icon-button compact" type="button" aria-label={`${label}下一页`} disabled={page === pageCount - 1} onClick={() => goTo(page + 1)}><ChevronRightIcon width={14} height={14} /></button>
      </nav>
    </div>
  )
}
