import { db } from './db'

export const SETTING_KEYS = {
  aiApiKey: 'aiApiKey',
  aiModel: 'aiModel',
  aiWebSearch: 'aiWebSearch',
  lastBackupAt: 'lastBackupAt',
  activeCarId: 'activeCarId',
  language: 'language',
} as const

export async function getSetting(key: string): Promise<string | undefined> {
  return (await db.settings.get(key))?.value
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value })
}

export async function removeSetting(key: string): Promise<void> {
  await db.settings.delete(key)
}
