import type { EngineInterface, Register } from 'claude-code'

import { buildIndex, contextOf, lessonOf, recall } from './match.ts'
import type { Hit, Index } from './match.ts'

// Prompts that are not the person's own words: notifications, other sessions, plugins
const SKIP_ORIGINS = ['task-notification', 'peer', 'plugin']

const DEFAULT_DIR = '~/.claude/lessons'

let index: Index = { lessons: [], idf: new Map() }
let lastHits: Hit[] = []
let lastError = ''

// `~` means the home directory, as in the shell
async function resolveDir($: EngineInterface, dir: string): Promise<string | null> {
  if (!dir.startsWith('~')) return dir
  const home = await $.env.get('HOME')
  return home ? home + dir.slice(1) : null
}

// ~/.claude/lessons is a symlink into OneDrive; a dataless file blocks its read, so this only ever runs off a timer
async function loadIndex($: EngineInterface, configured: string) {
  const dir = await resolveDir($, configured)
  if (!dir) return
  try {
    if (!(await $.fs.exists(dir))) return
    const files = (await $.fs.list(dir)).filter(f => f.kind === 'file' && f.name.endsWith('.md'))
    const lessons = await Promise.all(
      files.map(async f => {
        try {
          return lessonOf(f.name, await $.fs.read(`${dir}/${f.name}`))
        } catch {
          return null
        }
      }),
    )
    index = buildIndex(lessons.filter(l => l !== null))
    lastError = ''
  } catch (err) {
    lastError = String(err)
    $.ui.log('lessons 색인 실패: ' + lastError, { to: 'debug' })
  }
}

export const register: Register = (on, options) => {
  const dir = typeof options.dir === 'string' && options.dir.trim() ? options.dir.trim() : DEFAULT_DIR

  on('session.start', async ($, e, next) => {
    $.clock.after(0, () => loadIndex($, dir))
    // New lessons land during the day; refresh every half hour
    $.clock.every(1_800_000, () => loadIndex($, dir))
    try {
      await $.command.register({ name: 'lessons', description: 'lessons-recall 색인 크기와 마지막으로 첨부한 교훈 보기', immediate: true })
    } catch (err) {
      $.ui.log('/lessons 등록 실패: ' + String(err))
    }
    return next(e)
  })

  on('command.run', { command: 'lessons' }, async () => {
    const head = `색인 ${index.lessons.length}건 (${dir})${lastError ? ' · 마지막 읽기 실패: ' + lastError : ''}`
    if (lastHits.length === 0) return { text: head + '\n이 세션에서 첨부한 교훈 없음' }
    const rows = lastHits.map(h => `- ${h.file} — ${h.title} (${h.matched.join(', ')})`)
    return { text: [head, '마지막 첨부:', ...rows].join('\n') }
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.command || e.isMeta || SKIP_ORIGINS.includes(e.origin.kind) || e.text.trim().length < 6) return next(e)
    const hits = recall(index, e.text)
    if (hits.length === 0) return next(e)
    lastHits = hits
    $.ui.log(`교훈 ${hits.length}건 첨부: ` + hits.map(h => h.file.replace(/^\d{4}-\d{2}-\d{2}-/, '').slice(0, 40)).join(' · '))
    return next({ ...e, context: [...(e.context ?? []), contextOf(hits)] })
  })
}
