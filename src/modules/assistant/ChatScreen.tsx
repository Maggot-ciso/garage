import { useEffect, useRef, useState } from 'react'
import { useT } from '../../i18n/I18nProvider'
import type { TranslationKey } from '../../i18n/en'
import {
  ArrowUp,
  CalendarClock,
  Car as CarIcon,
  Cog,
  MessageCircle,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { type Car } from '../../db/db'
import { resolveActiveCar } from '../../db/activeCar'
import { CarPicker } from '../../components/CarPicker'
import { clearChat } from '../../db/chat'
import { getSetting, SETTING_KEYS } from '../../db/settings'
import { useCarChat } from './useCarChat'

const CHIPS: { icon: LucideIcon; label: TranslationKey; seed: string }[] = [
  { icon: Stethoscope, label: 'chat.suggestSymptom', seed: 'The vehicle ' },
  { icon: Cog, label: 'chat.suggestPart', seed: 'I need to find the right part: ' },
  {
    icon: CalendarClock,
    label: 'chat.suggestService',
    seed: 'Based on my history, what maintenance should I plan next?',
  },
]

export function ChatScreen({
  seed,
  onSeedConsumed,
}: {
  seed?: string | null
  onSeedConsumed?: () => void
}) {
  const [input, setInput] = useState('')
  const t = useT()
  const bottomRef = useRef<HTMLDivElement>(null)

  // null = no key stored; undefined = still loading
  const apiKey = useLiveQuery(async () => (await getSetting(SETTING_KEYS.aiApiKey)) ?? null, [])
  const state = useLiveQuery(resolveActiveCar, [])
  const cars = state?.cars
  const car: Car | undefined = state?.car
  const { messages, busy, error, pending, send, resolvePending } = useCarChat(car)

  // A question handed over from the Diagnostics tab ("ask AI about this code")
  // arrives as a seed: prefill the box so the owner can read and edit before
  // sending, then clear it so it fires only once.
  useEffect(() => {
    if (seed) {
      setInput(seed)
      onSeedConsumed?.()
    }
  }, [seed, onSeedConsumed])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages?.length, pending, busy])

  if (apiKey === undefined || cars === undefined || messages === undefined) return null

  if (!apiKey) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <MessageCircle className="faint h-10 w-10" strokeWidth={1.5} aria-hidden />
        <h2 className="text-base font-semibold">{t('chat.needKey')}</h2>
        <p className="muted max-w-xs text-sm">
          {t('chat.needKeyHint')}
        </p>
      </div>
    )
  }

  if (!car) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <CarIcon className="faint h-10 w-10" strokeWidth={1.5} aria-hidden />
        <h2 className="text-base font-semibold">{t('chat.noCar')}</h2>
        <p className="muted max-w-xs text-sm">
          {t('chat.noCarHint')}
        </p>
      </div>
    )
  }

  function handleSend(text: string) {
    setInput('')
    void send(text)
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        {cars.length > 1 ? (
          <div className="min-w-0 flex-1">
            <CarPicker cars={cars} car={car} />
          </div>
        ) : (
          <span className="muted text-sm">
            {car.year} {car.make} {car.model}
          </span>
        )}
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t('chat.confirmNewChat')))
                void clearChat(car.id)
            }}
            className="link-accent shrink-0"
          >
            {t('chat.newChat')}
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {messages.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="muted text-sm">
              {t('chat.emptyHint')}
            </p>
            {CHIPS.map((chip) => (
              <button
                key={t(chip.label)}
                type="button"
                onClick={() => setInput(chip.seed)}
                className="card-tap flex items-center gap-2.5 p-3 text-sm"
              >
                <chip.icon className="muted h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
                {t(chip.label)}
              </button>
            ))}
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
              m.role === 'user'
                ? 'self-end bg-red-600 text-white'
                : 'card self-start'
            }`}
          >
            {m.text}
          </div>
        ))}

        {busy && !pending && (
          <div className="card faint self-start px-3 py-2 text-sm">{t('chat.thinking')}</div>
        )}

        {pending && (
          <div className="self-start flex max-w-[85%] flex-col gap-2 rounded-2xl border border-red-300 bg-red-50 p-3 text-sm dark:border-red-800 dark:bg-red-950">
            <span className="font-medium text-red-900 dark:text-red-200">
              {pending.description}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => resolvePending(true)}
                className="flex-1 rounded-lg py-2 font-semibold bg-slate-900 text-white active:bg-slate-800 dark:bg-white dark:text-slate-900 dark:active:bg-slate-200"
              >
                ✓ Confirm
              </button>
              <button
                type="button"
                onClick={() => resolvePending(false)}
                className="flex-1 rounded-lg border border-slate-300 bg-white py-2 font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                ✗ No
              </button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="notice-error">
            {error}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('chat.placeholder')}
          rows={2}
          className="input min-w-0 flex-1 resize-none"
        />
        <button
          type="button"
          onClick={() => handleSend(input)}
          disabled={busy || !input.trim()}
          aria-label={t('chat.a11ySend')}
          className="shrink-0 rounded-xl px-4 py-3 font-semibold bg-slate-900 text-white active:bg-slate-800 dark:bg-white dark:text-slate-900 dark:active:bg-slate-200 disabled:opacity-50"
        >
          <ArrowUp className="h-5 w-5" strokeWidth={2.2} />
        </button>
      </div>
      <p className="faint text-center text-xs">
        {t('chat.disclaimer')}
      </p>
    </div>
  )
}
