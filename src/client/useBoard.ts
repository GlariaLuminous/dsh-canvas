import { useCallback, useEffect, useRef, useState } from "react";
import type { Board } from "../shared/model.ts";
import type { CanvasApi } from "./api.ts";

export function useBoard(api: CanvasApi) {
  const [board, setBoard] = useState<Board>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(0);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const latest = useRef<Board>();
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const mounted = useRef(false);
  const controller = useRef<AbortController>(new AbortController());
  const accept = useCallback((value: Board) => {
    if (
      !mounted.current ||
      (latest.current && value.revision < latest.current.revision)
    )
      return;
    latest.current = value;
    setBoard(value);
  }, []);
  const refresh = useCallback(
    async (full = false) => {
      const value = await api.read(
        full ? undefined : latest.current?.revision,
        controller.current.signal,
      );
      if (!("unchanged" in value)) accept(value);
    },
    [api, accept],
  );
  useEffect(() => {
    mounted.current = true;
    controller.current = new AbortController();
    void refresh(true).catch((error) => {
      if (mounted.current) setError(error.message);
    });
    const timer = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void refresh().catch((error) => {
        if (mounted.current) setError(error.message);
      });
    }, 2000);
    return () => {
      mounted.current = false;
      controller.current.abort();
      clearInterval(timer);
    };
  }, [refresh]);
  const mutate = useCallback(
    async (operation: unknown): Promise<Board> => {
      setPending((count) => count + 1);
      setError("");
      const next = queue.current
        .catch(() => undefined)
        .then(async () => {
          if (!latest.current) throw new Error("画布还未加载完成。");
          const value = await api.mutate(
            operation,
            latest.current.revision,
            controller.current.signal,
          );
          accept(value);
          return value;
        });
      queue.current = next;
      try {
        return await next;
      } catch (error) {
        if (mounted.current) {
          setError(
            error instanceof Error ? error.message : "操作失败，请重试。",
          );
          await refresh(true).catch(() => undefined);
        }
        throw error;
      } finally {
        if (mounted.current) setPending((count) => count - 1);
      }
    },
    [api, accept, refresh],
  );
  const send = useCallback(
    async (ids: string[], instruction: string) => {
      setSending(true);
      setError("");
      setNotice("");
      try {
        // A failed save is reported to its caller, but must not poison later sends.
        await queue.current.catch(() => undefined);
        const request = await api.prepare(
          ids,
          instruction,
          controller.current.signal,
        );
        controller.current.signal.throwIfAborted();
        await api.send(request, controller.current.signal);
        if (mounted.current)
          setNotice("已发送到当前 DSH 会话，新成果会自动出现在这里。");
      } catch (error) {
        if (mounted.current)
          setError(
            error instanceof Error ? error.message : "发送失败，请重试。",
          );
        throw error;
      } finally {
        if (mounted.current) setSending(false);
      }
    },
    [api],
  );
  return {
    board,
    error,
    pending,
    sending,
    notice,
    mutate,
    send,
    refresh,
    notify: setNotice,
    report: (message: string) => setError(message),
    dismiss: () => {
      setError("");
      setNotice("");
    },
  };
}
