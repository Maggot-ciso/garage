import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { addChatMessage, chatForCar, clearChat } from './chat'

beforeEach(async () => {
  await db.chatMessages.clear()
})

describe('chat repository', () => {
  it('stores and returns messages in order, per car', async () => {
    await addChatMessage('car-1', 'user', 'hello')
    await addChatMessage('car-1', 'assistant', 'hi, how can I help?')
    await addChatMessage('car-2', 'user', 'other car')
    const chat = await chatForCar('car-1')
    expect(chat.map((m) => m.role)).toEqual(['user', 'assistant'])
    expect(chat[0]?.text).toBe('hello')
  })

  it('clears only the requested car', async () => {
    await addChatMessage('car-1', 'user', 'a')
    await addChatMessage('car-2', 'user', 'b')
    await clearChat('car-1')
    expect(await chatForCar('car-1')).toHaveLength(0)
    expect(await chatForCar('car-2')).toHaveLength(1)
  })
})
