CHAIN MAP
P1 -> introduces the standard REST pattern (`POST /api/chat`) and notes it works in dev.
P2 -> states that this architecture collapses when multi-step reasoning loops are introduced.
P3 -> explains why REST fails (predictable latency vs. unbounded latency of ReAct loops).
P4 -> gives concrete infrastructure limits (AWS API Gateway 29s timeout vs. 40s ReAct loop) causing 504s.
P5 -> explains the consequences of these timeouts (orphaned backend processes, client/backend disconnect).
P6 -> introduces the "State Management Shell Game" where engineers try to fix this by making the client hold state.
P7 -> explains the architectural leak of this approach (sending internal scratchpads/prompts over the network).
P8 -> details the network payload explosion (32k tokens, 128KB, base64 images).
P9 -> details the client/backend CPU/memory overhead of serializing/deserializing this state repeatedly.
P10 -> introduces the next failed pattern: polling and webhooks (asynchronous HTTP patterns).
P11 -> explains why `202 Accepted` + polling is bad (wastes resources, introduces artificial latency).
P12 -> gives a concrete scenario of polling missing intermediate state transitions (UI jumps).
P13 -> explains why webhooks fail or are too complex for client-side apps (public endpoints, third-party WebSockets).
P14 -> introduces the thesis: agents are long-lived, stateful processes, not pure functions.
P15 -> explains how the backend should manage this (spawn process, hold context in memory, use network as broadcast channel).
P16 -> introduces Server-Sent Events (SSE) as the protocol for this.
P17 -> details how SSE works in this context (streaming typed events like `tool_start`, `token`, `error`).
P18 -> compares SSE vs. WebSockets, stating SSE is sufficient for 90% but WebSockets are needed for human-in-the-loop.
P19 -> explains SSE advantages (standard HTTP, routes easily) and server overhead comparison.
P20 -> explains Nginx/proxy buffering issues with SSE and how to configure them (`proxy_buffering off`).
P21 -> explains when SSE fails (bidirectional human-in-the-loop, e.g., approving a DB drop).
P22 -> explains the complexity of WebSockets (HTTP Upgrade, connection tracking, sticky sessions, Redis pub/sub).

BROKEN EDGES
- NONE: The article flows seamlessly from diagnosing the failures of synchronous REST and traditional async workarounds (polling/webhooks) to establishing the stateful process paradigm, detailing its implementation via SSE, and concluding with a precise technical trade-off analysis of WebSockets for human-in-the-loop scenarios.

REPAIRS MADE
- NONE