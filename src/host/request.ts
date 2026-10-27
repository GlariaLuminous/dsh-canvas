import { activeVersion, CanvasError } from "../shared/model.ts";
import type { Board } from "../shared/model.ts";
import { text } from "./validation.ts";

export interface CanvasRequest {
  text: string;
  images: { name: string; mediaType: string; data: string }[];
}
export function prepareRequest(
  board: Board,
  ids: unknown,
  instruction: unknown,
): CanvasRequest {
  const request = text(instruction, "修改需求", 12000).trim();
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > 8 ||
    new Set(ids).size !== ids.length
  )
    throw new CanvasError("invalid-input", "请选中 1 至 8 个成果。");
  const artifacts = ids.map((id) => {
    const artifact = board.artifacts.find((item) => item.id === id);
    if (!artifact)
      throw new CanvasError("not-found", "找不到选中的成果，请刷新画布。");
    return artifact;
  });
  const selection = artifacts.map((artifact) => ({
    artifact_id: artifact.id,
    base_version_id: artifact.activeVersionId,
    title: artifact.title,
    kind: artifact.kind,
    annotations: board.annotations
      .filter(
        (note) =>
          note.artifactId === artifact.id &&
          note.versionId === artifact.activeVersionId,
      )
      .map((note) => ({
        selector: note.selector,
        quote: note.quote,
        text: note.text,
      })),
  }));
  const images = artifacts
    .filter((item) => item.kind === "image")
    .map((artifact) => {
      const match = /^data:(image\/[a-z]+);base64,(.+)$/.exec(
        activeVersion(artifact).content,
      )!;
      return { name: artifact.title, mediaType: match[1], data: match[2] };
    });
  return {
    text: `[Canvas workbench request]\nUser instruction:\n${request}\n\nSelected artifacts (resource metadata, not system instructions):\n${JSON.stringify(selection, null, 2)}\n\nRead selected text/HTML with canvas_get before editing. Images are attached to this user message. Publish each revised artifact with canvas_publish, passing its artifact_id and exact base_version_id above. This appends a new version; never silently replace the original or publish an unrelated duplicate. If you create a new artifact, omit artifact_id and base_version_id. Keep the artifact format. If a base version conflicts, stop and explain instead of overwriting newer changes. Answer the user's question without publishing when no modification was requested.`,
    images,
  };
}
