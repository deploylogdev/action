# DeployLog GitHub Action

Automatically publish changelog entries from GitHub Releases. Optionally use AI to transform commit messages into user-friendly release notes.

## Quick Start

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
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api-key` | Yes | — | Your DeployLog API key ([get one here](https://deploylog.dev/dashboard/api-keys)) |
| `project` | Yes | — | Project slug from your DeployLog dashboard |
| `ai-summarize` | No | `false` | Rewrite release notes for end users using AI |
| `notify-subscribers` | No | `false` | Send email digest to subscribers on publish |
| `entry-type` | No | `feature` | Entry type: `feature`, `fix`, `improvement`, `breaking`, `announcement` |

## Examples

### Basic — publish release notes as-is

```yaml
- uses: deploylogdev/action@v1
  with:
    api-key: ${{ secrets.DEPLOYLOG_API_KEY }}
    project: my-app
```

### AI-powered — rewrite for end users

```yaml
- uses: deploylogdev/action@v1
  with:
    api-key: ${{ secrets.DEPLOYLOG_API_KEY }}
    project: my-app
    ai-summarize: true
    notify-subscribers: true
```

### Tag as a fix

```yaml
- uses: deploylogdev/action@v1
  with:
    api-key: ${{ secrets.DEPLOYLOG_API_KEY }}
    project: my-app
    entry-type: fix
```

## How It Works

1. You publish a GitHub Release
2. This Action reads the release title, tag, and body
3. If `ai-summarize` is enabled, the release body is rewritten into user-friendly language
4. A changelog entry is created on your DeployLog project
5. The entry appears on your widget, hosted changelog page, and RSS feed
6. If `notify-subscribers` is enabled, email subscribers receive a digest

## Setup

1. Sign up at [deploylog.dev](https://deploylog.dev) (free)
2. Create a project and copy the project slug
3. Generate an API key from your dashboard
4. Add the API key as a repository secret: Settings → Secrets → `DEPLOYLOG_API_KEY`
5. Add the workflow file above to `.github/workflows/changelog.yml`

## Links

- [DeployLog](https://deploylog.dev)
- [Documentation](https://deploylog.dev/docs/github-action)
- [CLI Tool](https://www.npmjs.com/package/deploylog)
- [Issues](https://github.com/deploylogdev/action/issues)

## License

MIT
