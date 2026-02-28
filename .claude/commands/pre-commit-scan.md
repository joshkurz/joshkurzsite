# Pre-Commit Vulnerability Scan

Scan staged changes for security vulnerabilities before committing. Catches real issues: secrets, injection vectors, unsafe patterns, and known CVEs.

## What Gets Scanned

1. Staged diff – line-by-line for dangerous patterns
2. npm audit – known CVEs in dependencies
3. ESLint – security-relevant lint rules
4. Secret detection – API keys, passwords, tokens
5. Unsafe patterns – eval, innerHTML, path traversal

## Steps

### Step 1 – Get Staged Changes

```bash
git diff --staged
```

Read the full diff. These are the changes that will be committed.

### Step 2 – Secret Detection

Scan the staged diff for:

```bash
git diff --staged | grep -iE "(api[_-]?key|secret|password|token|credential|private[_-]?key)\s*[=:]\s*['\"][^'\"]{8,}" || echo "No obvious secrets found"

git diff --staged | grep -E "(sk-[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16}|ghp_[a-zA-Z0-9]{36})" || echo "No API key patterns found"
```

Report any matches immediately as BLOCKING issues.

### Step 3 – Dependency Audit

```bash
npm audit --audit-level=moderate 2>&1 | head -50
```

Flag any HIGH or CRITICAL vulnerabilities. Note if the staged changes add new packages.

### Step 4 – ESLint

```bash
npx eslint $(git diff --staged --name-only | grep -E '\.(js|jsx|ts|tsx)$' | tr '\n' ' ') 2>&1
```

Report any errors (not just warnings).

### Step 5 – Unsafe Pattern Scan

Scan staged files for:
```bash
git diff --staged | grep -E "dangerouslySetInnerHTML|eval\(|innerHTML\s*=" || echo "No unsafe DOM patterns"
git diff --staged | grep -E "exec\(|execSync\(|spawn\(" || echo "No shell exec patterns"
git diff --staged | grep -E "\.readFile.*req\.|\.writeFile.*req\." || echo "No path traversal patterns"
git diff --staged | grep -iE "console\.log.*(key|secret|token|password)" || echo "No credential logging"
```

### Step 6 – API Change Review

If any `pages/api/*.js` files are in the staged changes:
- Read each modified API file
- Check that new parameters are validated
- Verify no new environment variables are exposed in responses

### Step 7 – Deliver Verdict

```
## Pre-Commit Security Scan

Scanned: [N files changed, +X -Y lines]
Date: [timestamp]

### 🔴 BLOCKING – Do not commit
[list issues that must be fixed]

### 🟡 Warnings – Review before committing
[list concerns]

### 🟢 Clear
[what passed]

Verdict: [PASS / FAIL]
```

If FAIL, explain exactly what needs to be fixed before committing. Do not suggest `--no-verify`.
