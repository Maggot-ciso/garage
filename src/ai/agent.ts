import Anthropic from '@anthropic-ai/sdk'
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema'
import { db, ENTRY_CATEGORIES, type Car, type ChatMessage, type EntryCategory } from '../db/db'
import { addEntry } from '../db/entries'
import { addReminder } from '../db/reminders'
import { updateCar } from '../db/cars'
import { buildCarContext, agentSystemPrompt } from './context'
import { getAiClient, translateAiError } from './aiClient'
import { getSetting, SETTING_KEYS } from '../db/settings'

// The owner approves or declines a proposed change from the chat UI.
export type ConfirmFn = (description: string) => Promise<boolean>

const HISTORY_LIMIT = 20
const DECLINED = 'The owner declined this action. Do not retry it unless asked.'

function makeTools(car: Car, confirm: ConfirmFn) {
  const searchLogbook = betaTool({
    name: 'search_logbook',
    description:
      'Search this car\'s full logbook (beyond the recent entries in context). Returns matching entries.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'Text to find in notes/category (optional)' },
        category: { type: 'string', enum: [...ENTRY_CATEGORIES], description: 'Optional filter' },
      },
    },
    run: async (input: { text?: string; category?: string }) => {
      const all = await db.entries.where('carId').equals(car.id).toArray()
      const needle = input.text?.toLowerCase()
      const hits = all
        .filter((e) => !input.category || e.category === input.category)
        .filter(
          (e) =>
            !needle ||
            e.notes?.toLowerCase().includes(needle) ||
            e.category.includes(needle),
        )
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 30)
      if (hits.length === 0) return 'No matching entries.'
      return hits
        .map(
          (e) =>
            `${e.date} ${e.category}: ${e.cost.toFixed(2)}€ at ${e.odometer} km${e.litres ? `, ${e.litres} L` : ''}${e.notes ? ` — ${e.notes}` : ''}`,
        )
        .join('\n')
    },
  })

  const addEntryTool = betaTool({
    name: 'add_entry',
    description:
      'Add a logbook entry for this car. The owner must confirm before it is saved.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD' },
        odometer: { type: 'number', description: 'km' },
        cost: { type: 'number', description: 'Total cost in €' },
        category: { type: 'string', enum: [...ENTRY_CATEGORIES] },
        litres: { type: 'number', description: 'Fuel only' },
        fullTank: { type: 'boolean', description: 'Fuel only — was the tank filled to full?' },
        notes: { type: 'string' },
      },
      required: ['date', 'odometer', 'cost', 'category'],
    },
    run: async (input: {
      date: string
      odometer: number
      cost: number
      category: EntryCategory
      litres?: number
      fullTank?: boolean
      notes?: string
    }) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return 'Invalid date format, use YYYY-MM-DD.'
      if (input.odometer < 0 || input.cost < 0) return 'Odometer and cost must be 0 or more.'
      const ok = await confirm(
        `Add ${input.category} entry: ${input.date}, ${input.cost.toFixed(2)} € at ${input.odometer.toLocaleString()} km${input.litres ? `, ${input.litres} L` : ''}${input.notes ? ` (${input.notes})` : ''}`,
      )
      if (!ok) return DECLINED
      await addEntry({
        carId: car.id,
        date: input.date,
        odometer: input.odometer,
        cost: input.cost,
        category: input.category,
        ...(input.notes ? { notes: input.notes } : {}),
        ...(input.category === 'fuel' && input.litres
          ? {
              litres: input.litres,
              pricePerLitre: Math.round((input.cost / input.litres) * 1000) / 1000,
              fullTank: input.fullTank ?? true,
            }
          : {}),
      })
      return 'Entry saved.'
    },
  })

  const addReminderTool = betaTool({
    name: 'add_reminder',
    description:
      'Create a maintenance reminder for this car (due at a mileage, a date, or both). The owner must confirm.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'e.g. "Oil change"' },
        dueOdometer: { type: 'number', description: 'Due at this km reading' },
        dueDate: { type: 'string', description: 'Due by this date, YYYY-MM-DD' },
        notes: { type: 'string' },
      },
      required: ['title'],
    },
    run: async (input: {
      title: string
      dueOdometer?: number
      dueDate?: string
      notes?: string
    }) => {
      if (input.dueOdometer === undefined && !input.dueDate)
        return 'A reminder needs dueOdometer, dueDate, or both.'
      const due = [
        input.dueOdometer !== undefined ? `at ${input.dueOdometer.toLocaleString()} km` : null,
        input.dueDate ? `by ${input.dueDate}` : null,
      ]
        .filter(Boolean)
        .join(' or ')
      const ok = await confirm(`Add reminder: ${input.title} — due ${due}`)
      if (!ok) return DECLINED
      await addReminder({
        carId: car.id,
        title: input.title,
        ...(input.dueOdometer !== undefined ? { dueOdometer: input.dueOdometer } : {}),
        ...(input.dueDate ? { dueDate: input.dueDate } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
      })
      return 'Reminder saved.'
    },
  })

  const updateOdometerTool = betaTool({
    name: 'update_odometer',
    description: "Update the car profile's current odometer reading. The owner must confirm.",
    inputSchema: {
      type: 'object' as const,
      properties: { odometer: { type: 'number', description: 'Current km' } },
      required: ['odometer'],
    },
    run: async (input: { odometer: number }) => {
      if (input.odometer < 0) return 'Odometer must be 0 or more.'
      const ok = await confirm(
        `Update odometer: ${car.odometer.toLocaleString()} → ${input.odometer.toLocaleString()} km`,
      )
      if (!ok) return DECLINED
      const { make, model, year, engine, vin } = car
      await updateCar(car.id, {
        make,
        model,
        year,
        odometer: input.odometer,
        ...(engine ? { engine } : {}),
        ...(vin ? { vin } : {}),
      })
      return 'Odometer updated.'
    },
  })

  return [searchLogbook, addEntryTool, addReminderTool, updateOdometerTool]
}

