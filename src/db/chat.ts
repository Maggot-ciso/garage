import { db, type ChatMessage } from './db'
import { newId } from './id'

export async function addChatMessage(
  carId: string,
  role: ChatMessage['role'],
  text: string,
): Promise<ChatMessage> {
  const message: ChatMessage = {
    id: newId(),
    carId,
    role,
    text,
    createdAt: new Date().toISOString(),
  }
  await db.chatMessages.add(message)
  return message
}

export async function chatForCar(carId: string): Promise<ChatMessage[]> {
  const messages = await db.chatMessages.where('carId').equals(carId).toArray()
  return messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function clearChat(carId: string): Promise<void> {
  await db.chatMessages.where('carId').equals(carId).delete()
}
