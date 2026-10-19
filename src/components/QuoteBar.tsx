import { QuoteIcon } from './Icon'

interface QuoteBarProps {
  quoteText: string
  quoteAuthor: string
  onNext: () => void
}

export function QuoteBar({ quoteText, quoteAuthor, onNext }: QuoteBarProps) {
  return (
    <div className="quote-bar glass-ridge">
      <div className="quote-mark">
        <QuoteIcon width={15} height={15} />
      </div>
      <div className="quote-copy" aria-live="polite">
        <p>{quoteText} <span className="quote-author">— {quoteAuthor}</span></p>
      </div>
      <div className="quote-actions">
        <button className="icon-button compact" type="button" onClick={onNext} aria-label="换句">
          换句
        </button>
      </div>
    </div>
  )
}
