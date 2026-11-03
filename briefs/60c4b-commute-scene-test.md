# Stage 60c4b — one added test for the commute scene (brief for Muse)

Agent mode, rules in `AGENTS.md` ("Usage budget"). No sub-agents, no git, no todo list, no full suite, no build. First edit in your first tool call. Stop when done.

`SCENES.commute` in `web/src/consult/diary-image.js` is already changed. Do not touch that file.

## Change — `web/tests/diary-image-60c.test.js`: append one test, nothing else
- **Strict.** The file has 23 passing tests. Keep every existing line exactly as it is. Do not rewrite, reorder or delete anything, and do not change the imports. `scenePrompt` is already imported.
- **Append this test at the very end of the file:**
  ```js
  test("60c4: the commute scene names no mode of transport", () => {
    for (const region of ["kr", "us"]) {
      const p = scenePrompt({ kind: "commute", minute: 480, region });
      for (const word of ["subway", "train", "platform", "station", "bus"]) {
        assert.equal(p.includes(word), false, `${region} commute mentions ${word}`);
      }
    }
  });
  ```

Run only: `cd web && node --test tests/diary-image-60c.test.js tests/diary-picture-60c2.test.js 2>&1 | grep -E "^# (pass|fail)|^not ok" | head`. Expected: `# pass 24`, `# fail 0`.
If the pass count is not 24, stop and print the last lines.

## Final message
Changed files, one line each.
