import { useState } from "react";
import { Dialog } from "./Dialog.tsx";
import type { Board } from "../shared/model.ts";
export function CreateDialog({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (operation: unknown) => Promise<Board>;
}) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("markdown");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog title="新建成果" onClose={onClose}>
      <form
        className="cw-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          setError("");
          try {
            await onSave({ type: "publish", title, kind, content });
            onClose();
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        <label>
          成果标题
          <input
            aria-label="成果标题"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={160}
            required
            autoFocus
            placeholder="例如：产品需求、首页方案"
          />
        </label>
        <label>
          格式
          <select
            aria-label="格式"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            <option value="markdown">Markdown</option>
            <option value="html">HTML 页面</option>
          </select>
        </label>
        <label>
          内容
          <textarea
            aria-label="内容"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            required
            rows={12}
            className="cw-source"
            placeholder={kind === "html" ? "<h1>我的页面</h1>" : "# 我的成果"}
          />
        </label>
        {error && (
          <p className="cw-inline-error" role="alert">
            {error}
          </p>
        )}
        <footer className="cw-dialog-actions">
          <button type="button" className="cw-button" onClick={onClose}>
            取消
          </button>
          <button
            className="cw-button cw-primary"
            disabled={saving || !title.trim() || !content.trim()}
          >
            {saving ? "保存中…" : "创建成果"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
