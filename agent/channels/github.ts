import { defaultGitHubAuth, githubChannel } from "eve/channels/github";

// Production webhook channel for GitHub App integration.
//
// SETUP REQUIRED (human step — see blockers.md):
//   1. Create a GitHub App (https://github.com/settings/apps/new).
//   2. Subscribe to: pull_request, issue_comment, pull_request_review_comment.
//   3. Set webhook URL to https://<deployment>/eve/v1/github.
//   4. Set env vars: GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY (PEM), GITHUB_WEBHOOK_SECRET.
//
// In the live test we drive the agent via the HTTP session API (channels/eve.ts) instead,
// because a GitHub App requires manual setup. This channel is production-ready code;
// it will auto-dispatch once the App is configured and the env vars are set.
export default githubChannel({
  botName: "eve-review-bot",
  credentials: {
    appId: process.env.GITHUB_APP_ID,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
  },
  // Auto-dispatch when a PR is opened (no @mention needed).
  onPullRequest: (ctx, pr) =>
    pr.action === "opened" ? { auth: defaultGitHubAuth(ctx) } : null,
});
