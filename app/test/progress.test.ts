import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { OperationTracker } from '../electron/progress';
test('progress records stages, bounded real counts and terminal states', () => {
  const tracker = new OperationTracker();
  tracker.start('환경 검사');
  tracker.report({ label: '도구 검사', completed: 1, total: 4 });
  tracker.report({ label: '도구 검사', completed: 2, total: 4 });
  assert.equal(tracker.value!.steps.length, 2);
  assert.equal(tracker.value!.current.completed, 2);
  tracker.report({ label: '외부 창 대기' });
  assert.equal(tracker.value!.current.total, undefined);
  tracker.finish('waiting');
  tracker.report({ label: 'late event' });
  assert.equal(tracker.value!.current.label, '외부 창 대기');
  tracker.start('재시도');
  tracker.report({ label: '다운로드', completed: 200, total: 100, unit: 'bytes' });
  assert.equal(tracker.value!.current.completed, 100);
  tracker.finish('failed');
  assert.equal(tracker.value!.steps.at(-1)!.status, 'failed');
  assert(tracker.value!.endedAt);
});
test('unknown or invalid totals never become fake percentage completion', () => {
  const tracker = new OperationTracker();
  tracker.start('작업');
  for (const total of [0, -1, NaN, Infinity]) {
    tracker.report({ label: '알 수 없음', completed: 1, total });
    assert.equal(tracker.value!.current.total, undefined);
  }
  tracker.finish('cancelled');
  assert.equal(tracker.value!.status, 'cancelled');
});
