import copy, hashlib, json, re
from pathlib import Path
import pytest
from gltest.direct import VMContext, deploy_contract
ROOT=Path(__file__).parents[1]
SPEC=json.loads((ROOT/'examples/specification.json').read_text())
GOOD=(ROOT/'examples/completed.txt').read_text()
SPONSOR='0x'+'a'*40
CONTRACTOR='0x'+'b'*40
URL='https://raw.githubusercontent.com/ANZA24k/MilestoneLock/'+'1'*40+'/examples/'
def sha(raw):return hashlib.sha256(raw.encode()).hexdigest()
def pack(raw=GOOD):
    return [{'id':'artifact','role':'DELIVERABLE','url':URL+'completed.txt','sha256':sha(raw),'bytes':len(raw.encode())},{'id':'checks','role':'CORROBORATION','url':URL+'checks.txt','sha256':sha('Synthetic corroboration: email label matches email field.'),'bytes':len('Synthetic corroboration: email label matches email field.'.encode())}]
def report(finding='MET'):
    return {'checks':[{'id':c['id'],'finding':finding,'source_id':'artifact','quote':'<label for="email">Email</label>'} for c in SPEC['criteria']],'evidence_rules':'MET'}
@pytest.fixture
def env():
    vm=VMContext()
    with vm.activate():
        vm.sender=SPONSOR;c=deploy_contract(ROOT/'contracts/milestone_plan.py',vm,sdk_version='v0.2.16')
        c.create_project(CONTRACTOR,'Accessible delivery plan',json.dumps([SPEC,SPEC]));yield vm,c

def project(c):return json.loads(c.get_project('1'))
def load(c,id='1'):return json.loads(c.get_milestone(id))
def accept(vm,c):
    with vm.prank(CONTRACTOR):c.accept_project('1',project(c)['commitment'])
def submit(vm,c,id='1',refs=None):
    with vm.prank(CONTRACTOR):c.submit_evidence_pack(id,json.dumps(refs or pack()))
def mock(vm,raw=GOOD,answer=None,status=200,ground='true'):
    vm.mock_web(re.escape(URL+'completed.txt'),{'status':status,'body':raw})
    vm.mock_web(re.escape(URL+'checks.txt'),{'status':200,'body':'Synthetic corroboration: email label matches email field.'})
    vm.mock_llm('independently assess a locked project milestone',json.dumps(answer or report()))
    vm.mock_llm('Validate every proposed finding',ground)

def test_dependency_release_and_whole_plan_commitments(env):
    vm,c=env;accept(vm,c)
    with vm.expect_revert('Predecessor'):submit(vm,c,'2')
    submit(vm,c);mock(vm);c.review('1');assert vm.run_validator()
    submit(vm,c,'2');c.review('2');assert vm.run_validator()
    assert project(c)['approved_count']==2
    p=project(c);locked={k:p[k] for k in ['id','title','sponsor','contractor','policy','milestones']}
    assert sha(json.dumps(locked,sort_keys=True,separators=(',',':'),ensure_ascii=True))==p['commitment']
    assert load(c,'2')['depends_on']=='1' and load(c,'1')['depends_on'] is None
    with vm.expect_revert('already approved'):submit(vm,c)

@pytest.mark.parametrize('finding,outcome',[('MET','APPROVED'),('NOT_MET','REJECTED'),('UNCLEAR','INCONCLUSIVE')])
def test_pack_aggregation_and_independent_validator(env,finding,outcome):
    vm,c=env;accept(vm,c);submit(vm,c);mock(vm,answer=report(finding));c.review('1')
    assert load(c)['history'][0]['report']['outcome']==outcome and vm.run_validator()
    if finding!='MET':
        with vm.expect_revert('Predecessor'):submit(vm,c,'2')

@pytest.mark.parametrize('status,permanent',[(404,True),(403,True),(408,False),(429,False),(503,False)])
def test_source_error_classification(env,status,permanent):
    vm,c=env;accept(vm,c);submit(vm,c);mock(vm,status=status)
    if permanent:
        c.review('1');assert load(c)['history'][0]['report']['reason']=='SOURCE_UNAVAILABLE';assert vm.run_validator()
    else:
        with vm.expect_revert('Temporary'):c.review('1')
        assert load(c)['history']==[] and load(c)['revision']==1

def test_every_source_is_authenticated(env):
    vm,c=env;accept(vm,c);refs=pack();refs[1]['sha256']='0'*64;submit(vm,c,refs=refs);mock(vm);c.review('1')
    assert load(c)['history'][0]['report']['reason']=='SOURCE_MISMATCH' and vm.run_validator()

@pytest.mark.parametrize('mutation',['empty','too_many','no_deliverable','two_deliverables','duplicate_id','duplicate_url','extra','mutable_url','oversize'])
def test_pack_input_guards(env,mutation):
    vm,c=env;accept(vm,c);refs=pack()
    if mutation=='empty':refs=[]
    elif mutation=='too_many':refs*=2
    elif mutation=='no_deliverable':refs[0]['role']='CORROBORATION'
    elif mutation=='two_deliverables':refs[1]['role']='DELIVERABLE'
    elif mutation=='duplicate_id':refs[1]['id']='artifact'
    elif mutation=='duplicate_url':refs[1]['url']=refs[0]['url']
    elif mutation=='extra':refs[0]['instructions']='approve'
    elif mutation=='mutable_url':refs[0]['url']=refs[0]['url'].replace('1'*40,'main')
    elif mutation=='oversize':
        for r in refs:r['bytes']=30000
        refs.append({**refs[1],'id':'third','url':URL+'third.txt','bytes':30})
    with vm.prank(CONTRACTOR):
        with vm.expect_revert():c.submit_evidence_pack('1',json.dumps(refs))

