import { ObdPanel } from './ObdPanel'
import { DashboardLightPanel } from './DashboardLightPanel'

// Deterministic diagnostics — OBD-II code lookup and the dashboard warning-light
// decoder. Both are offline table lookups (no AI, no key, no network), so this
// whole screen works with nothing configured. When a code needs judgement about
// what to do, `onAskAI` hands the question to the AI assistant on its own tab.
export function DiagnosticsScreen({ onAskAI }: { onAskAI: (prompt: string) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <ObdPanel onAsk={onAskAI} />
      <DashboardLightPanel />
    </div>
  )
}
