import { useEffect, useMemo, useRef } from "react";
import { marked } from "marked";
import type { ArtifactKind } from "../shared/model.ts";
import { sandboxDocument } from "./sandbox.ts";
import type { PreviewSelection } from "./sandbox.ts";

export function Preview({
  kind,
  content,
  title,
  compact = false,
  annotate = false,
  onSelection,
}: {
  kind: ArtifactKind;
  content: string;
  title: string;
  compact?: boolean;
  annotate?: boolean;
  onSelection?: (selection: PreviewSelection) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const token = useMemo(() => crypto.randomUUID(), [content]);
  const document = useMemo(
    () =>
      kind === "image"
        ? ""
        : sandboxDocument(
            kind === "markdown"
              ? `<article class="cw-document">${marked.parse(content, { async: false, gfm: true, breaks: true })}</article>`
              : content,
            token,
            false,
          ),
    [kind, content, token],
  );
  const selection = useRef(onSelection);
  selection.current = onSelection;
  useEffect(() => {
    if (kind === "image") return;
    const receive = (event: MessageEvent) => {
      const data = event.data;
      if (
        event.source !== frame.current?.contentWindow ||
        !data ||
        data.canvasToken !== token ||
        data.type !== "selection" ||
        typeof data.selector !== "string" ||
        data.selector.length > 500 ||
        typeof data.quote !== "string" ||
        data.quote.length > 3000
      )
        return;
      selection.current?.({ selector: data.selector, quote: data.quote });
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [kind, token]);
  const updateAnnotation = () =>
    frame.current?.contentWindow?.postMessage(
      { canvasToken: token, type: "annotate", enabled: annotate },
      "*",
    );
  useEffect(updateAnnotation, [annotate, token]);
  return (
    <div className={`cw-preview ${compact ? "cw-preview-compact" : ""}`}>
      {kind === "image" ? (
        <img src={content} alt={title} draggable={false} />
      ) : (
        <iframe
          ref={frame}
          title={`${title}预览`}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          srcDoc={document}
          onLoad={updateAnnotation}
        />
      )}
    </div>
  );
}
