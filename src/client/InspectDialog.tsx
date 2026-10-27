import { useState } from "react";
import type { Artifact, Board } from "../shared/model.ts";
import { activeVersion } from "../shared/model.ts";
import { Dialog } from "./Dialog.tsx";
import { Preview } from "./Preview.tsx";
import { downloadArtifact } from "./files.ts";
import type { PreviewSelection } from "./sandbox.ts";

export function InspectDialog({
  artifact,
  board,
  onClose,
  onSave,
  onCompare,
  onRequest,
}: {
  artifact: Artifact;
  board: Board;
  onClose: () => void;
  onSave: (operation: unknown) => Promise<Board>;
  onCompare: () => void;
  onRequest: () => Promise<void>;
}) {
  const [base] = useState(() => activeVersion(artifact));
  const [source, setSource] = useState(false);
  const [annotate, setAnnotate] = useState(false);
  const [title, setTitle] = useState(artifact.title);
  const [draft, setDraft] = useState(base.content);
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState<PreviewSelection>({
    selector: "",
    quote: "",
  });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const notes = board.annotations.filter(
    (item) => item.artifactId === artifact.id && item.versionId === base.id,
  );
  const dirty = draft !== base.content || title !== artifact.title;
  const outdated = artifact.activeVersionId !== base.id;
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={artifact.title} onClose={onClose} wide>
      <div className="cw-inspect-toolbar">
        <div className="cw-segment">
          <button
            className={!source ? "is-active" : ""}
            onClick={() => setSource(false)}
          >
            预览
          </button>
          {artifact.kind !== "image" && (
            <button
              className={source ? "is-active" : ""}
              onClick={() => setSource(true)}
            >
              编辑源码
            </button>
          )}
        </div>
        <span>
          v{artifact.versions.findIndex((item) => item.id === base.id) + 1} ·{" "}
          {base.label}
        </span>
        <button
          className="cw-button"
          aria-pressed={annotate}
          onClick={() => {
            setSource(false);
            setAnnotate((value) => !value);
          }}
        >
          {annotate ? "退出批注模式" : "选择区域批注"}
        </button>
        <button
          className="cw-button"
          disabled={artifact.versions.length < 2}
          onClick={onCompare}
        >
          比较版本
        </button>
        <button
          className="cw-button"
          onClick={() => downloadArtifact(artifact, base.id)}
        >
          导出文件
        </button>
      </div>
      {outdated && (
        <p className="cw-banner">
          当前成果已有新版本；这里保留你打开时的内容。请关闭后重新打开，以修改最新版本。
        </p>
      )}
      <div className="cw-inspect-body">
        <div className="cw-inspect-main">
          {source ? (
            <div className="cw-source-editor">
              <label>
                成果标题
                <input
                  value={title}
                  maxLength={160}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label className="cw-grow">
                内容
                <textarea
                  aria-label="编辑成果内容"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="cw-source"
                  spellCheck={false}
                />
              </label>
              <label>
                版本说明
                <input
                  placeholder="例如：调整标题和页面间距"
                  value={label}
                  maxLength={200}
                  onChange={(event) => setLabel(event.target.value)}
                />
              </label>
              <button
                className="cw-button cw-primary"
                disabled={
                  busy || !dirty || !draft.trim() || !title.trim() || outdated
                }
                onClick={() =>
                  void run(async () => {
                    await onSave({
                      type: "publish",
                      artifactId: artifact.id,
                      baseVersionId: base.id,
                      title,
                      kind: artifact.kind,
                      content: draft,
                      label: label.trim() || "手动编辑",
                    });
                    onClose();
                  })
                }
              >
                保存为新版本
              </button>
            </div>
          ) : (
            <>
              <div className="cw-preview-hint">
                {annotate
                  ? artifact.kind === "html"
                    ? "点击页面元素以定位批注"
                    : artifact.kind === "markdown"
                      ? "点击段落或表格单元格以定位批注"
                      : "在右侧填写对这张图片的批注"
                  : artifact.kind === "html"
                    ? "静态预览 · 页面脚本和外部资源不执行"
                    : "选中区域后可以添加批注"}
              </div>
              <Preview
                kind={artifact.kind}
                content={base.content}
                title={artifact.title}
                annotate={annotate}
                onSelection={setTarget}
              />
            </>
          )}
        </div>
        <aside className="cw-notes">
          <div className="cw-notes-heading">
            <h3>批注</h3>
            <span>{notes.length}</span>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                await onSave({
                  type: "annotate",
                  artifactId: artifact.id,
                  versionId: base.id,
                  ...target,
                  text: note,
                });
                setNote("");
                setTarget({ selector: "", quote: "" });
              });
            }}
          >
            {target.quote && (
              <blockquote className="cw-quote">
                {target.quote}
                <small>{target.selector}</small>
                <button
                  type="button"
                  className="cw-text-button"
                  onClick={() => setTarget({ selector: "", quote: "" })}
                >
                  清除选区
                </button>
              </blockquote>
            )}
            <label>
              修改意见
              <textarea
                aria-label="批注内容"
                placeholder="描述这个成果需要调整的地方…"
                value={note}
                maxLength={6000}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
              />
            </label>
            <button className="cw-button" disabled={busy || !note.trim()}>
              保存批注
            </button>
          </form>
          <div className="cw-note-list">
            {notes.map((item) => (
              <article className="cw-note" key={item.id}>
                {item.quote && <blockquote>{item.quote}</blockquote>}
                <p>{item.text}</p>
                <footer>
                  <small>{item.selector || "整个成果"}</small>
                  <button
                    className="cw-text-button"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        onSave({
                          type: "remove-annotation",
                          artifactId: artifact.id,
                          annotationId: item.id,
                        }),
                      )
                    }
                  >
                    删除
                  </button>
                </footer>
              </article>
            ))}
            {!notes.length && (
              <p className="cw-muted">
                批注会绑定这个版本，发送请求时一并交给 DSH。
              </p>
            )}
          </div>
          <button
            className="cw-button cw-primary"
            disabled={busy || !notes.length || outdated}
            onClick={() =>
              void run(async () => {
                await onRequest();
                onClose();
              })
            }
          >
            让 DSH 按批注修改
          </button>
          {error && (
            <p className="cw-inline-error" role="alert">
              {error}
            </p>
          )}
        </aside>
      </div>
    </Dialog>
  );
}
