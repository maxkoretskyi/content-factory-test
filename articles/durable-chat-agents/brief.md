# Brief

write a short article for backend engineers on why a request/response API route is a bad fit for an AI chat agent, and what a durable long-lived run changes. Use slug 'durable-chat-agents'. Keep it under 700 words.

## Intent

The reader is a backend engineer who is currently building or has built AI chat agents using standard request/response frameworks (like Express, FastAPI, or Next.js route handlers). They already know how to make LLM calls and implement tool-calling loops. However, they are experiencing issues with HTTP timeouts, connection drops, lack of state persistence during tool execution, and wasted tokens on failed retries. They need a clear architectural alternative: replacing transient HTTP request/response loops with durable, long-lived execution runs that separate the client connection from the agent execution.
