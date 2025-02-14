---
'@whatwg-node/server': patch
---

When two plugins use the `onResponse` hook and the first one modifies the response, the second one should get the modified one;

```ts
[
    {
        onResponse({ setResponse, fetchAPI }) {
            setResponse(
                fetchAPI.Response.json({
                    foo: 'bar'
                }, { status: 418 })
            )
        }
    },
    {
        onResponse({ response }) {
            console.log(response.status) // 418
        }
    }
]
```