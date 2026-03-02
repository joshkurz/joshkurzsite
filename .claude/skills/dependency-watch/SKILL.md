---
name: dependency-watch
description: Check the status of tracked dependency CVEs for joshkurz.net. Use when asked to check dependency security, monitor the AWS SDK changelog, or check if the fast-xml-parser CVE has been fixed. Appends a dated status entry to the latest security review.
---

# Dependency CVE Watch

Check whether tracked dependency vulnerabilities have been resolved upstream.

## Tracked CVEs

| CVE | Package | Fixed when | Blocked by |
|-----|---------|-----------|-----------|
| GHSA-fj3w-jwp8-x2g3 | `fast-xml-parser` via `@aws-sdk/xml-builder` | `fast-xml-parser >= 5.3.8` used by `@aws-sdk/xml-builder` | AWS SDK upstream |

## Step 1 — Gather current state

Run these commands:

```bash
npm show @aws-sdk/xml-builder@latest dependencies 2>/dev/null
```
Look for the `fast-xml-parser` version range in the output.

```bash
npm show fast-xml-parser version 2>/dev/null
```
This is the latest safe version available.

```bash
npm audit 2>&1 | grep -A3 "fast-xml-parser"
```
Check if the CVE is still flagged in the installed tree.

```bash
npm list fast-xml-parser 2>/dev/null
```
Show what version is actually installed.

## Step 2 — Assess status

For each tracked CVE determine:

- **FIXED** — the upstream package now uses a safe version (fast-xml-parser >= 5.3.8) AND `npm audit` no longer flags it
- **STILL OPEN** — the upstream package still pins to a vulnerable version
- **MITIGATED** — still present but not user-triggerable (document why)

For GHSA-fj3w-jwp8-x2g3 specifically:
- The fix requires `@aws-sdk/xml-builder` to depend on `fast-xml-parser >= 5.3.8`
- Check the `dependencies` output from Step 1 — if it shows `fast-xml-parser: '^5.3.8'` or higher, it's fixed
- If `npm audit` no longer lists GHSA-fj3w-jwp8-x2g3, it's resolved

## Step 3 — Deliver a status report

Output a clear summary:

```
## Dependency CVE Watch — <today's date>

### GHSA-fj3w-jwp8-x2g3 — fast-xml-parser stack overflow via @aws-sdk/xml-builder
- Status: STILL OPEN / FIXED
- @aws-sdk/xml-builder@latest uses: fast-xml-parser@<version>
- Safe threshold: >= 5.3.8
- Latest fast-xml-parser: <version>
- npm audit: still flagged / no longer flagged
- Action: No change needed — monitor next AWS SDK release / Ready to upgrade — run `npm audit fix --force`
```

## Step 4 — Append to the latest security review

Find the most recent file in `security-reviews/`:

```bash
ls security-reviews/ | sort | tail -1
```

Append a `## Dependency Watch` section to that file with today's date and the status report. If the section already exists, add a new dated entry under it.

Format:
```markdown
## Dependency Watch

### <YYYY-MM-DD>
<status report from Step 3>
```

Confirm to the user what was appended and to which file.
