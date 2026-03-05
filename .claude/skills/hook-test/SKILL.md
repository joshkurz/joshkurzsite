---
name: hook-test
description: Demo the pre-commit-gate hook by triggering a blocked commit. Run `/hook-test security` to demo secret detection, or `/hook-test test` to demo a failing test. Always cleans up after itself.
disable-model-invocation: true
---

# Hook Demo

Trigger the pre-commit-gate hook for a live demo, then restore everything cleanly.

The user will pass one argument: `security` or `test`.

## If the argument is `security`

### Step 1 — Create a temp file with a hardcoded API key

Create a new file `lib/demo-secret.js` containing a hardcoded OpenAI API key assignment. Use a realistic-looking key value (e.g. `sk-proj-` followed by random alphanumeric characters, at least 20 chars total after the prefix).

### Step 2 — Stage and attempt the commit

```bash
git add lib/demo-secret.js
git commit -m "hardcode api key for testing"
```

The hook will block with: `❌ Potential secrets detected in staged changes`

### Step 3 — Clean up

```bash
git restore --staged lib/demo-secret.js
rm lib/demo-secret.js
```

---

## If the argument is `test`

### Step 1 — Break a test assertion

Edit `__tests__/api/random-joke.test.js`. Find:

```js
expect(res._getStatusCode()).toBe(200)
```

Replace with:

```js
expect(res._getStatusCode()).toBe(999)
```

### Step 2 — Stage and attempt the commit

```bash
git add __tests__/api/random-joke.test.js
git commit -m "update joke API"
```

The hook will block with: `❌ Tests failed` and show the failing assertion.

### Step 3 — Clean up

```bash
git restore --staged __tests__/api/random-joke.test.js
```

Then revert the file edit — restore the original assertion:

```js
expect(res._getStatusCode()).toBe(200)
```

---

## After either demo

Confirm the working tree is clean:

```bash
git status
```

Output to the user:

```
Demo complete. Working tree restored — no changes staged or pending.
```
