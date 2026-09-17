import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { defaults } from '../electron/model';
const catalog=JSON.parse(fs.readFileSync('../shared/catalog.json','utf8'));
test.beforeEach(async({page})=>{
  const config=defaults(catalog);
  await page.addInitScript(({catalog,config})=>{
    const state:any={config,events:[],busy:false,phase:'configure',logPath:'test.log',inspection:{supported:true,wslReady:true,locationSupported:true,distros:[{name:'Ubuntu',location:'D:\\WSL\\Ubuntu',version:2}],drives:[{root:'D:\\',freeGB:415}],orcaInstalled:false,patchSupported:false,patchApplied:false,linux:{osId:'ubuntu',users:['muring'],user:'muring',zshrc:true,gitName:'',gitEmail:'',gitBranch:'main',timezone:'Asia/Seoul',auth:{gh:false,claude:false,codex:false},tools:{gh:true,claude:true,codex:true}}}};
    (window as any).bootstrap={snapshot:async()=>structuredClone(state),catalog:async()=>catalog,save:async(c:any)=>{state.config=c;return structuredClone(state)},inspect:async()=>structuredClone(state),prepare:async()=>({reboot:false}),install:async()=>({restartWsl:false}),run:async()=>{state.events=state.config.selected.map((step:string)=>({step,status:step==='kb'?'action-required':'completed',message:step==='kb'?'GitHub 로그인 필요':'실제 상태 확인 완료',time:Date.now()/1000,version:1}));state.events.push({step:'_run',status:'incomplete',message:'연결 대기',version:1,time:Date.now()/1000});return structuredClone(state)},stop:async()=>{},login:async(t:string)=>{state.inspection.linux.auth[t]=true;return structuredClone(state)},shutdown:async()=>structuredClone(state),reboot:async()=>{},logs:async()=>{}};
  },{catalog,config});
  await page.goto('/');
});
test('recommended choices preserve existing config and dependency deselection cascades',async({page})=>{
  await page.getByRole('button',{name:'설치 구성 선택 →'}).click();
  await expect(page.getByRole('checkbox')).toHaveCount(20);
  await expect(page.getByRole('checkbox',{name:'.zshrc 전체 교체',exact:false})).not.toBeChecked();
  await expect(page.getByRole('checkbox',{name:'Claude 권한 경고 생략',exact:false})).not.toBeChecked();
  await expect(page.getByRole('checkbox',{name:'Orca 1.4.202',exact:false})).toBeDisabled();
  await page.getByRole('checkbox',{name:'Node · fnm',exact:false}).uncheck();
  await expect(page.getByRole('checkbox',{name:'개인 지식 저장소',exact:false})).not.toBeChecked();
  await expect(page.getByRole('checkbox',{name:'Codex Recommended',exact:false})).not.toBeChecked();
  await page.getByRole('button',{name:'공통 개발환경',exact:false}).click();
  await expect(page.getByRole('checkbox',{name:'Node · fnm',exact:false})).toBeChecked();
  await expect(page.getByRole('checkbox',{name:'Orca 스킬 연결',exact:false})).not.toBeChecked();
});
test('review, progress, authentication, and incomplete summary are separate',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.getByRole('button',{name:'설치 구성 선택 →'}).click();
  await page.getByRole('button',{name:'변경 내용 확인 →'}).click();
  await expect(page.getByText('.zshrc 기존 내용 보존, 관리 블록 연결')).toBeVisible();
  await page.getByRole('button',{name:'선택한 항목 설치 시작'}).click();
  await expect(page.getByText('GitHub 로그인 필요',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'로그인 · 연동 →'}).click();
  await page.getByRole('button',{name:'로그인',exact:true}).first().click();
  await expect(page.getByText('연결 확인됨',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'결과 확인 · 로그인은 나중에'}).click();
  await expect(page.getByRole('heading',{name:'마무리할 항목이 있습니다'})).toBeVisible();
  expect(errors).toEqual([]);
});
