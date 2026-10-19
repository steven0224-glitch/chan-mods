import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { WipItem } from '../types'
import { COLOR, HINT, KINDS, LABEL, MARK, ageDays, ageLabel, bandLine, parseWip, sortItems } from './parse.ts'

const PANE = 'wip-board'
const DEFAULT_DIR = '~/.claude/wip'
const items = atom({ plugin: 'wip-board', key: 'items' } as const, [] as WipItem[])
const isBandHidden = atom({ plugin: 'wip-board', key: 'isBandHidden' } as const, false)

// `~` means the home directory, as in the shell
async function resolveDir($: EngineInterface, dir: string): Promise<string | null> {
  if (!dir.startsWith('~')) return dir
  const home = await $.env.get('HOME')
  return home ? home + dir.slice(1) : null
}

// ~/.claude/wip is a symlink into claude-shared (2-PC); list() follows the directory path
async function loadItems($: EngineInterface, configured: string) {
  const dir = await resolveDir($, configured)
  if (!dir) return
  try {
    if (!(await $.fs.exists(dir))) return update($, items, () => [])
    const entries = await $.fs.list(dir)
    const now = await $.clock.now()
    const files = entries.filter(f => f.name.endsWith('.md') && f.name.toLowerCase() !== 'readme.md')
    // One unreadable file (OneDrive mid-sync) skips that file, not the whole board
    const parsed = await Promise.all(
      files.map(async f => {
        try {
          return parseWip(f.name, await $.fs.read(`${dir}/${f.name}`), f.mtimeMs, now)
        } catch {
          return null
        }
      }),
    )
    const ok = parsed.filter((p): p is WipItem => p !== null)
    if (ok.length < parsed.length) $.ui.log(`wip ${parsed.length - ok.length}개 읽기 실패 — 건너뜀`)
    await update($, items, () => sortItems(ok))
  } catch (err) {
    // Keep the last good list; a half-synced OneDrive file should not blank the board
    $.ui.log('wip 읽기 실패: ' + String(err))
  }
}

async function loadBandFlag($: EngineInterface) {
  const saved = (await $.store.get('isBandHidden')) === true
  await update($, isBandHidden, () => saved)
}

export const register: Register = (on, options) => {
  const dir = typeof options.dir === 'string' && options.dir.trim() ? options.dir.trim() : DEFAULT_DIR

  on('session.start', async ($, e, next) => {
    await loadBandFlag($)
    // OneDrive dataless files block reads indefinitely and mods API waits skip the hook limit: never hold session start on disk
    $.clock.after(0, () => loadItems($, dir))
    // Other sessions and the other PC edit wip files too
    $.clock.every(600_000, () => loadItems($, dir))
    try {
      await $.command.register({
        name: 'wip',
        description: '열린 멀티세션 작업(wip) 보드 열기 · /wip band 로 프롬프트 위 줄 켜기/끄기',
        argumentHint: '[band]',
        immediate: true,
      })
    } catch (err) {
      $.ui.log('/wip 등록 실패: ' + String(err))
    }
    return next(e)
  })

  // /clear, /resume and /branch reset $.state without a new session.start
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    await loadBandFlag($)
    $.clock.after(0, () => loadItems($, dir))
    return next(e)
  })

  // Claude updates or deletes wip files during turns
  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) $.clock.after(0, () => loadItems($, dir))
    return next(e)
  })

  on('command.run', { command: 'wip' }, async ($, e) => {
    if (e.args.trim() === 'band') {
      const hidden = !(await read($, isBandHidden))
      await $.store.set('isBandHidden', hidden)
      await update($, isBandHidden, () => hidden)
      return { text: hidden ? 'wip 줄 숨김 · /wip band 로 다시 켬' : 'wip 줄 표시' }
    }
    await loadItems($, dir)
    await $.ui.open({ id: PANE, title: 'wip', focus: true, closeOnEscape: true })
    return {}
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, items)
    if (e.props.hasSurvey || list.length === 0 || (await read($, isBandHidden))) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    // Keep what later mods draw in the band, under this line
    const theirs = await next(e)
    const line = <Text dimColor wrap="truncate-end">{bandLine(list)} — /wip</Text>
    return <Box flexDirection="column">{theirs ? [line, theirs] : [line]}</Box>
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, items)
    const now = await $.clock.now()
    if (list.length === 0) return <Text dimColor>열린 wip 없음 — 멀티세션 작업을 시작하면 ~/.claude/wip/&lt;슬러그&gt;.md 로 생김</Text>

    // One section per kind, needs-attention first; empty sections are skipped
    const sections = KINDS.map(kind => ({ kind, rows: list.filter(i => i.kind === kind) })).filter(s => s.rows.length > 0)

    return (
      <Box flexDirection="column" rowGap={1}>
        <Text dimColor>열린 작업 {list.length}개 · Tab 으로 이어서 선택 → Enter 가 프롬프트에 넣음 · Esc 닫기</Text>
        {sections.map(({ kind, rows }) => (
          <Box key={kind} flexDirection="column">
            <Box flexDirection="row" columnGap={1}>
              <Text color={COLOR[kind]} bold>
                {MARK[kind]} {LABEL[kind]} {rows.length}
              </Text>
              {HINT[kind] ? <Text dimColor>— {HINT[kind]}</Text> : null}
            </Box>
            {rows.map(item => {
              const days = ageDays(item.mtimeMs, now)
              return (
                <Box key={item.file} flexDirection="column" paddingLeft={2}>
                  <Box flexDirection="row" columnGap={1}>
                    {/* bold, not weight: weight needs 2.1.299+ and the terminal CLI may be older */}
                    <Text bold wrap="truncate-end">{item.title}</Text>
                    <Text color={kind === 'stale' ? 'yellow' : undefined} dimColor={kind !== 'stale'}>
                      {ageLabel(days)}
                    </Text>
                    <Text dimColor wrap="truncate-end">{item.file.replace(/\.md$/, '')}</Text>
                    <Button
                      key={'go-' + item.file}
                      label="이어서"
                      plain
                      onPress={async () => {
                        const text = `wip/${item.file} 읽고 다음 행동 이어서 진행`
                        const r = await $.prompt.fill({ text })
                        // Under a dialog the prompt box takes nothing: say what to type instead
                        if (!r.isFilled) $.ui.toast('프롬프트에 넣지 못함 — 직접 입력: ' + text)
                      }}
                    />
                  </Box>
                  {item.next ? (
                    <Text dimColor wrap="truncate-end">
                      {'  → '}
                      {item.next}
                    </Text>
                  ) : (
                    <Text color="red" dimColor wrap="truncate-end">
                      {'  → 다음: 줄 없음 — '}
                      {item.file}
                      {' 에 「다음: …」 한 줄 추가'}
                    </Text>
                  )}
                </Box>
              )
            })}
          </Box>
        ))}
      </Box>
    )
  })
}
