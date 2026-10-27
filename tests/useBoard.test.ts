import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { act, create } from "react-test-renderer";
import type { ReactTestRenderer } from "react-test-renderer";
import { useBoard } from "../src/client/useBoard.ts";
import type { CanvasApi } from "../src/client/api.ts";
import type { Board } from "../src/shared/model.ts";

test("recovers sending after a rejected save and successful refresh", async () => {
  const board: Board = {
    schemaVersion: 1,
    sessionId: "hook-test",
    revision: 2,
    artifacts: [],
    annotations: [],
  };
  let prepared = 0,
    sent = 0,
    reads = 0;
  const api: CanvasApi = {
    async read() {
      reads++;
      return board;
    },
    async mutate() {
      throw new Error("conflict: newer version exists");
    },
    async prepare() {
      prepared++;
      return { text: "Current selection", images: [] };
    },
    async send() {
      sent++;
    },
  };
  let current: ReturnType<typeof useBoard> | undefined;
  let renderer: ReactTestRenderer | undefined;
  function Probe() {
    current = useBoard(api);
    return null;
  }
  try {
    await act(async () => {
      renderer = create(createElement(Probe));
    });
    await act(async () => {
      await assert.rejects(current!.mutate({ type: "rename" }), /conflict/);
    });
    assert.ok(reads >= 2, "A rejected mutation triggers a full refresh");
    await act(async () => {
      await current!.send(["selected-id"], "Continue after refresh");
    });
    assert.equal(prepared, 1);
    assert.equal(sent, 1);
    assert.equal(current!.error, "");
    assert.match(current!.notice, /已发送/);
  } finally {
    await act(async () => renderer?.unmount());
  }
});
