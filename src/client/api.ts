import type { Board } from "../shared/model.ts";
import type { CanvasRequest } from "../host/request.ts";
export interface CanvasApi {
  read(
    knownRevision?: number,
    signal?: AbortSignal,
  ): Promise<Board | { unchanged: true; revision: number }>;
  mutate(
    operation: unknown,
    expectedRevision: number,
    signal?: AbortSignal,
  ): Promise<Board>;
  prepare(
    ids: string[],
    instruction: string,
    signal?: AbortSignal,
  ): Promise<CanvasRequest>;
  send(request: CanvasRequest, signal?: AbortSignal): Promise<void>;
}
type Result =
  | { ok: true; value: unknown }
  | { ok: false; error: { code: string; message: string } };
interface SessionFace {
  prompt(
    content: unknown[],
    mode: "queue",
    signal?: AbortSignal,
  ): Promise<Result>;
}
export interface ClientContext {
  slots: {
    inject(name: string, fn: () => unknown): unknown;
    register(
      options: unknown,
      component: React.ComponentType<CanvasViewProps>,
    ): unknown;
  };
  connection: {
    rpc: {
      call(
        channel: string,
        endpoint: string,
        payload: unknown,
        signal?: AbortSignal,
      ): Promise<Result>;
    };
  };
  sessions: { binding(id: string): { session: SessionFace } | undefined };
  effect(fn: () => () => void): unknown;
}
export interface CanvasViewProps {
  sessionId: string;
  api: CanvasApi;
}
export function createApi(ctx: ClientContext, sessionId: string): CanvasApi {
  const call = async <T>(
    endpoint: string,
    payload: object,
    signal?: AbortSignal,
  ): Promise<T> => {
    const result = await ctx.connection.rpc.call(
      "/api",
      `canvas-workbench/${endpoint}`,
      { sessionId, ...payload },
      signal,
    );
    if (!result.ok)
      throw Object.assign(new Error(result.error.message), {
        code: result.error.code,
      });
    return result.value as T;
  };
  return {
    read: (knownRevision, signal) => call("read", { knownRevision }, signal),
    mutate: (operation, expectedRevision, signal) =>
      call("mutate", { operation, expectedRevision }, signal),
    prepare: (ids, instruction, signal) =>
      call("prepare", { ids, instruction }, signal),
    async send(request, signal) {
      const binding = ctx.sessions.binding(sessionId);
      if (!binding) throw new Error("会话已关闭，请重新打开后再发送。");
      const content: unknown[] = [
        { type: "text", text: request.text },
        ...request.images.map((image) => ({ type: "image", ...image })),
      ];
      const result = await binding.session.prompt(content, "queue", signal);
      if (!result.ok) throw new Error(result.error.message);
    },
  };
}
