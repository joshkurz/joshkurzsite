---
name: pre-commit-tests
description: Run the full test suite and audit test quality before committing. Catches fluff tests, missing coverage, and broken tests. Use before every commit.
disable-model-invocation: true
---

# Pre-Commit Test Suite

Run the full test suite before committing and verify tests actually test real behavior. Fails loudly if tests are fluff, missing coverage, or broken.

## What This Does

1. Runs all Jest tests
2. Audits test quality – catches tests that always pass regardless of behavior
3. Checks coverage on changed files
4. Identifies missing tests for new code

## Steps

### Step 1 – Check What's Changing

```bash
git diff --staged --name-only
```

Read this list – you'll verify test coverage for every changed file.

### Step 2 – Run the Full Test Suite

```bash
npm test -- --passWithNoTests 2>&1
```

If tests fail, stop here and report the failures. Do not continue.

### Step 3 – Run with Coverage on Changed Files

```bash
git diff --staged --name-only | grep -E '\.(js|jsx)$' | grep -v '__tests__' | head -10
```

For each changed source file, check if there's a corresponding test file in `__tests__/`:
```bash
ls __tests__/
```

### Step 4 – Audit Test Quality

Read the test files in `__tests__/` that correspond to changed files. For each test, ask:

**Is this a real test?** A real test:
- Has a descriptive name explaining what behavior it verifies
- Calls the actual code being tested (not just a mock of it)
- Has at least one meaningful `expect()` that could actually fail
- Would fail if you deleted or broke the feature it's testing

**Red flags for fluff tests:**
- `expect(true).toBe(true)`
- Tests that only verify a function exists
- Tests that mock out everything and test nothing real
- `expect(component).toBeTruthy()` with no behavior verification

Report any fluff tests found with file:line references.

### Step 5 – Check for Missing Tests

For each staged file in `pages/api/` or `lib/`:
- Is there a test file covering it?
- Does the test file cover the main happy path?
- Does the test file cover at least one error path?

If a changed file has NO tests, flag it as a gap.

### Step 6 – Verify Key Behaviors Are Tested

Read `__tests__/api/ratings.test.js` (if it exists) and verify it actually tests:
- `GET /api/ratings` returns rating data
- `POST /api/ratings` stores a rating and returns updated stats
- Invalid input returns an error response

If these aren't tested, say so.

### Step 7 – Deliver Report

```
## Pre-Commit Test Report

Tests run: X
Passing: X
Failing: X
Skipped: X

### Test Quality Audit
- [file]: [GOOD / FLUFF / MISSING]
- [specific issue if any]

### Coverage Gaps
- [file that needs tests]: [what should be tested]

### Verdict: [PASS / FAIL / PASS WITH WARNINGS]
```

If FAIL: list exactly what needs to be fixed.
If PASS WITH WARNINGS: list what tests should be added in a follow-up.
If PASS: give a brief summary of confidence level.

**Do not approve a commit with failing tests. Do not approve a commit where the only tests are fluff.**
