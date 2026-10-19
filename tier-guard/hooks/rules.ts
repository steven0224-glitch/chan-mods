// CLAUDE.md §2 three-tier routing (2026-10-08)
export const EXPECTED: Record<string, string> = {
  'deep-reasoner': 'opus',
  'default-worker': 'sonnet',
  'task-worker': 'haiku',
}

const FAMILIES = ['fable', 'opus', 'sonnet', 'haiku']
export const familyOf = (model: string | undefined) =>
  FAMILIES.find(f => (model ?? '').toLowerCase().includes(f)) ?? ''

const EXPENSIVE = ['fable', 'opus']

// A warning for a spawn that ran on `model`, or '' when it follows the rules
export function spawnWarning(subagentType: string, model: string): string {
  const fam = familyOf(model)
  if (subagentType === 'Explore' && EXPENSIVE.includes(fam)) {
    return `Explore 가 ${model} 로 실행 — 싼 탐색은 task-worker (§2)`
  }
  const want = EXPECTED[subagentType]
  if (want && fam && fam !== want) return `${subagentType} 는 ${want} 여야 하는데 ${model} (§2)`
  return ''
}

export const isLowEffortTaskWorker = (subagentType: string | undefined, effort: unknown) =>
  subagentType === 'task-worker' && effort === 'low'

type Step = { model: string; effort?: unknown }
// What changed between two main-loop requests, or '' when nothing did
export function switchNote(prev: Step | null, next: Step): string {
  if (!prev) return ''
  const parts: string[] = []
  if (prev.model !== next.model) parts.push(`모델 ${prev.model}→${next.model}`)
  if (prev.effort !== next.effort) parts.push(`effort ${String(prev.effort ?? '-')}→${String(next.effort ?? '-')}`)
  return parts.join(', ')
}
