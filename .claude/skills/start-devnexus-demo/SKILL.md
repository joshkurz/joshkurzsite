---
name: start-devnexus-demo
description: Open the DevNexus demo environment in the cmux browser. Use when the user wants to launch or start the demo environment for the DevNexus talk.
---

# Start DevNexus Demo

Open all three URLs in the cmux browser — one tab per site.

## Step 1 — Open the slides

```bash
cmux browser open "https://joshkurz.github.io/joshkurzsite/"
```

Wait for the surface ID from the output (e.g. `surface=surface:6`), then wait for it to load:

```bash
cmux browser <surface> wait --load-state complete --timeout-ms 15000
```

## Step 2 — Open the main site in a second tab

```bash
cmux browser open "https://joshkurz.net"
```

Wait for the new surface ID from the output, then wait for it to load:

```bash
cmux browser <surface> wait --load-state complete --timeout-ms 15000
```

## Step 3 — Ensure code-server is running, then open it in a third tab

First, check if code-server is already listening on port 8080:

```bash
lsof -i :8080 | head -3
```

If nothing is listening, start it in the background:

```bash
code-server /Users/joshkurz/projects/joshkurzsite
```

(Run in background — passing the path explicitly ensures it opens the correct project directory.)

Wait a couple seconds for it to start, then verify it's up:

```bash
lsof -i :8080 | head -3
```

Then open the browser tab with the explicit folder path so it always opens the correct project:

```bash
cmux browser open "http://localhost:8080/?folder=/Users/joshkurz/projects/joshkurzsite"
```

Wait for the new surface ID from the output, then wait for it to load:

```bash
cmux browser <surface> wait --load-state complete --timeout-ms 15000
```

## Done

Report back with all three surfaces and URLs:
- Tab 1: https://joshkurz.github.io/joshkurzsite/
- Tab 2: https://joshkurz.net
- Tab 3: http://localhost:8080/?folder=/Users/joshkurz/projects/joshkurzsite (code-server)

IMPORTANT: Do NOT append `--json` to `cmux browser open` — it will corrupt the URL.
