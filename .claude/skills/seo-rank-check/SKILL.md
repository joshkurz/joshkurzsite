---
name: seo-rank-check
description: Check Google search rankings for joshkurz.net target keywords and track progress over time. Use when asked to check SEO rankings, check search results, or track keyword progress.
allowed-tools: WebSearch, Read, Write, Bash
---

# SEO Rank Check — joshkurz.net

Search for each tracked keyword, find joshkurz.net's position in results, compare to the previous check, and save a dated report.

**Target site:** `joshkurz.net`
**Keywords file:** [keywords.md](keywords.md)
**History folder:** `.claude/skills/seo-rank-check/rankings/`

---

## Step 1 — Load keywords and previous results

Read [keywords.md](keywords.md) to get the full keyword list.

Then check if there's a previous ranking file:
```bash
ls .claude/skills/seo-rank-check/rankings/ | sort | tail -1
```

If a previous file exists, read it to extract prior rankings for comparison.

---

## Step 2 — Search each keyword

For **every keyword** in keywords.md, run a WebSearch. Search exactly as a user would type it (no quotes).

For each result set, scan through the returned URLs/titles/snippets and look for `joshkurz.net`. Record:
- **Position** — 1-based rank in the results (1 = first result). If joshkurz.net appears multiple times, record the highest (lowest number) position.
- **URL** — the specific joshkurz.net URL that appeared (e.g. `/`, `/jokes/animals`, `/top`)
- **Not found** — if joshkurz.net doesn't appear in the results at all

Work through all keywords before moving to Step 3.

---

## Step 3 — Build the results table

Format the findings as a markdown table. For each keyword show:
- Keyword
- Position found (or `—` if not found)
- URL that ranked (short path only, e.g. `/jokes/animals`)
- Change vs previous check: `NEW`, `↑3`, `↓1`, `→` (no change), or `—` if no prior data

Example table:

```
| Keyword | Position | URL | vs Last |
|---------|----------|-----|---------|
| dad jokes | 8 | / | ↑2 |
| funny dad jokes | — | — | — |
| animal dad jokes | 3 | /jokes/animals | NEW |
```

Also note:
- Total keywords tracked
- How many joshkurz.net appeared in
- Any notable moves (biggest gains/drops)

---

## Step 4 — Save the report

Today's date: use `date +%Y-%m-%d` to get it.

Save a new file at:
```
.claude/skills/seo-rank-check/rankings/YYYY-MM-DD.md
```

File contents:
```markdown
# SEO Rankings — YYYY-MM-DD

## Results

| Keyword | Position | URL | vs Last |
|---------|----------|-----|---------|
...

## Summary
- X/Y keywords found in results
- Biggest gain: ...
- Biggest drop: ...
- Not yet ranking: ...

## Notes
(anything notable about the results — new pages appearing, competitors seen, etc.)
```

---

## Step 5 — Report back

Output the full results table and summary to the user. Highlight any meaningful changes — pages that broke into results for the first time, big position jumps, or drops worth investigating.

Keep the tone concise. Focus on actionable signals.
