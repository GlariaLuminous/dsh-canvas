import test from "node:test";
import assert from "node:assert/strict";
import { lineDiff } from "../src/shared/diff.ts";
test("compares repeated lines without confusing unchanged and replaced content", () => {
  const rows = lineDiff("a\nb\na\nc", "a\nx\na\nc");
  assert.equal(
    rows
      .filter((row) => row.type !== "added")
      .map((row) => row.text)
      .join("\n"),
    "a\nb\na\nc",
  );
  assert.equal(
    rows
      .filter((row) => row.type !== "removed")
      .map((row) => row.text)
      .join("\n"),
    "a\nx\na\nc",
  );
  assert.equal(rows.filter((row) => row.type === "added").length, 1);
  assert.equal(rows.filter((row) => row.type === "removed").length, 1);
});
test("bounds comparison work for large documents while preserving every source line", () => {
  const before = Array.from({ length: 1000 }, (_, i) => `line ${i}`).join("\n");
  const after = before.replace("line 500", "changed 500");
  const rows = lineDiff(before, after);
  assert.equal(
    rows
      .filter((row) => row.type !== "added")
      .map((row) => row.text)
      .join("\n"),
    before,
  );
  assert.equal(
    rows
      .filter((row) => row.type !== "removed")
      .map((row) => row.text)
      .join("\n"),
    after,
  );
  assert.equal(rows.filter((row) => row.type === "added").length, 1);
});
test("handles permitted documents with many short lines and large common suffixes", () => {
  for (const [before, after] of [
    ["a\n".repeat(70000), "b\n".repeat(70000)],
    ["old\n" + "common\n".repeat(140000), "new\n" + "common\n".repeat(140000)],
  ]) {
    const rows = lineDiff(before, after);
    assert.equal(
      rows
        .filter((row) => row.type !== "added")
        .map((row) => row.text)
        .join("\n"),
      before,
    );
    assert.equal(
      rows
        .filter((row) => row.type !== "removed")
        .map((row) => row.text)
        .join("\n"),
      after,
    );
  }
});
