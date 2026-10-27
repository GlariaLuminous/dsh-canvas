import { CanvasApp } from "./CanvasApp.tsx";
import { createApi } from "./api.ts";
import type { CanvasApi, CanvasViewProps, ClientContext } from "./api.ts";
import css from "./styles.css";

export const inject = ["slots", "connection", "sessions"];
function CanvasView({ sessionId, api }: CanvasViewProps) {
  return <CanvasApp key={sessionId} api={api} />;
}
export function apply(ctx: ClientContext): void {
  const clients = new Map<string, CanvasApi>();
  ctx.effect(() => {
    const style = document.createElement("style");
    style.dataset.plugin = "dsh-canvas-workbench";
    style.textContent = css;
    document.head.append(style);
    return () => {
      style.remove();
      clients.clear();
    };
  });
  ctx.slots.inject("conversation.view", () =>
    ctx.slots.register(
      {
        name: "conversation.view",
        id: "canvas-workbench",
        order: 15,
        label: "Canvas",
        inject: (sessionId: string) => {
          let api = clients.get(sessionId);
          if (!api) {
            api = createApi(ctx, sessionId);
            clients.set(sessionId, api);
          }
          return { api };
        },
      },
      CanvasView,
    ),
  );
}
