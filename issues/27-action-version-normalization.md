# 27 — GitHub Action version normalization (BUG-027)

**Status:** ready-for-agent · **Type:** AFK · **Lane:** deploylog-action
**Parent:** ../deploylog/issues/prd-launch-security-billing-remediation.md *(PRD lives in the deploylog repo)*
**Blocked by:** None — but sequence after the deploylog server is confirmed unchanged (no server change is needed; the Action conforms to the existing schema).
**Verification:** PRD assertion 9 — failing tests to turn green in `src/release.test.ts`: `+build.42` → `1.0.0`; no clean semver → `''` or omitted (never `null`); the resulting payload validates against the server's `CreateEntrySchema.version` shape. Signal: `vitest run`.

> Relocated here from `deploylog/issues/` on 2026-07-02: it edits this repo, and the deploylog
> AFK night-loop branches the deploylog repo, so it would misfire there. Not armed for the same
> night as the deploylog remediation run (avoids double-drawing the nightly rate ceiling).

## What to build

Make the Action's derived version conform to the server's `CreateEntrySchema.version`
(`.regex(/^\d+\.\d+\.\d+$/).optional().or(z.literal(''))` — accepts `undefined`/`''`, **rejects
`null`**). Today `extractVersion` preserves suffixes and the Action can send `null`, both of which
400 and turn a user's release workflow red.

- For a stable tag with a suffix (`v1.0.0+build.42`), send `1.0.0`.
- When there is no clean `MAJOR.MINOR.PATCH`, **omit the field or send `''`, never `null`**.
- Reconcile with BUG-016 (already shipped): prerelease skipping is on by default, so `-rc.1` tags
  are gated before `extractVersion` and stripping them would collide with the later real `2.0.0` —
  so the target case is stable-with-suffix and the `null`-vs-`''` schema bug, not prereleases.
- Update `release.test.ts` (currently asserts suffix *preservation*) and rebuild `dist/` cleanly.

## Acceptance criteria

- [ ] `extractVersion` (or the derivation path) emits bare `MAJOR.MINOR.PATCH`, `''`, or omits — never `null`, never a suffix.
- [ ] Tests assert `+build.42` → `1.0.0` and the no-clean-semver → `''`/omitted path, and confirm the payload validates against the server schema shape.
- [ ] `dist/` rebuilt cleanly and committed (esbuild interop drift avoided per the known gotcha).
- [ ] `vitest run` passes in the action repo.
