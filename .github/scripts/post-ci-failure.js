// Posts a sticky PR comment with the tail of the current job's log on failure.
// Invoked from each CI job's "Post failure log as PR comment" step.
//
// Usage in workflow:
//   - uses: actions/github-script@v7
//     with:
//       script: |
//         await require(`${process.env.GITHUB_WORKSPACE}/.github/scripts/post-ci-failure.js`)
//           ({ github, context, core, jobName: 'backend' });

module.exports = async ({ github, context, core, jobName }) => {
  if (context.eventName !== 'pull_request') {
    core.info('not a pull_request event; skipping comment');
    return;
  }
  const prNumber = context.payload.pull_request?.number;
  if (!prNumber) {
    core.info('no PR number on payload; skipping');
    return;
  }
  const marker = `<!-- ci-failure-log:${jobName} -->`;
  const sha = context.sha.slice(0, 7);
  const runUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;

  // Find this job's id within the current workflow run, then fetch its logs.
  let tail = '(unable to fetch logs)';
  try {
    const { data: { jobs } } = await github.rest.actions.listJobsForWorkflowRun({
      owner: context.repo.owner,
      repo: context.repo.repo,
      run_id: context.runId,
      per_page: 100,
    });
    const job = jobs.find((j) => j.name === jobName) || jobs.find((j) => j.name === context.job);
    if (!job) {
      core.warning(`no job named ${jobName} or ${context.job} in run ${context.runId}`);
    } else {
      const res = await github.request('GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs', {
        owner: context.repo.owner,
        repo: context.repo.repo,
        job_id: job.id,
      });
      const raw = typeof res.data === 'string' ? res.data : Buffer.from(res.data).toString('utf8');
      // Strip the leading timestamp prefix ("2026-05-12T20:07:32.0220538Z ") to fit more useful content per line.
      const stripped = raw
        .split('\n')
        .map((line) => line.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s?/, ''));
      tail = stripped.slice(-180).join('\n');
      // GitHub PR comments are capped at 65536 chars; truncate the tail if needed.
      if (tail.length > 55000) tail = tail.slice(-55000);
    }
  } catch (err) {
    core.warning(`log fetch failed: ${err.message}`);
  }

  const body = [
    marker,
    `### CI failure: \`${jobName}\` on \`${sha}\``,
    '',
    `[Workflow run #${context.runId}](${runUrl})`,
    '',
    '<details><summary>Last ~180 lines of job log</summary>',
    '',
    '```',
    tail,
    '```',
    '',
    '</details>',
  ].join('\n');

  // Sticky-comment: find an existing comment with our marker and update it,
  // otherwise create a new one.
  const { data: comments } = await github.rest.issues.listComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: prNumber,
    per_page: 100,
  });
  const existing = comments.find((c) => typeof c.body === 'string' && c.body.includes(marker));
  if (existing) {
    await github.rest.issues.updateComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      body,
    });
  }
};
