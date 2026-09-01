# Thesis

Modeling an AI agent as a synchronous API endpoint is an architectural failure because non-deterministic reasoning is a stateful, long-running process, not a stateless network transaction.

## Angle

The obvious framing focuses on the symptoms of this mismatch, such as API gateway timeouts and dropped HTTP connections. Instead, this angle attacks the root category error: backend engineers are trying to treat multi-step agentic loops like fast database queries. This is for traditional API developers who need to stop hacking complex retry logic into REST routes and start embracing durable, asynchronous execution.