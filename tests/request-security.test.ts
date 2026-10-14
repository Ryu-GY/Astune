import { test } from "node:test";
import assert from "node:assert/strict";
import { requireSameOrigin } from "../src/lib/auth/request-security";

test("authenticated JSON writes require a valid Origin or same-origin Referer fallback", t => {
  const previous = process.env.BETTER_AUTH_URL;
  process.env.BETTER_AUTH_URL = "https://astune.example.test";
  t.after(() => {
    if (previous === undefined) delete process.env.BETTER_AUTH_URL;
    else process.env.BETTER_AUTH_URL = previous;
  });
  const request = (headers: Record<string, string>) => new Request("https://internal.example.test/api/save", {
    method: "POST", headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
  assert.doesNotThrow(() => requireSameOrigin(request({ origin: "https://astune.example.test" })));
  assert.doesNotThrow(() => requireSameOrigin(request({ referer: "https://astune.example.test/account?tab=profile" })));
  const rejectedHeaders: Record<string, string>[] = [
    {}, { "sec-fetch-site": "same-origin" }, { origin: "null" }, { origin: "" },
    { origin: "not a URL" }, { origin: "https://astune.example.test.evil.test" },
    { origin: "https:astune.example.test" },
    { origin: "https://astune.example.test:444" }, { origin: "http://astune.example.test" },
    { origin: "https://user:password@astune.example.test" }, { origin: "https://astune.example.test/path" },
    { origin: "null", referer: "https://astune.example.test/account" },
    { referer: "https://evil.test" }, { referer: "data:text/plain,test" },
    { origin: "https://astune.example.test", "sec-fetch-site": "cross-site" },
  ];
  for (const headers of rejectedHeaders) assert.throws(() => requireSameOrigin(request(headers)), { code: "ORIGIN_NOT_ALLOWED", statusCode: 403 });
  assert.throws(() => requireSameOrigin(request({ origin: "https://astune.example.test", "content-type": "text/plain" })), { code: "JSON_REQUIRED", statusCode: 415 });
});