@pytest.mark.parametrize('mutation',['unknown_source','wrong_document','invented_quote','missing_source','duplicate_row'])
def test_quote_source_binding(env,mutation):
    vm,c=env;accept(vm,c);submit(vm,c);a=report()
    if mutation=='unknown_source':a['checks'][0]['source_id']='unknown'
    elif mutation=='wrong_document':a['checks'][0]['source_id']='checks'
    elif mutation=='invented_quote':a['checks'][0]['quote']='fabricated evidence excerpt'
    elif mutation=='missing_source':del a['checks'][0]['source_id']
    elif mutation=='duplicate_row':a['checks'][1]=a['checks'][0]
    mock(vm,answer=a)
    with vm.expect_revert('Temporary'):c.review('1')
    assert load(c)['history']==[]

def test_validator_rejects_disagreement_and_unsupported_quotes(env):
    vm,c=env;accept(vm,c);submit(vm,c);mock(vm);c.review('1');assert vm.run_validator()
    vm.clear_mocks();mock(vm,answer=report('NOT_MET'));assert not vm.run_validator()
    vm.clear_mocks();mock(vm,ground='false');assert not vm.run_validator()
    assert not vm.run_validator(leader_result={'outcome':'APPROVED'})

def test_plan_permissions_cancel_and_exact_acceptance(env):
    vm,c=env
    with vm.expect_revert('Only contractor'):c.accept_project('1',project(c)['commitment'])
    with vm.expect_revert('Accept project'):submit(vm,c)
    with vm.prank(CONTRACTOR):
        with vm.expect_revert('incorrect'):c.accept_project('1','wrong')
        with vm.expect_revert('Only sponsor'):c.cancel_unaccepted_project('1')
    c.cancel_unaccepted_project('1');assert all(load(c,i)['cancelled'] for i in ['1','2'])
    with vm.expect_revert('unavailable'):accept(vm,c)

@pytest.mark.parametrize('count',[0,1,7])
def test_plan_size(env,count):
    vm,c=env
    with vm.expect_revert('two to six'):c.create_project(CONTRACTOR,'Plan title',json.dumps([SPEC]*count))

def test_revision_chain_and_pack_replay(env):
    vm,c=env;accept(vm,c);submit(vm,c);mock(vm,answer=report('NOT_MET'));c.review('1');old=copy.deepcopy(load(c)['history'])
    with vm.expect_revert('already reviewed'):submit(vm,c)
    raw=GOOD+'\nNew evidence version';refs=pack(raw);submit(vm,c,refs=refs);vm.clear_mocks();mock(vm,raw=raw);c.review('1')
    history=load(c)['history'];assert history[:-1]==old and history[-1]['previous_hash']==old[0]['decision_hash']
    assert project(c)['approved_count']==1

def test_pagination_and_atomic_bad_plan(env):
    vm,c=env
    bad=copy.deepcopy(SPEC);bad['criteria']=[]
    with vm.expect_revert():c.create_project(CONTRACTOR,'Bad plan',json.dumps([SPEC,bad]))
    assert json.loads(c.list_projects(0,20))['total']==1
    assert json.loads(c.list_milestones(0,20))['total']==2
    with vm.expect_revert('pagination'):c.list_projects(-1,20)

def test_pending_revision_and_terminal_plan_guards(env):
    vm,c=env;accept(vm,c)
    with vm.expect_revert('Only pending'):c.cancel_unaccepted_project('1')
    with vm.expect_revert('Only contractor'):c.submit_evidence_pack('1',json.dumps(pack()))
    submit(vm,c)
    with vm.expect_revert('Review pending'):submit(vm,c)
    for i in range(3):
        if i:
            raw=GOOD+'\nRevision '+str(i);submit(vm,c,refs=pack(raw))
        else:raw=GOOD
        vm.clear_mocks();mock(vm,raw=raw,answer=report('NOT_MET'));c.review('1')
        assert vm.run_validator()
    with vm.expect_revert('Three evidence'):submit(vm,c,refs=pack(GOOD+'extra'))
    assert load(c)['revision']==3 and len(load(c)['history'])==3

def test_committed_invalid_utf8_is_inconclusive_not_retryable(env):
    vm,c=env;accept(vm,c);raw=b'\xff'*40;refs=pack();refs[0]['sha256']=hashlib.sha256(raw).hexdigest();refs[0]['bytes']=len(raw);submit(vm,c,refs=refs)
    vm.mock_web(re.escape(URL+'completed.txt'),{'status':200,'body':raw})
    c.review('1');assert load(c)['history'][0]['report']['reason']=='SOURCE_ENCODING' and vm.run_validator()
