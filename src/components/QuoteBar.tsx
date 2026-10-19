import { QuoteIcon } from './Icon'

interface QuoteBarProps {
  quoteText: string
  quoteAuthor: string
  onNext: () => void
  onManage: () => void
}

export function QuoteBar({ quoteText, quoteAuthor, onNext, onManage }: QuoteBarProps) {
  return (
    <div className="quote-bar glass-ridge">
      <div className="quote-mark">
        <QuoteIcon width={15} height={15} />
      </div>
      <div className="quote-copy">
        <p>{quoteText} <span className="quote-author">— {quoteAuthor}</span></p>
      </div>
      <div className="quote-actions">
        <button className="icon-button compact" type="button" onClick={onNext} aria-label="切换短句">
          换一句
        </button>
        <button className="icon-button compact" type="button" onClick={onManage} aria-label="管理短句">
          句库
        </button>
      </div>
    </div>
  )
}
