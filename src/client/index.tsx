import React from 'react';

export const inject = ['slots','connection','sessions'];
interface ClientContext {
  slots: {
    inject(name:string,fn:() => unknown):unknown;
    register(options:unknown,component:React.ComponentType<InitialProps>):unknown;
  };
  connection: {rpc:{call(channel:string,endpoint:string,payload:unknown):Promise<unknown>}};
}
interface InitialProps {sessionId:string;read:() => Promise<unknown>}
function InitialView({sessionId,read}:InitialProps) {
  const [result,setResult] = React.useState('正在读取画布…');
  React.useEffect(() => { let mounted = true; void read().then(value => { if(mounted) setResult(JSON.stringify(value)); }); return () => {mounted=false;}; },[read]);
  return <section aria-label="Canvas 工作台"><h2>Canvas 工作台</h2><p>会话：{sessionId}</p><pre>{result}</pre></section>;
}
export function apply(ctx:ClientContext):void {
  ctx.slots.inject('conversation.view',() => ctx.slots.register({name:'conversation.view',id:'canvas-workbench',order:15,label:'Canvas',inject:(sessionId:string) => ({read:() => ctx.connection.rpc.call('/canvas-workbench','read',{sessionId})})},InitialView));
}
