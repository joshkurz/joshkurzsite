---
name: skill-docs
description: Load the Claude Code skills documentation. Use when creating, editing, or debugging a skill — provides full reference for SKILL.md format, frontmatter fields, context/fork, dynamic injection, supporting files, and invocation control.
allowed-tools: WebFetch
---

# Claude Code Skills Documentation

Fetch the latest official skills reference and use it to guide the current task:

```
https://code.claude.com/docs/en/skills
```

Use the WebFetch tool on that URL, extract the full content, and apply it to whatever skill authoring task is being requested.

## Quick reference (cached snapshot — fetch URL above for authoritative version)

### Directory layout
```
.claude/skills/<skill-name>/
├── SKILL.md          # required entrypoint
├── reference.md      # optional supporting docs
└── scripts/
    └── helper.py     # optional scripts Claude can run
```

### Frontmatter fields
| Field | Description |
|---|---|
| `name` | Slash-command name (lowercase, hyphens, max 64 chars) |
| `description` | When Claude should load this skill automatically |
| `disable-model-invocation: true` | Only you can invoke (not Claude) |
| `user-invocable: false` | Only Claude can invoke (hidden from `/` menu) |
| `context: fork` | Run in isolated subagent |
| `agent` | Subagent type: `Explore`, `Plan`, `general-purpose`, or custom |
| `allowed-tools` | Tools Claude can use without approval when skill is active |
| `argument-hint` | Autocomplete hint e.g. `[filename] [format]` |
| `model` | Override model for this skill |
| `hooks` | Lifecycle hooks scoped to this skill |

### String substitutions
| Variable | Value |
|---|---|
| `$ARGUMENTS` | All args passed after `/skill-name` |
| `$ARGUMENTS[N]` or `$N` | Specific arg by 0-based index |
| `${CLAUDE_SESSION_ID}` | Current session ID |

### Dynamic context injection
Use `!`command`` to run a shell command before the skill content reaches Claude:
```
PR diff: !`gh pr diff`
```
The output replaces the placeholder — Claude only sees the rendered result.

### Invocation control
- Default: both you and Claude can invoke
- `disable-model-invocation: true` → only you (use for `/commit`, `/deploy`, side-effectful ops)
- `user-invocable: false` → only Claude (use for background reference knowledge)

### context: fork
Runs the skill in an isolated subagent. The SKILL.md content becomes the agent's task prompt. It won't see your conversation history. Only use with explicit task instructions (not passive guidelines).

### Supporting files
Reference them from SKILL.md so Claude knows to load them:
```markdown
- For API details, see [reference.md](reference.md)
- For examples, see [examples.md](examples.md)
```

Keep SKILL.md under 500 lines. Move large reference material to separate files.
