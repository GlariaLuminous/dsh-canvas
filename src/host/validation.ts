import { CanvasError } from '../shared/model.ts';
import type { ArtifactKind, Board } from '../shared/model.ts';

export const MAX_BOARD_BYTES = 25 * 1024 * 1024;
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CanvasError('invalid-input', '请求格式不正确。');
  return value as Record<string, unknown>;
}
export function text(value: unknown, field: string, max = 256): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new CanvasError('invalid-input', `${field}不能为空，且不能超过 ${max} 个字符。`);
  return value;
}
export function kind(value: unknown): ArtifactKind {
  if (value !== 'markdown' && value !== 'html' && value !== 'image') throw new CanvasError('invalid-input', '仅支持 Markdown、HTML 和图片格式。');
  return value;
}
export function content(value: unknown, format: ArtifactKind): string {
  const limit = format === 'image' ? 7 * 1024 * 1024 : 1024 * 1024;
  if (typeof value !== 'string' || !value.length || Buffer.byteLength(value, 'utf8') > limit) throw new CanvasError('invalid-input', '内容为空或超过大小限制（文本 1 MiB，图片 5 MiB）。');
  if (format === 'image') {
    const match = /^data:image\/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match) throw new CanvasError('invalid-input', '图片必须为 PNG、JPEG、GIF 或 WebP。');
    const bytes = Buffer.from(match[2], 'base64');
    const valid = match[1] === 'png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : match[1] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : match[1] === 'gif' ? /^GIF8[79]a$/.test(bytes.subarray(0,6).toString('ascii'))
      : bytes.subarray(0,4).toString('ascii') === 'RIFF' && bytes.subarray(8,12).toString('ascii') === 'WEBP';
    if (!valid || bytes.length > 5 * 1024 * 1024 || bytes.toString('base64') !== match[2]) throw new CanvasError('invalid-input', '图片数据无效或超过 5 MiB。');
  }
  return value;
}
export function coordinate(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 100_000) throw new CanvasError('invalid-input', '画布坐标无效。');
  return Math.round(value);
}

export function validateBoard(value: unknown, sessionId: string): Board {
  try {
    const board = record(value);
    if (board.schemaVersion !== 1 || board.sessionId !== sessionId || !Number.isSafeInteger(board.revision) || Number(board.revision) < 0 || !Array.isArray(board.artifacts) || !Array.isArray(board.annotations) || board.artifacts.length > 100 || board.annotations.length > 500) throw new Error('Invalid board');
    const ids = new Set<string>();
    for (const raw of board.artifacts) {
      const artifact = record(raw);
      const id = text(artifact.id, 'ID');
      if (ids.has(id)) throw new Error('Duplicate artifact');
      ids.add(id);
      text(artifact.title, '标题', 160);
      const format = kind(artifact.kind);
      coordinate(artifact.x); coordinate(artifact.y);
      if (!Array.isArray(artifact.versions) || !artifact.versions.length || artifact.versions.length > 100) throw new Error('Invalid versions');
      const versions = new Set<string>();
      for (const rawVersion of artifact.versions) {
        const version = record(rawVersion);
        const versionId = text(version.id, '版本 ID');
        if (versions.has(versionId) || (version.parentId !== null && !versions.has(String(version.parentId)))) throw new Error('Invalid version lineage');
        versions.add(versionId);
        content(version.content, format);
        text(version.label, '版本标签', 200); text(version.createdAt, '日期', 64);
      }
      if (!versions.has(String(artifact.activeVersionId))) throw new Error('Unknown active version');
    }
    const noteIds = new Set<string>();
    for (const raw of board.annotations) {
      const note = record(raw);
      const id = text(note.id, '批注 ID');
      if (noteIds.has(id)) throw new Error('Duplicate annotation');
      noteIds.add(id);
      const artifact = board.artifacts.find(item => item.id === note.artifactId);
      if (!artifact || !artifact.versions.some((item: {id:string}) => item.id === note.versionId)) throw new Error('Unknown annotation version');
      text(note.text, '批注', 6000); text(note.createdAt, '日期', 64);
      if (typeof note.selector !== 'string' || note.selector.length > 500 || typeof note.quote !== 'string' || note.quote.length > 3000) throw new Error('Invalid annotation');
    }
    return value as Board;
  } catch {
    throw new CanvasError('damaged-store', '画布数据已损坏，已保留原文件，请从备份恢复。');
  }
}
