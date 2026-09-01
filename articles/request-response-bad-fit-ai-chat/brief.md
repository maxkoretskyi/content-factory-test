# Brief

Write an article for backend engineers on why request/response API routes are a bad fit for AI chat agents

## Intent

Backend engineers who are building or planning to build AI chat agents. They know standard HTTP request/response patterns and REST APIs. After reading, they should understand the physical and architectural mismatch between request/response and LLM agents (latency, streaming needs, state management, multi-turn tool use, and bi-directional communication) and see why they need streaming/event-driven architectures (like SSE, WebSockets, or stateful agent runners) instead.
