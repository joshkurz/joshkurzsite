---
name: well-architected-security
description: Review joshkurz.net for real security vulnerabilities including credential exposure, injection, API authorization gaps, and CVEs. Produces a prioritized report with specific fixes. Use when asked to audit security.
disable-model-invocation: true
---

# Well-Architected Review: Security

Review joshkurz.net for real security vulnerabilities. Find actual issues in the code, not generic advice. This is a live demo.

## Review Scope

Focus on **exploitable vulnerabilities** and **data exposure risks**:
1. Secret and credential exposure
2. Input validation and injection
3. API security (rate limiting, authorization)
4. Dependency vulnerabilities
5. Data privacy

## Steps

### Step 1 – Read Everything First

Read all of these before writing anything:
- `pages/api/*.js` – every API handler
- `lib/ratingsStorageDynamo.js` – DynamoDB data storage logic
- `lib/dynamoClient.js` – AWS credential and client setup
- `lib/customJokes.js` – user submission handling
- `lib/openaiClient.js` – API key handling
- `next.config.js` – server config
- `.env*` files if present (check for committed secrets)
- `.gitignore` – verify secrets are excluded

### Step 2 – Scan for Exposed Secrets

Search for hardcoded credentials:
```bash
grep -r "sk-" pages/ lib/ --include="*.js" -l
grep -r "AKIA" pages/ lib/ --include="*.js" -l
grep -r "aws_secret" pages/ lib/ --include="*.js" -l -i
grep -r "password\s*=" pages/ lib/ --include="*.js" -l -i
```

Check how API keys are accessed – are they always read from `process.env`?

### Step 3 – Audit API Input Validation

For each API endpoint, check:
- Is user input validated before use?
- Could a user inject arbitrary data into DynamoDB key expressions?
- Is joke content sanitized before storing or rendering?
- Are there any endpoints that expose internal error details?

Specifically check `pages/api/custom-jokes.js` and `pages/api/ratings.js` for:
- Key injection: can a user control part of the DynamoDB PK/SK?
- Size limits: is there a max body size enforced?
- Type checking: are all fields validated for type?

### Step 4 – Check API Authorization

- Which endpoints are public? Which require auth?
- Is there rate limiting on any endpoint? (If not, this is a real issue)
- Can users access or overwrite other users' ratings?
- Is the `/api/custom-jokes` endpoint protected against spam?

### Step 5 – Run Dependency Audit

```bash
npm audit 2>&1 | head -60
```

Report all HIGH and CRITICAL vulnerabilities with CVE numbers.

### Step 6 – Check for XSS

Review how user-submitted joke content is rendered in `pages/index.js`. Is React's JSX escaping being bypassed anywhere? Look for `dangerouslySetInnerHTML`.

### Step 7 – Check DynamoDB Security

Review `lib/dynamoClient.js` and `lib/ratingsStorageDynamo.js`:
- Are DynamoDB key expressions parameterized (no string concatenation into expressions)?
- Could user input affect which DynamoDB items are read/written (PK injection)?
- Are IAM permissions scoped to specific table ARNs, or overly broad?

### Step 8 – Deliver the Report

```
## Security Review: joshkurz.net

### 🔴 Critical Vulnerabilities
- [CVE/issue]: [file:line] – [attack scenario] – [fix]

### 🟡 Security Weaknesses
- [issue]: [file:line] – [risk] – [remediation]

### 🟢 Security Wins
- [what's done right]

### Immediate Actions Required
1. [specific fix with code diff]
2. [specific fix with code diff]

### Security Hardening Backlog
- [future improvements]
```

Be specific. Show the actual vulnerable code, explain how it could be exploited, and show the fix. No generic OWASP boilerplate.

### Step 9 – Write the Review to a Dated File

After delivering the report to the user, persist it to disk.

Get the commit metadata:
```bash
git log -1 --format="%H %ci %s"
```

This returns `<full-hash> <date> <message>`. Use the first 7 chars of the hash and the date (YYYY-MM-DD) to name the file.

Write the full report to:
```
security-reviews/YYYY-MM-DD-<short-hash>.md
```

The file must open with a metadata header:
```md
# Security Review: joshkurz.net

| Field | Value |
|-------|-------|
| Reviewed | YYYY-MM-DD |
| Commit | `<full-hash>` |
| Commit date | <commit datetime> |
| Commit message | <message> |
| Reviewer | Claude (well-architected-security skill) |
```

Followed by the full report content exactly as delivered to the user. Create the `security-reviews/` directory if it doesn't exist.
