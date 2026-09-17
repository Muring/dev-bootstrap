// Optional read-only smoke test for an already launched Windows build.
// Start the app with --remote-debugging-port=9337 and an isolated LOCALAPPDATA.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9337');
  const page = browser.contexts()[0].pages().find(p => p.url().startsWith('file:'));
  assert(page, 'App page missing');
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.getByRole('heading',{name:'환경 확인',exact:true}).waitFor();
  const result = await page.evaluate(async () => {
    const catalog=await window.bootstrap.catalog();
    const state=await window.bootstrap.inspect();
    return {catalog:catalog.length,supported:state.inspection.supported,wsl:state.inspection.wslReady,linux:!!state.inspection.linux,os:state.inspection.linux?.osId,error:state.inspection.error};
  });
  assert.equal(result.catalog,20);
  assert.equal(result.supported,true);
  assert.equal(result.wsl,true);
  assert.equal(result.linux,true,result.error);
  assert.equal(result.os,'ubuntu');
  assert.deepEqual(errors,[]);
  await page.getByRole('button',{name:'설치 구성 선택 →'}).click();
  await page.getByRole('heading',{name:'설치 구성',exact:true}).waitFor();
  assert.equal(await page.getByRole('checkbox').count(),20);
  await page.screenshot({path:require('node:path').join(process.env.TEMP,'dev-bootstrap-smoke.png'),fullPage:true});
  console.log('PASS: packaged Windows Electron app, sandbox preload, IPC, actual WSL inspection and configuration screen');
  await page.evaluate(()=>window.close());
  await browser.close();
})().catch(error=>{console.error(error);process.exitCode=1});
