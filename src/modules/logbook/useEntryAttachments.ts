import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Attachment } from '../../db/db'
import { addAttachment, attachmentsForEntry, deleteAttachment } from '../../db/attachments'
import { newId } from '../../db/id'
import { prepareAttachment } from './imageProcessing'

// A new entry has no id yet, so its attachments are held in memory until the
// entry is saved and persistTo() can key them to the real id. An entry being
// edited already exists, so its attachments write through immediately.
export function useEntryAttachments({ carId, entryId }: { carId: string; entryId?: string }) {
  const [pending, setPending] = useState<Attachment[]>([])
  const [busy, setBusy] = useState(false)

  const saved = useLiveQuery(
    () => (entryId ? attachmentsForEntry(entryId) : Promise.resolve([])),
    [entryId],
  )

  const attachments = entryId ? (saved ?? []) : pending

  async function add(files: FileList) {
    setBusy(true)
    try {
      for (const file of Array.from(files)) {
        const prepared = await prepareAttachment(file)
        if (entryId) {
          await addAttachment({ ...prepared, carId, entryId, size: prepared.bytes.byteLength })
        } else {
          setPending((current) => [
            ...current,
            {
              ...prepared,
              id: newId(),
              carId,
              entryId: '',
              size: prepared.bytes.byteLength,
              createdAt: new Date().toISOString(),
            },
          ])
        }
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove(attachment: Attachment) {
    if (entryId) await deleteAttachment(attachment.id)
    else setPending((current) => current.filter((a) => a.id !== attachment.id))
  }

  async function persistTo(newEntryId: string) {
    for (const attachment of pending) {
      const { id: _id, entryId: _entryId, createdAt: _createdAt, ...fields } = attachment
      await addAttachment({ ...fields, entryId: newEntryId })
    }
    setPending([])
  }

  return { attachments, busy, add, remove, persistTo, hasPending: pending.length > 0 }
}
