import {build}from'esbuild';import{mkdir,copyFile,cp}from'node:fs/promises';await mkdir('dist',{recursive:true});await build({entryPoints:['web/app.mjs'],bundle:true,minify:true,format:'esm',target:'es2022',outfile:'dist/app.js'});for(const file of ['index.html','style.css','logo.svg'])await copyFile('web/'+file,'dist/'+file);await copyFile('deployment.json','dist/deployment.json');await cp('examples','dist/examples',{recursive:true});await cp('docs/evidence','dist/evidence',{recursive:true});

await build({entryPoints:['web/plans.mjs'],bundle:true,minify:true,format:'esm',target:'es2022',outfile:'dist/plans.js'});await copyFile('web/plans.html','dist/plans.html');await copyFile('plan-deployment.json','dist/plan-deployment.json');

await build({entryPoints:['web/audit.mjs'],bundle:true,minify:true,format:'esm',target:'es2022',outfile:'dist/audit.js'});await copyFile('web/audit.html','dist/audit.html');
