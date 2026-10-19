import { expect, mock, test } from 'claude-code/testing'

const FILES: Record<string, string> = {
  'README.md': '# 규약',
  'grad.md': '# 학업계획서\n상태: v2\n다음: 수험번호 입력',
  'bank.md': '# 백필\n다음: **다음 주로 보류.**',
}

const logs: string[] = []
const BAND_PROPS = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 10 }, view: {} }

// Stand in for the disk: a fake ~/.claude/wip with the files above
function stubDisk(on: any, paths: string[] = []) {
  const clock = mock.clock(on)
  mock.env(on, { HOME: '/home/me' })
  mock.store(on)
  on('session.start', () => ({ cwd: '/home/me' }))
  on('command.register', () => ({ value: undefined }))
  on('ui.log', (_: any, e: any) => { logs.push(String(e.text ?? JSON.stringify(e))); return { value: undefined } })
  on('fs.exists', () => ({ value: true }))
  on('fs.list', (_: any, e: any) => {
    paths.push(String(e.path))
    return { value: Object.keys(FILES).map(name => ({ name, kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false })) }
  })
  on('fs.read', (_: any, e: any) => ({ value: FILES[String(e.path).split('/').pop()!] }))
  return clock
}

test('/wip band toggles the band and says so', async ($, on) => {
  const clock = stubDisk(on)
  await $.session.start({ cwd: '/home/me' })
  await clock.settle()
  const off = await $.command.run({ command: 'wip', args: 'band' })
  expect(off.text).toBe('wip 줄 숨김 · /wip band 로 다시 켬')
  const back = await $.command.run({ command: 'wip', args: 'band' })
  expect(back.text).toBe('wip 줄 표시')
  expect(logs).toEqual([])
})

test('the band counts open items, README excluded, on every surface', async ($, on) => {
  const clock = stubDisk(on)
  // Nothing else draws in the band
  on('ui.render', ($: any, e: any) => $.ui.resolve(e).Box({ children: [] }))
  await $.session.start({ cwd: '/home/me' })
  await clock.settle()
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'wip-board', surface, component: 'AbovePrompt', props: BAND_PROPS })
    expect(await ui.find({ type: 'Text', text: /wip 2 · 대기 1/ })).toBeDefined()
    await ui.unmount()
  }
})

test('the pane lists items, held last, and 이어서 fills the prompt', async ($, on) => {
  const clock = stubDisk(on)
  const filled: string[] = []
  on('prompt.fill', (_: any, e: any) => { filled.push(e.text); return { isFilled: true } })
  await $.session.start({ cwd: '/home/me' })
  await clock.settle()
  const PANE_PROPS = {
    title: 'wip', isFocused: true, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {},
  }
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'wip-board', surface, component: 'Pane', requestId: 'wip-board', props: PANE_PROPS })
    expect(await ui.find({ type: 'Text', text: '학업계획서' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /다음: 수험번호 입력/ })).toBeDefined()
    await ui.press({ key: 'go-grad.md' })
    await ui.unmount()
  }
  expect(filled[0]).toBe('wip/grad.md 읽고 다음 행동 이어서 진행')
})

test('after /clear the band reloads the list without a new session.start', async ($, on) => {
  const clock = stubDisk(on)
  on('classic.SessionStart', () => ({}))
  on('ui.render', ($: any, e: any) => $.ui.resolve(e).Box({ children: [] }))
  // /clear resets $.state and fires only classic.SessionStart
  await $.classic.SessionStart({ source: 'clear' })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'wip-board', surface: 'terminal', component: 'AbovePrompt', props: BAND_PROPS })
  expect(await ui.find({ type: 'Text', text: /wip 2 · 대기 1/ })).toBeDefined()
})

test('an unreadable file is skipped, the rest still show', async ($, on) => {
  mock.env(on, { HOME: '/home/me' })
  mock.store(on)
  const clock = mock.clock(on)
  on('session.start', () => ({ cwd: '/home/me' }))
  on('command.register', () => ({ value: undefined }))
  const lines: string[] = []
  on('ui.log', (_: any, e: any) => { lines.push(String(e.text)); return { value: undefined } })
  on('fs.exists', () => ({ value: true }))
  on('fs.list', () => ({ value: ['a.md', 'b.md'].map(name => ({ name, kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false })) }))
  on('fs.read', (_: any, e: any) => (String(e.path).endsWith('a.md') ? { deny: 'EBUSY' } : { value: '# B\n다음: go' }))
  on('ui.render', ($: any, e: any) => $.ui.resolve(e).Box({ children: [] }))
  await $.session.start({ cwd: '/home/me' })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'wip-board', surface: 'terminal', component: 'AbovePrompt', props: BAND_PROPS })
  expect(await ui.find({ type: 'Text', text: /^wip 1/ })).toBeDefined()
  expect(lines).toEqual(['wip 1개 읽기 실패 — 건너뜀'])
})

test('a hung disk (OneDrive dataless file) does not hold session start', async ($, on) => {
  mock.env(on, { HOME: '/home/me' })
  mock.store(on)
  const clock = mock.clock(on)
  on('session.start', () => ({ cwd: '/home/me' }))
  on('command.register', () => ({ value: undefined }))
  on('fs.exists', () => ({ value: true }))
  // The listing answers only after a minute of test time
  on('fs.list', async () => { await clock.sleep(60_000); return { value: [] } })
  let started = false
  const run = $.session.start({ cwd: '/home/me' }).then(() => { started = true })
  await clock.settle()
  await run
  expect(started).toBe(true)
})

test('a configured dir replaces ~/.claude/wip', { options: { dir: '~/notes/wip' } }, async ($, on) => {
  const paths: string[] = []
  const clock = stubDisk(on, paths)
  await $.session.start({ cwd: '/home/me' })
  await clock.settle()
  expect(paths).toEqual(['/home/me/notes/wip'])
})
