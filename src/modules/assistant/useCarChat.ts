import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Car, ChatMessage } from '../../db/db'
import { addChatMessage, chatForCar } from '../../db/chat'
import { getSetting, SETTING_KEYS } from '../../db/settings'
import { runAgentTurn } from '../../ai/agent'

export interface PendingAction {
  description: string
  resolve: (approved: boolean) => void
}

// One chat engine, two surfaces: the full Assistant tab and the compact
// chat window on the car detail screen share history and behavior.
export function useCarChat(car: Car | undefined) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)

  const messages: ChatMessage[] | undefined = useLiveQuery(
    () => (car ? chatForCar(car.id) : Promise.resolve([])),
    [car?.id],
  )

  async function send(text: string) {
    if (!text.trim() || busy || !car) return
    setError(null)
    setBusy(true)
    try {
      await addChatMessage(car.id, 'user', text.trim())
      const transcript = await chatForCar(car.id)
      const webSearch = (await getSetting(SETTING_KEYS.aiWebSearch)) === 'on'
      const reply = await runAgentTurn({
        car,
        transcript,
        webSearch,
        confirm: (description) =>
          new Promise<boolean>((resolve) => setPending({ description, resolve })),
      })
      await addChatMessage(car.id, 'assistant', reply || '(no answer)')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setPending(null)
      setBusy(false)
    }
  }

  function resolvePending(approved: boolean) {
    pending?.resolve(approved)
    setPending(null)
  }

  return { messages, busy, error, pending, send, resolvePending }
}
