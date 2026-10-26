import{canonical,sha,verifyPlanReceipt,safeURL,address}from'./core.mjs';
export const AUDIT_SCHEMA='milestonelock.audit.v1';
const MAX_PACKET=2_000_000,STATES=['MET','NOT_MET','UNCLEAR'];
const assert=(ok,message)=>{if(!ok)throw Error(message)};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const refKey=ref=>ref.url+'|'+ref.sha256+'|'+ref.bytes;
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const id=v=>typeof v==='string'&&/^[1-9][0-9]*$/.test(v);
// Validate JSON tokens before native decoding so duplicate object keys cannot disappear.
export function parseAuditJSON(text){
 assert(typeof text==='string'&&new TextEncoder().encode(text).length<=MAX_PACKET,'Audit JSON exceeds 2 MB');
 let at=0;
 const space=()=>{while(/[ \t\r\n]/.test(text[at]||'!'))at++};
 function string(){const start=at++;while(at<text.length){const c=text[at++];if(c==='"')return JSON.parse(text.slice(start,at));if(c==='\\')at++;}throw Error('Unterminated JSON string')}
 function value(depth){assert(depth<=40,'Audit JSON nesting exceeds limit');space();const c=text[at];
  if(c==='"'){string();return}
  if(c==='{'){at++;space();const keys=new Set();if(text[at]==='}'){at++;return}for(;;){space();assert(text[at]==='"','Invalid object key');const key=string();assert(!keys.has(key),'Duplicate JSON field: '+key);keys.add(key);space();assert(text[at++]===':','Missing colon');value(depth+1);space();const end=text[at++];if(end==='}')return;assert(end===',','Invalid object separator')}}
  if(c==='['){at++;space();if(text[at]===']'){at++;return}for(;;){value(depth+1);space();const end=text[at++];if(end===']')return;assert(end===',','Invalid array separator')}}
  const token=/^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(text.slice(at));assert(token,'Invalid JSON value');at+=token[0].length;
 }
 value(0);space();assert(at===text.length,'Trailing JSON content');return JSON.parse(text);
}
function pack(refs){
 assert(Array.isArray(refs)&&refs.length>=1&&refs.length<=3,'Invalid evidence pack');
 const ids=new Set(),urls=new Set();let total=0,primary=0;
 for(const ref of refs){assert(exact(ref,['id','role','url','sha256','bytes']),'Invalid source fields');assert(/^[a-z][a-z0-9_]{0,31}$/.test(ref.id)&&typeof ref.id==='string','Invalid source ID');assert(['DELIVERABLE','CORROBORATION'].includes(ref.role),'Invalid source role');assert(safeURL(ref.url)&&hash(ref.sha256)&&Number.isSafeInteger(ref.bytes)&&ref.bytes>=30&&ref.bytes<=30000,'Invalid source commitment');assert(!ids.has(ref.id)&&!urls.has(ref.url),'Duplicate evidence source');ids.add(ref.id);urls.add(ref.url);total+=ref.bytes;primary+=ref.role==='DELIVERABLE'?1:0}
 assert(primary===1&&total<=60000,'Invalid pack roles or total size');
}
function report(report,spec,refs){
 assert(exact(report,['outcome','reason','evidence_rules','checks']),'Invalid report fields');
 assert(STATES.includes(report.evidence_rules)&&Array.isArray(report.checks),'Invalid evidence finding');
 if(report.reason!=='SEMANTIC_REVIEW'){assert(['SOURCE_MISMATCH','SOURCE_UNAVAILABLE','SOURCE_ENCODING'].includes(report.reason)&&report.outcome==='INCONCLUSIVE'&&report.evidence_rules==='UNCLEAR'&&report.checks.length===0,'Invalid source-failure report');return}
 assert(report.checks.length===spec.criteria.length,'Incomplete criterion coverage');
 for(let i=0;i<spec.criteria.length;i++){const row=report.checks[i];assert(exact(row,['id','finding','source_id','quote']),'Invalid finding fields');assert(row.id===spec.criteria[i].id&&STATES.includes(row.finding)&&refs.some(ref=>ref.id===row.source_id),'Invalid finding or source binding');assert(typeof row.quote==='string'&&row.quote.length<=1200&&(row.finding==='UNCLEAR'||row.quote.trim().length>=10),'Invalid evidence quote')}
 const findings=[report.evidence_rules,...report.checks.map(c=>c.finding)],outcome=findings.includes('UNCLEAR')?'INCONCLUSIVE':findings.includes('NOT_MET')?'REJECTED':'APPROVED';
 assert(report.outcome===outcome,'Report outcome contradicts deterministic aggregation');
}
export function makeAuditPacket(deployment,project,record,documents=[]){return{schema:AUDIT_SCHEMA,chain_id:deployment.chain_id,contract:deployment.contract,read_state:'LATEST_FINAL',project,record,documents}}
export async function validateAuditPacket(input,deployment){
 let p=typeof input==='string'?parseAuditJSON(input):parseAuditJSON(JSON.stringify(input));
 if(p?.schema==='milestonelock.audit-report.v1')p=p.packet;
 assert(object(p)&&[AUDIT_SCHEMA,'milestonelock.plan-receipt.v2'].includes(p.schema),'Unsupported receipt schema');
 assert(p.chain_id===61999&&p.chain_id===deployment.chain_id&&address(p.contract)&&p.contract.toLowerCase()===deployment.contract.toLowerCase(),'Receipt targets a different deployment');
 assert(p.read_state==='LATEST_FINAL','Receipt is not labeled finalized');
 const{project,record}=p;assert(object(project)&&object(record)&&id(project.id)&&id(record.id),'Invalid receipt IDs');
 assert(project.policy==='milestonelock-plan-2'&&record.policy===project.policy,'Unknown contract policy');
 assert(Array.isArray(project.milestones)&&project.milestones.length>=2&&project.milestones.length<=6&&new Set(project.milestones.map(m=>m.id)).size===project.milestones.length,'Invalid project sequence');
 assert(address(project.sponsor)&&address(project.contractor)&&project.sponsor.toLowerCase()!==project.contractor.toLowerCase()&&!/^0x0{40}$/i.test(project.contractor),'Invalid project accounts');
 assert(Number.isSafeInteger(record.position)&&record.position>=1&&record.position<=project.milestones.length,'Invalid milestone position');
 assert(typeof project.accepted==='boolean'&&typeof project.cancelled==='boolean'&&typeof record.accepted==='boolean'&&typeof record.cancelled==='boolean','Invalid acceptance flags');
 assert(record.accepted===project.accepted&&record.cancelled===project.cancelled&&!(record.accepted&&record.cancelled),'Inconsistent project acceptance');
 assert(Number.isSafeInteger(record.revision)&&record.revision>=0&&record.revision<=3&&Array.isArray(record.history)&&record.history.length<=record.revision&&record.history.length>=record.revision-1,'Invalid revision state');
 assert(record.revision===0?record.evidence===null:Array.isArray(record.evidence),'Invalid current evidence');
 for(const item of project.milestones){assert(id(item.id)&&object(item.specification)&&Array.isArray(item.specification.criteria)&&item.specification.criteria.length>=1&&item.specification.criteria.length<=6&&new Set(item.specification.criteria.map(c=>c.id)).size===item.specification.criteria.length,'Invalid locked specification')}
 await verifyPlanReceipt(record,project);
 let previousApproved=false;const refsByURL=new Map();
 for(const h of record.history){assert(!previousApproved,'History continues after terminal approval');assert(h.revision<=record.revision&&address(h.reviewer),'Invalid history reviewer or revision');pack(h.evidence);report(h.report,record.specification,h.evidence);previousApproved=h.report.outcome==='APPROVED';
  for(const ref of h.evidence)refsByURL.set(refKey(ref),ref)
 }
 if(record.evidence){pack(record.evidence);if(record.history.length===record.revision&&record.revision>0)assert(canonical(record.evidence)===canonical(record.history.at(-1).evidence),'Current pack differs from latest reviewed pack')}
 assert(!previousApproved||record.history.length===record.revision,'Pending revision after terminal approval');
 assert(record.revision===0||record.accepted,'Unaccepted evidence revision');
 const documents=p.documents??[];assert(Array.isArray(documents)&&documents.length<=9,'Too many embedded documents');let total=0;const embedded=new Map();
 for(const doc of documents){assert(exact(doc,['url','text'])&&[...refsByURL.values()].some(ref=>ref.url===doc.url)&&typeof doc.text==='string'&&!embedded.has(doc.url),'Invalid embedded document');total+=new TextEncoder().encode(doc.text).length;assert(total<=180000,'Embedded sources exceed 180 KB');embedded.set(doc.url,doc.text)}
 return{packet:p,refs:[...refsByURL.values()],embedded,integrity:'VERIFIED',anchor:'NOT_CHECKED',note:'Self-consistent hashes do not prove on-chain origin or truthful evidence.'};
}
export async function reconcileAudit(validated,{readProject,readMilestone,readCode},deployment){
 const p=validated.packet;
 // Injected readers receive IDs only. Untrusted receipts cannot choose an RPC or address.
 const projectBefore=await readProject(p.project.id),record=await readMilestone(p.record.id),projectAfter=await readProject(p.project.id);
 assert(canonical(projectBefore)===canonical(projectAfter),'Project changed during audit; refresh and retry');
 assert(canonical(projectAfter)===canonical(p.project)&&canonical(record)===canonical(p.record),'Receipt does not match current finalized contract state (stale or altered)');
 const code=await readCode();assert(typeof code==='string'&&await sha(code)===deployment.source_sha256,'Deployed source differs from pinned release');
 return{anchor:'FINALIZED_MATCH',source_sha256:deployment.source_sha256,checked_at:new Date().toISOString()};
}
export async function verifyAuditSources(validated,fetchBytes){
 const documents=[],texts=new Map();const{packet,refs,embedded}=validated;
 for(const ref of refs){try{const bytes=embedded.has(ref.url)?new TextEncoder().encode(embedded.get(ref.url)):await fetchBytes(ref);assert(bytes instanceof Uint8Array&&bytes.length===ref.bytes&&await sha(bytes)===ref.sha256,'Source hash or byte length mismatch');const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);texts.set(refKey(ref),text);documents.push({url:ref.url,sha256:ref.sha256,bytes:ref.bytes,status:'VERIFIED',origin:embedded.has(ref.url)?'EMBEDDED':'FETCHED'});}catch(e){documents.push({url:ref.url,status:'UNVERIFIED',error:String(e.message).slice(0,180)})}}
 const revisions=packet.record.history.map(h=>{const errors=[];if(h.report.reason!=='SEMANTIC_REVIEW')errors.push('Contract recorded '+h.report.reason+'; no semantic approval is certified');for(const row of h.report.checks){const ref=h.evidence.find(ref=>ref.id===row.source_id),text=texts.get(refKey(ref));if(text===undefined)errors.push('Source unavailable for '+row.id);else if(row.quote&&!text.includes(row.quote))errors.push('Quote absent from source for '+row.id)}return{revision:h.revision,outcome:h.report.outcome,quotes:errors.length?'UNVERIFIED':'VERIFIED',errors}});
 return{documents,revisions,all_sources_verified:documents.length>0&&documents.every(d=>d.status==='VERIFIED')&&revisions.every(r=>r.quotes==='VERIFIED'),documents_for_export:[...new Map(refs.filter(ref=>texts.has(refKey(ref))).map(ref=>[ref.url,{url:ref.url,text:texts.get(refKey(ref))}])).values()],note:'Byte and quote checks do not independently reproduce GenLayer semantic judgment.'};
}
export async function boundedSourceFetch(ref,fetcher=fetch){
 assert(safeURL(ref.url),'Unsafe source URL');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{const response=await fetcher(ref.url,{signal:controller.signal,redirect:'error',credentials:'omit',cache:'no-store'});assert(response.ok,'Source HTTP '+response.status);assert(response.body?.getReader,'Streaming response unavailable');const reader=response.body.getReader(),parts=[];let size=0;try{for(;;){const{done,value}=await reader.read();if(done)break;size+=value.length;assert(size<=ref.bytes&&size<=30000,'Source exceeds committed byte limit');parts.push(value)}}finally{await reader.cancel().catch(()=>{})}const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}return bytes}finally{clearTimeout(timer)}
}
export function compareRevisions(record,fromRevision,toRevision){
 assert(Number.isSafeInteger(fromRevision)&&Number.isSafeInteger(toRevision)&&fromRevision<toRevision,'Choose two reviewed revisions in ascending order');
 const from=record.history.find(h=>h.revision===fromRevision),to=record.history.find(h=>h.revision===toRevision);assert(from&&to,'Reviewed revision not found');
 const rows=record.specification.criteria.map(c=>{const before=from.report.checks.find(r=>r.id===c.id),after=to.report.checks.find(r=>r.id===c.id);return{id:c.id,requirement:c.requirement,before:before??null,after:after??null,finding_changed:before?.finding!==after?.finding,quote_changed:before?.quote!==after?.quote||before?.source_id!==after?.source_id}});
 const ids=[...new Set([...from.evidence,...to.evidence].map(r=>r.id))].sort();
 const sources=ids.map(id=>{const before=from.evidence.find(r=>r.id===id)??null,after=to.evidence.find(r=>r.id===id)??null;return{id,before,after,change:!before?'ADDED':!after?'REMOVED':canonical(before)===canonical(after)?'UNCHANGED':'CHANGED'}});
 return{from:fromRevision,to:toRevision,outcome_before:from.report.outcome,outcome_after:to.report.outcome,rows,sources,blockers:rows.filter(r=>!r.after||r.after.finding!=='MET').map(r=>({id:r.id,finding:r.after?.finding??'UNCLEAR',requirement:r.requirement})),evidence_rules:{before:from.report.evidence_rules,after:to.report.evidence_rules},note:'Differences explain recorded decisions; they do not create a new validator verdict.'};
}
