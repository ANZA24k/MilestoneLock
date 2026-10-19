import copy, hashlib, json, re
from pathlib import Path
import pytest
from gltest.direct import VMContext, deploy_contract
ROOT=Path(__file__).parents[1]
SPEC=json.loads((ROOT/'examples/specification.json').read_text())
GOOD=(ROOT/'examples/completed.txt').read_text()
BAD=(ROOT/'examples/incomplete.txt').read_text()
SPONSOR='0x'+'a'*40
CONTRACTOR='0x'+'b'*40
REVIEWER='0x'+'c'*40
URL='https://raw.githubusercontent.com/ANZA24k/MilestoneLock/'+'1'*40+'/examples/completed.txt'
def sha(raw):return hashlib.sha256(raw.encode()).hexdigest()
def report(finding='MET'):
    return {'checks':[{'id':c['id'],'finding':finding,'quote':'<label for="email">Email</label>'} for c in SPEC['criteria']], 'evidence_rules':'MET'}
@pytest.fixture
def env():
    vm=VMContext()
    with vm.activate():
        vm.sender=SPONSOR
        c=deploy_contract(ROOT/'contracts/milestone_lock.py',vm,sdk_version='v0.2.16')
        c.create_milestone(CONTRACTOR,json.dumps(SPEC))
        yield vm,c

def load(c):return json.loads(c.get_milestone('1'))
def accept(vm,c):
    with vm.prank(CONTRACTOR):c.accept_milestone('1',load(c)['commitment'])
def submit(vm,c,raw=GOOD,hash_=None,url=URL):
    with vm.prank(CONTRACTOR):c.submit_evidence('1',url,hash_ or sha(raw),len(raw.encode()))
def mock(vm,raw=GOOD,answer=None,status=200,ground='true'):
    vm.mock_web(re.escape(URL),{'status':status,'body':raw})
    vm.mock_llm('independently assess a locked project milestone',json.dumps(answer or report()))
    vm.mock_llm('Validate every proposed finding',ground)

def test_full_lifecycle_independent_reviewer(env):
    vm,c=env;accept(vm,c);submit(vm,c);mock(vm)
    with vm.prank(REVIEWER):c.review('1')
    r=load(c);assert r['history'][0]['report']['outcome']=='APPROVED'
    assert r['history'][0]['reviewer']==REVIEWER and vm.run_validator()
    h=r['history'][0];expected=h.pop('decision_hash')
    assert expected==sha(json.dumps(h,sort_keys=True,separators=(',',':'),ensure_ascii=True))
    with vm.expect_revert('already approved'):submit(vm,c,BAD)

@pytest.mark.parametrize('finding,outcome',[('MET','APPROVED'),('NOT_MET','REJECTED'),('UNCLEAR','INCONCLUSIVE')])
def test_aggregation(env,finding,outcome):
    vm,c=env;accept(vm,c);submit(vm,c);mock(vm,answer=report(finding));c.review('1')
    assert load(c)['history'][0]['report']['outcome']==outcome and vm.run_validator()

def test_uncertainty_prevents_settlement(env):
    vm,c=env;accept(vm,c);submit(vm,c);a=report('NOT_MET');a['checks'][0]['finding']='UNCLEAR';mock(vm,answer=a);c.review('1')
    assert load(c)['history'][0]['report']['outcome']=='INCONCLUSIVE'

@pytest.mark.parametrize('kind',['hash','size','http','model','invented_quote','duplicate_json'])
def test_fail_closed(env,kind):
    vm,c=env;accept(vm,c);submit(vm,c,hash_='0'*64 if kind=='hash' else None)
    a=report();raw=GOOD;status=200
    if kind=='size':raw=GOOD+'x'
    if kind=='http':status=503
    if kind=='model':a={'bad':True}
    if kind=='invented_quote':a['checks'][0]['quote']='fabricated source excerpt'
    mock(vm,raw,a,status)
    if kind=='duplicate_json':
        vm.clear_mocks();vm.mock_web(re.escape(URL),{'status':200,'body':GOOD});vm.mock_llm('independently assess','{"checks":[],"checks":[],"evidence_rules":"MET"}')
    if kind in ['hash','size']:
        c.review('1');assert load(c)['history'][0]['report']['reason']=='SOURCE_MISMATCH';assert vm.run_validator()
    else:
        with vm.expect_revert('Temporary'):c.review('1')
        assert load(c)['history']==[]

