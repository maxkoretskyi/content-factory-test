# Outline

## 1. The Illusion of the Simple API Route

- Purpose: Introduce the fundamental mismatch between static HTTP request/response lifecycles and modern AI agent loops.
- Evidence: Contrast a simple LLM call (low latency, stateless) with an agent loop that runs multiple tool steps (high latency, stateful).

## 2. Three Structural Failure Modes of HTTP Agents

- Purpose: Demonstrate the practical technical limits of running agents in API endpoints (timeouts, connection drops, lack of step checkpointing).
- Evidence: Explain the exact mechanics of HTTP timeouts, client disconnects causing aborted requests, and the lack of state preservation across expensive LLM calls.

## 3. The Architecture of a Durable Run

- Purpose: Present the durable run model as the solution, explaining how it decouples the client connection from agent execution.
- Evidence: Outline the queue-and-poll or streaming/SSE architecture. Show a concise code snippet representing a durable agent execution using step-based checkpoints.

## 4. Why Durability Wins: Resiliency and Cost Efficiency

- Purpose: Conclude with the concrete benefits: token cost savings, robust error recovery, and clean developer ergonomics.
- Evidence: Detail how step-level retries save LLM tokens and prevent broken DB state when third-party APIs fail mid-agent-run.
