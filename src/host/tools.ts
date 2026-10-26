import { defineTool } from '@deepseek-ai/dsh-tools';
import type { ToolExecution } from '@deepseek-ai/dsh-tools';
import { activeVersion, CanvasError } from '../shared/model.ts';
import { BoardStore } from './store.ts';

export interface ToolRegistry { register(definition: ReturnType<typeof defineTool>): unknown }
const summarySchema = {type:'object',additionalProperties:false,properties:{
  artifact_id:{type:'string',required:true}, version_id:{type:'string',required:true}, title:{type:'string',required:true}, kind:{type:'string',required:true},
}} as const;
function summary(artifact: import('../shared/model.ts').Artifact) {
  return {artifact_id:artifact.id,version_id:artifact.activeVersionId,title:artifact.title,kind:artifact.kind};
}
function sessionOf(exec: ToolExecution): string {
  if (!exec.agent) throw new CanvasError('invalid-scope','Canvas tools require an agent session.');
  return exec.agent.session.id;
}
export function registerTools(registry: ToolRegistry, store: BoardStore): void {
  registry.register(defineTool({
    name:'canvas_list',
    description:'List artifacts on the Canvas workbench belonging to this session. Returns exact artifact and active version IDs for canvas_get and canvas_publish.',
    parameters:{},
    output:{schema:{type:'array',items:summarySchema},render:(_args,value) => [{type:'text',text:JSON.stringify(value)}]},
    async execute(_args,exec) { exec.signal.throwIfAborted(); return (await store.read(sessionOf(exec))).artifacts.map(summary); },
  }));
  registry.register(defineTool({
    name:'canvas_get',
    description:'Read one current Canvas artifact and its current-version annotations in this session. Image bytes are supplied as user attachments when selected; image content here is metadata only.',
    parameters:{artifact_id:{type:'string',required:true}},
    output:{schema:{type:'object',additionalProperties:false,properties:{...summarySchema.properties,content:{type:'string',required:true},annotations:{type:'string',required:true}}},render:(_args,value) => [{type:'text',text:JSON.stringify(value)}]},
    async execute(args,exec) {
      exec.signal.throwIfAborted();
      const board = await store.read(sessionOf(exec));
      const artifact = board.artifacts.find(item => item.id === args.artifact_id);
      if (!artifact) throw new CanvasError('not-found','Artifact not found in this session.');
      return {...summary(artifact),content:artifact.kind === 'image' ? '[Raster image; use the attached image in the user message.]' : activeVersion(artifact).content,annotations:JSON.stringify(board.annotations.filter(note => note.artifactId === artifact.id && note.versionId === artifact.activeVersionId))};
    },
  }));
  registry.register(defineTool({
    name:'canvas_publish',
    description:'Publish HTML, Markdown, or a raster-image data URL to this session’s persistent Canvas. To revise an existing artifact, supply BOTH artifact_id and its active base_version_id obtained from canvas_get. Appends an immutable version, never overwrites earlier content. HTML must be self-contained; preview has no network or filesystem access. Use this tool to deliver visible outputs or requested Canvas changes.',
    parameters:{
      title:{type:'string',required:true}, kind:{type:'string',required:true,enum:['html','markdown','image']}, content:{type:'string',required:true},
      artifact_id:{type:'string'}, base_version_id:{type:'string'}, label:{type:'string',description:'Short description of the change.'},
    },
    output:{schema:summarySchema,render:(_args,value) => [{type:'text',text:JSON.stringify(value)}]},
    async execute(args,exec) {
      exec.signal.throwIfAborted();
      const board = await store.mutate(sessionOf(exec),{type:'publish',title:args.title,kind:args.kind,content:args.content,
        ...(args.artifact_id ? {artifactId:args.artifact_id,baseVersionId:args.base_version_id} : {}),...(args.label ? {label:args.label} : {})});
      const artifact = args.artifact_id ? board.artifacts.find(item => item.id === args.artifact_id)! : board.artifacts.at(-1)!;
      return summary(artifact);
    },
  }));
}
