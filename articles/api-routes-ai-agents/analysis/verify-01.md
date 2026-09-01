CHAIN MAP
P1 -> introduces the 504 timeout problem in serverless LLM deployments.
P2 -> explains the common (bad) fix of increasing `maxDuration`.
P3 -> argues why this fix is a temporary band-aid due to LLM unpredictability.
P4 -> warns of the inevitable production failure when the new timeout ceiling is breached.
P5 -> explains the mechanism of idle connections during synchronous LLM requests.
P6 -> contrasts local development (lenient with idle sockets) with production.
P7 -> introduces production API gateways/load balancers policing idle connections.
P8 -> provides concrete gateway timeout limits (Vercel, AWS) that override function timeouts.
P9 -> identifies the root cause as an abstraction mismatch (synchronous HTTP vs. streaming data).
P10 -> explains the token-by-token nature of LLM generation.
P11 -> describes how synchronous endpoints buffer tokens and starve the network.
P12 -> provides evidence from industry leaders (OpenAI) using streaming.
P13 -> introduces Server-Sent Events (SSE) as the architectural solution.
P14 -> explains the technical mechanism of SSE (headers, chunked transfer) in preventing idle timeouts.
P15 -> concludes how SSE solves the problem permanently and aligns with industry standards.

BROKEN EDGES
- P1 -> P2: The phrases "The instinct here" and "done this" in P1 have no clear antecedent because the action of increasing the timeout limit has not yet been introduced.
- P8 -> P9: The paragraph lacks mention of other common serverless/cloud environments like Cloudflare or traditional load balancers, which also enforce strict idle timeouts that developers try to bypass by changing function timeouts.

REPAIRS MADE
- P1: Rewrote the final sentence to explicitly name the instinct to increase the timeout limit, resolving the missing antecedent.
- P8: Integrated Cloudflare and traditional cloud load balancers into the list of strict gateway-level idle limits that override function-level timeouts.