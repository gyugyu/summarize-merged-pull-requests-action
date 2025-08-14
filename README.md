# Summarize Merged Pull Requests Action

[![GitHub Super-Linter](https://github.com/gyugyu/summarize-merged-pull-requests-action/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/gyugyu/summarize-merged-pull-requests-action/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/gyugyu/summarize-merged-pull-requests-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/gyugyu/summarize-merged-pull-requests-action/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/gyugyu/summarize-merged-pull-requests-action/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/gyugyu/summarize-merged-pull-requests-action/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

GitHub Action to **automatically update a deploy PR description** with the list
of pull requests included in the diff between your main branch and a deploy
(staging) branch.

Useful when you manage deployment by opening a PR from `main` into `staging` (or
other environment branches) and want to see **which feature PRs are going to
production/test**.

---

## Features

- Detects PRs merged into `main` that are included in the diff `staging...main`.
- Inserts or updates a section in the deploy PR body, between markers:

  ```
  <!-- DEPLOY_DIFF_START -->
  ### This deploy will include the following PRs

  - #123 Add login form (@alice) — merged: 2025-01-10 12:00 UTC — https://github.com/owner/repo/pull/123
  - #124 Fix typo (@bob) — merged: 2025-01-12 09:30 UTC — https://github.com/owner/repo/pull/124
  <!-- DEPLOY_DIFF_END -->
  ```

- Supports re-run: existing section will be replaced, not duplicated.
- Handles squash/rebase/merge strategies (detects associated PRs via commits).
- Safe dry-run mode for local testing.

---

## Usage

### Basic workflow

```yaml
name: Update deploy PR body

on:
  pull_request:
    branches: [staging] # your deploy branch

permissions:
  contents: read
  pull-requests: write

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Update body with included PRs
        uses: gyugyu/summarize-merged-pull-requests-action@v1
        with:
          source_branch: main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Inputs

| Name            | Default                                        | Description                                                   |
| --------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| `source_branch` | `main`                                         | Branch where feature PRs are merged (typically `main`).       |
| `section_title` | `"This deploy will include the following PRs"` | Title of the section inserted in the PR body.                 |
| `start_mark`    | `"<!-- DEPLOY_DIFF_START -->"`                 | Start marker string.                                          |
| `end_mark`      | `"<!-- DEPLOY_DIFF_END -->"`                   | End marker string.                                            |
| `dry_run`       | `false`                                        | If true, do not update the PR body, only log the new content. |

---

## Permissions

This action needs:

```yaml
permissions:
  contents: read
  pull-requests: write
```

---

## Local Development

You can test with act:

1. Prepare a sample event payload at `.github/events/pull_request.json`:

```json
{
  "action": "opened",
  "number": 1,
  "pull_request": {
    "number": 1,
    "title": "Deploy to staging",
    "body": "Hello",
    "base": { "ref": "staging" },
    "head": { "ref": "main" }
  },
  "repository": {
    "full_name": "owner/repo",
    "name": "repo",
    "owner": { "login": "owner" }
  }
}
```

2. Run act with your PAT (must have `repo` scope):

```bash
export ACT_TOKEN=ghp_xxx
act pull_request \
  -W .github/workflows/e2e.yml \
  -e .github/events/pull_request.json \
  -s GITHUB_TOKEN=$ACT_TOKEN
```

---

## Notes

- Ensure that `dist/index.js` (compiled with ncc) is committed to your
  repository. GitHub Actions runners will execute that file.
- By default the action considers PRs whose base is `main` (or `source_branch`)
  and that are **merged**.
- The section in the PR body is fully replaced between markers on every run.

---

## License

MIT © gyugyu
