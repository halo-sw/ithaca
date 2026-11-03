# 47t — two whitespace corrections only

Muse only. `git diff --cached --check` found an extra blank line at EOF in `web/src/life/plan.js:918` and `web/tests/life-plan-47b.test.js:532`. Remove only extra trailing blank lines, leaving exactly one final newline in these two files. No content changes, reads of whole files, tests, git or exploration. Stop immediately after edit.
