import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { CanvasError } from '../shared/model.ts';
import { BoardStore } from './store.ts';
import { record, text } from './validation.ts';
import { prepareRequest } from './request.ts';
import { registerTools } from './tools.ts';
import type { ToolRegistry } from './tools.ts';

export const name = 'canvas-workbench';
export const inject = ['tools', 'connection'];
interface HostContext {
  tools: ToolRegistry;
  connection: {rpc: {handle(channel:string,handler:(endpoint:string,payload:unknown,signal:AbortSignal,peer:{principal:{kind:string}}) => Promise<unknown>):unknown}};
}
export function apply(ctx: HostContext): void {
  const home = resolve(process.env.DSH_HOME || join(homedir(),'.dsh'));
  const store = new BoardStore(join(home,'storages','canvas-workbench','boards'));
  registerTools(ctx.tools,store);
  ctx.connection.rpc.handle('/canvas-workbench',async (endpoint,payload,signal,peer) => {
    if (peer.principal.kind !== 'owner') return {ok:false,error:{code:'forbidden',message:'仅工作区所有者可以访问画布。',details:{}}};
    try {
      signal.throwIfAborted();
      const input = record(payload);
      const sessionId = text(input.sessionId,'会话 ID',1024);
      let value: unknown;
      if (endpoint === 'read') {
        const board = await store.read(sessionId);
        value = input.knownRevision === board.revision ? {unchanged:true,revision:board.revision} : board;
      } else if (endpoint === 'mutate') {
        if (!Number.isSafeInteger(input.expectedRevision)) throw new CanvasError('invalid-input','缺少画布版本，请刷新后重试。');
        value = await store.mutate(sessionId,input.operation,Number(input.expectedRevision));
      } else if (endpoint === 'prepare') value = prepareRequest(await store.read(sessionId),input.ids,input.instruction);
      else throw new CanvasError('not-found','找不到这个画布操作。');
      return {ok:true,value};
    } catch (error) {
      return {ok:false,error:{code:error instanceof CanvasError ? error.code : 'internal',message:error instanceof CanvasError ? error.message : '画布操作失败，原有数据已保留，请重试。',details:{}}};
    }
  });
}
