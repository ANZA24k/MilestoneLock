import {canonical, verifyPlanReceipt} from './core.mjs';
// Only call with independently read finalized state. This is workflow guidance, not a verdict.
export async function projectReadiness(project, records) {
 if (!Array.isArray(project.milestones) || project.milestones.length < 2 || project.milestones.length > 6 || records.length !== project.milestones.length) throw Error('Load every milestone in the locked plan.');
 const byId = new Map(records.map(r => [r.id, r]));
 if (byId.size !== records.length) throw Error('Duplicate milestone.');
 const rows = [];
 for (const item of project.milestones) {
  const r = byId.get(item.id);
  if (!r) throw Error('Missing plan milestone: ' + item.id);
  await verifyPlanReceipt(r, project);
  if (r.accepted !== project.accepted || r.cancelled !== project.cancelled || !Number.isInteger(r.revision) || r.revision < 0 || r.revision > 3 || r.history.length > r.revision || r.revision - r.history.length > 1) throw Error('Inconsistent finalized workflow state; reload.');
  const last = r.history.at(-1), pending = r.revision > r.history.length;
  if (pending && (!Array.isArray(r.evidence) || !r.evidence.length)) throw Error('Pending revision has no evidence.');
  if (last && !['APPROVED','REJECTED','INCONCLUSIVE'].includes(last.report.outcome)) throw Error('Unknown verdict.');
  if (r.history.slice(0,-1).some(h => h.report.outcome === 'APPROVED') || (pending && last?.report.outcome === 'APPROVED')) throw Error('Approved milestone cannot have later evidence.');
  if (!pending && last && canonical(r.evidence) !== canonical(last.evidence)) throw Error('Reviewed evidence differs from history.');
  const prior = r.depends_on ? rows.find(x => x.id === r.depends_on) : null;
  if ((r.revision > 0) && (!r.accepted || r.cancelled || (prior && prior.state !== 'APPROVED'))) throw Error('Inconsistent dependency or acceptance state; reload.');
  let state, actor, method = null, args = [], message;
  if (r.cancelled) { state='CANCELLED'; actor=null; message='Project cancelled; no further action.'; }
  else if (!r.accepted) { state='AWAITING_ACCEPTANCE'; actor=project.contractor; method='accept_project'; args=[project.id,project.commitment]; message='Contractor must accept the locked project commitment.'; }
  else if (prior && prior.state !== 'APPROVED') { state='BLOCKED'; actor=null; message='Resolve predecessor milestone '+r.depends_on+' first.'; }
  else if (pending) { state='AWAITING_REVIEW'; actor='Any independent reviewer'; method='review'; args=[r.id]; message='Review the submitted evidence in Normal (Full Consensus) mode.'; }
  else if (last?.report.outcome === 'APPROVED') { state='APPROVED'; actor=null; message='Terminal approval recorded; no further evidence accepted.'; }
  else if (r.revision === 3) { state='EXHAUSTED'; actor=null; message='All three evidence revisions consumed; no further submission allowed.'; }
  else { state=last?'NEEDS_REVISION':'AWAITING_EVIDENCE'; actor=project.contractor; method='submit_evidence_pack'; args=null; message=last?'Prepare a new evidence pack addressing the findings below.':'Prepare the first evidence pack in Project plans.'; }
  const unresolved = last ? r.specification.criteria.filter(c => last.report.checks?.find(f => f.id===c.id)?.finding !== 'MET').map(c => ({...c, finding:last.report.checks?.find(f=>f.id===c.id)?.finding || 'MISSING'})) : [];
  rows.push({id:r.id,title:r.specification.title,depends_on:r.depends_on,state,revision:r.revision,remaining_submissions:3-r.revision,last_outcome:last?.report.outcome||null,findings_revision:last?.revision||null,unresolved,evidence_rules:last?.report.evidence_rules||null,decision_hash:last?.decision_hash||null,action:{actor,method,args,message}});
 }
 const approved=rows.filter(r=>r.state==='APPROVED').length;
 return {project_id:project.id,commitment:project.commitment,total:rows.length,approved,complete:approved===rows.length,rows};
}
// Bracket reads detect changes while collecting records; never fall back to fixtures.
export async function loadReadiness(read, id) {
 if (!/^[1-9][0-9]{0,15}$/.test(id)) throw Error('Enter a positive project ID.');
 const project=await read('get_project',id);
 if (!Array.isArray(project.milestones) || project.milestones.length<2 || project.milestones.length>6) throw Error('Invalid project size.');
 const records=[];
 for(const item of project.milestones) records.push(await read('get_milestone',item.id));
 for(const r of records) if(canonical(r)!==canonical(await read('get_milestone',r.id))) throw Error('Finalized state changed during loading; reload.');
 if(canonical(project)!==canonical(await read('get_project',id))) throw Error('Finalized project changed during loading; reload.');
 return {project,records,summary:await projectReadiness(project,records)};
}
