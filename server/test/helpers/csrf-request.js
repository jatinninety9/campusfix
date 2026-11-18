import request from "supertest";

// Normal integration clients perform the same token handshake as the frontend.
// Security rejection tests use raw Supertest instead of this convenience client.
function agent(app) {
  const client = request.agent(app);
  for (const method of ["post", "put", "patch", "delete"]) {
    const original = client[method].bind(client);
    client[method] = (...args) => {
      const pending = original(...args);
      const send = pending.end.bind(pending);
      pending.end = callback => {
        // Use an independent request server: Supertest closes an agent's server
        // when a request settles, which must not close the pending write.
        const handshake = request(app).get("/api/auth/csrf");
        if (pending.get("Host")) handshake.set("Host", pending.get("Host"));
        const existingCookies = [pending.cookies, pending.get("Cookie")].filter(Boolean).join("; ");
        if (existingCookies) handshake.set("Cookie", existingCookies);
        handshake.end((error, response) => {
          if (error || !response.body.csrfToken)
            return callback(error || new Error("CSRF handshake failed"));
          const cookies = new Map();
          for (const value of [pending.cookies, pending.get("Cookie"), ...(response.headers["set-cookie"] || [])]) {
            if (!value) continue;
            const pairs = Array.isArray(value) ? value : [value];
            for (const pair of pairs) {
              // Set-Cookie attributes must not be sent as request cookies.
              const entries = pair.includes("; Path=") ? [pair.split(";")[0]] : pair.split(/;\s*/);
              for (const entry of entries) {
                const separator = entry.indexOf("=");
                if (separator > 0) cookies.set(entry.slice(0, separator), entry.slice(separator + 1));
              }
            }
          }
          pending.cookies = "";
          pending.set("Cookie", [...cookies].map(([name, value]) => `${name}=${value}`).join("; "));
          pending.set("X-CSRF-Token", response.body.csrfToken);
          send(callback);
        });
        return pending;
      };
      return pending;
    };
  }
  return client;
}

const csrfRequest = app => agent(app);
csrfRequest.agent = agent;
export default csrfRequest;
