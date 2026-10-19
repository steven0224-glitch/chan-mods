import { expect, test } from 'claude-code/testing'

import { ageLabel, bandLine, parseWip, sortItems } from '../hooks/parse.ts'

const NOW = Date.UTC(2026, 9, 19)
const daysAgo = (d: number) => NOW - d * 86_400_000

test('plain file: title from # line, next from 다음: line', () => {
  const it = parseWip('a.md', '# 데스크탑 처분\n상태: 완료\n다음: 디스크 초기화', daysAgo(1), NOW)
  expect(it.title).toBe('데스크탑 처분')
  expect(it.next).toBe('디스크 초기화')
  expect(it.kind).toBe('active')
})

test('frontmatter file takes title:, not ---', () => {
  const it = parseWip('c.md', '---\ntitle: 코퍼스 위생\n---\n\n# 상태\n', daysAgo(1), NOW)
  expect(it.title).toBe('코퍼스 위생')
  expect(it.kind).toBe('nonext')
})

test('bold first line and bold next are cleaned; 보류 is held', () => {
  const it = parseWip('m.md', '**⚠️ 방향 전환**\n다음: **다음 주로 보류(사용자 결정).** 재개 시', daysAgo(30), NOW)
  expect(it.title).toBe('⚠️ 방향 전환')
  expect(it.next.startsWith('다음 주로 보류')).toBe(true)
  expect(it.kind).toBe('held')
})

test('대기 is held even when old; untouched 14 days is stale', () => {
  expect(parseWip('h.md', '# x\n다음: 대기 — 릴리스', daysAgo(40), NOW).kind).toBe('held')
  expect(parseWip('s.md', '# x\n다음: 실행', daysAgo(14), NOW).kind).toBe('stale')
})

test('sort puts stale first and held last; band line counts each kind', () => {
  const list = sortItems([
    parseWip('held.md', '# h\n다음: 대기', daysAgo(1), NOW),
    parseWip('act.md', '# a\n다음: go', daysAgo(1), NOW),
    parseWip('old.md', '# o\n다음: go', daysAgo(20), NOW),
  ])
  expect(list.map(i => i.file)).toEqual(['old.md', 'act.md', 'held.md'])
  expect(bandLine(list)).toBe('wip 3 · ⚠ 오래됨 1 · ◌ 대기 1')
})

test('age label reads as a person says it', () => {
  expect(['오늘', '어제', '5일 전', '2주 전', '3달 전']).toEqual([0, 1, 5, 14, 100].map(ageLabel))
})
