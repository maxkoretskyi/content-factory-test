trigger.dev can suspend and resume tasks, for example like this.

If your task calls wait.for() or awaits a child task with triggerAndWait():

```ts
export const myTask = task({
  id: "my-task",
  run: async () => {
    // Container is suspended here — you pay nothing for the hour
    await wait.for({ hours: 1 });

    // Container is suspended while the child task runs in its own container
    const result = await childTask.triggerAndWait({ data: "some data" });
  },
});
```

The platform suspends the entire container, stops billing you for compute, and resumes
execution from the exact point where it paused — whether that's an hour later or when the child
task finishes. No serialization, no state management, no re-running previous steps.

Trigger.dev calls this the Checkpoint-Resume System:
https://trigger.dev/docs/how-it-works#the-checkpoint-resume-system

Write an article about how they do it.
