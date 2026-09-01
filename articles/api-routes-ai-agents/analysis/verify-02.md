CHAIN MAP
P1 -> introduces the problem of 504 Gateway Timeouts in serverless environments when LLM generation times increase.
P2 -> explains how developers use `maxDuration` as a band-aid.
P3 -> explains why `maxDuration` is a bad solution due to the unpredictability of LLM generation.
P4 -> warns that increasing timeouts to 5 minutes only delays the inevitable failure of synchronous requests.
P5 -> explains the mechanism of synchronous HTTP requests to LLMs and how they leave connections idle.
P6 -> explains why this idle connection issue is hidden during local development.
P7 -> introduces the role of production API gateways and load balancers in policing idle connections.
P8 -> explains how gateway-level idle timeouts kill the connection regardless of `maxDuration`.
P9 -> identifies the core issue as an abstraction mismatch (synchronous HTTP vs. token-by-token generation).
P10 -> explains how LLMs generate data as a continuous stream rather than a static document.
P11 -> explains how synchronous endpoints buffer these tokens, starving the network layer.
P12 -> points to industry standards (like OpenAI) relying on streaming.
P13 -> introduces Server-Sent Events (SSE) as the solution.
P14 -> explains how SSE works technically to bypass gateway idle timeouts.
P15 -> explains the consequence/benefits of SSE in eliminating 504s and making `maxDuration` obsolete.

BROKEN EDGES
- NONE: The argument flows seamlessly from identifying the symptom (504 timeouts) to the common but flawed workarounds (maxDuration), explaining the underlying infrastructure limits (API gateways), diagnosing the architectural mismatch (synchronous vs. streaming), and presenting the correct solution (SSE) with its technical justification.

REPAIRS MADE
- NONE (The fourth paragraph is already exactly two sentences long and fits the flow perfectly, so no changes are made to preserve the text byte-identically).