@pytest.mark.parametrize('url',['http://127.0.0.1/a.txt','https://evil.example/a.txt',URL.replace('1'*40,'main'),URL+'?x=1',URL.replace('/examples/','/../'),URL.replace('/examples/','//'),URL.replace('https://','https://u:p@'),URL.replace('.com/','.com:443/')])
def test_source_restrictions(env,url):
    vm,c=env;accept(vm,c)
    with vm.expect_revert():submit(vm,c,url=url)

def test_access_and_acceptance(env):
    vm,c=env
    with vm.expect_revert('Only contractor'):c.accept_milestone('1',load(c)['commitment'])
    with vm.expect_revert('Accept milestone'):submit(vm,c)
    with vm.prank(CONTRACTOR):
        with vm.expect_revert('incorrect'):c.accept_milestone('1','wrong')
    accept(vm,c)
    with vm.expect_revert('Only pending'):c.cancel_unaccepted('1')
    with vm.expect_revert('Only contractor'):c.submit_evidence('1',URL,sha(GOOD),len(GOOD.encode()))
    submit(vm,c)
    with vm.expect_revert('pending evidence'):submit(vm,c,BAD)
    mock(vm);c.review('1')
    with vm.expect_revert('No pending'):c.review('1')

def test_cancellation(env):
    vm,c=env;c.cancel_unaccepted('1')
    with vm.expect_revert('unavailable'):accept(vm,c)

@pytest.mark.parametrize('mutation',['duplicate','missing','too_many','bad_id','extra','long','same_actor','zero'])
def test_specification_guards(env,mutation):
    vm,c=env;s=copy.deepcopy(SPEC);contractor=CONTRACTOR
    if mutation=='duplicate':s['criteria'][1]['id']=s['criteria'][0]['id']
    elif mutation=='missing':s['criteria']=[]
    elif mutation=='too_many':s['criteria']*=3
    elif mutation=='bad_id':s['criteria'][0]['id']='bad id'
    elif mutation=='extra':s['unexpected']='field'
    elif mutation=='long':s['title']='x'*121
    elif mutation=='same_actor':contractor=SPONSOR
    elif mutation=='zero':contractor='0x'+'0'*40
    with vm.expect_revert():c.create_milestone(contractor,json.dumps(s))

def test_append_only_and_revision_limit(env):
    vm,c=env;accept(vm,c);snapshots=[]
    for i in range(3):
        raw=GOOD+'\nrevision '+str(i);submit(vm,c,raw);vm.clear_mocks();mock(vm,raw,report('NOT_MET'));c.review('1')
        history=load(c)['history'];assert history[:-1]==snapshots;snapshots=copy.deepcopy(history)
        assert history[-1]['previous_hash']==(history[-2]['decision_hash'] if i else load(c)['commitment'])
    with vm.expect_revert('Three evidence'):submit(vm,c,BAD)

def test_validator_rejects_disagreement_changed_source_and_unsupported_quotes(env):
    vm,c=env;accept(vm,c);submit(vm,c);mock(vm);c.review('1');assert vm.run_validator()
    assert not vm.run_validator(leader_result={'outcome':'APPROVED'})
    vm.clear_mocks();mock(vm,answer=report('NOT_MET'));assert not vm.run_validator()
    vm.clear_mocks();mock(vm,raw=BAD);assert not vm.run_validator()
    vm.clear_mocks();mock(vm,ground='false');assert not vm.run_validator()
    assert not vm.run_validator(leader_error=ValueError('fake'))

def test_pagination_and_duplicate_evidence(env):
    vm,c=env;assert json.loads(c.list_milestones(0,20))['total']==1
    with vm.expect_revert('pagination'):c.list_milestones(-1,20)
    accept(vm,c);submit(vm,c);mock(vm,answer=report('NOT_MET'));c.review('1')
    with vm.expect_revert('already reviewed'):submit(vm,c)

def test_model_metadata_and_row_order_are_normalized(env):
    vm,c=env;accept(vm,c);submit(vm,c);answer=report();answer['note']='Non-authoritative metadata';answer['checks'].reverse();answer['checks'][0]['explanation']='Ignored metadata';mock(vm,answer=answer);c.review('1')
    result=load(c)['history'][0]['report'];assert result['outcome']=='APPROVED';assert [r['id'] for r in result['checks']]==[r['id'] for r in SPEC['criteria']];assert vm.run_validator()

def test_duplicate_model_criterion_is_not_accepted(env):
    vm,c=env;accept(vm,c);submit(vm,c);answer=report();answer['checks'][1]=answer['checks'][0];mock(vm,answer=answer)
    with vm.expect_revert('Temporary'):c.review('1')
