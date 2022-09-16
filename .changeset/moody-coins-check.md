---
'@whatwg-node/server': minor
---

Breaking Changes;

- `baseObject` in the configuration has been removed! Now you can pass `baseObject` itself but `baseObject` needs to implement a `handle` method that is exactly same with `handleRequest`.

```diff
- const myServerBaseObject = {...}
+ const myServerBaseObject = {
+   handle(req) {/*...*/}
+ }

- const adapter = createServerAdapter({
-   baseObject: myServerBaseObject,
-   handleRequest(req) {/*...*/}
- })
+ const adapter = createServerAdapter(myServerBaseObject)
```

- `handleRequest` has been renamed to `handle` which has the same signature.

```diff
createServerAdapter({
-   handleRequest(request) {
+   handle(request) {
})
```

- `Request` in the configuration needs to be passed as a second argument.
```diff
createServerAdapter({
-   handleRequest(request) {
+   handle(request) {
-   Request: MyRequestCtor
- })
+ }, MyRequestCtor)
```
