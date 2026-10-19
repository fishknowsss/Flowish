import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'

interface DialogShellProps {
  ariaLabel: string
  className?: string
  children: ReactNode
  onClose: () => void
}

export function DialogShell({ ariaLabel, className = '', children, onClose }: DialogShellProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement && activeElement !== document.body) {
      returnFocusRef.current = activeElement
    }

    const handleCancel = (event: Event) => {
      event.preventDefault()
      onCloseRef.current()
    }

    dialog.addEventListener('cancel', handleCancel)
    if (!dialog.open) dialog.showModal()

    return () => {
      dialog.removeEventListener('cancel', handleCancel)
      if (dialog.open) dialog.close()
      const returnTarget = returnFocusRef.current
      queueMicrotask(() => {
        if (returnTarget?.isConnected) returnTarget.focus({ preventScroll: true })
      })
    }
  }, [])

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className={`dialog-shell ${className}`.trim()}
      aria-label={ariaLabel}
      onClick={handleBackdropClick}
    >
      {children}
    </dialog>
  )
}
