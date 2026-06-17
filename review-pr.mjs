/**
 * Drive the Eve GitHub Review Bot against any pull request.
 *
 * Usage:
 *   node review-pr.mjs <owner> <repo> <pr-number>
 *
 * Env:
 *   BOT_URL                    base URL of the running bot (default http://localhost:3000)
 *   ROUTE_AUTH_BASIC_PASSWORD  HTTP Basic password the bot was started with
 *   GITHUB_TOKEN               only needed by the bot process itself, not this script
 *
 * The script opens a session asking the bot to review the PR, then streams the
 * NDJSON events so you can watch the tool calls and the posted review.
 */
const [owner, repo, prNumber] = process.argv.slice(2);
if (!owner || !repo || !prNumber) {
  console.error("usage: node review-pr.mjs <owner> <repo> <pr-number>");
  process.exit(1);
}

const BOT_URL = process.env.BOT_URL ?? "http://localhost:3000";
const PASS = process.env.ROUTE_AUTH_BASIC_PASSWORD;
if (!PASS) throw new Error("ROUTE_AUTH_BASIC_PASSWORD is required");

const auth = "Basic " + Buffer.from(`operator:${PASS}`).toString("base64");
const message = `Review pull request #${prNumber} in ${owner}/${repo} and post your review.`;

const res = await fetch(`${BOT_URL}/eve/v1/session`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: auth },
  body: JSON.stringify({ message }),
});
if (!(res.status === 200 || res.status === 202)) {
  throw new Error(`session create failed: ${res.status} ${await res.text()}`);
}
const { sessionId } = await res.json();
console.log(`session ${sessionId} — streaming…\n`);

const stream = await fetch(`${BOT_URL}/eve/v1/session/${sessionId}/stream`, {
  headers: { Authorization: auth },
});
for await (const chunk of stream.body) {
  for (const line of Buffer.from(chunk).toString().split("\n").filter(Boolean)) {
    try {
      const e = JSON.parse(line);
      if (e.type === "actions.requested")
        console.log("→ tool call:", e.data.actions?.map((a) => a.toolName).join(", "));
      else if (e.type === "action.result" && e.data.result?.output?.html_url)
        console.log("✓ review posted:", e.data.result.output.html_url);
      else if (e.type === "message.completed") console.log("\n💬", e.data.message);
      else if (e.type === "session.waiting" || e.type === "session.completed") process.exit(0);
    } catch {}
  }
}
