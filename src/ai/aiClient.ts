import Anthropic from '@anthropic-ai/sdk'
import { getSetting, SETTING_KEYS } from '../db/settings'

// Model routing. 'auto' (the default) picks per task: extraction is a simple
// vision job → cheapest model; chat carries diagnostic weight → Sonnet.
// The user can pin any model in Settings instead.
export const AUTO_MODEL = 'auto'
export const MODEL_OPTIONS = [
  { value: 'auto', label: 'Auto — pick per task (recommended)' },
  { value: 'claude-sonnet-5', label: 'Sonnet — balanced quality/price' },
  { value: 'claude-opus-4-8', label: 'Opus — best, ~3× Sonnet price' },
  { value: 'claude-haiku-4-5', label: 'Haiku — fastest and cheapest' },
] as const

export type AiTask = 'chat' | 'extract'

const AUTO_BY_TASK: Record<AiTask, string> = {
  chat: 'claude-sonnet-5',
  extract: 'claude-haiku-4-5',
}

export const DEFAULT_MODEL = AUTO_MODEL

export function resolveModel(stored: string | undefined, task: AiTask): string {
  if (!stored || stored === AUTO_MODEL) return AUTO_BY_TASK[task]
  return stored
}

export class MissingApiKeyError extends Error {
  constructor() {
    super('No AI API key configured. Add one in Settings.')
    this.name = 'MissingApiKeyError'
  }
}

export async function isAiConfigured(): Promise<boolean> {
  return Boolean(await getSetting(SETTING_KEYS.aiApiKey))
}

export async function getAiClient(): Promise<{ client: Anthropic; model: (task: AiTask) => string }> {
  const apiKey = await getSetting(SETTING_KEYS.aiApiKey)
  if (!apiKey) throw new MissingApiKeyError()
  const stored = await getSetting(SETTING_KEYS.aiModel)
  return {
    // The user's own key goes directly from their device to the provider —
    // no server in between, which is why dangerouslyAllowBrowser is correct here.
    client: new Anthropic({ apiKey, dangerouslyAllowBrowser: true }),
    model: (task) => resolveModel(stored, task),
  }
}

export function translateAiError(err: unknown): Error {
  if (err instanceof Anthropic.AuthenticationError) {
    return new Error('The API key was rejected — check it in Settings.')
  }
  if (err instanceof Anthropic.NotFoundError) {
    return new Error('Unknown model — check the model name in Settings.')
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new Error('Rate limited by the provider — try again in a minute.')
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new Error('Could not reach the AI provider — are you online?')
  }
  return err instanceof Error ? err : new Error(String(err))
}

export interface AiRequest {
  system?: string
  messages: Anthropic.MessageParam[]
  maxTokens?: number
  task?: AiTask
}

export async function askAi(request: AiRequest): Promise<string> {
  const { client, model } = await getAiClient()

  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      model: model(request.task ?? 'chat'),
      max_tokens: request.maxTokens ?? 4096,
      ...(request.system ? { system: request.system } : {}),
      messages: request.messages,
    })
  } catch (err) {
    throw translateAiError(err)
  }

  if (response.stop_reason === 'refusal') {
    throw new Error('The AI declined to answer this request.')
  }

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
}
