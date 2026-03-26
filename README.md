# thinking-tree

Persistent thinking system for Claude Code — captures, organizes, and evolves scattered thoughts across sessions.

Your insights emerge while working. They scatter across conversations and get lost when the session ends. thinking-tree catches the ones worth keeping.

## Install

```
/plugin → Marketplaces → Add → CoralLips
/plugin → Discover → thinking-tree → Install
/think  → Enable recording
```

## How it works

1. **You work normally** — code, discuss, debug
2. **AI evaluates each turn** — is there an independent insight here?
3. **Worth recording → saved** as a fragment or question in `~/.thinking-tree/`
4. **Next session** — recent fragments and open questions are injected as context
5. **Review anytime** — web viewer at `http://localhost:3456`

Every turn ends with a status indicator:
- `📝 #tag Title` — fragment recorded
- `❓ Title` — question recorded
- `🌳` — checked, nothing to record

## Spaces

```
~/.thinking-tree/
├── *.md            Thoughts — crystallized understanding with a throughline
├── fragments.md    Fragments — standalone insights, not yet organized
├── questions.md    Questions — specific unknowns with direction
└── todos.md        Todos — actionable items derived from thinking
```

Fragments accumulate → organize into thought files → questions emerge → answers flow back.

## Commands

| Command | What it does |
|---------|-------------|
| `/think` | Toggle recording on/off |
| `/reduce` | Interactive cleanup — deduplicate, classify, remove stale fragments |

## Web Viewer

Auto-starts on session start at [localhost:3456](http://localhost:3456).

- Browse thoughts, fragments, questions, todos
- Click to edit, Ctrl+S to save
- Real-time sync (SSE) — edits in Claude or the viewer appear instantly
- Dark/light theme toggle
- Export all data as markdown

## Data

All data lives in `~/.thinking-tree/`. The plugin never touches your project files. Uninstalling the plugin leaves your data intact.

## License

MIT
