import type { WipItem, WipKind } from '../types'

export const STALE_DAYS = 14
const DAY_MS = 86_400_000

const clean = (s: string) => s.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim()

// Title: frontmatter `title:` if the file opens with ---, else the first non-blank line
function titleOf(lines: string[], file: string): string {
  if (lines[0]?.trim() === '---') {
    const end = lines.indexOf('---', 1)
    const fm = lines.slice(1, end > 0 ? end : undefined)
    const t = fm.find(l => /^title\s*:/.test(l))
    if (t) return clean(t.replace(/^title\s*:/, '')).slice(0, 80)
  }
  const first = lines.find(l => l.trim() && l.trim() !== '---')
  return (first ? clean(first) : file).slice(0, 80)
}

export function parseWip(file: string, text: string, mtimeMs: number, nowMs: number): WipItem {
  const lines = text.split('\n')
  const title = titleOf(lines, file.replace(/\.md$/, ''))
  const raw = lines.find(l => /^\**다음\s*:/.test(l.trim()))
  const next = raw ? clean(raw.trim().replace(/^\**다음\s*:\**/, '')) : ''
  let kind: WipKind
  if (!next) kind = 'nonext'
  else if (/^대기/.test(next) || /보류/.test(next.slice(0, 40))) kind = 'held'
  else if (ageDays(mtimeMs, nowMs) >= STALE_DAYS) kind = 'stale'
  else kind = 'active'
  return { file, title, next, mtimeMs, kind }
}

export const ageDays = (mtimeMs: number, nowMs: number) => Math.max(0, Math.floor((nowMs - mtimeMs) / DAY_MS))

// Needs-attention first: stale, then no next step, then active, held last; newest first within each
const RANK: Record<WipKind, number> = { stale: 0, nonext: 1, active: 2, held: 3 }
export const sortItems = (items: WipItem[]) =>
  [...items].sort((a, b) => RANK[a.kind] - RANK[b.kind] || b.mtimeMs - a.mtimeMs)

export function bandLine(items: WipItem[]): string {
  const n = (k: WipKind) => items.filter(i => i.kind === k).length
  const parts = [`wip ${items.length}`]
  if (n('held')) parts.push(`대기 ${n('held')}`)
  if (n('stale')) parts.push(`${STALE_DAYS}일↑ ${n('stale')}`)
  if (n('nonext')) parts.push(`다음 없음 ${n('nonext')}`)
  return parts.join(' · ')
}
