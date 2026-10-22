import {
  createServerAdapter,
  RequestBodyTooLargeError,
  useErrorHandling,
  useLimitRequestBodySize,
} from '@whatwg-node/server';

const LIMIT = 64;

let incomingConstructor = null;

const adapter = createServerAdapter(
  async (request, _ctx, fetchAPI) => {
    const text = request.body ? await request.text() : '';
    return Response.json({
      text,
      incomingConstructor,
      nativeFetchAPI:
        fetchAPI.Request === globalThis.Request &&
        fetchAPI.TransformStream === globalThis.TransformStream,
    });
  },
  {
    plugins: [
      {
        onRequest({ request }) {
          incomingConstructor = request.constructor?.name ?? null;
        },
      },
      useLimitRequestBodySize(LIMIT),
      useErrorHandling(err => {
        if (err instanceof RequestBodyTooLargeError || err?.name === 'RequestBodyTooLargeError') {
          return Response.json({ error: err.message }, { status: err.status || 413 });
        }
        return Response.json({ error: String(err?.message || err) }, { status: 500 });
      }),
    ],
  },
);

export const runtime = 'nodejs';

export function GET() {
  return Response.json({ ok: true });
}

export function POST(request) {
  return adapter.fetch(request);
}
