---
name: cmux-browser
description: Control a website open in a cmux browser pane. Use this skill whenever the user asks Claude to interact with, automate, click, fill, navigate, inspect, or do anything on a website that's open in a cmux browser pane. Trigger on phrases like "go to", "click", "fill in", "submit the form", "what's on the page", "take a screenshot", "type in", "check the website", "scroll to", "log in to", or any request that implies acting on a browser that is visible in the user's terminal session.
---

# cmux Browser Automation

You are operating inside a cmux session. The user has a browser pane open alongside their terminal. Use the `cmux browser` CLI to control that browser directly.

## Step 1 — Identify the browser surface

Run this first to get your current context:

```bash
cmux identify --json
```

This returns workspace and surface IDs. The browser surface is the one with `"type": "browser"`. Use its `id` or `ref` for all subsequent commands as `<surface>`.

If no browser surface exists yet, open one:

```bash
cmux browser open <url> --json
```

## Step 2 — Snapshot the page

Before acting, always get the current page state:

```bash
cmux browser <surface> snapshot --interactive
```

The snapshot returns an accessibility tree with element references like `@e1`, `@e2`. Use these refs for precise targeting. Pass `--compact` or `--max-depth 3` if the page is large.

## Step 3 — Act

Use the refs from the snapshot to interact:

| Task | Command |
|------|---------|
| Click a button/link | `cmux browser <surface> click @e5` |
| Fill a text input | `cmux browser <surface> fill @e3 "hello world"` |
| Type character by character | `cmux browser <surface> type @e3 "hello"` |
| Press a key | `cmux browser <surface> press Enter` |
| Select a dropdown option | `cmux browser <surface> select @e7 "option-value"` |
| Check/uncheck a checkbox | `cmux browser <surface> check @e9` |
| Navigate to a URL | `cmux browser <surface> goto https://example.com` |
| Go back/forward | `cmux browser <surface> back` |
| Reload the page | `cmux browser <surface> reload` |
| Scroll the page | `cmux browser <surface> scroll --dy 300` |
| Run JavaScript | `cmux browser <surface> eval 'document.title'` |
| Take a screenshot | `cmux browser <surface> screenshot` |

## Step 4 — Wait for changes

After actions that trigger navigation or async updates, wait before re-snapshotting:

```bash
# Wait for navigation to complete
cmux browser <surface> wait --load-state complete --timeout-ms 10000

# Wait for a specific element to appear
cmux browser <surface> wait --selector "#result" --timeout-ms 5000

# Wait for page text
cmux browser <surface> wait --text "Success" --timeout-ms 5000

# Wait for URL change
cmux browser <surface> wait --url-contains "/dashboard" --timeout-ms 10000
```

## Step 5 — Verify

Re-snapshot after waiting to confirm the action worked and report back to the user.

---

## Core loop

```
identify → snapshot → act → wait → snapshot → report
```

Always snapshot before acting. Always wait after navigation. Always re-snapshot to verify.

---

## Inspecting page data

```bash
# Get visible text from an element
cmux browser <surface> get text @e4

# Get the current URL
cmux browser <surface> get url

# Get the page title
cmux browser <surface> get title

# Get an attribute
cmux browser <surface> get attr @e2 href

# Get input value
cmux browser <surface> get value @e3

# Read browser console output
cmux browser <surface> console list
```

---

## Troubleshooting

**`cmux` not found** — cmux must be installed and running. Install from [github.com/manaflow-ai/cmux](https://github.com/manaflow-ai/cmux).

**No browser surface** — Open one with `cmux browser open <url>` or use ⌘⇧L inside cmux to split a browser pane.

**Refs are stale** — Always re-snapshot after page changes. Refs from a previous snapshot are invalid after navigation or DOM mutations.

**Element not interactable** — Try `cmux browser <surface> highlight @eN` to visually confirm what the ref points to. Use `--compact` snapshot with `--max-depth 2` to reduce noise and find the right element.

**Page uses heavy JS / SPA** — Wait for `--load-state complete` and then wait for a stable selector before snapshotting.

---

## Reference

See `references/commands.md` for the full command reference with all flags and options.
