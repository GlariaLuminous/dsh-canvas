import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BoardStore } from "../src/host/store.ts";
import { prepareRequest } from "../src/host/request.ts";

test("prepares only selected artifacts and their current-version annotations", async () => {
  const store = new BoardStore(
    await mkdtemp(join(tmpdir(), "canvas-request-")),
  );
  const first = await store.mutate(
    "s",
    { type: "publish", title: "页面", kind: "html", content: "<h1>Old</h1>" },
    0,
  );
  const artifact = first.artifacts[0];
  await store.mutate(
    "s",
    {
      type: "publish",
      title: "秘密资料",
      kind: "markdown",
      content: "unselected content",
    },
    1,
  );
  const board = await store.mutate(
    "s",
    {
      type: "annotate",
      artifactId: artifact.id,
      versionId: artifact.activeVersionId,
      selector: "h1",
      quote: "Old",
      text: "换成中文",
    },
    2,
  );
  const request = prepareRequest(board, [artifact.id], "按照批注修改");
  assert.match(request.text, /canvas_publish/);
  assert.match(request.text, new RegExp(artifact.activeVersionId));
  assert.match(request.text, /换成中文/);
  assert.doesNotMatch(request.text, /秘密资料|unselected content/);
  assert.equal(request.images.length, 0);
  assert.throws(() => prepareRequest(board, [], "修改"), /选中/);
  assert.throws(() => prepareRequest(board, ["missing"], "修改"), /找不到/);
  assert.throws(() => prepareRequest(board, [artifact.id], " "), /需求/);
});
