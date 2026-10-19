# tier-guard

## Install

```
/plugin install tier-guard --marketplace steven0224-glitch/chan-mods
```

Older CLIs: `claude plugin marketplace add steven0224-glitch/chan-mods` then `claude plugin install tier-guard@chan-mods`.

Watches model routing against a three-tier rule and tells you when it drifts. Written for my `CLAUDE.md §2`:

| subagent | expected family |
|---|---|
| `deep-reasoner` | opus |
| `default-worker` | sonnet |
| `task-worker` | haiku (effort `medium`, never `low`) |
| built-in `Explore` | not fable/opus — cheap exploration belongs to `task-worker` |

What it does:

- **Every spawn** logs a dim line `type → model`, with `⚠ …` when the tier is wrong.
- **task-worker on effort `low`** toasts once per agent.
- **Mid-session model or effort switch** in the main loop toasts `세션 중간 전환 감지: …` (switching mid-session re-bills the whole prompt-cache prefix; do it at session start or right after `/compact`). Tracking resets on compact, `/clear`, resume and fork.
- **`/tier`** lists the session's spawns, warnings and whether enforce is on.

## Config

| option | default | meaning |
|---|---|---|
| `enforce` | `false` | `true`: run `Explore` on haiku (non-fork spawns) and raise a `task-worker` request's effort from `low` to `medium`. `false`: warn only |

```json
"pluginConfigs": { "tier-guard@chan-mods": { "options": { "enforce": true } } }
```

Edit `hooks/rules.ts` to change the expected tiers.
