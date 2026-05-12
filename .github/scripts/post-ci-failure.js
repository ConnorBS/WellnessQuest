// Posts a sticky PR comment with the tail of each FAILED job's log.
// Invoked from a downstream `post-failures` job that runs after the primary
// jobs complete, so the /jobs/{id}/logs endpoint actually has logs to return.
//
// Defensively: any error fetching logs is swallowed and surfaced in the
// comment body itself, so the wrapper job stays green even when individual
// pieces fail. That keeps the auto-feed visible instead of opaque.

module.exports = async ({ github, context, core }) => {
  try {
    if (context.eventName !== 'pull_request') {
      core.info('not a pull_request event; skipping comments');
      return;
    }
    const prNumber = context.payload.pull_request?.number;
    if (!prNumber) {
      core.info('no PR number on payload; skipping');
      return;
    }
    const sha = context.sha.slice(0, 7);
    const runUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;

    let jobs = [];
    try {
      const res = await github.rest.actions.listJobsForWorkflowRun({
        owner: context.repo.owner,
        repo: context.repo.repo,
        run_id: context.runId,
        per_page: 100,
      });
      jobs = res.data.jobs;
    } catch (err) {
      core.warning(`listJobsForWorkflowRun failed: ${err.status} ${err.message}`);
      return;
    }

    const failed = jobs.filter((j) => j.conclusion === 'failure');
    if (failed.length === 0) {
      core.info('no failed jobs in this run; nothing to post');
      return;
    }
    core.info(`found ${failed.length} failed job(s): ${failed.map((j) => j.name).join(', ')}`);

    let existingComments = [];
    try {
      const res = await github.rest.issues.listComments({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: prNumber,
        per_page: 100,
      });
      existingComments = res.data;
    } catch (err) {
      core.warning(`listComments failed: ${err.status} ${err.message}`);
    }

    for (const job of failed) {
      const jobName = job.name;
      const marker = `<!-- ci-failure-log:${jobName} -->`;

      let tail = '(log fetch not attempted)';
      try {
        const res = await github.request('GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs', {
          owner: context.repo.owner,
          repo: context.repo.repo,
          job_id: job.id,
        });
        const raw = typeof res.data === 'string' ? res.data : Buffer.from(res.data).toString('utf8');
        const stripped = raw
          .split('\n')
          .map((line) => line.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s?/, ''));
        tail = stripped.slice(-200).join('\n');
        if (tail.length > 55000) tail = tail.slice(-55000);
      } catch (err) {
        tail = `(log fetch failed: HTTP ${err.status || '?'} ${err.message})`;
        core.warning(`log fetch for job ${jobName} (${job.id}) failed: ${err.status} ${err.message}`);
      }

      const body = [
        marker,
        `### CI failure: \`${jobName}\` on \`${sha}\``,
        '',
        `[Workflow run #${context.runId}](${runUrl}) · [Job log](${job.html_url})`,
        '',
        '<details><summary>Last ~200 lines of job log</summary>',
        '',
        '```',
        tail,
        '```',
        '',
        '</details>',
      ].join('\n');

      const existing = existingComments.find(
        (c) => typeof c.body === 'string' && c.body.includes(marker),
      );
      try {
        if (existing) {
          await github.rest.issues.updateComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            comment_id: existing.id,
            body,
          });
          core.info(`updated comment ${existing.id} for ${jobName}`);
        } else {
          await github.rest.issues.createComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: prNumber,
            body,
          });
          core.info(`created comment for ${jobName}`);
        }
      } catch (err) {
        core.warning(`comment write for ${jobName} failed: ${err.status} ${err.message}`);
      }
    }
  } catch (err) {
    core.warning(`post-ci-failure top-level error: ${err.stack || err.message}`);
  }
};
