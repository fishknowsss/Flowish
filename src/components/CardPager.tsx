import { Children, useEffect, useRef, useState, type ReactNode } from 'react'

import { ChevronLeftIcon, ChevronRightIcon } from './Icon'

interface CardPagerProps {
  label: string
  columns: number
  minCardWidth: number
  minCardHeight?: number
  children: ReactNode
}

function reducedMotion() {
  return document.documentElement.dataset.motion === 'reduce' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Keep every page mounted: search, keyboard focus and drag ordering can reach it. */
export function CardPager({ label, columns: maxColumns, minCardWidth, minCardHeight = 128, children }: CardPagerProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [{ columns, rows }, setLayout] = useState({ columns: maxColumns, rows: 2 })
  const [requestedPage, setRequestedPage] = useState(0)
  const pageRef = useRef(0)
  const items = Children.toArray(children)
  const pageSize = columns * rows
  const previousPageSize = useRef(pageSize)
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const page = Math.min(requestedPage, pageCount - 1)

  useEffect(() => {
    const viewport = viewportRef.current!
    const observer = new ResizeObserver(([entry]) => {
      const bounds = viewport.getBoundingClientRect()
      const { width, height } = bounds.width ? bounds : entry.contentRect
      const fittedWidth = height < minCardHeight ? Math.max(minCardWidth, 160) : minCardWidth
      const cardHeight = Math.max(minCardHeight, ...Array.from(viewport.querySelectorAll<HTMLElement>('.card-page > article'), (card) => card.scrollHeight))
      const next = {
        columns: Math.max(1, Math.min(maxColumns, Math.floor((width + 8) / (fittedWidth + 8)))),
        // Short screens show one complete row rather than half of the second.
        rows: height < cardHeight * 2 + 12 ? 1 : 2,
      }
      if (viewport.querySelector('.editing')) return
      setLayout((previous) => previous.columns === next.columns && previous.rows === next.rows ? previous : next)
    })
    observer.observe(viewport)
    // Observe natural text boxes, not the constrained card frames.
    viewport.querySelectorAll('.ritual-chip-body, .milestone-info').forEach((content) => observer.observe(content))
    return () => observer.disconnect()
  }, [maxColumns, minCardWidth, minCardHeight, children])

  useEffect(() => {
    const viewport = viewportRef.current!
    const anchor = pageRef.current * previousPageSize.current
    pageRef.current = Math.min(Math.floor(anchor / pageSize), pageCount - 1)
    previousPageSize.current = pageSize
    viewport.scrollTo({ left: pageRef.current * viewport.clientWidth, behavior: 'instant' })
  }, [columns, pageSize, pageCount])

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
          <div className="card-page" data-columns={columns} data-rows={rows} role="group" aria-label={`${label}第 ${index + 1} 页`} key={index}>
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
