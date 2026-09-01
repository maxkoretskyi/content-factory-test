### 1. The "Increase the Timeout" Trap
1. **Angle** — Increasing your endpoint timeout to fix LLM 504 errors is a temporary band-aid that guarantees your app will eventually break in production.
2. **The hook** — Anyone deploying a Next.js or Node app who just changed `maxDuration` to 60s to stop their OpenAI calls from crashing.
3. **Why it qualifies** — **Popular but wrong.** The most upvoted advice for 504s is "upgrade your plan or bump the timeout," but LLMs degrade unpredictably and holding connections open on serverless platforms doesn't scale.
4. **Evidence** — I found this specific advice—just bumping the timeout or paying for a higher tier—offered as the accepted solution in at least three different Reddit threads explicitly discussing LLM 504 errors.
   - "You can configure an API endpoint on a Hobby plan to have a max timeout of 60s... `export const maxDuration = 60;`" ([Source](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFkAfbbMmBxzQCPJFHHWv3_VajrAt8fR9Ezz2QAUJFhmfQBY-INYcS4D1Uvhj_7jjf_QIyf79qUqeEPilt-nEyXFidQ6ppFIoV-H38NZP6KmiRNOUPqUu8RY-xO3k8zB5jmXJ08uu_p-7Vqhh9Fuy63-DgnQWnnMEu8GrQhlHoaapy7b2r_I3ZGU0G0)).
   - "You can change the maximum duration the function can run to be up to 5 minutes on the Vercel Pro plan." ([Source](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFELbHIdNmuiYopRhWdH2suTAuliyflJIGzPIJABB2HX6jhVG5zDQ2z8ub7hgguvcagq87dptr9hdTGM3vGo5r05GRD-ZMtRhhCSAXqxVU-__4RfqYhoDx9YjKd6_nRJI7g_qSJW4gObS54CALRvIefi3Nj8Il-x1vbmWKuuhmgBffL_W1XqqooXF6s1g==)).
5. **Who disagrees** — Framework vendors and docs. Vercel's own AI SDK documentation explicitly instructs developers to configure `maxDuration` as a standard step for AI routes.
6. **Risk** — If the reader is building an internal tool with a massive 15-minute AWS Lambda timeout, they might not care about the scalability argument.

### 2. You don't need WebSockets for real-time AI
1. **Angle** — You don't need WebSockets for real-time AI chat—and using them introduces massive complexity for a one-way data stream.
2. **The hook** — Backend engineers architecting their new AI chat feature and assuming they need to set up Socket.io or WebSockets to achieve a "typing" effect.
3. **Why it qualifies** — **Surprising & Contested.** WebSockets are the developer default for "real-time", but Server-Sent Events (SSE) is the actual industry standard for LLMs.
4. **Evidence** — The debate between SSE and WebSockets for LLMs is happening constantly across Hacker News and Reddit, with developers frequently surprised that bidirectional communication isn't required.
   - "The biggest real-world validation of SSE right now is LLM streaming. Every major AI API (OpenAI, Anthropic, etc.) streams completions back via SSE over fetch, not WebSockets." ([Source](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEhuO3oltfPnugnnLpUFVyFLwh6DhymsdJBYKwnVTTcVVhCskT3r7O52e8pnZpn8sdA4JyZfDnrvBlVokrSoyKH8ohWLkwdccbAwAQkY908r2A9Vytxle3ccty0heM86eNE0MJYC9WzZhtLGiOnquc0znvAMdv8Pxg50IidUtQEAUOsZlP_-NHbr5h2GoK4KeNg3ZO1015jcg==)).
   - "I was looking through the implementation of chat.openai.com recently and was pleasantly surprised to see that it was 100% Server Sent Events, no Websockets." ([Source](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFiOFr97romHsPWL7MAwAcxULzA7pZLTiJv5N3S5PeWOv96tceJV7UI6tQTJo3c9Qoh80RTeP5bf1ctrQuUkiClufErbegQ4PEKVZI5JTXHuwJOpHyXqc0VftO7ACeI3XEbtA==)).
5. **Who disagrees** — Developers building multi-modal agents (voice/video) or those who hate SSE's text-only limitations. One HN user argued "SSE sucks for transporting LLM tokens" because of parsing nightmares.
6. **Risk** — SSE is well-known among senior frontend devs, so the "surprise" factor relies heavily on backend devs who might default to WebSockets or RPC.

