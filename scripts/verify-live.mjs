import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createClient} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {TransactionHashVariant} from 'genlayer-js/types';
import {verifyReceipt} from '../web/core.mjs';
const c=createClient({chain:studionet});
const config=JSON.parse(await readFile('deployment.json','utf8'));
const source=await readFile('contracts/milestone_lock.py','utf8');
const [code,records,rawTransactions,failed]=await Promise.all([
 c.getContractCode(config.contract),
 Promise.all(config.pilot_ids.map(async id=>JSON.parse(String(await c.readContract({address:config.contract,functionName:'get_milestone',args:[id],transactionHashVariant:TransactionHashVariant.LATEST_FINAL}))))),
 Promise.all(config.transactions.map(hash=>c.getTransaction({hash}))),
 Promise.all((config.failed_attempts||[]).map(item=>c.getTransaction({hash:item.hash})))
]);
assert.equal(typeof code==='string'?code:Buffer.from(code).toString(),source,'Deployed source mismatch');
assert.equal(createHash('sha256').update(source).digest('hex'),config.source_sha256);
await Promise.all(records.map(verifyReceipt));
const transactions=rawTransactions.map(tx=>{
 assert.equal(tx.statusName,'FINALIZED',tx.hash+' not finalized');
 assert.equal(tx.consensus_data.leader_receipt[0].execution_result,'SUCCESS');
 assert.equal(tx.execution_mode,'NORMAL');
 assert.equal(tx.result_name,'MAJORITY_AGREE','A finalized dissent is not a successful settlement');
 return {hash:tx.hash,status:tx.statusName,execution:'SUCCESS',mode:tx.execution_mode,consensus_result:tx.result_name,votes:tx.consensus_data.votes};
});
const failures=failed.map(tx=>{assert.equal(tx.result_name,'MAJORITY_DISAGREE');return {hash:tx.hash,status:tx.statusName,consensus_result:tx.result_name,votes:tx.consensus_data.votes,effect:'No milestone history entry was stored.'};});
assert(records.some(r=>r.history.at(-1)?.report.outcome==='APPROVED'));
assert(records.some(r=>r.history.some(h=>h.report.outcome==='REJECTED')));
const revisionPilot=records.find(r=>r.id==='2');
assert.deepEqual(revisionPilot.history.map(h=>h.report.outcome),['REJECTED','APPROVED'],'Expected preserved rejection followed by corrected approval');
const references=[...new Map(records.flatMap(r=>r.history.map(h=>[h.evidence.url,h.evidence]))).values()];
const documents=await Promise.all(references.map(async ref=>{const response=await fetch(ref.url);assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,ref.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),ref.sha256);new TextDecoder('utf-8',{fatal:true}).decode(bytes);return {...ref,verified:true};}));
const evidence={schema:'milestonelock.live.v1',checked_at:new Date().toISOString(),network:'studionet',contract:config.contract,source_sha256:config.source_sha256,read_state:'LATEST_FINAL',transactions,failed_attempts:failures,documents,records};
await writeFile('docs/evidence/live-state.json',JSON.stringify(evidence,null,2)+'\n');
console.log('Verified exact source, finalized MAJORITY_AGREE transactions, successful execution, and receipt chains.');
console.log(records.map(r=>({id:r.id,history:r.history.map(h=>h.report.outcome)})));
