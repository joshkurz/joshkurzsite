---
name: smoke-test
description: Run a full smoke test on joshkurz.net (or a preview URL) using the cmux browser. Walks through every page and feature — joke display, AI joke generation, speech, speak page, dashboard, navigation, custom joke form. Use when you want to verify the site is working after a deploy or PR.
---

# QA Flow — joshkurz.net

Walk through the site end-to-end and verify all key functionality. Skip destructive or billable writes (ratings submit, custom joke submit) but test everything else.

## Before you start

Determine the base URL to test:
- If the user provided a URL (preview URL, localhost:3000, etc.), use that.
- Otherwise default to `https://joshkurz.net`.

Identify the browser surface:

```bash
cmux identify --json
```

If no browser surface exists, open one:

```bash
cmux browser open <base-url> --json
```

---

## Check 1 — Homepage loads

Navigate to the root:

```bash
cmux browser <surface> goto <base-url>/
cmux browser <surface> wait --load-state complete --timeout-ms 10000
cmux browser <surface> snapshot --interactive
```

Verify:
- [ ] Page title contains "Josh Kurz" or "Dad Jokes"
- [ ] A joke is visible (setup/punchline text on screen)
- [ ] Navigation header has "Live Jokes", "Speak", "Dashboard" links

---

## Check 2 — Next joke navigation

Find the "Next Joke" or arrow/next button in the snapshot and click it:

```bash
cmux browser <surface> click @<next-btn>
cmux browser <surface> wait --timeout-ms 3000
cmux browser <surface> snapshot --interactive
```

Verify:
- [ ] A different joke is now displayed (text changed)

---

## Check 3 — AI joke generation

Find the "Get AI Joke" button and click it:

```bash
cmux browser <surface> click @<ai-joke-btn>
cmux browser <surface> wait --timeout-ms 15000
cmux browser <surface> snapshot --interactive
```

Verify:
- [ ] A joke appears (AI-generated content displayed — may take a few seconds to stream in)
- [ ] No error message shown

---

## Check 4 — Speak button on homepage

Find the "Hear this joke" / speaker button on the current joke and click it:

```bash
cmux browser <surface> click @<speak-btn>
cmux browser <surface> wait --timeout-ms 12000
cmux browser <surface> snapshot --interactive
```

Verify:
- [ ] Audio player appears on the page (ReactAudioPlayer rendered)
- [ ] No error message shown ("Unable to play audio" text is absent)

---

## Check 5 — Custom joke form visible

Scroll down to find the custom joke submission form:

```bash
cmux browser <surface> scroll --dy 600
cmux browser <surface> snapshot --interactive
```

Verify:
- [ ] A text input or textarea for joke submission is visible
- [ ] Submit/Add button is present

> **Skip submitting** — do not click submit to avoid polluting production data.

---

## Check 6 — Speak page loads

Navigate to the speak page:

```bash
cmux browser <surface> goto <base-url>/speak
cmux browser <surface> wait --load-state complete --timeout-ms 10000
cmux browser <surface> snapshot --interactive
```

Verify:
- [ ] Page title contains "Speech"
- [ ] Text input is present
- [ ] Voice dropdown is present
- [ ] "Play" and "Load Random Dad Joke" buttons are present

---

## Check 7 — Load random joke on speak page

Click "Load Random Dad Joke":

```bash
cmux browser <surface> click @<load-random-btn>
cmux browser <surface> wait --timeout-ms 5000
cmux browser <surface> snapshot --interactive
```

Verify:
- [ ] Text input is now populated with a joke

---

## Check 8 — Voice dropdown works

Select a different voice from the dropdown:

```bash
cmux browser <surface> select @<voice-select> "nova"
cmux browser <surface> snapshot --interactive
```

Verify:
- [ ] Dropdown now shows "Nova" selected

---

## Check 9 — Play audio on speak page

Click "Play":

```bash
cmux browser <surface> click @<play-btn>
cmux browser <surface> wait --timeout-ms 12000
cmux browser <surface> snapshot --interactive
```

Verify:
- [ ] Audio player appears on page
- [ ] No error message shown

---

## Check 10 — Dashboard loads

Navigate to the dashboard:

```bash
cmux browser <surface> goto <base-url>/dashboard
cmux browser <surface> wait --load-state complete --timeout-ms 10000
cmux browser <surface> snapshot --interactive
```

Verify:
- [ ] Page title contains "Dashboard"
- [ ] Stats or chart content is visible (not a blank page or error)
- [ ] At least one rating count or joke stat is shown

---

## Check 11 — Navigation links

From the dashboard, click the "Live Jokes" nav link:

```bash
cmux browser <surface> click @<live-jokes-link>
cmux browser <surface> wait --load-state complete --timeout-ms 8000
cmux browser <surface> get url
```

Verify:
- [ ] URL ends with `/` (back on homepage)

---

## Check 12 — Console errors

Check for JS errors that appeared during the session:

```bash
cmux browser <surface> console list
```

Verify:
- [ ] No unhandled errors (404s on static assets, uncaught exceptions, failed fetches)
- [ ] Note any warnings that may indicate issues

---

## Final Report

Deliver a summary table:

```
## QA Flow Results — <date> — <base-url>

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | Homepage loads | ✅ / ❌ | |
| 2 | Next joke navigation | ✅ / ❌ | |
| 3 | AI joke generation | ✅ / ❌ | |
| 4 | Speak button (homepage) | ✅ / ❌ | |
| 5 | Custom joke form visible | ✅ / ❌ | |
| 6 | Speak page loads | ✅ / ❌ | |
| 7 | Load random joke | ✅ / ❌ | |
| 8 | Voice dropdown | ✅ / ❌ | |
| 9 | Play audio (speak page) | ✅ / ❌ | |
| 10 | Dashboard loads | ✅ / ❌ | |
| 11 | Nav links | ✅ / ❌ | |
| 12 | Console errors | ✅ / ❌ | |

**Skipped:** ratings submit, custom joke submit (no dev env — would affect production data)

**Overall:** PASS / FAIL — <summary>
```

If any check fails, include the specific error or unexpected behavior observed.
