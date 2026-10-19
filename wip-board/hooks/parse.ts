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

// 오늘 · 어제 · 5일 전 · 3주 전 · 2달 전
export function ageLabel(days: number): string {
  if (days === 0) return '오늘'
  if (days === 1) return '어제'
  if (days < 14) return `${days}일 전`
  if (days < 60) return `${Math.floor(days / 7)}주 전`
  return `${Math.floor(days / 30)}달 전`
}

// What each kind means, in the order the pane and the band show them (needs attention first)
export const MARK: Record<WipKind, string> = { stale: '⚠', nonext: '?', active: '●', held: '◌' }
export const COLOR: Record<WipKind, 'yellow' | 'red' | 'green' | 'gray'> = { stale: 'yellow', nonext: 'red', active: 'green', held: 'gray' }
export const LABEL: Record<WipKind, string> = { stale: '오래됨', nonext: '다음 행동 없음', active: '진행 중', held: '대기' }
export const HINT: Record<WipKind, string> = {
  stale: `${STALE_DAYS}일 넘게 손대지 않음 — 이어가거나 대기로 돌리거나 지울 것`,
  nonext: '파일에 다음: 줄이 없음 — 다음 행동 한 줄을 적을 것',
  active: '',
  held: '깨우는 조건이 올 때까지 둠',
}
export const KINDS: WipKind[] = ['stale', 'nonext', 'active', 'held']

// Needs-attention first: stale, then no next step, then active, held last; newest first within each
const RANK: Record<WipKind, number> = { stale: 0, nonext: 1, active: 2, held: 3 }
export const sortItems = (items: WipItem[]) =>
  [...items].sort((a, b) => RANK[a.kind] - RANK[b.kind] || b.mtimeMs - a.mtimeMs)

// `wip 9 · ⚠ 오래됨 2 · ? 다음 없음 3 · ◌ 대기 1` — active needs no call-out
export function bandLine(items: WipItem[]): string {
  const n = (k: WipKind) => items.filter(i => i.kind === k).length
  const parts = [`wip ${items.length}`]
  if (n('stale')) parts.push(`${MARK.stale} ${LABEL.stale} ${n('stale')}`)
  if (n('nonext')) parts.push(`${MARK.nonext} 다음 없음 ${n('nonext')}`)
  if (n('held')) parts.push(`${MARK.held} ${LABEL.held} ${n('held')}`)
  return parts.join(' · ')
}
