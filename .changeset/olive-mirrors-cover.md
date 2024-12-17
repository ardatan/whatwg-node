---
'@whatwg-node/server': patch
---

- New `onDispose` hook which is alias of `Symbol.asyncDispose` for Explicit Resource Management
- Registration of the server adapter's disposal to the global process termination listener is now opt-in and configurable.

```ts
const plugin: ServerAdapterPlugin = {
    onDispose() {
        console.log('Server adapter is disposed');
    }
};

const serverAdapter = createServerAdapter(() => new Response('Hello world!'), {
    plugins: [plugin],
    // Register the server adapter's disposal to the global process termination listener
    // Then the server adapter will be disposed when the process exit signals only in Node.js!
    disposeOnProcessTerminate: true
});

await serverAdapter.dispose();
// Prints 'Server adapter is disposed'
```