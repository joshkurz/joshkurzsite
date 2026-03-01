#!/bin/bash
# .claude/hooks/pre-commit-gate.sh
# Blocks git commits if tests fail or secrets are detected in staged changes.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')
CWD=$(echo "$INPUT" | jq -r '.cwd // ""')
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$CWD}"

# Only intercept git commit commands
if ! echo "$COMMAND" | grep -qE 'git\s+commit'; then
  exit 0
fi

echo "━━━ Pre-Commit Gate ━━━" >&2
FAILED=false
WARN_MESSAGES=""

# ── Tests ──────────────────────────────────────────────────────────────
echo "⏳ Running tests..." >&2
TEST_OUTPUT=$(cd "$PROJECT_DIR" && ./node_modules/.bin/jest --passWithNoTests 2>&1)
TEST_EXIT=$?

if [ $TEST_EXIT -ne 0 ]; then
  echo "❌ Tests failed:" >&2
  echo "$TEST_OUTPUT" | tail -20 >&2
  FAILED=true
else
  PASS_LINE=$(echo "$TEST_OUTPUT" | grep "Tests:" | tr -s ' ')
  echo "✅ Tests passed — ${PASS_LINE}" >&2
fi

# ── Secret scan ─────────────────────────────────────────────────────────
echo "⏳ Scanning staged diff for secrets..." >&2
STAGED_DIFF=$(cd "$PROJECT_DIR" && git diff --staged)

SECRETS=$(echo "$STAGED_DIFF" | grep -iE "(api[_-]?key|secret|password|token|credential|private[_-]?key)\s*[=:]\s*['\"][^'\"]{8,}")
API_KEYS=$(echo "$STAGED_DIFF" | grep -E "(sk-[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16}|ghp_[a-zA-Z0-9]{36})")

if [ -n "$SECRETS" ] || [ -n "$API_KEYS" ]; then
  echo "❌ Potential secrets detected in staged changes" >&2
  FAILED=true
else
  echo "✅ No secrets detected" >&2
fi

# ── Unsafe patterns (JS/JSX only) ───────────────────────────────────────
JS_DIFF=$(cd "$PROJECT_DIR" && git diff --staged -- '*.js' '*.jsx' '*.ts' '*.tsx')
UNSAFE=$(echo "$JS_DIFF" | grep -E "dangerouslySetInnerHTML|eval\(|innerHTML\s*=")
if [ -n "$UNSAFE" ]; then
  echo "⚠️  Unsafe DOM patterns detected" >&2
  WARN_MESSAGES="Unsafe DOM patterns in staged changes. Review before committing."
fi

echo "" >&2

# ── Verdict ─────────────────────────────────────────────────────────────
if [ "$FAILED" = true ]; then
  echo "🚫 COMMIT BLOCKED — fix issues above before committing" >&2
  exit 2
fi

if [ -n "$WARN_MESSAGES" ]; then
  jq -n --arg reason "$WARN_MESSAGES" '{
    "hookSpecificOutput": {
      "hookEventName": "PreToolUse",
      "permissionDecision": "ask",
      "permissionDecisionReason": $reason
    }
  }'
  exit 0
fi

echo "✅ All checks passed — commit allowed" >&2
exit 0
