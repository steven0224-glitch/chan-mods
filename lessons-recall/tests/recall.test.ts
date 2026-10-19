import { expect, mock, test } from 'claude-code/testing'

const FILES: Record<string, string> = {
  '2026-08-06-graphify-writes-output-next-to-root.md': '# graphify 재빌드 출력은 root 옆에',
  '2026-07-20-onedrive-symlink-not-synced.md': '# OneDrive 심링크는 동기화되지 않는다',
}

// A fake ~/.claude/lessons; returns the clock so a test can let the background index build
function stubLessons(on: any, lines: string[], paths: string[] = []) {
  const clock = mock.clock(on)
  mock.env(on, { HOME: '/home/me' })
  on('session.start', () => ({ cwd: '/home/me' }))
  on('command.register', () => ({ value: undefined }))
  on('ui.log', (_: any, e: any) => { lines.push(String(e.text)); return { value: undefined } })
  on('fs.exists', () => ({ value: true }))
  on('fs.list', (_: any, e: any) => {
    paths.push(String(e.path))
    return { value: Object.keys(FILES).map(name => ({ name, kind: 'file', size: 1, mtimeMs: 0, isLink: false })) }
  })
  on('fs.read', (_: any, e: any) => ({ value: FILES[String(e.path).split('/').pop()!] }))
  // Claude Code's side of a submit: hand back what reached it
  on('prompt.submit', (_: any, e: any) => ({ text: e.text, context: e.context }))
  return clock
}

const typed = (text: string) => ({ text, wait: false, origin: { kind: 'composer' } })

test('a matching prompt gets the lesson as context and a log line', async ($, on) => {
  const lines: string[] = []
  const clock = stubLessons(on, lines)
  await $.session.start({ cwd: '/home/me' })
  await clock.settle()
  const out: any = await $.prompt.submit(typed('graphify 그래프 재빌드 해줘'))
  expect(out.text).toBe('graphify 그래프 재빌드 해줘')
  expect(out.context.length).toBe(1)
  expect(out.context[0]).toMatch(/lessons\/2026-08-06-graphify-writes-output-next-to-root\.md/)
  expect(lines[0]).toMatch(/^교훈 1건 첨부: graphify/)
})

test('no match, another session, or a slash command passes unchanged', async ($, on) => {
  const lines: string[] = []
  const clock = stubLessons(on, lines)
  await $.session.start({ cwd: '/home/me' })
  await clock.settle()
  const none: any = await $.prompt.submit(typed('오늘 저녁 메뉴 추천해줘'))
  expect(none.context).toBeUndefined()
  const peer: any = await $.prompt.submit({ ...typed('graphify 재빌드'), origin: { kind: 'peer' } })
  expect(peer.context).toBeUndefined()
  expect(lines).toEqual([])
})

test('before the index is built, prompts pass unchanged and nothing waits on disk', async ($, on) => {
  const lines: string[] = []
  const clock = mock.clock(on)
  mock.env(on, { HOME: '/home/me' })
  on('session.start', () => ({ cwd: '/home/me' }))
  on('command.register', () => ({ value: undefined }))
  on('fs.exists', () => ({ value: true }))
  on('fs.list', async () => { await clock.sleep(60_000); return { value: [] } })
  on('prompt.submit', (_: any, e: any) => ({ text: e.text, context: e.context }))
  await $.session.start({ cwd: '/home/me' })
  await clock.settle()
  const out: any = await $.prompt.submit(typed('graphify 재빌드 해줘'))
  expect(out.context).toBeUndefined()
})

test('/lessons reports the index size and the last attached lessons', async ($, on) => {
  const lines: string[] = []
  const clock = stubLessons(on, lines)
  await $.session.start({ cwd: '/home/me' })
  await clock.settle()
  const empty = await $.command.run({ command: 'lessons', args: '' })
  expect(empty.text).toBe('색인 2건 (~/.claude/lessons)\n이 세션에서 첨부한 교훈 없음')
  await $.prompt.submit(typed('graphify 그래프 재빌드 해줘'))
  const after = await $.command.run({ command: 'lessons', args: '' })
  expect(after.text).toMatch(/^색인 2건 .*\n마지막 첨부:\n- 2026-08-06-graphify-writes-output-next-to-root\.md — graphify 재빌드 출력은 root 옆에 \(graphify, 재빌드\)$/)
})

test('a configured dir is read instead of ~/.claude/lessons', { options: { dir: '/notes/lessons' } }, async ($, on) => {
  const lines: string[] = []
  const paths: string[] = []
  const clock = stubLessons(on, lines, paths)
  await $.session.start({ cwd: '/home/me' })
  await clock.settle()
  expect(paths).toEqual(['/notes/lessons'])
  const out = await $.command.run({ command: 'lessons', args: '' })
  expect(out.text).toMatch(/^색인 2건 \(\/notes\/lessons\)/)
})
