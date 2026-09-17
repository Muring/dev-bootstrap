import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { defaults } from '../electron/model';
const catalog=JSON.parse(fs.readFileSync('../shared/catalog.json','utf8'));
test.beforeEach(async({page})=>{
  const config=defaults(catalog);
  await page.addInitScript(({catalog,config})=>{
    const state:any={config,events:[],busy:false,phase:'configure',logPath:'test.log',inspection:{supported:true,wslReady:true,locationSupported:true,distros:[{name:'Ubuntu',location:'D:\\WSL\\Ubuntu',version:2}],drives:[{root:'D:\\',freeGB:415}],orcaInstalled:false,patchSupported:false,patchApplied:false,linux:{osId:'ubuntu',users:['muring'],user:'muring',zshrc:true,gitName:'',gitEmail:'',gitBranch:'main',timezone:'Asia/Seoul',auth:{gh:false,claude:false,codex:false},tools:{gh:true,claude:true,codex:true}}}};
    (window as any).testState=state;
    (window as any).bootstrap={snapshot:async()=>structuredClone(state),catalog:async()=>catalog,save:async(c:any)=>{state.config=c;return structuredClone(state)},inspect:async()=>structuredClone(state),prepare:async()=>({reboot:false}),installOrca:async()=>{(window as any).orcaInstallerOpened=true;return structuredClone(state)},install:async()=>({restartWsl:false}),previewContent:async()=>{state.config.contentCommit='a'.repeat(40);state.contentPreview={commit:state.config.contentCommit,message:'공용 명령 업데이트',commands:['commit'],skills:['commit'],changes:[{path:'skills/commit/SKILL.md',status:'modified'}]};return structuredClone(state)},updateContent:async()=>{(window as any).contentApplied=true;return structuredClone(state)},run:async(target?:string)=>{(window as any).installerRan=true;state.events=state.config.selected.map((step:string)=>({step,status:step==='kb'&&!target?'action-required':'completed',message:step==='kb'&&!target?'GitHub 로그인 필요':'실제 상태 확인 완료',time:Date.now()/1000,version:1}));state.events.push({step:'_run',status:'incomplete',message:'연결 대기',version:1,time:Date.now()/1000});return structuredClone(state)},stop:async()=>{},login:async(t:string)=>{state.inspection.linux.auth[t]=true;return structuredClone(state)},shutdown:async()=>structuredClone(state),reboot:async()=>{},logs:async()=>{}};
  },{catalog,config});
  await page.goto('/');
});
test('recommended choices preserve existing config and dependency deselection cascades',async({page})=>{
  await page.getByRole('button',{name:'설치 구성 선택 →'}).click();
  await expect(page.getByRole('checkbox')).toHaveCount(21);
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
  await expect(page.getByRole('button',{name:'설치 완료 확인'})).toBeDisabled();
  for(const button of await page.getByRole('button',{name:'로그인',exact:true}).all())await button.click();
  await page.getByRole('button',{name:'KB 연결 재시도'}).click();
  await page.getByRole('button',{name:'설치 완료 확인'}).click();
  await expect(page.getByRole('heading',{name:'선택한 도구를 준비했습니다'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('content update requires preview and does not run installer',async({page})=>{
  await page.getByRole('button',{name:'커맨드 · 스킬 업데이트',exact:false}).click();
  await expect(page.getByRole('button',{name:'확인한 버전 적용'})).toBeDisabled();
  await page.getByRole('button',{name:'업데이트 확인',exact:true}).click();
  await expect(page.getByText('a'.repeat(40),{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'확인한 버전 적용'}).click();
  expect(await page.evaluate(()=>(window as any).contentApplied)).toBe(true);
  expect(await page.evaluate(()=>(window as any).installerRan)).toBeUndefined();
});
test('changing content targets requires another preview',async({page})=>{
  await page.getByRole('button',{name:'커맨드 · 스킬 업데이트',exact:false}).click();
  await page.getByRole('button',{name:'업데이트 확인',exact:true}).click();
  await expect(page.getByRole('button',{name:'확인한 버전 적용'})).toBeEnabled();
  await page.getByRole('button',{name:'대상 선택 변경'}).click();
  await page.getByRole('checkbox',{name:'Codex 공용 스킬',exact:false}).uncheck();
  await page.getByRole('button',{name:'커맨드 · 스킬 업데이트',exact:false}).click();
  await expect(page.getByRole('button',{name:'확인한 버전 적용'})).toBeDisabled();
});

test('future stages stay locked and installer is launched only on request',async({page})=>{
  for(const name of ['변경 내용 확인','설치 진행','로그인 · 연동','완료'])await expect(page.locator('nav').getByRole('button',{name,exact:false})).toBeDisabled();
  await page.getByRole('button',{name:'Orca 다운로드 · 설치'}).click();
  expect(await page.evaluate(()=>(window as any).orcaInstallerOpened)).toBe(true);
  expect(await page.evaluate(()=>(window as any).installerRan)).toBeUndefined();
});
test('only body scrolls at the minimum window size',async({page})=>{
  await page.setViewportSize({width:900,height:650});
  await page.getByRole('button',{name:'설치 구성 선택 →'}).click();
  const heading=page.getByRole('heading',{name:'설치 구성',exact:true});
  const next=page.getByRole('button',{name:'변경 내용 확인 →'});
  const before=await heading.boundingBox();const buttonBefore=await next.boundingBox();
  await page.locator('.page-content').evaluate(el=>el.scrollTop=el.scrollHeight);
  expect(await heading.boundingBox()).toEqual(before);
  expect(await next.boundingBox()).toEqual(buttonBefore);
  expect(await page.evaluate(()=>window.scrollY)).toBe(0);
  expect(await page.locator('.page-content').evaluate(el=>el.scrollTop)).toBeGreaterThan(500);
  expect(buttonBefore!.y+buttonBefore!.height).toBeLessThan(650);
  await page.screenshot({path:'test-results/fixed-layout.png'});
});
test('editing the inspected account locks configuration and updates',async({page})=>{
  await page.getByLabel('Ubuntu 사용자명',{exact:true}).fill('another');
  await expect(page.getByRole('button',{name:'설치 구성 선택 →'})).toBeDisabled();
  await expect(page.locator('nav').getByRole('button',{name:'커맨드 · 스킬 업데이트',exact:false})).toBeDisabled();
});
