---
name: architecture-diagram
description: Generate up-to-date architecture diagrams from the codebase. Checks what has changed since diagrams were last generated, updates the diagram script if needed, then runs it. Use when asked to visualize or document the system architecture.
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(npm *), Bash(python3 *), Bash(pip3 *), Bash(brew *), Bash(dot *), Bash(git *)
---

# Architecture Diagram Generator

IDE-based workflow. Do not assume you know the architecture — derive it from the code every time.
Diagrams live in `diagrams/` (committed). The generation script is in `scripts/generate_diagrams.py`.
Vercel serves the committed PNGs. Never wire diagram generation into `npm run build`.

## Supporting files

- **[scripts/generate_diagrams.py](scripts/generate_diagrams.py)** — Python script using the `diagrams` library. Edit this file when the architecture has changed before running it.
- **[requirements.txt](requirements.txt)** — pinned Python deps (`diagrams==0.25.1`)

---

## Pre-flight context (injected before you start)

Last diagram commit (git is the state store — committing diagrams/ sets the reference point):
!`git log --oneline --follow -- diagrams/ | head -1`

Structural diff since that commit (empty = no changes; "NEVER_COMMITTED" = first run):
!`sh .claude/skills/architecture-diagram/scripts/check_changes.sh`

---

## Decision — read the injected output above, then choose a path

**If the diff is empty** → no structural changes since diagrams were last committed. Go directly to Step 3 (display existing diagrams). Do not run the build.

**If the diff says `NEVER_COMMITTED`** → diagrams have never been generated. Treat as a full first run: go through Steps 1 → 2 → 3.

**If the diff is non-empty** → structural changes exist since last commit. Continue through Steps 1 → 2 → 3.

---

## Step 1 — Check dependencies (only if rebuilding)

```bash
python3 -c "from diagrams import Diagram; print('diagrams OK')"
dot -V
```

If `diagrams` is missing:
```bash
pip3 install -r .claude/skills/architecture-diagram/requirements.txt
```

If `dot` / Graphviz is missing:
```bash
brew install graphviz        # macOS
# sudo apt-get install graphviz   # Ubuntu/Debian
# https://graphviz.org/download/  # Windows
```

---

## Step 2 — Update the diagram script (only if rebuilding)

Read the current script to understand what it draws:
`scripts/generate_diagrams.py`

Then read the changed source files from the diff. Use Glob and Read to explore:
- `pages/api/*.js` — what routes exist, what they call
- `lib/*.js` — what services they use, what they read/write
- `package.json` — what external dependencies are present

Update `scripts/generate_diagrams.py` to reflect the current state:
- Add nodes for new API routes, lib modules, or external services
- Remove nodes for deleted routes or modules
- Rewire edges to match the actual data flow
- Do not remove or rename diagrams — update them in place unless entirely irrelevant

Verify the script parses cleanly before running:
```bash
python3 -c "import ast; ast.parse(open('.claude/skills/architecture-diagram/scripts/generate_diagrams.py').read()); print('syntax OK')"
```

Then run the build:
```bash
npm run build:diagrams
```

---

## Step 3 — Display and summarise

Use the Read tool to show each PNG inline:
- `diagrams/system_architecture.png`
- `diagrams/api_routes.png`
- `diagrams/ai_joke_flow.png`

Write a short summary:
- Whether diagrams were regenerated or served from the existing committed versions
- What changed since the last diagrams (if anything)
- What was updated in the script (if anything)

If diagrams or the script were updated, remind the user to commit:
```bash
git add diagrams/ .claude/skills/architecture-diagram/scripts/generate_diagrams.py
git commit -m "chore: regenerate architecture diagrams"
```
