import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
await mkdir('lib',{recursive:true});
await build({entryPoints:['src/host/index.ts'],outfile:'lib/index.js',bundle:true,format:'esm',platform:'node',target:'node22',packages:'external',sourcemap:true});
await build({entryPoints:['src/client/index.tsx'],outfile:'lib/client.js',bundle:true,format:'cjs',platform:'browser',target:'es2022',jsx:'automatic',loader:{'.css':'text'},external:['react','react/jsx-runtime','react-dom','@deepseek-ai/*'],sourcemap:true,
  banner:{js:`window.__ModuleLoader__.load({id:${JSON.stringify(pkg.name)},factory:(require)=>{var module={exports:{}};var exports=module.exports;`},
  footer:{js:'return module.exports;}});'},
});
console.log(`Built ${pkg.name}@${pkg.version} (Host + DSH browser plugin).`);
