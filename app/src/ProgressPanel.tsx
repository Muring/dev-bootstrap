import React, { useEffect, useState } from 'react';
import type { Operation } from '../electron/progress';
export function ProgressPanel({operation,busy}:{operation?:Operation;busy:boolean}) {
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{if(!busy)return;const timer=setInterval(()=>setNow(Date.now()),500);return()=>clearInterval(timer);},[busy]);
  if(!operation&&!busy)return null;
  const current=operation?.current;
  const elapsed=Math.max(0,Math.floor(((operation?.endedAt||now)-(operation?.startedAt||now))/1000));
  const status=operation?.status||'running';
  const states={running:'진행 중',completed:'작업 종료',failed:'실패',waiting:'사용자 작업 필요',cancelled:'취소됨'};
  const counts=current?.total!==undefined?current.unit==='bytes'?`${(current.completed!/1048576).toFixed(1)} / ${(current.total/1048576).toFixed(1)} MB · ${Math.floor(current.completed!/current.total*100)}%`:`${current.completed} / ${current.total} 항목 처리`:null;
  return <section className={`operation ${status}`} aria-label="작업 진행 상황" aria-busy={status==='running'}>
    <div className="operation-heading"><strong>{operation?.title||'작업 준비'}</strong><span>{states[status]} · {Math.floor(elapsed/60)}분 {elapsed%60}초</span></div>
    <div className="operation-current" role="status">{current?.label||'요청을 전달하고 있습니다.'}</div>
    {status==='running'&&(counts?<><progress aria-label="현재 작업 진행도" max={current!.total} value={current!.completed}/><small>{counts}{current?.unit!=='bytes'?' · 항목 수 기준이며 소요 시간 비율은 아닙니다.':''}</small></>:<><progress aria-label="현재 작업 진행 중"/><small>진행 수치를 제공하지 않는 작업입니다. 현재 과정과 경과 시간을 표시합니다.</small></>)}
    {!!operation?.steps.length&&<details><summary>진행 과정 {operation.steps.length}개</summary><ol>{operation.steps.map((step,i)=><li key={i}><span>{step.status==='completed'?'✓':step.status==='running'?'…':states[step.status]}</span>{step.label}</li>)}</ol></details>}
  </section>;
}
