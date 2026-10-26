import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { activeVersion, CanvasError } from '../shared/model.ts';
import type { Artifact, Board } from '../shared/model.ts';
import { content, coordinate, kind, MAX_BOARD_BYTES, record, text, validateBoard } from './validation.ts';

export class BoardStore {
  directory: string;
  private queues = new Map<string, Promise<unknown>>();
  constructor(directory: string) { this.directory = directory; }

  async read(sessionId: string): Promise<Board> {
    text(sessionId, '会话 ID', 1024);
    const path = this.path(sessionId);
    try {
      if ((await stat(path)).size > MAX_BOARD_BYTES) throw new CanvasError('damaged-store', '画布数据超过大小限制，已保留原文件。');
      const raw = await readFile(path, 'utf8');
      let value: unknown;
      try { value = JSON.parse(raw); } catch { throw new CanvasError('damaged-store', '画布数据已损坏，已保留原文件。'); }
      return validateBoard(value, sessionId);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {schemaVersion:1, sessionId, revision:0, artifacts:[], annotations:[]};
      throw error;
    }
  }

  async mutate(sessionId: string, operation: unknown, expectedRevision?: number): Promise<Board> {
    text(sessionId, '会话 ID', 1024);
    const previous = this.queues.get(sessionId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(async () => {
      const board = await this.read(sessionId);
      if (expectedRevision !== undefined && (!Number.isSafeInteger(expectedRevision) || board.revision !== expectedRevision)) throw new CanvasError('conflict', '画布已更新，请刷新后重试，未覆盖任何修改。');
      this.apply(board, record(operation));
      board.revision += 1;
      if (board.artifacts.length > 100 || board.annotations.length > 500) throw new CanvasError('limit', '画布最多保存 100 个成果、500 条批注。');
      const serialized = JSON.stringify(board);
      if (Buffer.byteLength(serialized) > MAX_BOARD_BYTES) throw new CanvasError('limit', '画布超过 25 MiB，请导出并移除部分成果。');
      await mkdir(this.directory, {recursive:true, mode:0o700});
      const path = this.path(sessionId);
      const temporary = `${path}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, serialized, {encoding:'utf8',mode:0o600,flag:'wx'});
        await rename(temporary, path);
      } catch (error) { await unlink(temporary).catch(() => undefined); throw error; }
      return board;
    });
    this.queues.set(sessionId, next);
    try { return await next; } finally { if (this.queues.get(sessionId) === next) this.queues.delete(sessionId); }
  }

  private path(sessionId: string): string { return join(this.directory, `${createHash('sha256').update(sessionId).digest('hex')}.json`); }
  private artifact(board: Board, id: unknown): Artifact {
    const artifact = board.artifacts.find(item => item.id === text(id, '成果 ID'));
    if (!artifact) throw new CanvasError('not-found', '找不到这个成果。');
    return artifact;
  }

  private apply(board: Board, op: Record<string, unknown>): void {
    if (op.type === 'publish') {
      const format = kind(op.kind);
      const body = content(op.content, format);
      const title = text(op.title, '标题', 160).trim();
      const label = op.label === undefined ? '新版本' : text(op.label, '版本标签', 200);
      if (op.artifactId !== undefined) {
        const artifact = this.artifact(board, op.artifactId);
        if (artifact.kind !== format) throw new CanvasError('invalid-input', '新版本必须保持原成果的格式。');
        if (op.baseVersionId !== artifact.activeVersionId) throw new CanvasError('conflict', '成果已更新，请先读取当前版本，未覆盖任何修改。');
        if (artifact.versions.length >= 100) throw new CanvasError('limit', '每个成果最多保存 100 个版本。');
        const version = {id:randomUUID(),content:body,label,createdAt:new Date().toISOString(),parentId:activeVersion(artifact).id};
        artifact.versions.push(version); artifact.activeVersionId = version.id; artifact.title = title;
      } else {
        const index = board.artifacts.length;
        const version = {id:randomUUID(),content:body,label:op.label === undefined ? '初始版本' : label,createdAt:new Date().toISOString(),parentId:null};
        board.artifacts.push({id:randomUUID(),title,kind:format,x:coordinate(op.x ?? (index % 3) * 380 + 40),y:coordinate(op.y ?? Math.floor(index / 3) * 380 + 40),activeVersionId:version.id,versions:[version]});
      }
      return;
    }
    if (op.type === 'move') {
      if (!Array.isArray(op.positions) || op.positions.length > 100) throw new CanvasError('invalid-input', '位置数据无效。');
      for (const value of op.positions) { const position = record(value); const artifact = this.artifact(board, position.id); artifact.x = coordinate(position.x); artifact.y = coordinate(position.y); }
      return;
    }
    const artifact = this.artifact(board, op.artifactId);
    if (op.type === 'activate') {
      if (!artifact.versions.some(item => item.id === op.versionId)) throw new CanvasError('not-found', '找不到这个版本。');
      artifact.activeVersionId = String(op.versionId);
    } else if (op.type === 'rename') artifact.title = text(op.title, '标题', 160).trim();
    else if (op.type === 'remove') { board.artifacts = board.artifacts.filter(item => item.id !== artifact.id); board.annotations = board.annotations.filter(item => item.artifactId !== artifact.id); }
    else if (op.type === 'annotate') {
      if (!artifact.versions.some(item => item.id === op.versionId)) throw new CanvasError('not-found', '找不到批注对应的版本。');
      const selector = typeof op.selector === 'string' ? op.selector : '';
      const quote = typeof op.quote === 'string' ? op.quote : '';
      if (selector.length > 500 || quote.length > 3000) throw new CanvasError('invalid-input', '批注选区过长。');
      board.annotations.push({id:randomUUID(),artifactId:artifact.id,versionId:String(op.versionId),selector,quote,text:text(op.text,'批注',6000),createdAt:new Date().toISOString()});
    } else if (op.type === 'remove-annotation') board.annotations = board.annotations.filter(item => item.id !== op.annotationId || item.artifactId !== artifact.id);
    else throw new CanvasError('invalid-input', '未知画布操作。');
  }
}
