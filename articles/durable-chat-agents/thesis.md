# Thesis

Fitting an AI agent's multi-step, unpredictable tool-calling loop into a transient HTTP request/response cycle is a structural anti-pattern; agents must run in durable, long-lived background executions that preserve state and survive network or system failures.

## Angle

Instead of treating timeouts and connection losses as minor issues to be solved by tweaking server config (like raising gateway timeouts), this article frames the standard HTTP request/response model as fundamentally incompatible with the stateful, multi-step, and high-latency nature of AI agent execution. It argues for decoupling the agent loop into durable background runs.
