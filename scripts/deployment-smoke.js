import assert from "node:assert/strict";

// Read-only: no credentials, account creation, database cleanup, or S3 writes.
const base = new URL(process.env.BASE_URL || "http://127.0.0.1:8095");
assert.ok(["http:", "https:"].includes(base.protocol), "BASE_URL must use HTTP or HTTPS");
assert.equal(base.pathname, "/", "Use the site root as BASE_URL");
assert.ok(!base.username && !base.password && !base.search && !base.hash,
  "BASE_URL must not contain credentials, a query, or a fragment");
let checks = 0;

async function get(path, status, type) {
  const response = await fetch(new URL(path, base), {
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, status, `${path}: unexpected status (including redirects)`);
  assert.match(response.headers.get("content-type") || "", type, `${path}: wrong content type`);
  checks++;
  return response;
}

const page = await get("/", 200, /text\/html/);
const html = await page.text();
const assets = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)]
  .map((match) => new URL(match[1], base));
assert.ok(assets.some((url) => url.pathname.endsWith(".js")), "Missing frontend JavaScript entry");
const pending = assets;
const visited = new Set();
while (pending.length) {
  const url = pending.shift();
  assert.equal(url.origin, base.origin, "Frontend assets must use the tested origin");
  if (visited.has(url.href)) continue;
  visited.add(url.href);
  const css = url.pathname.endsWith(".css");
  const response = await get(url.pathname + url.search, 200,
    css ? /text\/css/ : /(?:javascript|ecmascript)/);
  const source = await response.text();
  // Vite's generated chunk map includes lazy-loaded JS and CSS paths.
  for (const match of source.matchAll(/["'](?:\.\/)?((?:assets\/)?[\w.-]+\.(?:js|css))["']/g)) {
    const dependency = match[1].startsWith("assets/")
      ? new URL(`/${match[1]}`, base) : new URL(match[1], url);
    pending.push(dependency);
  }
}
const health = await (await get("/api/health", 200, /application\/json/)).json();
assert.equal(health.status, "ok");
assert.equal(health.service, "campusfix-api");
for (const path of ["/api/auth/me", "/api/issues", "/api/staff", "/api/issues/1/attachments"]) {
  const body = await (await get(path, 401, /application\/json/)).json();
  assert.equal(typeof body.error, "string", `${path}: missing authentication error`);
}
console.log(`PASS: ${checks} read-only checks at ${base.origin}: HTML, assets/chunks, database health, and protected API routes.`);
