import { eveChannel } from "eve/channels/eve";
import { httpBasic, vercelOidc } from "eve/channels/auth";

// Eve fails closed in production: unconfigured session routes reject all traffic.
// Accept (1) Vercel internal/OIDC callers and (2) an operator via HTTP Basic
// so the deployed agent can be smoke-tested with curl -u.
// GET /eve/v1/health stays public regardless.
export default eveChannel({
  auth: [
    vercelOidc(),
    httpBasic({
      username: "operator",
      password: process.env.ROUTE_AUTH_BASIC_PASSWORD ?? "",
    }),
  ],
});
