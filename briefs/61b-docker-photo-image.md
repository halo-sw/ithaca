# Stage 61b — Docker build turns on the room-photo windows and the diary picture (brief for Muse)

Agent mode, rules in `AGENTS.md` ("Usage budget"). No sub-agents, no git, no todo list, no full suite, no build. First edit in your first tool call. Stop when done.

**Why.** `.github/workflows/pages.yml:45` builds the public site with `VITE_SAM_PHOTO=1 VITE_MUSE_IMAGE=1`. The Docker `web-build` stage does not set them. So `docker compose up` hides the room-photo windows (SAM 3.1) and the diary picture (Muse Image), even though its relay already serves `/api/vision/windows` and `/api/image/diary`. Only two files change.

## Change 1 — `Dockerfile`, two edits, nothing else
- **Lines 2–3, the header comment.** Name the two flags. Replace
  ```
  # web-build mirrors .github/workflows/pages.yml (vite build with
  # PAGES_BASE=/, VITE_STATIC=1, runtime-data.tgz, committed scenarios);
  ```
  with
  ```
  # web-build mirrors .github/workflows/pages.yml (vite build with
  # PAGES_BASE=/, VITE_STATIC=1, VITE_SAM_PHOTO=1, VITE_MUSE_IMAGE=1,
  # runtime-data.tgz, committed scenarios);
  ```
- **Line 19.** Replace
  ```
  ENV PAGES_BASE=/ VITE_STATIC=1
  ```
  with
  ```
  ENV PAGES_BASE=/ VITE_STATIC=1 VITE_SAM_PHOTO=1 VITE_MUSE_IMAGE=1
  ```

## Change 2 — `web/tests/docker-30a.test.js`: append one test, nothing else
- **Strict.** The file has 12 passing tests and ends at line 216 with `});`, which closes `describe("30a docker workspace", …)`. Keep every existing line exactly as it is. Do not change the imports. `describe`, `it`, `assert` and `read` are already defined at the top of the file.
- **Append at the very end of the file:**
  ```js

  describe("61b docker flags", () => {
    it("the Docker build turns on the same feature flags as the Pages build", () => {
      const docker = read("Dockerfile");
      const pages = read(".github/workflows/pages.yml");
      for (const flag of ["VITE_SAM_PHOTO=1", "VITE_MUSE_IMAGE=1"]) {
        assert.ok(pages.includes(flag), `pages.yml sets ${flag}`);
        assert.match(docker, new RegExp(`^ENV .*${flag}`, "m"), `Dockerfile ENV sets ${flag}`);
      }
    });
  });
  ```

Run only: `cd web && node --test tests/docker-30a.test.js 2>&1 | grep -E "^# (pass|fail)|^not ok" | head`. Expected: `# pass 13`, `# fail 0`.
If the pass count is not 13, stop and print the last lines.

## Final message
Changed files, one line each.
