import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BoardStore } from "../src/host/store.ts";

async function store() {
  return new BoardStore(await mkdtemp(join(tmpdir(), "dsh-canvas-test-")));
}
const first = {
  type: "publish",
  title: "需求",
  kind: "markdown",
  content: "# 第一版",
} as const;

test("imports an artifact and preserves it after a process-level reload", async () => {
  const subject = await store();
  const board = await subject.mutate("session-a", first, 0);
  const reloaded = await new BoardStore(subject.directory).read("session-a");
  assert.deepEqual(reloaded, board);
  assert.equal(board.artifacts[0].versions[0].content, "# 第一版");
  assert.equal((await subject.read("session-b")).artifacts.length, 0);
});

test("appends immutable versions and restores a previous version without destroying history", async () => {
  const subject = await store();
  const one = await subject.mutate("a", first, 0);
  const artifact = one.artifacts[0];
  const two = await subject.mutate(
    "a",
    {
      ...first,
      artifactId: artifact.id,
      baseVersionId: artifact.activeVersionId,
      content: "# 第二版",
    },
    1,
  );
  const three = await subject.mutate(
    "a",
    {
      type: "activate",
      artifactId: artifact.id,
      versionId: artifact.activeVersionId,
    },
    2,
  );
  assert.equal(two.artifacts[0].versions.length, 2);
  assert.equal(two.artifacts[0].versions[0].content, "# 第一版");
  assert.equal(three.artifacts[0].activeVersionId, artifact.activeVersionId);
  assert.equal(three.artifacts[0].versions.length, 2);
});

test("serializes concurrent mutations and rejects a stale edit instead of losing data", async () => {
  const subject = await store();
  const results = await Promise.allSettled([
    subject.mutate("a", first, 0),
    subject.mutate("a", { ...first, title: "另一份需求" }, 0),
  ]);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  assert.match(
    String(
      (
        results.find(
          (item) => item.status === "rejected",
        ) as PromiseRejectedResult
      ).reason,
    ),
    /已更新/,
  );
  assert.equal((await subject.read("a")).artifacts.length, 1);
});

test("binds annotations to the exact artifact version and removes them with the artifact", async () => {
  const subject = await store();
  const board = await subject.mutate("a", first, 0);
  const artifact = board.artifacts[0];
  const annotated = await subject.mutate(
    "a",
    {
      type: "annotate",
      artifactId: artifact.id,
      versionId: artifact.activeVersionId,
      selector: "h1",
      quote: "第一版",
      text: "标题更明确",
    },
    1,
  );
  assert.equal(annotated.annotations[0].versionId, artifact.activeVersionId);
  const removed = await subject.mutate(
    "a",
    { type: "remove", artifactId: artifact.id },
    2,
  );
  assert.equal(removed.annotations.length, 0);
});

test("rejects invalid formats, forged image payloads, invalid version references, and oversized content", async () => {
  const subject = await store();
  await assert.rejects(
    subject.mutate("a", { ...first, kind: "exe" }, 0),
    /格式/,
  );
  await assert.rejects(
    subject.mutate(
      "a",
      {
        ...first,
        kind: "image",
        content: "data:image/png;base64,PHNjcmlwdD4=",
      },
      0,
    ),
    /图片/,
  );
  await assert.rejects(
    subject.mutate("a", { ...first, content: "x".repeat(1_100_000) }, 0),
    /大小/,
  );
  await assert.rejects(
    subject.mutate(
      "a",
      { type: "activate", artifactId: "missing", versionId: "missing" },
      0,
    ),
    /找不到/,
  );
});

test("does not turn session ids into paths and fails loudly on a damaged store", async () => {
  const subject = await store();
  await subject.mutate("../../outside", first, 0);
  const files = await readdir(subject.directory);
  assert.equal(files.length, 1);
  assert.match(files[0], /^[a-f0-9]{64}\.json$/);
  const target = join(subject.directory, files[0]);
  const saved = await readFile(target, "utf8");
  assert.match(saved, /outside/);
  await writeFile(target, "{broken");
  await assert.rejects(subject.read("../../outside"), /损坏/);
});
