# 🤖 Eve GitHub Review Bot

An autonomous **pull-request review bot** built on [Eve](https://github.com/vercel/eve), Vercel's open-source, filesystem-first agent framework. Point it at a pull request and it fetches the diff, reasons about it with an LLM, and posts a real GitHub review naming the actual defects — off-by-one errors, `==` vs `===`, missing null checks, ignored arguments, logic bugs.

The whole bot is **~120 lines across 5 files**. Eve provides the runtime, the durable HTTP session API, the auth, and the deploy story; you just write the agent and two tools.

> Built as a proof-of-concept. Runs locally, as a GitHub Action, or deployed to Vercel as a GitHub-App webhook bot.

---

## What it actually does

Given a PR, the agent calls two tools — `get_pull_request_diff` then `post_pull_request_review` — and posts something like this (a **real** review this bot posted during testing):

> The new `filter` function is correctly implemented. However, the PR introduces several bugs:
> 1. **findIndex** (line 17): Off-by-one error with `i <= arr.length` (should be `i < arr.length`)
> 2. **findIndex** (line 11): Uses loose equality `==` instead of `===`
> 3. **sum** (line 24): Unused `result` parameter
> 4. **first** (line 31): No null/undefined check before accessing `arr[0]`

No fine-tuning, no rules engine — just an LLM with the diff in context and a tool to post the review.

---

## How it works

In Eve, **an agent is a directory**. This bot is:

```
agent/
  agent.ts                      # the model (Claude Haiku 4.5 via @ai-sdk/anthropic)
  instructions.md               # the system prompt: "you are a code review bot…"
  tools/
    get_pull_request_diff.ts    # GET the PR files + patches  (uses GITHUB_TOKEN)
    post_pull_request_review.ts # POST a review with inline comments (uses GITHUB_TOKEN)
  channels/
    eve.ts                      # the HTTP session API + route auth (fail-closed)
    github.ts                   # OPTIONAL: GitHub App webhook channel (auto-review on PR open)
.github/workflows/eve-review.yml  # run the bot as a GitHub Action on every PR
review-pr.mjs                     # CLI: drive the bot against any PR
```

A tool is just a typed function:

```ts
// agent/tools/post_pull_request_review.ts (abridged)
export default defineTool({
  description: "Post a review on a GitHub pull request…",
  inputSchema: z.object({ owner: z.string(), repo: z.string(), pull_number: z.number(),
                          body: z.string(), event: z.enum(["COMMENT","APPROVE","REQUEST_CHANGES"]),
                          comments: z.array(/* inline comments */).optional() }),
  async execute({ owner, repo, pull_number, body, event, comments }) {
    const token = process.env.GITHUB_TOKEN;            // ← from env, never hardcoded
    // POST /repos/{owner}/{repo}/pulls/{n}/reviews
  },
});
```

The model decides *what* to review and *what* to say; the tools just talk to the GitHub API.

---

## Quick start (local)

**Prerequisites:** Node 24+, an [Anthropic API key](https://console.anthropic.com/settings/keys), and a [GitHub token](https://github.com/settings/tokens) with `repo` (or fine-grained *Pull requests: read & write*) scope.

```bash
git clone https://github.com/dennisonbertram/eve-poc-gh-review-bot.git
cd eve-poc-gh-review-bot
npm install

cp .env.example .env.local        # then edit .env.local with your keys (see below)
npm run dev                       # interactive TUI — type: "review PR #3 in owner/repo"
```

Or run it headless and drive it over HTTP:

```bash
npm run build && npm start &      # serves the HTTP session API on :3000
ROUTE_AUTH_BASIC_PASSWORD=… node review-pr.mjs <owner> <repo> <pr-number>
```

### Environment variables

Copy `.env.example` → `.env.local` (gitignored) and fill in:

| Variable | Required | What it's for |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | the model. `sk-ant-…` from console.anthropic.com |
| `GITHUB_TOKEN` | ✅ | the bot reads PR diffs + posts reviews with this |
| `ROUTE_AUTH_BASIC_PASSWORD` | ✅ (deployed) | HTTP Basic password guarding the session routes |
| `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` / `GITHUB_WEBHOOK_SECRET` | optional | only for the GitHub-App webhook channel |

> ⚠️ **Eve uses the AI Gateway by default.** A *string* model id like `"anthropic/claude-haiku-4-5"` routes through the Vercel AI Gateway and needs `AI_GATEWAY_API_KEY`. To run on a bare `ANTHROPIC_API_KEY`, this repo passes a **provider object** — `anthropic("claude-haiku-4-5")` from `@ai-sdk/anthropic` — in `agent/agent.ts`.

---

## Run it as a GitHub Action

`.github/workflows/eve-review.yml` triggers on every PR and drives the deployed bot. Deploy the bot (below), then set three repo secrets:

| Secret | Value |
|---|---|
| `EVE_BOT_URL` | your deployed bot URL, e.g. `https://your-bot.vercel.app` |
| `EVE_BOT_PASSWORD` | the `ROUTE_AUTH_BASIC_PASSWORD` you deployed with |
| `GITHUB_TOKEN` | provided automatically by Actions |

Now every opened/updated PR gets an automatic review comment.

---

## Deploy to Vercel

Eve runs the same locally and on Vercel.

```bash
VERCEL=1 npx eve build               # writes the Build Output bundle to .vercel/output
vercel link --yes --project eve-review-bot
# set runtime env on the project (never commit these):
printf '%s' "$ANTHROPIC_API_KEY"          | vercel env add ANTHROPIC_API_KEY production
printf '%s' "$GITHUB_TOKEN"               | vercel env add GITHUB_TOKEN production
printf '%s' "$ROUTE_AUTH_BASIC_PASSWORD"  | vercel env add ROUTE_AUTH_BASIC_PASSWORD production
vercel deploy --prebuilt --prod --yes
```

**Route auth (important).** Eve **fails closed**: deployed session routes reject traffic unless you configure auth (`agent/channels/eve.ts` accepts a Vercel OIDC caller or HTTP Basic `operator` / `ROUTE_AUTH_BASIC_PASSWORD`). `GET /eve/v1/health` is always public. New Vercel projects also enable *Vercel SSO* on all routes by default — disable it (Project → Settings → Deployment Protection) if you want the bot reachable by external callers; Eve's own route auth still guards the session endpoints.

---

## Production form: a GitHub App webhook bot

For a bot that reviews **automatically when a PR opens** (no Action, no polling), use `agent/channels/github.ts`. Eve's GitHub channel takes App webhooks at `/eve/v1/github`, verifies the signature, puts the **PR diff in context**, and checks the repo out into a sandbox.

1. Create a GitHub App → https://github.com/settings/apps/new
2. Subscribe to the `pull_request` event; set the webhook URL to `https://<your-deployment>/eve/v1/github`
3. Set `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` (PEM), `GITHUB_WEBHOOK_SECRET` on the project
4. Install the App on your repo

The channel auto-dispatches on `pull_request.opened` and the agent reviews it in-thread.

---

## Security

- **No secrets in this repo.** Every credential is read from `process.env` at runtime; `.env.local` is gitignored. The committed `.env.example` contains only placeholders.
- The bot acts with whatever `GITHUB_TOKEN` you give it — scope it to the minimum (read PRs + write reviews) and to specific repos with a fine-grained PAT.
- Session routes are **fail-closed** (HTTP Basic / Vercel OIDC). Never expose the bot without auth.

## Built with

[Eve](https://github.com/vercel/eve) · [Vercel AI SDK](https://ai-sdk.dev) · Anthropic Claude · [Vercel](https://vercel.com)

## License

MIT — see [LICENSE](./LICENSE).
