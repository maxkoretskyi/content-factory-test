<!-- Focus on Angle 1: Increasing your endpoint timeout to fix LLM 504 errors is a temporary band-aid that guarantees your app will eventually break in production. Frame it directly for backend engineers who are tempted to increase maxDuration/timeout settings on serverless (like Vercel, AWS Lambda, or Cloudflare) or traditional cloud hosts to 'fix' AI response timeouts, and show them why they need a streaming architecture (specifically Server-Sent Events) instead. -->
# Synchronous HTTP Cannot Survive LLM Token Generation

## The `maxDuration` Trap

You wire up your first LLM endpoint, write a prompt, and hit send. Everything works perfectly on your local machine. Then you deploy it to a serverless environment, hand the model a slightly larger context window, and get slapped with a 504 Gateway Timeout. The instinct here is entirely predictable because backend engineers have all done this with slow database queries or heavy background tasks.

Framework vendors actively encourage this bad habit in their documentation. If you look at the Vercel AI SDK quickstart, they explicitly instruct developers to drop `export const maxDuration = 60;` into the top of their route files. You change the default 10 or 15 seconds to 60, redeploy the application, and the 504 errors disappear. The endpoint works again. You close the ticket.

This is a temporary band-aid that treats an unpredictable AI model like a slightly sluggish Postgres query. A database query usually has a predictable execution time bound by index efficiency and row counts. An LLM's token generation is completely unpredictable. It depends heavily on the provider's current load. Prompt complexity and the sheer volume of tokens the model decides to generate also swing the response time wildly. Eventually, 60 seconds will not be enough. When it fails again, you will find Reddit threads advising you to upgrade your account to a Vercel Pro plan specifically so you can change the maximum function duration to 5 minutes.

Buying a five-minute timeout is paying to ignore the actual architectural problem. You are setting an arbitrary ceiling on a process that has no fixed upper bound. The generation time will inevitably breach that new artificial ceiling. Whenever it does, the synchronous HTTP request will die. The user will stare at a spinner that eventually turns into an error state, and your application will break in production.

## Why API Gateways Kill Idle Connections

When you make a synchronous HTTP request to an LLM provider, your server essentially freezes. It fires off the prompt to an external API and waits for the entire response to be generated. The time it takes for the model to process the prompt and start generating—the Time to First Token (TTFT)—can easily spike during peak hours. During this entire wait, your serverless function is not sending a single byte back to the client. The connection is entirely idle.

This silence is fine on your laptop. Local development environments do not aggressively police idle connections. A Node server running on localhost will happily let a socket sit open for minutes while you test a massive context window. You test the feature. The full string eventually logs to your terminal, and you push the code assuming the transport layer is stable.

Production infrastructure is fundamentally hostile to idle sockets. Your deployed serverless function does not talk directly to the client's browser. It sits behind an API gateway or a cloud load balancer. These intermediaries monitor traffic at the byte level, and they are configured to sever connections that go quiet.

The gateway does not care what your framework's `maxDuration` is set to. Vercel deployment environments enforce a hard 10-second default timeout for idle connections. AWS API Gateway is similarly strict, enforcing a hard 29-second integration timeout. You cannot bypass this 29-second limit for synchronous requests, no matter how much memory you provision or what timeout you configure on the Lambda itself. The gateway shuts the door, and the user gets a 504.

## The Abstraction Mismatch

The root of the problem is not the gateway configuration. It is the abstraction you are using. A standard HTTP POST request is designed for discrete, complete transactions. You send a payload, the server does some work, assembles the entire result in memory, and fires back a single JSON object. This is how we build everything from user registration to billing systems.

LLMs fundamentally break this request-response paradigm. A generative model does not process a prompt and instantly materialize a complete answer. It predicts and emits one token at a time. The output is inherently a continuous data stream, not a static document. You are taking a fluid stream of data and trying to cram it into a synchronous box.

When you write a synchronous AI endpoint, you force your server to act as a dam. The LLM provider hands your backend the first token, but your code holds it in memory. It waits for the next token, and the next, buffering everything until the model finally emits a stop sequence. You are artificially starving the network layer of bytes while the server hoards the text.

The organizations training these models do not attempt to build user interfaces this way. If you open the network tab on `chat.openai.com`, you will not see a synchronous POST request hanging open, waiting for a massive JSON payload to resolve. They rely entirely on streaming.

## Bypassing Gateways with Server-Sent Events

The fix for 504 timeouts is not an infrastructural overhaul. You do not need to abandon your serverless stack or deploy message brokers to handle background jobs. The solution is Server-Sent Events (SSE). SSE operates entirely over standard HTTP. It uses the exact same routing and API gateways you already have in production.

When an SSE endpoint receives a request, the server does not wait for the LLM to finish generating text. It responds immediately with a specific set of headers: `Content-Type: text/event-stream` and `Transfer-Encoding: chunked`. This combination acts as a direct instruction to the API gateway. It tells the load balancer not to buffer the response and to expect an ongoing stream of data. As the LLM provider hands your backend a token, your server flushes that exact chunk of text down the open socket to the client. The gateway sees continuous bytes moving. Because the network layer is never starved of activity, the idle timer never triggers.

This continuous flush of tokens eliminates the 504 Gateway Timeout entirely. It makes no difference if the model takes three minutes to write a script or if the underlying API degrades and slows the token emission rate. As long as chunks keep moving, the connection stays alive. Your arbitrary `maxDuration` configurations become completely obsolete. You can delete them from your route files today. This architectural reality is why every major AI API—including OpenAI and Anthropic—defaults to streaming completions back via SSE over fetch. They know the only way to guarantee the delivery of an unpredictable, long-running generation is to keep the bytes flowing from the very first token.