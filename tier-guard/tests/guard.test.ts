import { expect, test } from 'claude-code/testing'

const SPAWN = {
  tool_use_id: 'tu1', prompt: 'find x', description: 'find x', subagentType: 'Explore',
  provider: { plugin: 'engine', tier: 'core' }, parentModel: 'claude-fable-5-1', background: false, fork: false,
}

// Stubs every test needs; `spawnModel` is what the engine resolves the subagent to
function base(on: any, spawnModel: string, seen: { model?: string }[], lines: string[], toasts: string[], efforts: unknown[] = []) {
  on('session.start', () => ({ cwd: '/w' }))
  on('command.register', () => ({ value: undefined }))
  on('ui.log', (_: any, e: any) => { lines.push(String(e.text)); return { value: undefined } })
  on('ui.toast', (_: any, e: any) => { toasts.push(String(e.text)); return { value: undefined } })
  on('agent.spawn', (_: any, e: any) => { seen.push({ model: e.model }); return { model: e.model ?? spawnModel, agentId: 'a1' } })
  on('turn.step', async function* (_: any, e: any) {
    efforts.push(e.effort)
    return { turnId: e.turnId, index: e.index, answer: 'ok', toolUses: [], stopReason: 'end_turn', usage: null }
  })
}

async function step($: any, input: object) {
  const stream = $.turn.step({ turnId: 't', index: 0, messageCount: 1, ...input })
  let s = await stream.next()
  while (s.done !== true) s = await stream.next()
  return s.value
}

test('warn mode: Explore on fable is logged with a warning and left as is', async ($, on) => {
  const seen: { model?: string }[] = [], lines: string[] = [], toasts: string[] = []
  base(on, 'claude-fable-5-1', seen, lines, toasts)
  await $.session.start({ cwd: '/w' })
  await $.agent.spawn(SPAWN)
  expect(seen[0].model).toBeUndefined()
  expect(lines[0]).toMatch(/^Explore → claude-fable-5-1 ⚠ .*task-worker/)
  const out = await $.command.run({ command: 'tier', args: '' })
  expect(out.text).toMatch(/서브에이전트 1건 · 경고 1건 · enforce off/)
})

test('enforce mode: Explore runs on haiku', { options: { enforce: true } }, async ($, on) => {
  const seen: { model?: string }[] = [], lines: string[] = [], toasts: string[] = []
  base(on, 'claude-fable-5-1', seen, lines, toasts)
  await $.session.start({ cwd: '/w' })
  await $.agent.spawn(SPAWN)
  expect(seen[0].model).toBe('haiku')
  expect(lines[0]).toBe('Explore → haiku (Explore→haiku 강제)')
})

test('a mid-session main model switch toasts once per change; /clear resets', async ($, on) => {
  const seen: { model?: string }[] = [], lines: string[] = [], toasts: string[] = []
  base(on, 'x', seen, lines, toasts)
  on('classic.SessionStart', () => ({}))
  await $.session.start({ cwd: '/w' })
  await step($, { model: 'claude-fable-5-1', effort: 'high' })
  await step($, { model: 'claude-fable-5-1', effort: 'high' })
  expect(toasts).toEqual([])
  await step($, { model: 'claude-opus-5-5', effort: 'high' })
  expect(toasts.length).toBe(1)
  expect(toasts[0]).toMatch(/모델 claude-fable-5-1→claude-opus-5-5/)
  await $.classic.SessionStart({ source: 'clear' })
  await step($, { model: 'claude-sonnet-5-5', effort: 'low' })
  expect(toasts.length).toBe(1)
})

test('task-worker on low effort: warned once, raised to medium only when enforcing', { options: { enforce: true } }, async ($, on) => {
  const seen: { model?: string }[] = [], lines: string[] = [], toasts: string[] = []
  const efforts: unknown[] = []
  base(on, 'claude-haiku-5-5', seen, lines, toasts, efforts)
  await $.session.start({ cwd: '/w' })
  await $.agent.spawn({ ...SPAWN, subagentType: 'task-worker' })
  await step($, { model: 'claude-haiku-5-5', effort: 'low', agentId: 'a1' })
  await step($, { model: 'claude-haiku-5-5', effort: 'low', agentId: 'a1' })
  expect(efforts).toEqual(['medium', 'medium'])
  expect(toasts.length).toBe(1)
  expect(toasts[0]).toMatch(/medium 으로 올림/)
})
