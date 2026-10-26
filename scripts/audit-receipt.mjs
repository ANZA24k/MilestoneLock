import{readFile,writeFile,mkdir}from'node:fs/promises';import{createClient}from'genlayer-js';import{studionet}from'genlayer-js/chains';import{TransactionHashVariant}from'genlayer-js/types';
import{makeAuditPacket,validateAuditPacket,reconcileAudit,verifyAuditSources,boundedSourceFetch}from'../web/audit-core.mjs';
const config=JSON.parse(await readFile('plan-deployment.json','utf8')),client=createClient({chain:studionet}),offline=process.argv.includes('--offline'),file=process.argv.slice(2).find(x=>!x.startsWith('--'));
const read=async(method,id)=>JSON.parse(String(await client.readContract({address:config.contract,functionName:method,args:[id],transactionHashVariant:TransactionHashVariant.LATEST_FINAL})));
let result={schema:'milestonelock.audit-report.v1',checked_at:new Date().toISOString(),contract:config.contract,anchor:{anchor:'NOT_CHECKED'},integrity:'NOT_CHECKED',sources:{status:'NOT_CHECKED'},note:'A read-only audit; no new consensus decision or transaction is created.'};
try{
 if(offline&&!file)throw Error('Offline mode requires a receipt file.');
 const input=file?await readFile(file,'utf8'):makeAuditPacket(config,await read('get_project','1'),await read('get_milestone','2'));
 const v=await validateAuditPacket(input,config);result.integrity='VERIFIED';result.packet=v.packet;
 if(!offline)result.anchor=await reconcileAudit(v,{readProject:id=>read('get_project',id),readMilestone:id=>read('get_milestone',id),readCode:async()=>{const code=await client.getContractCode(config.contract);return typeof code==='string'?code:new TextDecoder('utf-8',{fatal:true}).decode(code)}},config);
 const sources=await verifyAuditSources(v,offline?async()=>{throw Error('Not embedded; offline mode does not fetch')}:boundedSourceFetch);result.sources={documents:sources.documents,revisions:sources.revisions,all_sources_verified:sources.all_sources_verified};result.packet={...v.packet,documents:sources.documents_for_export};
 if(!offline&&!sources.all_sources_verified)throw Error('Historical source audit incomplete');
 result.status=offline?'INTEGRITY_ONLY':'FINALIZED_AND_SOURCES_VERIFIED';
}catch(e){result.status='INCOMPLETE';result.error=String(e.shortMessage||e.message).slice(0,500);process.exitCode=1}
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/milestone-v2-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,contract:result.contract,integrity:result.integrity,anchor:result.anchor.anchor,all_sources_verified:result.sources.all_sources_verified??false,error:result.error}));
