---
name: live-code-feature
description: Add a new feature to joshkurz.net live, start to finish. Covers spec, implementation, tests, and self-review. Use when asked to build a feature or demonstrate AI-assisted development.
disable-model-invocation: true
argument-hint: [feature-description]
---

# Live Code Feature

Add a new feature to joshkurz.net live, with Claude, start to finish. This demonstrates the full AI-assisted development workflow: spec → implementation → tests → review.

$ARGUMENTS

## The Feature

If no feature is specified in $ARGUMENTS, build **"Joke Streaks"**: track when a user rates 3+ jokes in a session and show a "You're on a streak! 🔥" badge. Use localStorage for session tracking (no backend needed).

Otherwise build whatever feature is specified in $ARGUMENTS.

## Workflow

### Step 1 – Spec It (2 minutes)

Before writing any code, output a concise spec:
```
Feature: [Name]
User story: As a [user], I want to [action] so that [benefit]
Acceptance criteria:
  - [ ] [criterion 1]
  - [ ] [criterion 2]
Data model: [what data is stored and where]
Files to change: [list]
Files to create: [list]
```

### Step 2 – Read Before Writing

Read every file you plan to modify. Do not write code you haven't read context for.

Essential reads:
- `pages/index.js` – state management, rendering patterns
- `styles/Home.module.css` – existing CSS patterns and variables
- `__tests__/` – existing test patterns to follow

### Step 3 – Implement

Write the code. Follow existing patterns:
- Class component patterns from `pages/index.js` for state additions
- CSS Modules for any new styles (no inline styles)
- Add to existing components where it fits; create new ones only if needed
- Keep it simple – no new dependencies

As you write, narrate what you're doing and why.

### Step 4 – Write Real Tests

Create tests in `__tests__/` that actually verify the feature works. Tests must:
- Test actual behavior, not implementation details
- Have descriptive names that read like documentation
- Cover the happy path AND at least one edge case
- Use existing test patterns from `__tests__/`

Run the tests:
```bash
npm test 2>&1
```

Fix any failures.

### Step 5 – Review Your Own Code

After implementing, review what you wrote and answer:
1. Is there anything you'd do differently?
2. What would break under load?
3. What's the simplest possible version of this feature?

Output a brief self-review before declaring done.

### Step 6 – Summary

```
## Feature Complete: [Name]

Files changed:
- [file]: [what changed]

Files created:
- [file]: [what it does]

Tests: X passing
Demo: [brief description of how to see it working]
```
