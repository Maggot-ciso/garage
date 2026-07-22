import { useEffect, useState } from 'react'
import { Bell, Settings, X } from 'lucide-react'
import { liveQuery } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import { openReminders } from './db/reminders'
import { currentOdometer, reminderStatus } from './modules/reminders/reminderLogic'
import { TabBar, type TabId } from './components/TabBar'
import { useT } from './i18n/I18nProvider'
import type { TranslationKey } from './i18n/en'
import { GarageScreen } from './modules/garage/GarageScreen'
import { LogbookScreen } from './modules/logbook/LogbookScreen'
import { InsightsScreen } from './modules/insights/InsightsScreen'
import { DiagnosticsScreen } from './modules/diagnostics/DiagnosticsScreen'
import { ChatScreen } from './modules/assistant/ChatScreen'
import { SettingsScreen } from './modules/settings/SettingsScreen'
import { RemindersPanel } from './modules/reminders/RemindersPanel'
import { syncReminderNotifications } from './modules/reminders/notificationSync'

const TITLE_KEYS: Record<TabId, TranslationKey> = {
  garage: 'tab.garage',
  logbook: 'tab.logbook',
  insights: 'tab.insights',
  diagnostics: 'tab.diagnostics',
  assistant: 'tab.assistant',
}

type Overlay = 'settings' | 'reminders' | null

export default function App() {
  const t = useT()
  const [tab, setTab] = useState<TabId>('garage')
  const [overlay, setOverlay] = useState<Overlay>(null)
  // A question handed from the Diagnostics tab to the AI assistant.
  const [assistantSeed, setAssistantSeed] = useState<string | null>(null)

  // One subscription catches every reminder mutation — form edits, Done,
  // tyre swaps, backup imports — and the initial emission covers app launch.
  useEffect(() => {
    const sub = liveQuery(() => db.reminders.toArray()).subscribe({
      next: () => void syncReminderNotifications(),
    })
    return () => sub.unsubscribe()
  }, [])

  const dueCount =
    useLiveQuery(async () => {
      const [cars, entries, reminders] = await Promise.all([
        db.cars.toArray(),
        db.entries.toArray(),
        openReminders(),
      ])
      const today = new Date().toISOString().slice(0, 10)
      return reminders.filter((r) => {
        const car = cars.find((c) => c.id === r.carId)
        return car && reminderStatus(r, currentOdometer(car, entries), today) === 'due'
      }).length
    }, []) ?? 0

  const title =
    overlay === 'settings'
      ? t('title.settings')
      : overlay === 'reminders'
        ? t('title.reminders')
        : t(TITLE_KEYS[tab])

  return (
    <div className="screen flex h-full flex-col">
      <header className="bar flex items-center justify-between border-b px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <h1 className="text-lg font-bold tracking-tight">{title}</h1>
        {overlay ? (
          <button
            type="button"
            aria-label={overlay === 'settings' ? t('a11y.closeSettings') : t('a11y.closeReminders')}
            onClick={() => setOverlay(null)}
            className="rounded-full p-2 text-slate-500 active:bg-slate-100 dark:text-slate-400 dark:active:bg-slate-800"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={t('a11y.openReminders')}
              onClick={() => setOverlay('reminders')}
              className="relative rounded-full p-2 text-slate-500 active:bg-slate-100 dark:text-slate-400 dark:active:bg-slate-800"
            >
              <Bell className="h-5 w-5" strokeWidth={1.8} />
              {dueCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {dueCount}
                </span>
              )}
            </button>
            <button
              type="button"
              aria-label={t('a11y.openSettings')}
              onClick={() => setOverlay('settings')}
              className="rounded-full p-2 text-slate-500 active:bg-slate-100 dark:text-slate-400 dark:active:bg-slate-800"
            >
              <Settings className="h-5 w-5" strokeWidth={1.8} />
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        {overlay === 'settings' ? (
          <SettingsScreen />
        ) : overlay === 'reminders' ? (
          <RemindersPanel />
        ) : tab === 'garage' ? (
          <GarageScreen onOpenTab={setTab} onOpenReminders={() => setOverlay('reminders')} />
        ) : tab === 'logbook' ? (
          <LogbookScreen />
        ) : tab === 'insights' ? (
          <InsightsScreen />
        ) : tab === 'diagnostics' ? (
          <DiagnosticsScreen
            onAskAI={(prompt) => {
              setAssistantSeed(prompt)
              setTab('assistant')
            }}
          />
        ) : (
          <ChatScreen seed={assistantSeed} onSeedConsumed={() => setAssistantSeed(null)} />
        )}
      </main>

      {!overlay && <TabBar active={tab} onChange={setTab} />}
    </div>
  )
}
