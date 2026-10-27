import { useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { Artifact, Board } from "../shared/model.ts";
import { ArtifactCard } from "./ArtifactCard.tsx";
type Point = { x: number; y: number };
type Drag =
  | { type: "move"; origin: Point; positions: Record<string, Point> }
  | { type: "select"; origin: Point; append: string[] }
  | { type: "pan"; origin: Point; scroll: Point };
interface Props {
  board: Board;
  selected: string[];
  query: string;
  mode: "select" | "pan";
  onSelect: (ids: string[]) => void;
  onOpen: (id: string) => void;
  onMove: (positions: { id: string; x: number; y: number }[]) => void;
  onImport: (files: File[]) => void;
  onCreate: () => void;
  onPickFiles: () => void;
}
export function CanvasStage({
  board,
  selected,
  query,
  mode,
  onSelect,
  onOpen,
  onMove,
  onImport,
  onCreate,
  onPickFiles,
}: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag>();
  const [positions, setPositions] = useState<Record<string, Point>>({});
  const [box, setBox] = useState<{ start: Point; end: Point }>();
  const [zoom, setZoom] = useState(1);
  const [dropping, setDropping] = useState(false);
  const shown = board.artifacts.filter((item) =>
    item.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const point = (event: PointerEvent): Point => {
    const element = viewport.current!;
    const rect = element.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left + element.scrollLeft) / zoom,
      y: (event.clientY - rect.top + element.scrollTop) / zoom,
    };
  };
  function moveStart(event: PointerEvent, artifact: Artifact) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      onSelect(
        selected.includes(artifact.id)
          ? selected.filter((id) => id !== artifact.id)
          : [...selected, artifact.id],
      );
      return;
    }
    const ids = selected.includes(artifact.id) ? selected : [artifact.id];
    onSelect(ids);
    drag.current = {
      type: "move",
      origin: { x: event.clientX, y: event.clientY },
      positions: Object.fromEntries(
        board.artifacts
          .filter((item) => ids.includes(item.id))
          .map((item) => [item.id, { x: item.x, y: item.y }]),
      ),
    };
    viewport.current?.setPointerCapture(event.pointerId);
  }
  function begin(event: PointerEvent) {
    if ((event.target as Element).closest(".cw-card,.cw-stage-tools")) return;
    if (event.button !== 0 && event.button !== 1) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (mode === "pan" || event.button === 1)
      drag.current = {
        type: "pan",
        origin: { x: event.clientX, y: event.clientY },
        scroll: {
          x: viewport.current!.scrollLeft,
          y: viewport.current!.scrollTop,
        },
      };
    else {
      const origin = point(event);
      drag.current = {
        type: "select",
        origin,
        append: event.shiftKey ? selected : [],
      };
      setBox({ start: origin, end: origin });
      if (!event.shiftKey) onSelect([]);
    }
  }
  function move(event: PointerEvent) {
    const current = drag.current;
    if (!current) return;
    if (current.type === "move") {
      const delta = {
        x: (event.clientX - current.origin.x) / zoom,
        y: (event.clientY - current.origin.y) / zoom,
      };
      setPositions(
        Object.fromEntries(
          Object.entries(current.positions).map(([id, position]) => [
            id,
            {
              x: Math.max(16, Math.round(position.x + delta.x)),
              y: Math.max(16, Math.round(position.y + delta.y)),
            },
          ]),
        ),
      );
    } else if (current.type === "pan") {
      viewport.current!.scrollLeft =
        current.scroll.x - event.clientX + current.origin.x;
      viewport.current!.scrollTop =
        current.scroll.y - event.clientY + current.origin.y;
    } else setBox({ start: current.origin, end: point(event) });
  }
  function finish(event: PointerEvent) {
    const current = drag.current;
    drag.current = undefined;
    if (!current) return;
    if (current.type === "move") {
      const delta = {
        x: (event.clientX - current.origin.x) / zoom,
        y: (event.clientY - current.origin.y) / zoom,
      };
      if (Math.abs(delta.x) + Math.abs(delta.y) > 2)
        onMove(
          Object.entries(current.positions).map(([id, position]) => ({
            id,
            x: Math.max(16, Math.round(position.x + delta.x)),
            y: Math.max(16, Math.round(position.y + delta.y)),
          })),
        );
      setPositions({});
    } else if (current.type === "select") {
      const end = point(event);
      const left = Math.min(end.x, current.origin.x),
        right = Math.max(end.x, current.origin.x),
        top = Math.min(end.y, current.origin.y),
        bottom = Math.max(end.y, current.origin.y);
      onSelect([
        ...new Set([
          ...current.append,
          ...shown
            .filter(
              (item) =>
                item.x < right &&
                item.x + 340 > left &&
                item.y < bottom &&
                item.y + 304 > top,
            )
            .map((item) => item.id),
        ]),
      ]);
      setBox(undefined);
    }
  }
  const width = Math.max(
    1600,
    ...board.artifacts.map((item) => (positions[item.id]?.x ?? item.x) + 420),
  );
  const height = Math.max(
    1000,
    ...board.artifacts.map((item) => (positions[item.id]?.y ?? item.y) + 400),
  );
  return (
    <div
      className={`cw-stage-wrap ${dropping ? "is-dropping" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDropping(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setDropping(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDropping(false);
        onImport(Array.from(event.dataTransfer.files));
      }}
    >
      <div
        ref={viewport}
        className={`cw-stage ${mode === "pan" ? "is-pan" : ""}`}
        tabIndex={0}
        aria-label="成果画布，拖动空白区域框选，方向键移动选中成果"
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={() => {
          drag.current = undefined;
          setPositions({});
          setBox(undefined);
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "a"
          ) {
            event.preventDefault();
            onSelect(shown.map((item) => item.id));
          }
          const direction = (
            {
              ArrowLeft: [-1, 0],
              ArrowRight: [1, 0],
              ArrowUp: [0, -1],
              ArrowDown: [0, 1],
            } as Record<string, number[]>
          )[event.key];
          if (direction && selected.length) {
            event.preventDefault();
            const step = event.shiftKey ? 40 : 8;
            onMove(
              board.artifacts
                .filter((item) => selected.includes(item.id))
                .map((item) => ({
                  id: item.id,
                  x: Math.max(16, item.x + direction[0] * step),
                  y: Math.max(16, item.y + direction[1] * step),
                })),
            );
          }
        }}
      >
        <div
          style={{
            width: width * zoom,
            height: height * zoom,
            position: "relative",
          }}
        >
          <div
            className="cw-world"
            style={{ width, height, transform: `scale(${zoom})` }}
          >
            {shown.map((artifact) => (
              <ArtifactCard
                key={artifact.id}
                artifact={artifact}
                selected={selected.includes(artifact.id)}
                position={positions[artifact.id]}
                notes={
                  board.annotations.filter(
                    (note) =>
                      note.artifactId === artifact.id &&
                      note.versionId === artifact.activeVersionId,
                  ).length
                }
                onSelect={() =>
                  onSelect(
                    selected.includes(artifact.id)
                      ? selected.filter((id) => id !== artifact.id)
                      : [...selected, artifact.id],
                  )
                }
                onOpen={() => onOpen(artifact.id)}
                onDrag={(event) => moveStart(event, artifact)}
              />
            ))}
            {box && (
              <div
                className="cw-selection-box"
                style={{
                  left: Math.min(box.start.x, box.end.x),
                  top: Math.min(box.start.y, box.end.y),
                  width: Math.abs(box.start.x - box.end.x),
                  height: Math.abs(box.start.y - box.end.y),
                }}
              />
            )}
          </div>
        </div>
      </div>
      {!board.artifacts.length && (
        <div className="cw-empty">
          <span className="cw-empty-mark" aria-hidden="true">
            ▧
          </span>
          <h2>导入第一个成果</h2>
          <p>
            把 Markdown、HTML 或图片拖到这里，
            <br />
            在同一张画布上整理、批注和继续修改。
          </p>
          <div>
            <button className="cw-button cw-primary" onClick={onPickFiles}>
              导入文件
            </button>
            <button className="cw-button" onClick={onCreate}>
              新建成果
            </button>
          </div>
          <small>内容保存在本机，按 DSH 会话独立存储</small>
        </div>
      )}
      {board.artifacts.length > 0 && !shown.length && (
        <div className="cw-no-results" role="status">
          没有匹配“{query}”的成果
        </div>
      )}
      {dropping && <div className="cw-drop-overlay">松开以导入成果</div>}
      <div className="cw-stage-tools">
        <button
          aria-label="缩小画布"
          className="cw-icon"
          onClick={() => setZoom((value) => Math.max(0.3, value - 0.1))}
        >
          −
        </button>
        <output aria-label="画布缩放">{Math.round(zoom * 100)}%</output>
        <button
          aria-label="放大画布"
          className="cw-icon"
          onClick={() => setZoom((value) => Math.min(1.6, value + 0.1))}
        >
          +
        </button>
        <span />
        <button
          className="cw-text-button"
          onClick={() => {
            const element = viewport.current!;
            const maxX = Math.max(
              500,
              ...board.artifacts.map((item) => item.x + 380),
            );
            const maxY = Math.max(
              400,
              ...board.artifacts.map((item) => item.y + 340),
            );
            setZoom(
              Math.max(
                0.3,
                Math.min(
                  1,
                  (element.clientWidth - 48) / maxX,
                  (element.clientHeight - 48) / maxY,
                ),
              ),
            );
            element.scrollTo(0, 0);
          }}
        >
          适应画布
        </button>
      </div>
    </div>
  );
}
