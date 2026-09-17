export function sectionSelection(raw, count) {
 if (raw == null) return Array.from({length:count},(_,i)=>i+1);
 const parts=raw.split(',');
 if (!parts.length||parts.some(v=>!/^\d+$/.test(v.trim()))) throw Error('--sections expects comma-separated section numbers, e.g. 2,5');
 const selected=[...new Set(parts.map(Number))].sort((a,b)=>a-b);
 if(selected.some(n=>n<1||n>count))throw Error(`--sections must be between 1 and ${count}`);
 return selected;
}
export function briefReport(report, reportPath) {
 return {passed:report.passed,scope:report.scope,sections:report.sections,report:reportPath,
  viewports:report.results.map(r=>r.viewport),hostViewports:report.shopify.map(r=>r.viewport),
  errorCount:report.errors.length,policyErrorCount:report.policyErrors.length,
  errors:report.errors.slice(0,5),policyErrors:report.policyErrors.slice(0,5),
  geometryFailureCount:[...report.results,...report.shopify].reduce((n,r)=>n+r.outOfBounds.length+r.inkOutOfBounds.length+r.referenceBounds.failures.length+r.typographyMismatches.length,0),
  note:report.scope==='partial'?'Selected-section geometry only; global structure/policy checked. Run full verification before delivery.':'Full configured viewport verification; inspect report for limitations.'};
}
