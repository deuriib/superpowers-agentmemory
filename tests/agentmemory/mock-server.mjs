// tests/agentmemory/mock-server.mjs
// Shared in-memory agentmemory mock for bridge tests. Records every request
// and serves canned responses registered in `routes`. Tests never touch the
// live server. Paths mirror the real server under /agentmemory/*.
//
// Route values: { status, body } | { status, raw } | (request) => { status, body }

export function startMockServer() {
  const requests = [];
  const routes = new Map();

  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      const key = `${req.method} ${url.pathname}`;
      let body = null;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        try {
          body = await req.json();
        } catch {
          body = null;
        }
      }
      const request = {
        method: req.method,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        headers: Object.fromEntries(req.headers),
        body,
      };
      requests.push(request);

      const route = routes.get(key);
      if (typeof route === 'function') {
        const canned = route(request);
        if (canned && canned.raw !== undefined) {
          return new Response(canned.raw, { status: canned.status });
        }
        return Response.json(canned ? canned.body : null, { status: canned ? canned.status : 200 });
      }
      if (route && route.raw !== undefined) {
        return new Response(route.raw, { status: route.status });
      }
      return Response.json(route ? route.body : { error: 'not found' }, {
        status: route ? route.status : 404,
      });
    },
  });

  return {
    url: `http://localhost:${server.port}`,
    requests,
    routes,
    reset() {
      requests.length = 0;
    },
    stop() {
      server.stop(true);
    },
  };
}
