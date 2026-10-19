import { expect, test } from 'claude-code/testing'

import { buildIndex, lessonOf, recall, tokens } from '../hooks/match.ts'

test('tokens strip Korean particles, short words and stop words', () => {
  // 로/를/는 come off; one-syllable 중 is too short
  expect(tokens('mlx whisper로 한국어 강의를 전사하는 중')).toEqual(['mlx', 'whisper', '한국어', '강의', '전사하'])
  expect(tokens('the a to 그리고 확인 claude')).toEqual([])
})

test('a lesson takes its slug without the date and its first line as title', () => {
  const l = lessonOf('2026-10-17-mlx-whisper-ko-pass.md', '\n# mlx-whisper 한국어 고정 패스는 느려진다\n본문')
  expect(l.title).toBe('mlx-whisper 한국어 고정 패스는 느려진다')
  expect(l.keys).toContain('whisper')
  expect(l.keys).toContain('한국어')
  expect(l.keys).not.toContain('2026')
})

const INDEX = buildIndex([
  lessonOf('2026-10-17-mlx-whisper-ko-pass.md', '# mlx-whisper 한국어 고정 패스'),
  lessonOf('2026-08-06-graphify-writes-output-next-to-root.md', '# graphify 재빌드 출력은 root 옆에'),
  lessonOf('2026-07-20-onedrive-symlink-not-synced.md', '# OneDrive 심링크는 동기화되지 않는다'),
  lessonOf('2026-09-01-claude-hooks-timeout.md', '# claude 훅 타임아웃'),
  lessonOf('2026-09-02-claude-settings-merge.md', '# claude 설정 병합'),
])

test('two shared words find the lesson; one common word does not', () => {
  expect(recall(INDEX, 'graphify 재빌드 해줘').map(h => h.file)).toEqual(['2026-08-06-graphify-writes-output-next-to-root.md'])
  expect(recall(INDEX, 'claude 오늘 뭐하지')).toEqual([])
  expect(recall(INDEX, '오늘 저녁 메뉴 추천')).toEqual([])
})

test('at most the limit, best score first', () => {
  const hits = recall(INDEX, 'mlx whisper 한국어 그리고 onedrive 심링크', 1)
  expect(hits.length).toBe(1)
  expect(hits[0].file).toBe('2026-10-17-mlx-whisper-ko-pass.md')
})
