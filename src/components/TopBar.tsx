import { useEffect, useRef, useState } from 'react'

import { formatTopbarDate } from '../lib/date'
import type { Preferences } from '../store/appData'
import { DownloadIcon, InstallIcon, SearchIcon, SettingsIcon, ThemeIcon, UploadIcon, VolumeIcon } from './Icon'
import { PomodoroTimer } from './PomodoroTimer'
import { QuoteBar } from './QuoteBar'

const faviconUrl = `${import.meta.env.BASE_URL}favicon.png`

interface TopBarProps {
  todayKey: string
  quoteText: string
  quoteAuthor: string
  preferences: Preferences
  installAvailable: boolean
  onNextQuote: () => void
  onManageQuotes: () => void
  onToggleSound: () => void
  onToggleTheme: () => void
  onToggleMotion: () => void
  onToggleQuoteMode: () => void
  onToggleCalendarDefault: () => void
  onPomodoroConfigChange: (config: Preferences['pomodoro']) => void
  onExport: () => void
  onImport: () => void
  onInstall: () => void
  onOpenSearch: () => void
}

function getThemeLabel(theme: Preferences['theme']) {
  return theme === 'pearl' ? '浅色' : '深色'
}

export function TopBar({
  todayKey,
  quoteText,
  quoteAuthor,
  preferences,
  installAvailable,
  onNextQuote,
  onManageQuotes,
  onToggleSound,
  onToggleTheme,
  onToggleMotion,
  onToggleQuoteMode,
  onToggleCalendarDefault,
  onPomodoroConfigChange,
  onExport,
  onImport,
  onInstall,
  onOpenSearch,
}: TopBarProps) {
  const [showMore, setShowMore] = useState(false)
  const moreRef = useRef<HTMLDivElement | null>(null)
  const moreButtonRef = useRef<HTMLButtonElement | null>(null)
  const firstActionRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!showMore) return

    firstActionRef.current?.focus()

    const handlePointerDown = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) {
        setShowMore(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        moreButtonRef.current?.focus({ preventScroll: true })
        setShowMore(false)
        return
      }
      if (event.key !== 'Escape') return
      if (document.querySelector('dialog[open]')) return
      event.preventDefault()
      event.stopPropagation()
      setShowMore(false)
      moreButtonRef.current?.focus()
    }

    window.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleEscape, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape, true)
    }
  }, [showMore])

  const runPanelAction = (action: () => void) => {
    setShowMore(false)
    moreButtonRef.current?.focus({ preventScroll: true })
    action()
  }

  return (
    <header className="topbar glass-panel">
      <div className="brand-block">
        <div className="brand-glyph" aria-hidden="true">
          <img src={faviconUrl} alt="" />
        </div>
        <div>
          <h1>Flowish</h1>
          <p className="topbar-date">{formatTopbarDate(todayKey)}</p>
        </div>
      </div>

      <QuoteBar
        quoteText={quoteText}
        quoteAuthor={quoteAuthor}
        onNext={onNextQuote}
        onManage={onManageQuotes}
      />

      <div className="toolbar">
        <PomodoroTimer
          config={preferences.pomodoro}
          soundEnabled={preferences.soundEnabled}
          onConfigChange={onPomodoroConfigChange}
        />
        <button
          className="icon-button"
          type="button"
          onClick={() => {
            setShowMore(false)
            onOpenSearch()
          }}
          aria-label="搜索"
          aria-keyshortcuts="Control+K Meta+K"
        >
          <SearchIcon width={18} height={18} />

        </button>
        <button className="icon-button" type="button" onClick={onToggleSound} aria-label={preferences.soundEnabled ? '关闭音效' : '开启音效'}>
          <VolumeIcon width={18} height={18} muted={!preferences.soundEnabled} />
        </button>
        <button className="icon-button" type="button" onClick={onToggleTheme} aria-label={`切换主题，当前为${getThemeLabel(preferences.theme)}`}>
          <ThemeIcon width={18} height={18} />
        </button>
        <button className="icon-button" type="button" onClick={onExport} aria-label="导出数据"><DownloadIcon width={18} height={18} /></button>
        <button className="icon-button" type="button" onClick={onImport} aria-label="导入数据"><UploadIcon width={18} height={18} /></button>
        {installAvailable ? <button className="icon-button" type="button" onClick={onInstall} aria-label="安装应用"><InstallIcon width={18} height={18} /></button> : null}
        <div
          ref={moreRef}
          className="settings-wrap"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setShowMore(false)
            }
          }}
        >
          <button
            ref={moreButtonRef}
            className="icon-button"
            type="button"
            onClick={() => setShowMore((value) => !value)}
            aria-label={showMore ? '关闭更多' : '打开更多'}
            aria-expanded={showMore}
            aria-haspopup="dialog"
            aria-controls="topbar-more-panel"
          >
            <SettingsIcon width={18} height={18} />

          </button>
          {showMore ? (
            <div
              id="topbar-more-panel"
              className="settings-popover glass-panel"
              role="dialog"
              aria-label="更多设置"
            >
              <button
                ref={firstActionRef}
                className="toggle-row"
                type="button"
                onClick={() => runPanelAction(onManageQuotes)}
              >
                <span>短句管理</span>
                <strong>管理</strong>
              </button>
              {installAvailable ? (
                <button
                  className="toggle-row"
                  type="button"
                  onClick={() => runPanelAction(onInstall)}
                >
                  <span>安装应用</span>
                  <strong>安装</strong>
                </button>
              ) : null}
              <button
                className="toggle-row"
                type="button"
                onClick={onToggleTheme}
                aria-pressed={preferences.theme === 'obsidian'}
              >
                <span>主题</span>
                <strong>{getThemeLabel(preferences.theme)}</strong>
              </button>
              <button
                className="toggle-row"
                type="button"
                onClick={onToggleSound}
                aria-pressed={preferences.soundEnabled}
              >
                <span>音效</span>
                <strong>{preferences.soundEnabled ? '开启' : '关闭'}</strong>
              </button>
              <button
                className="toggle-row"
                type="button"
                onClick={onToggleMotion}
                aria-pressed={preferences.reducedMotion}
              >
                <span>动效</span>
                <strong>{preferences.reducedMotion ? '简化' : '标准'}</strong>
              </button>
              <button
                className="toggle-row"
                type="button"
                onClick={onToggleQuoteMode}
                aria-pressed={preferences.quoteMode === 'random'}
              >
                <span>短句模式</span>
                <strong>{preferences.quoteMode === 'daily' ? '每日' : '随机'}</strong>
              </button>
              <button
                className="toggle-row"
                type="button"
                onClick={onToggleCalendarDefault}
                aria-pressed={preferences.calendarExpandedDefault}
              >
                <span>启动月历</span>
                <strong>{preferences.calendarExpandedDefault ? '开启' : '关闭'}</strong>
              </button>
              <button
                className="toggle-row"
                type="button"
                onClick={() => runPanelAction(onImport)}
              >
                <span>导入数据</span>
                <strong>选择</strong>
              </button>
              <button
                className="toggle-row"
                type="button"
                onClick={() => runPanelAction(onExport)}
              >
                <span>导出数据</span>
                <strong>下载</strong>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
