# 47u — final newline really remains twice

Muse only, ONE action then stop. Previous47t fixed the test file but `web/src/life/plan.js` still literally ends with bytes `  };\n}\n\n` (two trailing newlines). Remove ALL trailing whitespace from this file and append exactly ONE newline using a byte/text operation; do not rely on contextual apply_patch that can match a different `}`. No other edits, no tests, no git. Verify last bytes only and stop.
