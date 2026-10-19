# wip-board

## Install

```
/plugin install wip-board --marketplace steven0224-glitch/chan-mods
```

Older CLIs: `claude plugin marketplace add steven0224-glitch/chan-mods` then `claude plugin install wip-board@chan-mods`.

Shows the open multi-session work that lives in a folder of Markdown notes (one task per file), so the next step is on screen instead of in your head.

- **Above the prompt**: `wip 9 · ⚠ 오래됨 2 · ? 다음 없음 3 · ◌ 대기 1 — /wip` (only the kinds that need a look are called out)
- **`/wip`**: a pane grouped into sections, needs-attention first — `⚠ 오래됨`, `? 다음 행동 없음`, `● 진행 중`, `◌ 대기` — each with a one-line hint of what to do. A row shows the title, a plain age (`오늘`, `어제`, `5일 전`, `3주 전`), the file slug and an **이어서** button that fills the prompt with `wip/<file> 읽고 다음 행동 이어서 진행`; under it `→ <next step>`, or a red note when the file has no `다음:` line. Esc closes.
- **`/wip band`**: hide or show the line above the prompt (remembered across sessions).

## Install

```
/plugin install wip-board --marketplace steven0224-glitch/chan-mods
```

Older CLIs: `claude plugin marketplace add steven0224-glitch/chan-mods` then `claude plugin install wip-board@chan-mods`.

Shows the open multi-session work that lives in a folder of Markdown notes (one task per file), so the next step is on screen instead of in your head.

- **Above the prompt**: `wip 9 · 대기 1 · 14일↑ 2 · 다음 없음 3 — /wip`
- **`/wip`**: a pane listing every item, needs-attention first. Each row has a mark, the title, its age in days and an **이어서** button that fills the prompt with `wip/<file> 읽고 다음 행동 이어서 진행`. Esc closes.
- **`/wip band`**: hide or show the line above the prompt (remembered across sessions).

| mark | kind | rule |
|---|---|---|
| ⚠ | stale | has a `다음:` line but the file is 14+ days old |
| ? | nonext | no `다음:` line |
| ● | active | has a `다음:` line, touched within 14 days |
| ◌ | held | `다음:` starts with `대기` or mentions `보류` in its first 40 chars |

## File format

```
# <title>                 ← or frontmatter `title:`
상태: <where it stands>
다음: <the one next action>
```

`README.md` in the folder is skipped. Only `# title` and the `다음:` line are read.

## Config

| option | default | meaning |
|---|---|---|
| `dir` | `~/.claude/wip` | folder of wip notes; `~` is the home directory |

```json
"pluginConfigs": { "wip-board@chan-mods": { "options": { "dir": "~/notes/wip" } } }
```

## Behaviour notes

- Disk reads run off a timer (`$.clock.after(0, …)`) so a slow cloud-synced file never blocks session start. The list refreshes after every main-loop turn and every 10 minutes.
- One unreadable file is skipped and logged; the rest of the board still draws.
- Uses `Text bold`, not `weight`, so it also renders on engines before 2.1.299.
