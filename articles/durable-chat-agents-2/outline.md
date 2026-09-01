# Outline

## 1. The 29-Second Illusion

- Purpose: To expose the fundamental mismatch between HTTP lifecycle expectations and LLM generation times, proving the standard synchronous REST model is doomed from the start.
- Evidence: The hard 29-second integration timeout on AWS API Gateway versus a standard multi-step GPT-4 agent execution that routinely takes 40+ seconds.

## 2. The Non-Deterministic Tool Loop

- Purpose: To demonstrate why agentic workflows cannot be treated as simple "slow queries" by revealing their internal, stateful progression.
- Evidence: An OpenAI API trace where an agent executes `search_db`, waits for the result, evaluates the context, and triggers `fetch_url`—requiring continuous state accumulation across multiple network boundaries.

## 3. The Cost of Stateless Workarounds

- Purpose: To dismantle the typical backend band-aids (client retries, payload bloat) by showing how they actively harm agent architecture and reliability.
- Evidence: A dropped TCP connection triggering a standard client-side REST retry, which results in duplicate OpenAI API billing and lost intermediate tool-call state because the compute process restarted from scratch.

## 4. Shifting to Durable Execution

- Purpose: To introduce persistent, long-lived runs as the correct architectural primitive for non-deterministic reasoning.
- Evidence: Temporal's `Workflow.await()` or Inngest's `step.waitForEvent()` signatures, which suspend the agent's compute state and wait for external input without holding an active HTTP socket.

## 5. Decoupling the Network from the Compute

- Purpose: To resolve the architectural problem by showing how the client and backend communicate once the agent is modeled as a durable background process.
- Evidence: An API signature where `POST /chat` immediately returns a `202 Accepted` with a `run_id`, allowing the client to consume state changes asynchronously via a Server-Sent Events (SSE) stream tied to that specific ID.