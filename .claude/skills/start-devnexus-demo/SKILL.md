---
name: start-devnexus-demo
description: Open the DevNexus demo environment in the cmux browser. Use when the user wants to launch or start the demo environment for the DevNexus talk.
---

# Start DevNexus Demo

Open both demo URLs in the cmux browser — one tab per site.

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

## Done

Report back with both surfaces and URLs:
- Tab 1: https://joshkurz.github.io/joshkurzsite/
- Tab 2: https://joshkurz.net

IMPORTANT: Do NOT append `--json` to `cmux browser open` — it will corrupt the URL.
