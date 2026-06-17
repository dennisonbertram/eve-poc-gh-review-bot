import { defineTool } from "eve/tools";
import { z } from "zod";

// Fetches the list of changed files + patches for a GitHub pull request.
// Reads process.env.GITHUB_TOKEN for auth — never hardcode credentials.
export default defineTool({
  description:
    "Fetch the list of changed files and their diffs for a GitHub pull request.",
  inputSchema: z.object({
    owner: z.string().min(1).describe("GitHub repo owner (user or org)"),
    repo: z.string().min(1).describe("GitHub repo name"),
    pull_number: z.number().int().positive().describe("Pull request number"),
  }),
  async execute({ owner, repo, pull_number }) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN env var is not set");

    // Fetch PR metadata
    const prRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "eve-github-review-bot/1.0",
        },
      }
    );
    if (!prRes.ok) {
      throw new Error(
        `GitHub API error fetching PR: ${prRes.status} ${prRes.statusText}`
      );
    }
    const pr = await prRes.json();

    // Fetch PR files with patches
    const filesRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}/files`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "eve-github-review-bot/1.0",
        },
      }
    );
    if (!filesRes.ok) {
      throw new Error(
        `GitHub API error fetching PR files: ${filesRes.status} ${filesRes.statusText}`
      );
    }
    const files = await filesRes.json();

    return {
      title: pr.title,
      body: pr.body,
      base_sha: pr.base.sha,
      head_sha: pr.head.sha,
      files: files.map((f: any) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch ?? "(binary or no patch)",
      })),
    };
  },
});
