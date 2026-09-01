## Thesis
Wrapping an AI agent in a stateless request/response endpoint is an architectural anti-pattern that shifts the burden of state management and multi-step execution onto the client.

## Reader promise
You will be able to justify ripping out your REST-based agent endpoints, evaluate whether your specific use case requires Server-Sent Events (SSE) or WebSockets, and redesign your architecture to handle multi-turn agent execution without client-side polling.

## Scope

**Covers:**
- The impedance mismatch between the HTTP lifecycle and multi-turn agent loops (like ReAct).
- The network and payload costs of faking statefulness in stateless APIs.
- Why standard async patterns (polling, webhooks) fail for conversational agents.
- The architectural requirements for event-driven agent communication (SSE vs. WebSockets).

**Excludes:**
- **Prompt engineering and LLM selection:** We will not discuss how to write system prompts or compare OpenAI to Anthropic.
- **Agent frameworks:** We are deliberately ignoring the specific abstractions of LangChain, LlamaIndex, or AutoGen to focus purely on the network and infrastructure layers beneath them.
- **Frontend UI implementation:** We will not cover React hooks or state management for rendering the chat UI.

## Sections

### 1. The Illusion of the `POST /api/chat` Endpoint
- **Purpose:** Break the reader's assumption that an agent is just a slow API endpoint.
- **mainPoint:** Treating an agent like a standard API endpoint works for a single LLM generation, but collapses the moment the agent needs to execute a multi-step reasoning loop.
- **supportingPoints:**
  - Standard REST assumes predictable latency and single-turn execution (request in, data out).
  - Agents have unbounded latency; a single prompt might trigger a loop of thinking, tool calling, waiting for external APIs, and evaluating results.
  - Synchronous HTTP connections will simply die before the agent finishes its work, leaving both the client and server in an unknown state.
- **evidence:** The standard AWS API Gateway maximum integration timeout is 29 seconds. A typical ReAct loop with two external API tool calls routinely exceeds 40 seconds, guaranteeing a 504 Gateway Timeout regardless of the backend's success.

### 2. The State Management Shell Game
- **Purpose:** Demonstrate the architectural damage caused by trying to force agents into stateless HTTP.
- **mainPoint:** Stateless endpoints force you to pass the entire conversation and reasoning history back and forth over the network, leaking backend execution state to the client.
- **supportingPoints:**
  - In a stateless REST model, if a connection drops during step 3 of a 5-step agent loop, the server forgets the agent exists.
  - To recover, the client must own the state and pass it back in the next request.
  - This means the client isn't just sending user messages; it is sending the LLM's internal scratchpad, previous tool outputs, and system prompts over the wire on every request.
- **evidence:** Network payload explosion. Passing a 32,000 token context window (roughly 128KB of text) back and forth on every turn of a multi-step conversation consumes massive bandwidth and introduces severe serialization/deserialization latency.

### 3. The Polling and Webhook Traps
- **Purpose:** Dismantle the immediate compromises engineers reach for when synchronous HTTP fails.
- **mainPoint:** Standard asynchronous HTTP patterns like polling and webhooks solve the timeout problem but destroy the conversational UX and introduce race conditions.
- **supportingPoints:**
  - Returning a `202 Accepted` and forcing the client to poll a `/status` endpoint wastes resources and introduces artificial latency between agent thoughts.
  - Polling creates a "lossy" view of the agent: if the agent transitions through three states (e.g., `searching_db` -> `reading_results` -> `generating_response`) between client polls, the client misses the intermediate updates.
  - Webhooks require the client to expose a public endpoint or rely on a separate pub/sub system, which is physically impossible for standard web or mobile clients.
- **evidence:** A sequence diagram scenario where a client polling every 2 seconds completely misses a 500ms database retrieval tool execution, causing the UI to jump jarringly from "Thinking" to a final answer, breaking user trust.

### 4. The Agent as a Long-Lived Process
- **Purpose:** Introduce the correct mental model for agent architecture.
- **mainPoint:** An agent is not a pure function that returns a response; it is a long-lived, stateful process that emits a stream of distinct events.
- **supportingPoints:**
  - The backend must own the execution loop and the memory of the agent.
  - The network connection's only job is to act as a one-way broadcast channel from the running process to the client.
  - Instead of returning a single JSON blob, the server yields a stream of typed events, allowing the client to render intermediate states (like tool usage) in real-time.
- **evidence:** The `text/event-stream` MIME type used in Server-Sent Events (SSE), demonstrating a payload structure that pushes distinct, typed chunks (e.g., `event: tool_start`, `event: token`, `event: error`) over a single persistent connection.

### 5. The Decision: SSE vs. WebSockets
- **Purpose:** Give the reader the technical criteria to choose and implement their new architecture.
- **mainPoint:** Server-Sent Events are sufficient for 90% of agent architectures, but WebSockets are strictly required if your agent needs synchronous human-in-the-loop interventions.
- **supportingPoints:**
  - SSE operates over standard HTTP, making it easier to route through existing load balancers, WAFs, and API gateways without complex configuration.
  - SSE is strictly unidirectional (server to client). If the user just needs to watch the agent work and wait for the final answer, SSE is the right choice.
  - If the agent needs to pause its execution loop to ask the user for permission (e.g., "Can I delete this file?"), you need bidirectional communication to inject the user's response directly into the running agent process. This requires WebSockets.
- **evidence:** Infrastructure configuration requirements. SSE requires setting `proxy_buffering off;` in Nginx to prevent the proxy from swallowing the stream, whereas WebSockets require the much more complex HTTP/1.1 `Connection: Upgrade` header and persistent connection tracking at the load balancer level.