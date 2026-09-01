# Brief

write a short article for backend engineers on why a request/response API route is a bad fit for an AI chat agent, and what a durable long-lived run changes. Use slug 'durable-chat-agents-2'. Keep it under 700 words.

## Intent

The reader is a backend engineer who is familiar with traditional HTTP request/response architectures but is facing issues building AI chat agents. They should understand why HTTP/request-response is fundamentally mismatched for LLM agents (due to long execution times, multi-turn tool calling, state management, and network timeouts) and how a durable, long-lived run model (like Temporal, durable execution, or persistent run states) solves these issues.
