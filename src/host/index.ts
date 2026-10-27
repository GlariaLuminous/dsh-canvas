import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { CanvasError } from "../shared/model.ts";
import { BoardStore } from "./store.ts";
import { record, text } from "./validation.ts";
import { prepareRequest } from "./request.ts";
import { registerTools } from "./tools.ts";
import type { ToolRegistry } from "./tools.ts";

export const name = "canvas-workbench";
export const inject = ["tools", "connection"];
interface HostContext {
  tools: ToolRegistry;
  connection: {
    fetch: {
      register(route: {
        path: string;
        methods: string[];
        requestBody: "buffered";
        fetch: (request: Request) => Promise<Response>;
      }): unknown;
    };
  };
}
export function apply(ctx: HostContext): void {
  const home = resolve(process.env.DSH_HOME || join(homedir(), ".dsh"));
  const store = new BoardStore(
    join(home, "storages", "canvas-workbench", "boards"),
  );
  registerTools(ctx.tools, store);
  // Exact routes inherit native authentication and the Connection owner restriction.
  for (const endpoint of ["read", "mutate", "prepare"])
    ctx.connection.fetch.register({
      path: `/api/canvas-workbench/${endpoint}`,
      methods: ["POST"],
      requestBody: "buffered",
      async fetch(request) {
        let rpcId = "invalid-request";
        try {
          request.signal.throwIfAborted();
          const envelope = record(await request.json());
          rpcId = text(envelope.rpcId, "请求 ID", 256);
          if (
            envelope.type !== "client-request" ||
            envelope.method !== `canvas-workbench/${endpoint}`
          )
            throw new CanvasError("invalid-input", "请求方法不匹配。");
          const input = record(envelope.payload);
          const sessionId = text(input.sessionId, "会话 ID", 1024);
          let value: unknown;
          if (endpoint === "read") {
            const board = await store.read(sessionId);
            value =
              input.knownRevision === board.revision
                ? { unchanged: true, revision: board.revision }
                : board;
          } else if (endpoint === "mutate") {
            if (!Number.isSafeInteger(input.expectedRevision))
              throw new CanvasError(
                "invalid-input",
                "缺少画布版本，请刷新后重试。",
              );
            value = await store.mutate(
              sessionId,
              input.operation,
              Number(input.expectedRevision),
            );
          } else if (endpoint === "prepare")
            value = prepareRequest(
              await store.read(sessionId),
              input.ids,
              input.instruction,
            );
          else throw new CanvasError("not-found", "找不到这个画布操作。");
          return Response.json({
            type: "server-response",
            rpcId,
            result: { ok: true, value },
          });
        } catch (error) {
          return Response.json({
            type: "server-response",
            rpcId,
            result: {
              ok: false,
              error: {
                code: error instanceof CanvasError ? error.code : "internal",
                message:
                  error instanceof CanvasError
                    ? error.message
                    : "画布操作失败，原有数据已保留，请重试。",
                details: {},
              },
            },
          });
        }
      },
    });
}
