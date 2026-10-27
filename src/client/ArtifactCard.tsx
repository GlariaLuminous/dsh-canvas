import type { PointerEvent } from "react";
import type { Artifact } from "../shared/model.ts";
import { activeVersion } from "../shared/model.ts";
import { Preview } from "./Preview.tsx";
export const kindLabel = {
  html: "HTML 页面",
  markdown: "Markdown",
  image: "图片",
};
export function ArtifactCard({
  artifact,
  selected,
  position,
  notes,
  onSelect,
  onOpen,
  onDrag,
}: {
  artifact: Artifact;
  selected: boolean;
  position?: { x: number; y: number };
  notes: number;
  onSelect: () => void;
  onOpen: () => void;
  onDrag: (event: PointerEvent) => void;
}) {
  const version = activeVersion(artifact);
  return (
    <article
      className={`cw-card ${selected ? "is-selected" : ""}`}
      style={{
        left: position?.x ?? artifact.x,
        top: position?.y ?? artifact.y,
      }}
      aria-label={`成果：${artifact.title}`}
      data-artifact-id={artifact.id}
      onDoubleClick={onOpen}
    >
      <header className="cw-card-head">
        <input
          aria-label={`选择 ${artifact.title}`}
          type="checkbox"
          checked={selected}
          onChange={onSelect}
        />
        <button
          className="cw-card-handle"
          aria-label={`移动 ${artifact.title}`}
          onPointerDown={onDrag}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelect();
            }
          }}
        >
          <span className={`cw-kind cw-kind-${artifact.kind}`}>
            {artifact.kind === "markdown"
              ? "M"
              : artifact.kind === "html"
                ? "H"
                : "I"}
          </span>
          <span>{artifact.title}</span>
        </button>
        <button
          className="cw-icon"
          aria-label={`打开 ${artifact.title}`}
          onClick={onOpen}
        >
          ↗
        </button>
      </header>
      <div className="cw-card-cover" onClick={onSelect}>
        <Preview
          kind={artifact.kind}
          content={version.content}
          title={artifact.title}
          compact
        />
      </div>
      <footer>
        <span>{kindLabel[artifact.kind]}</span>
        <span>
          {notes > 0 ? `${notes} 条批注 · ` : ""}v
          {artifact.versions.findIndex(
            (item) => item.id === artifact.activeVersionId,
          ) + 1}{" "}
          / {artifact.versions.length}
        </span>
      </footer>
    </article>
  );
}
