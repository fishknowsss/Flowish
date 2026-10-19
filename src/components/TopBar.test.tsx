import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { defaultAppData } from '../store/appData'
import { TopBar } from './TopBar'

const noop = vi.fn()

describe('TopBar', () => {
  it('returns focus to More before the global search shortcut opens a dialog', async () => {
    render(
      <TopBar
        todayKey="2026-07-13"
        quoteText="慢一点，也是在前进。"
        quoteAuthor="Flowish"
        preferences={defaultAppData('2026-07-13').preferences}
        installAvailable={false}
        onNextQuote={noop}
        onManageQuotes={noop}
        onToggleSound={noop}
        onToggleTheme={noop}
        onToggleMotion={noop}
        onToggleQuoteMode={noop}
        onToggleCalendarDefault={noop}
        onPomodoroConfigChange={noop}
        onExport={noop}
        onImport={noop}
        onInstall={noop}
        onOpenSearch={noop}
      />,
    )

    const moreButton = screen.getByRole('button', { name: '打开更多' })
    fireEvent.click(moreButton)
    await waitFor(() => expect(screen.getByRole('dialog', { name: '更多设置' })).toBeInTheDocument())

    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    expect(screen.queryByRole('dialog', { name: '更多设置' })).not.toBeInTheDocument()
    expect(moreButton).toHaveFocus()
  })
})
