import { useMemo, useState } from "react";
import type { Artifact, Board } from "../shared/model.ts";
import { lineDiff } from "../shared/diff.ts";
import { Dialog } from "./Dialog.tsx";
import { Preview } from "./Preview.tsx";

export function CompareDialog({
  artifact,
  onClose,
  onSave,
}: {
  artifact: Artifact;
  onClose: () => void;
  onSave: (operation: unknown) => Promise<Board>;
}) {
  const [left, setLeft] = useState(
    artifact.versions.at(-2)?.id ?? artifact.versions[0].id,
  );
  const [right, setRight] = useState(artifact.activeVersionId);
  const [source, setSource] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const a = artifact.versions.find((item) => item.id === left)!;
  const b = artifact.versions.find((item) => item.id === right)!;
  const diff = useMemo(() => {
    if (!source || artifact.kind === "image") return [];
    if (a.content.split("\n").length + b.content.split("\n").length > 10000)
      return null;
    return lineDiff(a.content, b.content);
  }, [source, a.content, b.content, artifact.kind]);
  const options = artifact.versions.map((version, index) => (
    <option key={version.id} value={version.id}>
      v{index + 1} · {version.label}
      {version.id === artifact.activeVersionId ? " · 当前" : ""}
    </option>
  ));
  async function activate(versionId: string) {
    setSaving(true);
    setError("");
    try {
      await onSave({ type: "activate", artifactId: artifact.id, versionId });
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }
  let oldLine = 0,
    newLine = 0;
  return (
    <Dialog title={`版本比较 · ${artifact.title}`} onClose={onClose} wide>
      <div className="cw-compare-toolbar">
        <span>选择任意两个版本进行比较</span>
        {artifact.kind !== "image" && (
          <button
            className="cw-button"
            onClick={() => setSource((value) => !value)}
          >
            {source ? "查看预览" : "查看文本差异"}
          </button>
        )}
      </div>
      <div className="cw-compare-headers">
        <label>
          左侧版本
          <select
            aria-label="左侧版本"
            value={left}
            onChange={(event) => setLeft(event.target.value)}
          >
            {options}
          </select>
        </label>
        <label>
          右侧版本
          <select
            aria-label="右侧版本"
            value={right}
            onChange={(event) => setRight(event.target.value)}
          >
            {options}
          </select>
        </label>
      </div>
      {source ? (
        <div className="cw-diff" aria-label="文本差异">
          {diff === null ? (
            <p className="cw-muted cw-diff-limit">
              两个版本合计超过 10,000
              行，暂不计算逐行差异。可以切回双栏预览、采用版本，或在成果详情中导出完整内容。
            </p>
          ) : (
            <>
              <div className="cw-diff-summary">
                新增 {diff.filter((row) => row.type === "added").length} 行 ·
                删除 {diff.filter((row) => row.type === "removed").length} 行
                {diff.length > 2000
                  ? " · 仅显示前 2,000 行；完整内容可导出"
                  : ""}
              </div>
              {diff.slice(0, 2000).map((row, index) => {
                const old = row.type === "added" ? "" : String(++oldLine),
                  next = row.type === "removed" ? "" : String(++newLine);
                return (
                  <div
                    className={`cw-diff-row cw-diff-${row.type}`}
                    key={index}
                  >
                    <pre>
                      <span>{old}</span>
                      {row.type === "added" ? "" : row.text || " "}
                    </pre>
                    <pre>
                      <span>{next}</span>
                      {row.type === "removed" ? "" : row.text || " "}
                    </pre>
                  </div>
                );
              })}
            </>
          )}
        </div>
      ) : (
        <div className="cw-compare-previews">
          <Preview
            kind={artifact.kind}
            content={a.content}
            title={`左侧 ${artifact.title}`}
          />
          <Preview
            kind={artifact.kind}
            content={b.content}
            title={`右侧 ${artifact.title}`}
          />
        </div>
      )}
      {error && (
        <p className="cw-inline-error" role="alert">
          {error}
        </p>
      )}
      <footer className="cw-dialog-actions cw-compare-actions">
        <button
          className="cw-button"
          disabled={saving || left === artifact.activeVersionId}
          onClick={() => void activate(left)}
        >
          采用左侧版本
        </button>
        <span>采用版本会保留所有历史</span>
        <button
          className="cw-button cw-primary"
          disabled={saving || right === artifact.activeVersionId}
          onClick={() => void activate(right)}
        >
          采用右侧版本
        </button>
      </footer>
    </Dialog>
  );
}
