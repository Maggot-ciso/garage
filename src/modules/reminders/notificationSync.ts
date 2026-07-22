import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { db } from '../../db/db'
import { planNotifications } from './notifications'

// Cancel-all-and-reschedule on every reminder change. Per-operation bookkeeping
// would have to track create/edit/complete/delete/tyre-swap/backup-import — a
// full resync is idempotent and can't drift. Runs only in the native shell;
// the web/PWA build silently does nothing (no push entitlement there anyway).
//
// Runs are serialized: rapid mutations (Done + recurring roll-forward, tyre
// swaps) would otherwise interleave cancel/schedule and could strand a
// notification for a deleted reminder. A queued flag coalesces bursts into
// one trailing resync.
let inFlight: Promise<void> | null = null
let queued = false

export function syncReminderNotifications(): Promise<void> {
  if (inFlight) {
    queued = true
    return inFlight
  }
  inFlight = doSync().finally(() => {
    inFlight = null
    if (queued) {
      queued = false
      void syncReminderNotifications()
    }
  })
  return inFlight
}

async function doSync(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    let { display } = await LocalNotifications.checkPermissions()
    if (display === 'prompt' || display === 'prompt-with-rationale') {
      display = (await LocalNotifications.requestPermissions()).display
    }
    if (display !== 'granted') return

    const [reminders, cars] = await Promise.all([db.reminders.toArray(), db.cars.toArray()])
    const planned = planNotifications(reminders, cars, new Date())

    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map((n) => ({ id: n.id })),
      })
    }
    if (planned.length > 0) {
      await LocalNotifications.schedule({
        notifications: planned.map((p) => ({
          id: p.id,
          title: p.title,
          body: p.body,
          schedule: { at: p.at },
        })),
      })
    }
  } catch (err) {
    // Notifications are a convenience layer over the due banner — a scheduling
    // failure must never break the app, but it shouldn't be invisible either.
    console.warn('Reminder notification sync failed', err)
  }
}
