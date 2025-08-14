import * as core from '@actions/core'
import * as github from '@actions/github'
import type { components } from '@octokit/openapi-types'

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
type PullRequest = {
  number: number
  title: string
  url: string
  user: string
  merged_at: string | null
}

export async function run(): Promise<void> {
  try {
    const token =
      process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? core.getInput('token')
    if (!token) {
      core.setFailed(
        'GITHUB_TOKEN (or GH_TOKEN) is required via workflow `with: github-token` or env `secrets.GITHUB_TOKEN`.'
      )
      return
    }
    const octokit = github.getOctokit(token)
    const ctx = github.context

    if (
      ctx.eventName !== 'pull_request' &&
      ctx.eventName !== 'pull_request_target'
    ) {
      core.info(`Skip: event is ${ctx.eventName}`)
      return
    }

    const pr = ctx.payload.pull_request
    if (!pr) {
      core.setFailed('No pull_request payload.')
      return
    }

    const owner = ctx.repo.owner
    const repo = ctx.repo.repo

    const sourceBranch = core.getInput('source_branch') || 'main'
    const sectionTitle =
      core.getInput('section_title') ||
      'This deploy will include the following PRs'
    const START_MARK =
      core.getInput('start_mark') || '<!-- DEPLOY_DIFF_START -->'
    const END_MARK = core.getInput('end_mark') || '<!-- DEPLOY_DIFF_END -->'
    const dryRun =
      (core.getInput('dry_run') || 'false').toLowerCase() === 'true'

    const baseRef = pr.base?.ref
    const headRef = pr.head?.ref

    if (!baseRef) {
      core.info(`Skip: base is ${baseRef}`)
      return
    }
    if (headRef !== sourceBranch) {
      core.info(`Skip: head is ${headRef}, expected ${sourceBranch}`)
      return
    }

    const perPage = 250
    let page = 1
    let allCommits: components['schemas']['commit'][] = []
    while (true) {
      const { data } = await octokit.rest.repos.compareCommitsWithBasehead({
        owner,
        repo,
        basehead: `${baseRef}...${headRef}`,
        per_page: perPage,
        page
      })
      const commits = data?.commits || []
      allCommits = allCommits.concat(commits)
      if (commits.length < perPage) break
      page += 1
      if (page > 10) {
        core.warning('Too many pages; aborting compare pagination at page 10.')
        break
      }
    }
    core.info(`Commits in diff: ${allCommits.length}`)

    const prMap: Map<number, PullRequest> = new Map()
    for (const c of allCommits) {
      const sha = c.sha
      const { data: assoc } =
        await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
          owner,
          repo,
          commit_sha: sha
        })
      for (const apr of assoc) {
        const isMerged = Boolean(apr.merged_at)
        const baseIsSource = apr.base?.ref === sourceBranch
        if (isMerged && baseIsSource) {
          prMap.set(apr.number, {
            number: apr.number,
            title: apr.title || '(no title)',
            url: apr.html_url,
            user: apr.user?.login ? `@${apr.user.login}` : 'unknown user',
            merged_at: apr.merged_at
          })
        }
      }
    }

    const included = Array.from(prMap.values()).sort((a, b) => {
      const ta = a.merged_at ? Date.parse(a.merged_at) : 0
      const tb = b.merged_at ? Date.parse(b.merged_at) : 0
      return ta - tb
    })

    const lines = [`### ${sectionTitle}`, '']
    if (included.length === 0) {
      lines.push('- (none)')
    } else {
      for (const p of included) {
        lines.push(`- #${p.number} ${p.title} (${p.user}) — ${p.url}`)
      }
    }
    const section = `${START_MARK}\n${lines.join('\n')}\n${END_MARK}`

    const prNumber = pr.number
    const { data: cur } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber
    })
    const body = cur.body || ''
    const s = body.indexOf(START_MARK)
    const e = body.indexOf(END_MARK)
    const newBody =
      s !== -1 && e !== -1 && e > s
        ? body.slice(0, s) + section + body.slice(e + END_MARK.length)
        : (body ? body + '\n\n' : '') + section

    if (dryRun) {
      core.info('Dry-run enabled. New body preview:\n' + newBody)
      return
    }

    await octokit.rest.pulls.update({
      owner,
      repo,
      pull_number: prNumber,
      body: newBody
    })

    core.info(`Updated PR #${prNumber} body. Included PRs: ${included.length}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    core.setFailed(message)
  }
}
