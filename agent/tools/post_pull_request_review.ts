import { defineTool } from "eve/tools";
import { z } from "zod";

// Posts a pull request review (with optional inline comments) to GitHub.
// Reads process.env.GITHUB_TOKEN for auth — never hardcode credentials.
export default defineTool({
  description:
    "Post a review on a GitHub pull request, with an overall body and optional inline comments on specific lines.",
  inputSchema: z.object({
    owner: z.string().min(1).describe("GitHub repo owner (user or org)"),
    repo: z.string().min(1).describe("GitHub repo name"),
    pull_number: z.number().int().positive().describe("Pull request number"),
    body: z
      .string()
      .min(1)
      .describe("The overall review body summarising the findings"),
    event: z
      .enum(["COMMENT", "APPROVE", "REQUEST_CHANGES"])
      .describe("Review event type"),
    comments: z
      .array(
        z.object({
          path: z.string().describe("Relative file path in the repo"),
          position: z
            .number()
            .int()
            .positive()
            .describe(
              "Line position in the unified diff (1-based index into the patch hunk lines)"
            ),
          body: z.string().describe("Inline comment body"),
        })
      )
      .optional()
      .describe("Inline comments on specific diff positions"),
  }),
  async execute({ owner, repo, pull_number, body, event, comments }) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN env var is not set");

    const payload: Record<string, unknown> = { body, event };
    if (comments && comments.length > 0) {
      payload.comments = comments;
    }

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}/reviews`,
      {
        method: "POST",
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "eve-github-review-bot/1.0",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        `GitHub API error posting review: ${res.status} ${res.statusText}: ${errText}`
      );
    }

    const review = await res.json();
    return {
      id: review.id,
      html_url: review.html_url,
      state: review.state,
      submitted_at: review.submitted_at,
    };
  },
});
