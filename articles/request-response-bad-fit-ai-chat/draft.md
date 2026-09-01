# Agents Are Processes, Not Endpoints: The Case Against REST

## The Illusion of the `POST /api/chat` Endpoint

Most AI architectures begin with a fundamental category error. You have a frontend application that needs to talk to a Large Language Model. You build a standard REST API. The client sends a string of text to `POST /api/chat`, the server hands that text to the LLM, waits for a response, and returns a JSON object containing the answer. This works flawlessly in development when the prompt is simple and the model replies in three seconds. 

The architecture collapses the moment the agent needs to execute a multi-step reasoning loop. 

Standard REST assumes predictable latency and single-turn execution. A request comes in, a database is queried, and data goes out. The connection is held open for a few hundred milliseconds. Agents operate with unbounded latency. A single prompt might trigger a Reasoning and Acting (ReAct) loop where the agent plans a strategy, calls an external API, waits for that API to return, evaluates the result, realizes the data is incomplete, and calls a second API before finally synthesizing an answer. 

Synchronous HTTP connections are not designed to survive this execution model. They will die before the agent finishes its work. The standard AWS API Gateway maximum integration timeout is 29 seconds. A typical ReAct loop executing two external API tool calls routinely exceeds 40 seconds. This guarantees a 504 Gateway Timeout regardless of whether the backend code is executing perfectly. 

The backend might still be running the loop, burning expensive GPU cycles and executing downstream mutations for a client that is no longer listening. The frontend does not know if the tool calls succeeded, and the backend does not know the client has severed the connection. You cannot fix this by tweaking timeout configurations. You are trying to force an asynchronous, unpredictable workflow into a protocol built for deterministic request-response cycles.

## The State Management Shell Game

When synchronous HTTP fails, engineers attempt to patch the architecture by making the client responsible for the execution state. If a connection drops during step three of a five-step agent loop, the stateless server forgets the agent entirely. To recover the conversation and continue the execution, the client must own the state and pass it back to the server in the next request. 

This introduces a massive architectural leak. You are no longer sending user messages over the network. You are sending the LLM's internal scratchpad, previous raw tool outputs, system prompts, and complete reasoning traces back and forth on every turn. You are faking statefulness in a stateless API by serializing the entire universe.

The network payload explosion is immediate and severe. Passing a 32,000 token context window—roughly 128KB of text—back and forth on every turn of a multi-step conversation consumes immense bandwidth. If the agent is analyzing base64-encoded images or reading dense CSV files, that payload grows exponentially. 

The frontend mobile device or web browser must allocate memory to serialize a massive JSON array of message history. The backend must parse that 128KB payload, validate the schema, and reconstruct the agent's context before the LLM can even begin generating the next token. If the agent takes six steps to resolve a user query, you have serialized, transmitted, and deserialized the entire accumulating history six separate times.

## The Polling and Webhook Traps

To escape the payload explosion and the 504 timeouts, backend teams reach for standard asynchronous HTTP patterns. The server accepts the initial request, immediately returns a `202 Accepted` status code, and forces the client to poll a `/status` endpoint to fetch the result.

Returning a `202 Accepted` and forcing a polling loop wastes server resources. More importantly, it introduces artificial latency between agent thoughts. If the agent finishes a complex tool call 100 milliseconds after the client's last poll, the user sits staring at a spinner for another 1.9 seconds waiting for the next polling interval to trigger.

Consider a scenario where a client is polling the `/status` endpoint every two seconds. Internally, the agent transitions through three distinct states: `searching_db`, `reading_results`, and `generating_response`. The database retrieval tool executes incredibly fast, taking exactly 500 milliseconds. This entire operation happens entirely between the client's polling intervals. The client polls at T=0 and sees `searching_db`. It polls at T=2 and sees `generating_response`. The client completely misses the intermediate updates. The user interface jumps jarringly from a "Thinking..." state directly to a final answer.

Webhooks are the traditional alternative to polling, pushing the final result back to the client when the job finishes. Webhooks require the client to expose a publicly routable endpoint or rely on a separate publish/subscribe system. Exposing a public endpoint is physically impossible for standard web browsers or mobile clients. You are forced to introduce a third-party WebSocket service or AWS IoT Core purely to route a webhook payload back to a mobile app, vastly complicating the infrastructure footprint to avoid changing the agent API design.

## The Agent as a Long-Lived Process

An agent is not a pure function that takes an input and returns a response. It is a long-lived, stateful process that emits a stream of distinct events over time.

The backend must own the execution loop and the memory of the agent. When a user sends a message, the server spawns or wakes a process. That process holds the context window, manages the system prompts, and coordinates the ReAct loop in memory. The network connection's only job is to act as a one-way broadcast channel from the running process to the client.

Instead of returning a single JSON blob at the end of the execution, the server yields a stream of typed events. The protocol built exactly for this architecture uses the `text/event-stream` MIME type, commonly known as Server-Sent Events (SSE). 

The backend process begins executing and immediately flushes an event to the client: `event: tool_start`. The client updates the UI to show the specific tool being used. When the LLM begins speaking, the server streams the text chunk by chunk using `event: token`. If an external API fails, the server pushes an `event: error`. The client receives a high-fidelity, real-time transcript of the backend process without managing the execution state, holding the context window, or polling a database.

## The Decision: SSE vs. WebSockets

Server-Sent Events are sufficient for 90% of agent architectures, but WebSockets are strictly required if your agent needs synchronous human-in-the-loop interventions.

SSE operates over standard HTTP. It routes easily through existing load balancers, Web Application Firewalls, and API gateways without complex network configuration. If the user only needs to submit a prompt, watch the agent work, observe the tool calls, and wait for the final generated answer, SSE is the correct choice. It requires far less memory overhead on the server than maintaining bidirectional sockets.

You must configure your proxies to respect the stream. Nginx, for example, will attempt to buffer the HTTP response by default to optimize network transit. It will swallow your carefully yielded event stream until the buffer fills, completely defeating the purpose of real-time updates. You must explicitly set `proxy_buffering off;` (and often `X-Accel-Buffering: no` in the application headers) for the agent endpoint to ensure the chunks are flushed directly to the TCP socket.

If the agent needs to pause its execution loop to ask the user for permission, SSE fails. Consider an agent managing cloud infrastructure that decides it needs to drop a database table. It must pause the loop and ask, "Can I delete this file?" You need bidirectional communication to inject the user's "Yes" or "No" response directly into the blocked, running agent process without tearing down the context. 

This requires WebSockets. Implementing WebSockets requires the much more complex HTTP/1.1 `Connection: Upgrade` header to transition the protocol. It also demands persistent connection tracking at the load balancer level. If your architecture spans multiple backend instances, you must implement sticky sessions or a Redis pub/sub backplane to ensure the user's reply routes back to the specific container holding the paused agent process in memory.