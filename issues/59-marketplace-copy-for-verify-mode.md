# 59 — Marketplace copy for verify mode (draft for Marko)

**Status:** draft, awaiting Marko's edit · **Type:** HUMAN · **Lane:** deploylog-action
**Blocks:** tagging the version that carries verify mode. `action.yml`'s description already
advertises it, and the two must not go live disagreeing.

Written to `references/voice.md`: short direct sentences, no hype, no em dashes or arrows. The
value gate is applied, so the opening names the reader's problem rather than the product's history.

## Short Description (max 80 characters)

Current, publish-only:

> Publish changelog entries from GitHub Releases. AI-polished release notes.

**Option A (75 chars).** Plain, symmetric, says what both modes do.

> Publish changelogs from Releases. Check your manual still matches the code.

**Option B (77 chars).** Names the mechanism, so the reader knows it is a check and not a viewer.

> Changelogs from your Releases. And a manual that fails CI when it goes stale.

**Option C (79 chars).** Keeps the AI line, which is the current listing's hook.

> Changelogs from Releases, AI-polished. Plus a manual checked against the code.

## Long Description, new section

To sit after the existing "Ship the update. Skip the busywork." paragraphs, before Features.

> ### Docs go stale quietly.
>
> A constant changes, the sentence describing it does not, and nobody finds out until a customer
> reads the old number. Nothing fails. Nothing is flagged. The doc just stops being true.
>
> Set `mode: verify` and this Action checks your DeployLog manual against the code it cites, on
> every pull request. When a cited value moves, the finding lands as an annotation on the changed
> line, next to the change that caused it.
>
> It starts quiet. On the default setting the check stays green and the findings are informational,
> so adding it to a busy repository breaks nothing on day one. When you trust it, `fail-on: drift`
> makes stale docs fail the build.

## Features, added bullets

> - Verify your manual against the code it cites, on every pull request
> - Findings appear inline on the changed line, not in a report nobody opens
> - Green by default, so it cannot break an existing build the day you add it

## Two things to decide

1. **The existing Long Description uses em dashes** ("your product's website — automatically"). That
   predates the punctuation rule. Left alone rather than rewritten quietly. Say the word and it goes.
2. **Do not tag until the copy lands.** `action.yml:2` already names verify mode, so a release
   shipped before this edit puts a listing and a manifest into the Marketplace saying different
   things about the same version.
