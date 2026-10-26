import {canonical, verifyPlanReceipt, safeURL, sha} from './core.mjs';
export const receiptSchema='milestonelock.plan-receipt.v2';
export function parseReceipt(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>1000000)throw Error('Receipt exceeds 1 MB.');
 const v=JSON.parse(text);
 if(!v||v.schema!==receiptSchema||v.chain_id!==61999||v.read_state!=='LATEST_FINAL'||!v.project||!v.record||!Array.isArray(v.record.history)||!v.record.history.length)throw Error('Use a finalized MilestoneLock plan receipt with reviewed history.');
 if(!/^[1-9][0-9]{0,15}$/.test(v.record.id)||!Array.isArray(v.project.milestones)||v.project.milestones.length<2||v.project.milestones.length>6||v.record.history.length>3)throw Error('Invalid receipt structure.');
 return v;
}
// Hashes authenticate structure, not origin. This check must use independently read finalized state.
export async function anchorReceipt(receipt,{contract,project,record}){
 if(receipt.contract?.toLowerCase()!==contract.toLowerCase()||receipt.chain_id!==61999||receipt.schema!==receiptSchema||receipt.read_state!=='LATEST_FINAL')throw Error('Wrong contract, network or receipt schema.');
 await verifyPlanReceipt(receipt.record,receipt.project);
 await verifyPlanReceipt(record,project);
 const r=receipt.record;
 if(r.id!==record.id||r.project_id!==project.id||r.commitment!==record.commitment||receipt.project.commitment!==project.commitment)throw Error('Receipt is not from this finalized project and milestone.');
 if(!r.history.length||r.history.length>record.history.length||r.history.some((h,i)=>canonical(h)!==canonical(record.history[i])))throw Error('Receipt history does not match finalized contract history.');
 const current=r.history.length===record.history.length;
 return {integrity:true,provenance:true,scope:current?'CURRENT_HISTORY':'HISTORICAL_PREFIX',reviewed_revisions:r.history.length,finalized_revisions:record.history.length,last_decision_hash:r.history.at(-1).decision_hash};
}
export function compareRevisions(record,from,to){
 const old=record.history.find(h=>h.revision===from),next=record.history.find(h=>h.revision===to);
 if(!old||!next||from>=to)throw Error('Select two reviewed revisions in ascending order.');
 const checks=h=>new Map((h.report.checks||[]).map(c=>[c.id,c]));const a=checks(old),b=checks(next);
 const criteria=record.specification.criteria.map(c=>{const before=a.get(c.id)||null,after=b.get(c.id)||null;return {...c,before,after,changed:canonical(before)!==canonical(after),resolved:before?.finding!=='MET'&&after?.finding==='MET',regressed:before?.finding==='MET'&&after?.finding!=='MET'};});
 const sources=new Map(old.evidence.map(s=>[s.id,s])),targets=new Map(next.evidence.map(s=>[s.id,s]));
 const evidence=[...new Set([...sources.keys(),...targets.keys()])].sort().map(id=>{const before=sources.get(id)||null,after=targets.get(id)||null;return{id,before,after,change:!before?'ADDED':!after?'REMOVED':canonical(before)===canonical(after)?'UNCHANGED':'CHANGED'};});
 return {from,to,before_outcome:old.report.outcome,after_outcome:next.report.outcome,evidence_rules:{before:old.report.evidence_rules,after:next.report.evidence_rules},criteria,evidence,unresolved:criteria.filter(c=>c.after?.finding!=='MET').map(c=>c.id)};
}
export async function verifyHistoricalSources(record,fetcher=fetch){
 const refs=[...new Map(record.history.flatMap(h=>h.evidence).map(s=>[canonical(s),s])).values()];const texts=new Map();
 for(const ref of refs){
  if(!safeURL(ref.url)||!Number.isInteger(ref.bytes)||ref.bytes<30||ref.bytes>30000)throw Error('Invalid historical source commitment.');
  const response=await fetcher(ref.url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Historical source unavailable: '+ref.id);
  // Bound streamed responses before allocating or hashing attacker-controlled bytes.
  const reader=response.body.getReader();let size=0;const chunks=[];
  try{for(;;){const{value,done}=await reader.read();if(done)break;size+=value.length;if(size>ref.bytes)throw Error('Historical byte length mismatch: '+ref.id);chunks.push(value);}}finally{await reader.cancel();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  if(size!==ref.bytes||await sha(bytes)!==ref.sha256)throw Error('Historical source hash mismatch: '+ref.id);
  texts.set(canonical(ref),new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }
 let quotes=0;for(const h of record.history){for(const check of h.report.checks||[]){if(!check.quote)continue;const ref=h.evidence.find(s=>s.id===check.source_id);if(!ref||!texts.get(canonical(ref))?.includes(check.quote))throw Error('Historical quote mismatch: '+check.id);quotes++;}}
 return {documents:refs.length,quotes};
}
