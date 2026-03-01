#!/bin/sh
# Finds the last commit that touched diagrams/ and diffs the architecture
# source files against it. Used by the architecture-diagram skill for
# change detection before deciding whether to rebuild.

SHA=$(git log --oneline --follow -- diagrams/ | head -1 | awk '{print $1}')

if [ -z "$SHA" ]; then
  echo "NEVER_COMMITTED"
else
  git diff "$SHA" -- pages/api/ lib/ package.json next.config.js
fi
