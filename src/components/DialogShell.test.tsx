import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DialogShell } from './DialogShell'

function DialogHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>打开计划</button>
      {open ? (
        <DialogShell ariaLabel="日期计划" onClose={() => setOpen(false)}>
          <section className="dialog-surface">
            <button type="button" onClick={() => setOpen(false)}>关闭计划</button>
          </section>
        </DialogShell>
      ) : null}
    </>
  )
}

describe('DialogShell', () => {
  it('returns focus to the trigger after the dialog closes', async () => {
    render(<DialogHarness />)
    const trigger = screen.getByRole('button', { name: '打开计划' })

    trigger.focus()
    fireEvent.click(trigger)
    const close = screen.getByRole('button', { name: '关闭计划' })
    close.focus()
    fireEvent.click(close)

    await waitFor(() => expect(trigger).toHaveFocus())
  })
})
