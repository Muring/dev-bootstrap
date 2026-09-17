export interface ProgressUpdate { label:string; completed?:number; total?:number; unit?:'items'|'bytes' }
export interface Operation { title:string; status:'running'|'completed'|'failed'|'waiting'|'cancelled'; startedAt:number; endedAt?:number; steps:{label:string; time:number; status:'running'|'completed'|'failed'|'waiting'|'cancelled'}[]; current:ProgressUpdate }
export class OperationTracker {
  value?:Operation;
  start(title:string){this.value={title,status:'running',startedAt:Date.now(),steps:[],current:{label:'작업 준비'}};this.report({label:'작업 준비'});}
  report(update:ProgressUpdate){
    const value=this.value;if(!value||value.status!=='running'||typeof update.label!=='string')return;
    const current:ProgressUpdate={label:update.label.slice(0,240)};
    if(Number.isFinite(update.total)&&update.total!>0&&Number.isFinite(update.completed)&&update.completed!>=0){current.total=update.total;current.completed=Math.min(update.completed!,update.total!);current.unit=update.unit==='bytes'?'bytes':'items';}
    if(value.current.label!==current.label||!value.steps.length){const last=value.steps.at(-1);if(last)last.status='completed';value.steps.push({label:current.label,time:Date.now(),status:'running'});if(value.steps.length>200)value.steps.shift();}
    value.current=current;
  }
  finish(status:Exclude<Operation['status'],'running'>){const value=this.value;if(!value||value.status!=='running')return;value.status=status;value.endedAt=Date.now();const last=value.steps.at(-1);if(last)last.status=status;}
}
