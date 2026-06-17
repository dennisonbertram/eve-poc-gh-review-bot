import { anthropic } from "@ai-sdk/anthropic";
import { defineAgent } from "eve";

// Use @ai-sdk/anthropic direct provider with ANTHROPIC_API_KEY.
// Primary model: claude-haiku-4-5 (fast + cheap for code review).
// Fall back to claude-sonnet-4-6 manually if haiku errors at runtime.
export default defineAgent({
  model: anthropic("claude-haiku-4-5"),
});