### 3. The Polling Anti-Pattern
1. **Angle** — Shifting LLM requests to background jobs and polling for results ruins the one metric that matters for AI chat: Time to First Token.
2. **The hook** — Engineers who gave up on HTTP timeouts, moved their LLM calls to Celery, Redis, or SQS, and are now dealing with sluggish UIs.
3. **Why it qualifies** — **Costly.** Polling a database or queue every few seconds wastes server resources and completely breaks the illusion of a typing AI, degrading the UX.
4. **Evidence** — The pattern of falling back to Celery/Redis for LLMs is a common architectural crutch when developers hit HTTP timeouts, appearing in multiple threads asking for validation on this approach.
   - "I decided to implement the long running tasks with Celery and Redis as the message broker... I thought about using polling but I've heard many people say it's very taxing on the server." ([Source](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHCxV7a0OpIUC3mYb_p72bwM1Kae1gGj819-AQ4k0yZFtXMc1mWX2a7IKklnf75MzSfFE-36oZNjnKovJ-mEI6YvQQ6nPGSi_o1lG-IM9ThcO6ohWu2aSUf9vTTJzHefYHJakQrbAFXWa_6ZAyHVuv7dptyTHWoT_DZ1l5RPGqPHgkqcI-66LhHmfP5wjYuLtCTs8I=)).
   - "When you have a background job that is a durable transactional unit with own retries... it is not an Agentic flow and you may need to break the loop" ([Source](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEtWf8JlzcJaRqoQC34CmfstyNIvqqNPPvR63iUgKdW6UrhCqs4ChUITnIrwV1RP91WSKVDzDCE9Om3Eh78Z5gp9JongrZx0BuTSlEPM_dYdIV7C2UnLim7YP_kf39YbTCguFMYNQFuaUsgMxSPyXA20HWQJw-TwJ4TMPSHMR_TpgBmNFxwkw-DuLbeO-e0WViXN4j7W6LGjPDXAg==)).
5. **Who disagrees** — Engineers building autonomous, long-running agents (like RAG document ingestion pipelines) where a single task takes 10+ minutes. For them, Celery + polling is exactly the right architecture.
6. **Risk** — Requires drawing a very sharp line early in the article between user-facing "chat UIs" (which need streaming) and backend "autonomous agents" (which need background jobs).

### 4. The "Works on Localhost" Illusion
1. **Angle** — Your synchronous LLM endpoint works perfectly on localhost because your laptop doesn't have an API Gateway silently killing idle connections.
2. **The hook** — The developer who just deployed their flawlessly working AI feature only to watch it instantly fail with a 504 Gateway Timeout in production.
3. **Why it qualifies** — **Unspoken / Confusing.** Local dev environments don't enforce the 10-29 second idle connection limits that cloud load balancers and serverless platforms do, leading to a massive deployment blindspot.
4. **Evidence** — "Works on localhost, 504 in production" is the most common framing of this exact issue, appearing repeatedly across Next.js and webdev subreddits.
   - "working fine on localhost but when I host the website it is giving me this error... The unexpected error (504) is a timeout error. This is happening because Vercel deployment environments default to 10 second timeouts." ([Source](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHcfjhNzxx1FN8OTV6V1GWni9pDQtsuaoqZG7vaq14UYMbtX7ARRt0ALxzXCgXyjcs4q4peNxUEx058w8CwpfQ9TeTSUK5AYJl6i8BCZt0-SavoGS45Q8PA96_tcB_K_gNLZOLueBt7o4wagUgQJz_qYc72xKiEPuw7cyCG1zgkPA0sH7VVnjGJiiaiJs7cjAdPOiWiCDE3)).
   - "Result: 504 Gateway Timeouts. I didn't want to fall back to a long‑running Node server. Wanted to keep it edge/serverless." ([Source](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFio9RKheWW-as_-bUV1Iq0kyfE-_Z_vFullyjyHgXznlnXz1DtNvGxdSZHZGQIIuOE-xjSsdeFh4rmV_6rcvvnyQZ8GS3jrI26icoDmeR67fCadbUHsbaysdC-rtiWu5VjFKLtr8WoKXi-2HU1xnDUCryhmMvg7eaGkm_p4N3-LMs_ZP3r9uC1-GjuC05zAxQZk3HNlwLw)).
5. **Who disagrees** — Nobody actively disagrees that localhost lacks cloud limits, but many assume their framework's "dev" command accurately simulates production execution limits.
6. **Risk** — Might overlap slightly with Angle 1, though the focus here is on the environment mismatch and infrastructure reality rather than the "increase timeout" bad advice.

---

### Recommendation
I would take **Candidate 2 (You don't need WebSockets for real-time AI)**. It challenges a deeply ingrained developer assumption ("real-time = WebSockets") and provides a highly actionable architectural pivot (Server-Sent Events) that directly solves the 504 timeout issue without requiring heavy infrastructure changes.

I would avoid **Candidate 4 (The "Works on Localhost" Illusion)**. While accurate, it functions more as a diagnostic explanation of *why* the 504 happened rather than a strong architectural stance on what to do next. It's a great intro paragraph, but a weak premise for an entire article.

### Weak signals
- **WebRTC for LLM streaming:** I saw one passing mention of future implementations leveraging WebRTC for LLMs, but absolutely zero developers actually complaining about it or trying to implement it for standard text chat. It's too niche to be an angle.
- **Client-side LLMs bypassing the backend entirely:** Frequently discussed in general AI spaces, but entirely misses our target audience (backend engineers trying to integrate LLMs into an *existing* web app).