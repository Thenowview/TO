#!/usr/bin/env python3
"""Fail-closed release readiness from independent receipts, not self-reported claims."""
from __future__ import annotations
import argparse,json,re,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from scripts.check_release import validate_release

STAGES=('source','windows','model','coding','browser','multi_agent')

def evaluate(source_log=None,windows_dist=None,model_report=None,browser_report=None,agent_report=None):
    report={'schema':'theorg-acceptance-v1','overall':'not_release_ready',
            'checks':{stage:{'status':'not_verified','evidence':None} for stage in STAGES}}
    checks=report['checks']
    if source_log:
        path=Path(source_log)
        if path.is_file():
            text=path.read_text(errors='replace')[-100000:]
            m=re.search(r'Ran\s+(\d+)\s+tests?\s+in\s+[\d.]+s\s+OK',text)
            checks['source']={'status':'passed' if m and int(m.group(1))>0 else 'failed',
                              'evidence':{'test_count':int(m.group(1)) if m else 0}}
    if windows_dist:
        result=validate_release(windows_dist)
        checks['windows']={'status':'passed' if result['status']=='passed' else 'failed',
                           'evidence':{'exe_sha256':result.get('exe_sha256'),
                                       'problems':result.get('problems')}}
    if model_report:
        file=Path(model_report)
        if file.is_file():
            try:
                data=json.loads(file.read_text())
                real=data.get('real_model_required') is True and data.get('model_calls_mocked') is False
                okay=(data.get('status')=='passed' and real and
                      type(data.get('hidden_test_count')) is int and data['hidden_test_count']>0 and
                      isinstance(data.get('verified_git_sha'),str) and
                      bool(re.fullmatch(r'[0-9a-f]{40}',data['verified_git_sha'])))
                checks['model']={'status':'passed' if okay else 'failed','evidence':{'real_model':real}}
                checks['coding']={'status':'passed' if okay else 'failed',
                                  'evidence':{'hidden_tests':data.get('hidden_test_count'),
                                              'commit':data.get('verified_git_sha')}}
            except (ValueError,TypeError,KeyError):
                checks['model']['status']='failed';checks['coding']['status']='failed'
    for stage,path in [('browser',browser_report),('multi_agent',agent_report)]:
        if not path:continue
        file=Path(path)
        if not file.is_file():continue
        try:
            data=json.loads(file.read_text())
            ev=data.get('checks')
            passed=(data.get('status')=='passed' and type(ev) is dict and len(ev)>=2 and
                    all(v is True for v in ev.values()))
            checks[stage]={'status':'passed' if passed else 'failed',
                           'evidence':{'checks':ev,'source':'provided external receipt'}}
        except (ValueError,TypeError,KeyError):
            checks[stage]['status']='failed'
    report['overall']='passed' if all(x['status']=='passed' for x in checks.values()) else 'not_release_ready'
    report['disclaimer']='Source tests, filename checks or synthetic model results alone cannot prove release readiness.'
    return report

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source-log',type=Path)
    p.add_argument('--windows-dist',type=Path)
    p.add_argument('--model-report',type=Path)
    p.add_argument('--browser-report',type=Path)
    p.add_argument('--agent-report',type=Path)
    p.add_argument('--output',type=Path)
    p.add_argument('--strict',action='store_true')
    a=p.parse_args()
    result=evaluate(a.source_log,a.windows_dist,a.model_report,a.browser_report,a.agent_report)
    data=json.dumps(result,indent=2,sort_keys=True)+'\n'
    if a.output:
        a.output.parent.mkdir(parents=True,exist_ok=True)
        a.output.write_text(data)
    print(data)
    return 1 if a.strict and result['overall']!='passed' else 0

if __name__=='__main__':raise SystemExit(main())
