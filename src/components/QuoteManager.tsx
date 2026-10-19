import { useState } from 'react'

import type { Quote } from '../store/appData'
import { CloseIcon, PlusIcon, TrashIcon } from './Icon'
import { DialogShell } from './DialogShell'

interface QuoteManagerProps {
  quotes: Quote[]
  onClose: () => void
  onAdd: (text: string, author: string) => void
  onToggle: (quoteId: string) => void
  onDelete: (quoteId: string) => void
}

export function QuoteManager({ quotes, onClose, onAdd, onToggle, onDelete }: QuoteManagerProps) {
  const [text, setText] = useState('')
  const [author, setAuthor] = useState('')
  const enabledCount = quotes.filter((quote) => quote.enabled).length

  return (
    <DialogShell ariaLabel="管理短句" className="quote-dialog" onClose={onClose}>
      <section className="dialog-surface quote-manager">
        <header className="drawer-header">
          <h2>短句</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭短句">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <form
          className="quote-form"
          onSubmit={(event) => {
            event.preventDefault()
            const nextText = text.trim()
            const nextAuthor = author.trim()
            if (!nextText || !nextAuthor) return
            onAdd(nextText, nextAuthor)
            setText('')
            setAuthor('')
          }}
        >
          <textarea
            autoFocus
            className="note-field compact"
            name="quote-text"
            value={text}
            maxLength={240}
            onChange={(event) => setText(event.target.value)}
            placeholder="写下一句话"
            aria-label="短句内容"
            autoComplete="off"
            required
          />
          <div className="quote-form-row">
            <input
              className="field"
              name="quote-author"
              value={author}
              maxLength={80}
              onChange={(event) => setAuthor(event.target.value)}
              placeholder="作者或出处"
              aria-label="作者或出处"
              autoComplete="off"
              required
            />
            <button className="primary-button" type="submit">
              <PlusIcon width={18} height={18} />
              添加
            </button>
          </div>
        </form>

        <div className="quote-list">
          {quotes.map((quote) => (
            <article key={quote.id} className="quote-item">
              <div>
                <p>{quote.text}</p>
                <span>{quote.author}</span>
              </div>
              <div className="quote-item-actions">
                <button
                  className="chip-toggle"
                  type="button"
                  aria-pressed={quote.enabled}
                  aria-label={`${quote.enabled ? '停用' : '启用'}“${quote.text}”`}
                  disabled={quote.enabled && enabledCount === 1}
                  onClick={() => onToggle(quote.id)}
                >
                  {quote.enabled ? '停用' : '启用'}
                </button>
                {quote.source === 'custom' ? (
                  <button
                    className="ghost-button danger"
                    type="button"
                    onClick={() => onDelete(quote.id)}
                    aria-label={`删除“${quote.text}”`}
                    disabled={quote.enabled && enabledCount === 1}
                  >
                    <TrashIcon width={16} height={16} />
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </DialogShell>
  )
}
