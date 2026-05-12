import { useEffect, useRef, useState } from 'react'

import { formatTopbarDate } from '../lib/date'
import type { Preferences } from '../store/appData'
import {
  DownloadIcon,
  InstallIcon,
  SearchIcon,
  SettingsIcon,
  ThemeIcon,
  UploadIcon,
  VolumeIcon,
} from './Icon'
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
  onExport: () => void
  onImport: () => void
  onInstall: () => void
  onOpenSearch: () => void
}

function getThemeLabel(theme: Preferences['theme']) {
  return theme === 'pearl' ? '普通' : '深色'
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
  onExport,
  onImport,
  onInstall,
  onOpenSearch,
}: TopBarProps) {
  const [showSettings, setShowSettings] = useState(false)
  const settingsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!showSettings) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) {
        setShowSettings(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowSettings(false)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [showSettings])

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
          defaultMinutes={preferences.pomodoroMinutes}
          soundEnabled={preferences.soundEnabled}
        />
        <button
          className="icon-button"
          type="button"
          onClick={onOpenSearch}
          aria-label="搜索"
          title="搜索 (Ctrl+K)"
        >
          <SearchIcon width={18} height={18} />
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={onToggleSound}
          aria-label={preferences.soundEnabled ? '关闭音效' : '开启音效'}
          title={preferences.soundEnabled ? '关闭音效' : '开启音效'}
        >
          <VolumeIcon width={18} height={18} muted={!preferences.soundEnabled} />
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={onToggleTheme}
          aria-label={`切换主题，当前为${getThemeLabel(preferences.theme)}`}
          title={`切换主题，当前为${getThemeLabel(preferences.theme)}`}
        >
          <ThemeIcon width={18} height={18} />
        </button>
        <button className="icon-button" type="button" onClick={onExport} aria-label="导出数据" title="导出数据">
          <DownloadIcon width={18} height={18} />
        </button>
        <button className="icon-button" type="button" onClick={onImport} aria-label="导入数据" title="导入数据">
          <UploadIcon width={18} height={18} />
        </button>
        {installAvailable ? (
          <button className="icon-button" type="button" onClick={onInstall} aria-label="安装应用" title="安装应用">
            <InstallIcon width={18} height={18} />
          </button>
        ) : null}
        <div ref={settingsRef} className="settings-wrap">
          <button
            className="icon-button"
            type="button"
            onClick={() => setShowSettings((value) => !value)}
            aria-label="打开偏好设置"
            aria-expanded={showSettings}
            title="偏好设置"
          >
            <SettingsIcon width={18} height={18} />
          </button>
          {showSettings ? (
            <div className="settings-popover glass-panel">
              <button className="toggle-row" type="button" onClick={onToggleTheme}>
                <span>颜色模式</span>
                <strong>{getThemeLabel(preferences.theme)}</strong>
              </button>
              <button className="toggle-row" type="button" onClick={onToggleMotion}>
                <span>动效节奏</span>
                <strong>{preferences.reducedMotion ? '简化' : '标准'}</strong>
              </button>
              <button className="toggle-row" type="button" onClick={onToggleQuoteMode}>
                <span>短句模式</span>
                <strong>{preferences.quoteMode === 'daily' ? '每日一句' : '随机切换'}</strong>
              </button>
              <button className="toggle-row" type="button" onClick={onToggleCalendarDefault}>
                <span>启动即展开月历</span>
                <strong>{preferences.calendarExpandedDefault ? '开启' : '关闭'}</strong>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
