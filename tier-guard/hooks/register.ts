import type { Register } from 'claude-code'

import { isLowEffortTaskWorker, spawnWarning, switchNote } from './rules.ts'

type Spawn = { type: string; model: string; warning: string }

export const register: Register = (on, options) => {
  const enforce = options.enforce === true
  // Module variables on purpose: a reload starts the tracking over instead of warning on stale data
  const typeByAgent = new Map<string, string>()
  const effortWarned = new Set<string>()
  const spawns: Spawn[] = []
  let lastMain: { model: string; effort?: unknown } | null = null

  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({ name: 'tier', description: '이 세션의 서브에이전트 모델 라우팅과 경고 보기', immediate: true })
    } catch (err) {
      $.ui.log('/tier 등록 실패: ' + String(err))
    }
    return next(e)
  })

  // Compaction and /clear are the sanctioned moments to switch model or effort
  on('classic.SessionStart', { source: ['compact', 'clear', 'resume', 'fork'] }, async ($, e, next) => {
    lastMain = null
    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const forced = enforce && e.subagentType === 'Explore' && !e.fork
    const r = await next(forced ? { ...e, model: 'haiku' } : e)
    if (r.deny !== undefined) return r
    if (r.agentId) typeByAgent.set(r.agentId, e.subagentType)
    const warning = spawnWarning(e.subagentType, r.model)
    spawns.push({ type: e.subagentType, model: r.model, warning })
    $.ui.log(`${e.subagentType} → ${r.model}${forced ? ' (Explore→haiku 강제)' : ''}${warning ? ' ⚠ ' + warning : ''}`)
    return r
  })

  on('turn.step', async function* ($, e, next) {
    let step = e
    if (e.agentId) {
      const type = typeByAgent.get(e.agentId)
      if (isLowEffortTaskWorker(type, e.effort)) {
        if (enforce) step = { ...e, effort: 'medium' }
        if (!effortWarned.has(e.agentId)) {
          effortWarned.add(e.agentId)
          $.ui.toast(`task-worker 가 effort low 로 실행${enforce ? ' → medium 으로 올림' : ''} (§2: low 금지)`)
        }
      }
    } else {
      const note = switchNote(lastMain, { model: e.model, effort: e.effort })
      // A fallback model after an overload also shows up here, so the wording only reports
      if (note) $.ui.toast(`세션 중간 전환 감지: ${note} — 캐시 프리픽스 재과금. 전환은 세션 시작·/compact 직후 (§2)`)
      lastMain = { model: e.model, effort: e.effort }
    }
    return yield* next(step)
  })

  on('command.run', { command: 'tier' }, async () => {
    if (spawns.length === 0) return { text: '이 세션에 서브에이전트 실행 없음' }
    const warned = spawns.filter(s => s.warning).length
    const rows = spawns.slice(-20).map(s => `${s.warning ? '⚠' : '·'} ${s.type} → ${s.model}${s.warning ? ' — ' + s.warning : ''}`)
    return { text: [`서브에이전트 ${spawns.length}건 · 경고 ${warned}건 · enforce ${enforce ? 'on' : 'off'}`, ...rows].join('\n') }
  })
}
