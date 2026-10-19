# lessons-recall

## Install

```
/plugin install lessons-recall --marketplace steven0224-glitch/chan-mods
```

Older CLIs: `claude plugin marketplace add steven0224-glitch/chan-mods` then `claude plugin install lessons-recall@chan-mods`.

Keeps a folder of one-lesson-per-file notes in play: when a prompt shares rare words with a lesson's file name or title, the lesson path is attached to the prompt as context Claude reads before working.

- Index = file slug (date prefix stripped) + first line, tokenised with Korean particles removed; rarity is IDF normalised to 0..1 by `log n`.
- A lesson is attached when the prompt shares **two distinct keys with score ≥ 1.0**, or **one rare key** (length ≥ 6, idf ≥ 0.9). Top 3 only.
- Skipped: slash commands, meta prompts, prompts under 6 characters, and prompts from `task-notification`, `peer` or `plugin` origins.
- A dim line `교훈 N건 첨부: …` shows what was attached. **`/lessons`** prints the index size, the folder, the last read error if any, and the last attached lessons with the matched words.

The attached context is a short list, not the file body:

```
[lessons-recall] 이 프롬프트와 단어가 겹치는 교훈 파일 — 관련 있으면 작업 전에 읽을 것(무관하면 무시):
- ~/.claude/lessons/2026-08-06-graphify-writes-output-next-to-root-not-cwd.md — graphify 재빌드 출력은 root 옆에
```

## Config

| option | default | meaning |
|---|---|---|
| `dir` | `~/.claude/lessons` | folder of lesson notes; `~` is the home directory |

```json
"pluginConfigs": { "lessons-recall@chan-mods": { "options": { "dir": "~/notes/lessons" } } }
```

## Behaviour notes

- The index builds off a timer at session start and refreshes every 30 minutes, so a slow cloud-synced file never blocks the session. Until it is built, prompts pass unchanged.
- Matching is plain token overlap. It misses paraphrases on purpose: no model call per prompt.
