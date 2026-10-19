# chan-mods

Claude Code [mods](https://code.claude.com/docs/en/plugins/mods/overview) I use every day — three plugins, each a hooks module with tests. Korean UI strings; the code and READMEs are in English/Korean mix because I am the only user so far.

| mod | what it adds | version |
|---|---|---|
| [wip-board](./wip-board) | `/wip` pane of open multi-session work and a one-line count above the prompt | 0.3.1 |
| [tier-guard](./tier-guard) | Warns when a subagent runs on the wrong model tier or the main loop switches model/effort mid-session; `/tier` | 0.1.0 |
| [lessons-recall](./lessons-recall) | Attaches lesson notes that share rare words with each prompt as context; `/lessons` | 0.2.0 |

Needs Claude Code **2.1.299 or newer** (tested on 2.1.303, desktop app 2.1.299).

## Install

```bash
claude plugin marketplace add steven0224-glitch/chan-mods
claude plugin install wip-board@chan-mods
claude plugin install tier-guard@chan-mods
claude plugin install lessons-recall@chan-mods
```

Then `/reload-plugins` or start a new session. Each mod's README lists its `userConfig` options; set them in `settings.json` under `pluginConfigs["<mod>@chan-mods"].options`.

## Develop

Clone, then add the clone as a folder marketplace so edits load live (`/reload-plugins`):

```bash
claude plugin marketplace add ./chan-mods
claude plugin validate ./chan-mods/wip-board
claude plugin test ./chan-mods/wip-board
```

Tests use `claude-code/testing` and run with no session, login or network.

## License

MIT — see [LICENSE](./LICENSE).
