/* eslint-disable */
import http from 'k6/http';
import { textSummary } from 'k6/summary';

export function githubComment(data, options) {
  if (!options.commit) {
    return;
  }

  const token = options.token;
  const commit = options.commit;
  const org = options.org;
  const repo = options.repo;
  const commentKey = options.commentKey;
  const renderTitle = options.renderTitle;
  const renderMessage = options.renderMessage;

  // Count the thresholds and those that have failed
  let thresholdFailures = 0;
  let thresholdCount = 0;
  for (let metricName in data.metrics) {
    if (data.metrics[metricName].thresholds) {
      thresholdCount++;
      let thresholds = data.metrics[metricName].thresholds;
      for (let thresName in thresholds) {
        if (!thresholds[thresName].ok) {
          thresholdFailures++;
        }
      }
    }
  }

  // Count the checks and those that have passed or failed
  // NOTE. Nested groups are not checked!
  let checkFailures = 0;
  let checkPasses = 0;
  if (data.root_group.checks) {
    let { passes, fails } = countChecks(data.root_group.checks);
    checkFailures += fails;
    checkPasses += passes;
  }

  for (let group of data.root_group.groups) {
    if (group.checks) {
      let { passes, fails } = countChecks(group.checks);
      checkFailures += fails;
      checkPasses += passes;
    }
  }

  const prNumber = options.pr || getPullRequestNumber();

  if (!prNumber) {
    console.log('Not a Pull Request. Skipping comment creation...');
    return;
  }

  const existingComment = getExistingComment(prNumber);
  const passes = checkFailures === 0 && thresholdFailures === 0;
  const summary = textSummary(data, { indent: ' ', enableColors: false });

  const status = {
    passes,
    thresholds: {
      failures: thresholdFailures,
      passes: thresholdCount - thresholdFailures,
    },
    checks: {
      failures: checkFailures,
      passes: checkPasses,
    },
  };

  const body = [
    commentKey ? renderCommentKey(commentKey) : '',
    `### ${renderTitle(status)}`,
    renderMessage(status),
    '```',
    summary,
    '```',
  ].join('\n');

  if (existingComment) {
    console.log('Updating existing PR comment...');
    updateComment(existingComment.id, body);
  } else {
    console.log('Creating a new PR comment...');
    createComment(prNumber, body);
  }

  function getPullRequestNumber() {
    const res = http.get(
      `https://api.github.com/repos/${org}/${repo}/commits/${commit}/pulls`,
      {
        headers: {
          accept: 'application/vnd.github.groot-preview+json',
          authorization: `Bearer ${token}`,
        },
      },
    );

    const pullRequests = res.json();

    if (pullRequests && pullRequests.length) {
      return pullRequests[0].number;
    }

    return null;
  }

  function getExistingComment(id) {
    const res = http.get(
      `https://api.github.com/repos/${org}/${repo}/issues/${id}/comments`,
      {
        headers: {
          accept: 'application/vnd.github.v3+json',
          authorization: `Bearer ${token}`,
        },
      },
    );

    const comments = res.json();

    if (comments && comments.length) {
      return matchComment(comments, commentKey);
    }

    return null;
  }

  function updateComment(id, body) {
    const res = http.patch(
      `https://api.github.com/repos/${org}/${repo}/issues/comments/${id}`,
      JSON.stringify({
        body,
      }),
      {
        headers: {
          accept: 'application/vnd.github.v3+json',
          authorization: `Bearer ${token}`,
        },
      },
    );

    assert2XX(res, 'Failed to update the comment');
  }

  function createComment(id, body) {
    const res = http.post(
      `https://api.github.com/repos/${org}/${repo}/issues/${id}/comments`,
      JSON.stringify({
        body,
      }),
      {
        headers: {
          accept: 'application/vnd.github.v3+json',
          authorization: `Bearer ${token}`,
        },
      },
    );

    assert2XX(res, 'Failed to create a comment');
  }
}

function assert2XX(res, message) {
  if (res.status === 200 || res.status === 201) {
    return;
  }

  if (res.status < 200 && res.status >= 300) {
    console.error(message, res.status, res.error, res.error_code);
  } else {
    console.warn(message, res.status, res.error, res.error_code);
  }
}

function matchComment(comments, commentKey) {
  return comments.find(({ body }) => {
    if (commentKey) {
      return body.includes(renderCommentKey(commentKey));
    }
    return body.includes('http_req_waiting');
  });
}

// Helper for counting the checks in a group
function countChecks(checks) {
  let passes = 0;
  let fails = 0;
  for (let check of checks) {
    passes += parseInt(check.passes);
    fails += parseInt(check.fails);
  }
  return { passes, fails };
}

function renderCommentKey(commentKey) {
  return `<!-- commentKey:${commentKey} -->`;
}
