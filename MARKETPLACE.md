# GitHub Marketplace Listing

## Short Description (max 80 characters)

Publish changelog entries from GitHub Releases. AI-polished release notes.

## Primary Category

Continuous Integration

## Secondary Category

Utilities

## Long Description

### Ship the update. Skip the busywork.

DeployLog turns your GitHub Releases into beautiful changelog entries on your product's website — automatically. When you publish a release, this Action creates a changelog entry on DeployLog, which then appears in your embeddable widget, hosted changelog page, and subscriber email digests.

Optionally, use AI to transform technical commit messages into user-friendly release notes your customers will actually read.

### Features

- Trigger on `release.published` events
- Auto-generate user-facing notes from commits with Claude Haiku
- Notify email subscribers automatically
- Tag entries by type (feature, fix, improvement, breaking change)
- Zero configuration beyond an API key

### Quick Start

```yaml
name: Publish Changelog
on:
  release:
    types: [published]

jobs:
  changelog:
    runs-on: ubuntu-latest
    steps:
      - uses: deploylogdev/action@v1
        with:
          api-key: ${{ secrets.DEPLOYLOG_API_KEY }}
          project: your-project-slug
          ai-summarize: true
          notify-subscribers: true
```

### Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api-key` | Yes | — | Your DeployLog API key |
| `project` | Yes | — | Project slug from your DeployLog dashboard |
| `ai-summarize` | No | `false` | Use AI to rewrite release notes for end users |
| `notify-subscribers` | No | `false` | Send email digest to subscribers on publish |
| `entry-type` | No | `feature` | Entry type: feature, fix, improvement, breaking |

### Requirements

- A free DeployLog account — sign up at [deploylog.dev](https://deploylog.dev)
- A DeployLog API key stored as a GitHub Secret (`DEPLOYLOG_API_KEY`)

### How It Works

1. You publish a GitHub Release (with a tag, title, and release notes)
2. This Action sends the release data to your DeployLog project
3. If `ai-summarize` is enabled, the release notes are rewritten for non-technical users
4. A changelog entry is created and published automatically
5. The entry appears on your embeddable widget, hosted changelog page, and RSS feed
6. If `notify-subscribers` is enabled, confirmed email subscribers receive a digest

### Links

- **Documentation:** [deploylog.dev/docs/github-action](https://deploylog.dev/docs/github-action)
- **Support:** [github.com/deploylogdev/action/issues](https://github.com/deploylogdev/action/issues)
- **Privacy Policy:** [deploylog.dev/privacy](https://deploylog.dev/privacy)
- **Terms of Service:** [deploylog.dev/terms](https://deploylog.dev/terms)

---

## Marketplace Metadata

- **Logo:** `icon.png` (200x200px, solid background)
- **Background color:** `#FFFFFF`
- **Support URL:** `https://github.com/deploylogdev/action/issues`
- **Privacy Policy URL:** `https://deploylog.dev/privacy`
- **Terms of Service URL:** `https://deploylog.dev/terms`
