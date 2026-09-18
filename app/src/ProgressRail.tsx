import React, { useEffect, useState } from 'react';
import type { Operation } from '../electron/progress';
import type { InstallEvent } from '../electron/model';
const states = {
  running: '진행 중',
  completed: '작업 종료',
  failed: '실패',
  waiting: '사용자 작업 필요',
  cancelled: '취소됨',
};
export function ProgressRail({
  operation,
  busy,
  open,
  onToggle,
  events,
  labels,
}: {
  operation?: Operation;
  busy: boolean;
  open: boolean;
  onToggle(): void;
  events?: InstallEvent[];
  labels?: Record<string, string>;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [busy]);
  const current = operation?.current;
  const elapsed = Math.max(
    0,
    Math.floor(((operation?.endedAt || now) - (operation?.startedAt || now)) / 1000),
  );
  const status = operation?.status || (busy ? 'running' : 'idle');
  const clock = `${Math.floor(elapsed / 60)}분 ${elapsed % 60}초`;
  const counts =
    current?.total !== undefined
      ? current.unit === 'bytes'
        ? `${(current.completed! / 1048576).toFixed(1)} / ${(current.total / 1048576).toFixed(1)} MB · ${Math.floor((current.completed! / current.total) * 100)}%`
        : `${current.completed} / ${current.total} 항목 처리`
      : null;
  const toggle = (
    <button
      type="button"
      className="rail-toggle"
      aria-label={open ? '진행 상황 패널 접기' : '진행 상황 패널 펼치기'}
      aria-expanded={open}
      onClick={onToggle}>
      {open ? '›' : '‹'}
    </button>
  );
  if (!open)
    return (
      <div className="rail closed" role="complementary" aria-label="진행 상황 패널">
        {toggle}
        <span
          className={`rail-dot ${status}`}
          title={operation ? `${operation.title} · ${states[operation.status]}` : '실행한 작업 없음'}
        />
        {(operation || busy) && <span className="rail-clock">{clock}</span>}
      </div>
    );
  return (
    <div className="rail open" role="complementary" aria-label="진행 상황 패널">
      <div className="rail-heading">
        <span>진행 상황</span>
        {toggle}
      </div>
      <div className="rail-body">
        {!operation && !busy && <p className="rail-empty">이 단계에서 실행한 작업이 없습니다.</p>}
        {(operation || busy) && (
          <section
            className={`operation ${status}`}
            aria-label="작업 진행 상황"
            aria-busy={status === 'running'}>
            <div className="operation-heading">
              <strong>{operation?.title || '작업 준비'}</strong>
              <span>
                {states[status as keyof typeof states]} · {clock}
              </span>
            </div>
            <div className="operation-current" role="status">
              {current?.label || '요청을 전달하고 있습니다.'}
            </div>
            {status === 'running' &&
              (counts ? (
                <>
                  <progress aria-label="현재 작업 진행도" max={current!.total} value={current!.completed} />
                  <small>
                    {counts}
                    {current?.unit !== 'bytes' ? ' · 항목 수 기준이며 소요 시간 비율은 아닙니다.' : ''}
                  </small>
                </>
              ) : (
                <>
                  <progress aria-label="현재 작업 진행 중" />
                  <small>진행 수치를 제공하지 않는 작업입니다. 현재 과정과 경과 시간을 표시합니다.</small>
                </>
              ))}
            {!!operation?.steps.length && (
              <div className="rail-steps">
                <div className="rail-subheading">진행 과정 {operation.steps.length}개</div>
                <ol className="log-box" tabIndex={0} aria-label="작업 진행 이력">
                  {operation.steps.map((step, i) => (
                    <li key={i}>
                      <span>
                        {step.status === 'completed'
                          ? '✓'
                          : step.status === 'running'
                            ? '…'
                            : states[step.status]}
                      </span>
                      {step.label}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>
        )}
        {events && (
          <section className="log-panel" aria-label="설치 로그">
            <div className="log-heading">설치 진행 기록</div>
            <pre className="log-box" tabIndex={0}>
              {events.length
                ? events.map(e => `${labels?.[e.status] || e.status} · ${e.step} · ${e.message}`).join('\n')
                : '아직 기록이 없습니다.'}
            </pre>
          </section>
        )}
      </div>
    </div>
  );
}
