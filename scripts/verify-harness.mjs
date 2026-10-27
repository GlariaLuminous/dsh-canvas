// Integration checks against a separately launched, disposable DSH web profile.
// Credentials stay in memory. Never use a production profile for this test.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const logPath = process.argv[2];
if (!logPath)
  throw new Error(
    "Usage: npm run test:integration -- <isolated-dsh-startup.log>",
  );
const log = await readFile(logPath, "utf8");
const launch = log.match(/http:\/\/127\.0\.0\.1:\d+[^\s\u001b]*/g)?.at(-1);
if (!launch)
  throw new Error("No local DSH startup URL found in the supplied log.");
const origin = new URL(launch).origin;
const auth = await fetch(launch, { redirect: "manual" });
const cookie = auth.headers
  .getSetCookie()
  .map((value) => value.split(";")[0])
  .join("; ");
assert.ok(cookie, "Native DSH authentication must issue a browser session.");
const sessionId = `canvas-integration-${randomUUID()}`;
async function request(endpoint, payload, headers = { origin, cookie }) {
  return fetch(`${origin}/api/canvas-workbench/${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({
      type: "client-request",
      rpcId: randomUUID(),
      method: `canvas-workbench/${endpoint}`,
      payload: { sessionId, ...payload },
    }),
  });
}
async function rpc(endpoint, payload) {
  const response = await request(endpoint, payload);
  assert.equal(response.status, 200);
  const envelope = await response.json();
  assert.equal(envelope.type, "server-response");
  return envelope.result;
}
function value(result) {
  assert.equal(result.ok, true, JSON.stringify(result.error));
  return result.value;
}
let checks = 0;
const rejected = await request("read", {}, { origin });
assert.equal(rejected.status, 401);
checks++;
const crossOrigin = await request(
  "read",
  {},
  { origin: "https://untrusted.example", cookie },
);
assert.equal(crossOrigin.status, 403);
checks++;
let board = value(await rpc("read", {}));
assert.equal(board.revision, 0);
assert.equal(board.artifacts.length, 0);
checks++;
board = value(
  await rpc("mutate", {
    expectedRevision: 0,
    operation: {
      type: "publish",
      title: "Integration artifact",
      kind: "markdown",
      content: "# First version",
    },
  }),
);
const artifact = board.artifacts[0];
checks++;
board = value(
  await rpc("mutate", {
    expectedRevision: board.revision,
    operation: {
      type: "annotate",
      artifactId: artifact.id,
      versionId: artifact.activeVersionId,
      selector: "h1",
      quote: "First version",
      text: "Change heading",
    },
  }),
);
const prepared = value(
  await rpc("prepare", {
    ids: [artifact.id],
    instruction: "Apply the annotation",
  }),
);
assert.ok(prepared.text.includes(artifact.id));
assert.ok(prepared.text.includes("Change heading"));
checks++;
board = value(
  await rpc("mutate", {
    expectedRevision: board.revision,
    operation: {
      type: "publish",
      artifactId: artifact.id,
      baseVersionId: artifact.activeVersionId,
      title: artifact.title,
      kind: artifact.kind,
      content: "# Second version",
    },
  }),
);
assert.equal(board.artifacts[0].versions.length, 2);
checks++;
const stale = await rpc("mutate", {
  expectedRevision: board.revision,
  operation: {
    type: "publish",
    artifactId: artifact.id,
    baseVersionId: artifact.activeVersionId,
    title: artifact.title,
    kind: artifact.kind,
    content: "stale",
  },
});
assert.equal(stale.ok, false);
assert.equal(stale.error.code, "conflict");
checks++;
board = value(
  await rpc("mutate", {
    expectedRevision: board.revision,
    operation: {
      type: "activate",
      artifactId: artifact.id,
      versionId: artifact.activeVersionId,
    },
  }),
);
assert.equal(board.artifacts[0].activeVersionId, artifact.activeVersionId);
assert.equal(board.artifacts[0].versions.length, 2);
checks++;
const concurrent = await Promise.all(
  [0, 1].map((n) =>
    rpc("mutate", {
      expectedRevision: board.revision,
      operation: {
        type: "rename",
        artifactId: artifact.id,
        title: `Concurrent ${n}`,
      },
    }),
  ),
);
assert.equal(concurrent.filter((item) => item.ok).length, 1);
assert.equal(concurrent.find((item) => !item.ok).error.code, "conflict");
checks++;
board = value(await rpc("read", {}));
assert.deepEqual(value(await rpc("read", { knownRevision: board.revision })), {
  unchanged: true,
  revision: board.revision,
});
checks++;
const badImage = await rpc("mutate", {
  expectedRevision: board.revision,
  operation: {
    type: "publish",
    title: "Invalid image",
    kind: "image",
    content: "data:image/png;base64,PHNjcmlwdD4=",
  },
});
assert.equal(badImage.ok, false);
assert.equal(badImage.error.code, "invalid-input");
checks++;
assert.equal(
  value(await rpc("read", { sessionId: `${sessionId}-other` })).artifacts
    .length,
  0,
);
checks++;
// Remove only this test's artifact through the authenticated API. No user data is touched.
value(
  await rpc("mutate", {
    expectedRevision: board.revision,
    operation: { type: "remove", artifactId: artifact.id },
  }),
);
console.log(
  `PASS: ${checks} native DSH HTTP integration checks (authentication, origin, storage, annotations, versioning, conflicts, validation, isolation).`,
);
