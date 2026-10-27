import { useEffect, useRef, useState } from "react";
import type { CanvasApi } from "./api.ts";
import { useBoard } from "./useBoard.ts";
import { CanvasStage } from "./CanvasStage.tsx";
import { CreateDialog } from "./CreateDialog.tsx";
import { InspectDialog } from "./InspectDialog.tsx";
import { CompareDialog } from "./CompareDialog.tsx";
import { downloadArtifact, readImport } from "./files.ts";
import { kindLabel } from "./ArtifactCard.tsx";

export function CanvasApp({ api }: { api: CanvasApi }) {
  const state = useBoard(api);
  const board = state.board;
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"select" | "pan">("select");
  const [instruction, setInstruction] = useState("");
  const [create, setCreate] = useState(false);
  const [inspect, setInspect] = useState<string>();
  const [compare, setCompare] = useState<string>();
  const [importing, setImporting] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (board)
      setSelected((ids) =>
        ids.filter((id) => board.artifacts.some((item) => item.id === id)),
      );
  }, [board]);
  const chosen =
    board?.artifacts.filter((item) => selected.includes(item.id)) ?? [];
  const inspected = board?.artifacts.find((item) => item.id === inspect);
  const compared = board?.artifacts.find((item) => item.id === compare);
  async function importFiles(files: File[]) {
    if (!files.length || importing) return;
    setImporting(true);
    state.dismiss();
    const failures: string[] = [];
    let count = 0;
    for (const file of files) {
      try {
        const data = await readImport(file);
        const saved = await state.mutate({ type: "publish", ...data });
        setSelected([saved.artifacts.at(-1)!.id]);
        count++;
      } catch (error) {
        failures.push(`${file.name}：${(error as Error).message}`);
      }
    }
    if (count) state.notify(`已导入 ${count} 个成果。`);
    if (failures.length) state.report(failures.join("；"));
    setImporting(false);
    if (input.current) input.current.value = "";
  }
  async function send() {
    try {
      await state.send(selected, instruction);
      setInstruction("");
    } catch {
      /* Draft stays available for retry. */
    }
  }
  return (
    <section
      className="cw"
      aria-label="Canvas 工作台"
      data-conversation-composer-overlay=""
    >
      <header className="cw-header">
        <div className="cw-brand">
          <span className="cw-logo" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <div>
            <h2>Canvas</h2>
            <p>当前会话的成果工作台</p>
          </div>
        </div>
        <div className="cw-header-actions">
          <span className="cw-save-state" role="status">
            {state.pending || importing
              ? "保存中…"
              : board
                ? "已保存至本机"
                : "加载中…"}
          </span>
          <button
            className="cw-button"
            disabled={!board || importing}
            onClick={() => input.current?.click()}
          >
            {importing ? "导入中…" : "↑ 导入文件"}
          </button>
          <button
            className="cw-button cw-primary"
            disabled={!board}
            onClick={() => setCreate(true)}
          >
            ＋ 新建
          </button>
        </div>
      </header>
      <input
        ref={input}
        type="file"
        accept=".md,.markdown,.txt,.html,.htm,.png,.jpg,.jpeg,.webp,.gif"
        multiple
        hidden
        aria-label="选择要导入的成果文件"
        onChange={(event) =>
          void importFiles(Array.from(event.target.files ?? []))
        }
      />
      <div className="cw-toolbar">
        <div className="cw-segment" aria-label="画布工具">
          <button
            aria-pressed={mode === "select"}
            className={mode === "select" ? "is-active" : ""}
            onClick={() => setMode("select")}
          >
            ↖ 选取
          </button>
          <button
            aria-pressed={mode === "pan"}
            className={mode === "pan" ? "is-active" : ""}
            onClick={() => setMode("pan")}
          >
            ✥ 平移
          </button>
        </div>
        <span className="cw-toolbar-hint">拖动标题移动 · 空白处拖动框选</span>
        <input
          className="cw-search"
          aria-label="搜索成果标题"
          placeholder="搜索成果标题…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          className="cw-text-button"
          disabled={!board?.artifacts.length || state.pending > 0}
          onClick={() =>
            void state
              .mutate({
                type: "move",
                positions: board!.artifacts.map((item, index) => ({
                  id: item.id,
                  x: 40 + (index % 3) * 380,
                  y: 40 + Math.floor(index / 3) * 360,
                })),
              })
              .catch(() => undefined)
          }
        >
          整理布局
        </button>
      </div>
      {(state.error || state.notice) && (
        <div
          className={`cw-message ${state.error ? "is-error" : ""}`}
          role={state.error ? "alert" : "status"}
        >
          <span>{state.error || state.notice}</span>
          <button
            className="cw-icon"
            aria-label="关闭提示"
            onClick={state.dismiss}
          >
            ×
          </button>
        </div>
      )}
      <div className="cw-content">
        {board ? (
          <CanvasStage
            board={board}
            selected={selected}
            query={query}
            mode={mode}
            onSelect={setSelected}
            onOpen={(id) => {
              setSelected([id]);
              setInspect(id);
            }}
            onMove={(positions) =>
              void state
                .mutate({ type: "move", positions })
                .catch(() => undefined)
            }
            onImport={(files) => void importFiles(files)}
            onCreate={() => setCreate(true)}
            onPickFiles={() => input.current?.click()}
          />
        ) : (
          <div className="cw-loading" role="status">
            <div className="cw-loading-shape" />
            <p>{state.error ? "画布读取失败" : "正在打开成果工作台…"}</p>
            <button
              className="cw-button"
              onClick={() =>
                void state
                  .refresh(true)
                  .catch((error) => state.report(error.message))
              }
            >
              重新读取
            </button>
          </div>
        )}
        <aside className="cw-context">
          <div className="cw-context-head">
            <h3>选中成果</h3>
            <span>{chosen.length}</span>
          </div>
          {!chosen.length ? (
            <div className="cw-context-empty">
              <span aria-hidden="true">↖</span>
              <p>
                选择画布上的成果，
                <br />
                把明确的上下文交给 DSH。
              </p>
              <small>可框选或勾选多个成果</small>
            </div>
          ) : (
            <div className="cw-chosen-list">
              {chosen.map((artifact) => (
                <div className="cw-chosen" key={artifact.id}>
                  <button onClick={() => setInspect(artifact.id)}>
                    <span className={`cw-kind cw-kind-${artifact.kind}`}>
                      {artifact.kind === "html"
                        ? "H"
                        : artifact.kind === "markdown"
                          ? "M"
                          : "I"}
                    </span>
                    <span>
                      <strong>{artifact.title}</strong>
                      <small>
                        {kindLabel[artifact.kind]} · v
                        {artifact.versions.findIndex(
                          (item) => item.id === artifact.activeVersionId,
                        ) + 1}
                      </small>
                    </span>
                  </button>
                  <button
                    className="cw-icon"
                    aria-label={`取消选择 ${artifact.title}`}
                    onClick={() =>
                      setSelected((ids) =>
                        ids.filter((id) => id !== artifact.id),
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {chosen.length === 1 && (
            <div className="cw-selection-actions">
              <button
                className="cw-button"
                onClick={() => setInspect(chosen[0].id)}
              >
                打开与批注
              </button>
              <button
                className="cw-button"
                disabled={chosen[0].versions.length < 2}
                onClick={() => setCompare(chosen[0].id)}
              >
                比较版本
              </button>
              <button
                className="cw-button"
                onClick={() => downloadArtifact(chosen[0])}
              >
                导出
              </button>
            </div>
          )}
          <form
            className="cw-request"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <label>
              让 DSH 继续处理
              <textarea
                aria-label="给 DSH 的修改需求"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                maxLength={12000}
                placeholder="例如：结合这份需求，调整选中页面的内容，并保留原来的配色。"
                rows={6}
                onKeyDown={(event) => {
                  if (
                    (event.ctrlKey || event.metaKey) &&
                    event.key === "Enter" &&
                    instruction.trim() &&
                    chosen.length &&
                    chosen.length <= 8 &&
                    !state.sending
                  ) {
                    event.preventDefault();
                    void send();
                  }
                }}
              />
            </label>
            <div className="cw-request-meta">
              <span>
                {chosen.length > 8
                  ? "每次最多发送 8 个成果"
                  : `将发送 ${chosen.length} 个成果及当前版本批注`}
              </span>
            </div>
            <button
              className="cw-button cw-primary"
              disabled={
                !chosen.length ||
                chosen.length > 8 ||
                !instruction.trim() ||
                state.sending ||
                state.pending > 0
              }
            >
              {state.sending ? "发送中…" : "发送到当前会话 ↗"}
            </button>
            <small>
              使用当前 DSH 模型与权限设置。新版本生成后会自动更新画布。
            </small>
          </form>
          <div className="cw-context-foot">
            <span>{board?.artifacts.length ?? 0} 个成果</span>
            <span>会话独立存储</span>
          </div>
        </aside>
      </div>
      {create && (
        <CreateDialog
          onClose={() => setCreate(false)}
          onSave={async (operation) => {
            const saved = await state.mutate(operation);
            setSelected([saved.artifacts.at(-1)!.id]);
            return saved;
          }}
        />
      )}
      {inspected && board && (
        <InspectDialog
          key={inspected.id}
          artifact={inspected}
          board={board}
          onClose={() => setInspect(undefined)}
          onSave={state.mutate}
          onCompare={() => {
            setInspect(undefined);
            setCompare(inspected.id);
          }}
          onRequest={() =>
            state.send(
              [inspected.id],
              "请按照当前版本的所有批注修改这个成果，并发布新版本。",
            )
          }
        />
      )}
      {compared && (
        <CompareDialog
          artifact={compared}
          onClose={() => setCompare(undefined)}
          onSave={state.mutate}
        />
      )}
    </section>
  );
}