export async function runAgentTurn(options: {
  car: Car
  transcript: ChatMessage[] // includes the latest user message
  confirm: ConfirmFn
  webSearch: boolean
}): Promise<string> {
  const { car, transcript, confirm, webSearch } = options
  const [entries, reminders, tyreSets, otherCars, attachments, language] = await Promise.all([
    db.entries.toArray(),
    db.reminders.toArray(),
    // Tyres were missing entirely: a tyre question used to be answered with no
    // tyre data at all.
    db.tyreSets.toArray(),
    db.cars.toArray(),
    db.attachments.where('carId').equals(car.id).toArray(),
    // Read the stored language here rather than threading it through the chat
    // UI — the agent already reads its own context from the database.
    getSetting(SETTING_KEYS.language),
  ])
  const system = agentSystemPrompt(
    buildCarContext({
      car,
      entries,
      reminders,
      tyreSets,
      otherCars,
      // Names and dates only — never the bytes.
      documents: attachments
        .filter((a) => !a.entryId)
        .map(({ name, createdAt }) => ({ name, createdAt })),
    }),
    language === 'sk' ? 'sk' : 'en',
  )

  const messages = transcript.slice(-HISTORY_LIMIT).map((m) => ({
    role: m.role,
    content: m.text,
  }))

  const { client, model } = await getAiClient()
  const tools = [
    ...makeTools(car, confirm),
    // Server-side tool — runs on the provider, gives live part/price links.
    ...(webSearch
      ? [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 } as never]
      : []),
  ]

  try {
    const runner = client.beta.messages.toolRunner({
      model: model('chat'),
      max_tokens: 2048,
      system,
      tools,
      messages,
      max_iterations: 8,
    })

    let finalMessage: Anthropic.Beta.BetaMessage | undefined
    for await (const message of runner) {
      finalMessage = message
      // Server-tool loop limit — push the turn back to resume (see SDK docs)
      if (message.stop_reason === 'pause_turn') {
        runner.pushMessages({ role: 'assistant', content: message.content })
      }
    }
    if (!finalMessage) throw new Error('The AI returned no response.')
    if (finalMessage.stop_reason === 'refusal') {
      throw new Error('The AI declined to answer this request.')
    }
    return finalMessage.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()
  } catch (err) {
    throw translateAiError(err)
  }
}
