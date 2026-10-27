import type { Artifact, ArtifactKind } from "../shared/model.ts";
import { activeVersion } from "../shared/model.ts";
export async function readImport(
  file: File,
): Promise<{ title: string; kind: ArtifactKind; content: string }> {
  const image = /\.(png|jpe?g|webp|gif)$/i.test(file.name);
  const format: ArtifactKind = image
    ? "image"
    : /\.html?$/i.test(file.name)
      ? "html"
      : "markdown";
  if (!image && !/\.(md|markdown|txt|html?)$/i.test(file.name))
    throw new Error("支持 .md、.txt、.html 和 PNG/JPEG/WebP/GIF 图片。");
  if (file.size > (image ? 5 * 1024 * 1024 : 1024 * 1024))
    throw new Error(`${file.name} 超过大小限制（文本 1 MiB，图片 5 MiB）。`);
  let content: string;
  if (image) {
    const extension = file.name.split(".").at(-1)!.toLowerCase();
    const mime = extension === "jpg" ? "jpeg" : extension;
    content = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(
          `data:image/${mime};base64,${String(reader.result).split(",")[1]}`,
        );
      reader.onerror = () => reject(new Error("读取图片失败。"));
      reader.readAsDataURL(file);
    });
  } else content = await file.text();
  return { title: file.name, kind: format, content };
}
export function downloadArtifact(
  artifact: Artifact,
  versionId = artifact.activeVersionId,
): void {
  const version =
    artifact.versions.find((item) => item.id === versionId) ??
    activeVersion(artifact);
  let blob: Blob;
  let extension: string;
  if (artifact.kind === "image") {
    const match = /^data:(image\/([a-z]+));base64,(.+)$/.exec(version.content)!;
    const binary = atob(match[3]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    blob = new Blob([bytes], { type: match[1] });
    extension = match[2];
  } else {
    extension = artifact.kind === "html" ? "html" : "md";
    blob = new Blob([version.content], {
      type:
        artifact.kind === "html"
          ? "text/html;charset=utf-8"
          : "text/markdown;charset=utf-8",
    });
  }
  const title =
    artifact.title
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .replace(/[. ]+$/, "") || "artifact";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = new RegExp(`\\.${extension}$`, "i").test(title)
    ? title
    : `${title}.${extension}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
