import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { downloadOrca } from './orca';
import { Config, ContentPreview, CONTENT_GROUPS, defaults, Inspection, InstallEvent, Item, Snapshot, validate } from './model';

let window: BrowserWindow;
let catalog: Item[];
let config: Config;
let inspection: Inspection | undefined;
let busy = false;
let phase = 'inspect';
let currentEvents = '';
let stateDir: string;
let assets: string;
let contentPreview: ContentPreview | undefined;
let contentTarget = '';

function contentKey(value: Config) {
  return JSON.stringify([value.distro,value.user,value.selected.filter(id=>CONTENT_GROUPS.includes(id)).sort()]);
}

async function atomic(file: string, value: unknown) {
  const temp = file + '.tmp';
  await fs.writeFile(temp, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(temp, file);
}
async function persist() { await atomic(path.join(stateDir, 'state.json'), {config, phase, currentEvents}); }
async function capture(executable: string, args: string[], timeout = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {windowsHide:true, shell:false});
    const stdout: Buffer[] = []; const stderr: Buffer[] = [];
    const timer = setTimeout(() => { child.kill(); reject(Error('명령 실행 시간이 초과되었습니다.')); }, timeout);
    child.stdout.on('data', chunk => stdout.push(chunk));
    child.stderr.on('data', chunk => stderr.push(chunk));
    child.on('error', error => {clearTimeout(timer); reject(error);});
    child.on('close', code => {clearTimeout(timer); code === 0 ? resolve(Buffer.concat(stdout).toString('utf8').replace(/\0/g,'')) : reject(Error(Buffer.concat(stderr).toString('utf8').replace(/\0/g,'') || `명령 실패 (${code})`));});
  });
}
async function helper(action: string, extra: Record<string, unknown> = {}): Promise<Record<string, any>> {
  if (process.platform !== 'win32') throw Error('실제 설치는 Windows에서 실행하세요.');
  const id = crypto.randomUUID();
  const requestFile = path.join(stateDir, `${id}.request.json`);
  const resultFile = path.join(stateDir, `${id}.result.json`);
  await atomic(requestFile, {action, ...extra});
  // No execution deadline for visible login/install terminals. User can finish them.
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(assets,'windows/app-host.ps1'),'-RequestFile',requestFile,'-ResultFile',resultFile], {windowsHide:true, stdio:'ignore', shell:false});
    child.on('error', reject);
    child.on('close', async () => {
      try {
        const result = JSON.parse(await fs.readFile(resultFile,'utf8'));
        if (result.error) reject(Error(result.error)); else resolve(result);
      } catch (error) { reject(error); }
      finally { await Promise.all([requestFile, resultFile, requestFile+'.system.json'].map(file => fs.rm(file,{force:true}).catch(()=>{}))); }
    });
  });
}
async function linuxPath(windowsPath: string) {
  return (await capture('wsl.exe',['-d',config.distro,'-u',config.user,'--exec','wslpath','-a',windowsPath])).trim();
}
async function events(): Promise<InstallEvent[]> {
  if (!currentEvents) return [];
  try { return (await fs.readFile(currentEvents,'utf8')).split('\n').flatMap(line => {try {return [JSON.parse(line)];} catch {return [];}}); }
  catch {return [];}
}
async function appendEvent(step: string, status: string, message: string) {
  if (!currentEvents) currentEvents = path.join(stateDir, `run-${Date.now()}.jsonl`);
  await fs.appendFile(currentEvents, JSON.stringify({version:1, step,status,message,time:Date.now()/1000})+'\n');
}
async function snapshot(): Promise<Snapshot> {return {config, inspection, contentPreview, events:await events(), busy, phase, logPath:currentEvents.replace(/\.jsonl$/,'.log')};}
async function inspect() {
  if (process.platform !== 'win32') {
    inspection = {supported:false,wslReady:false,locationSupported:false,distros:[],drives:[],orcaInstalled:false,patchSupported:false,patchApplied:false,error:'Windows 11 x64에서 실행하세요. 이 화면은 개발용 미리보기입니다.'};
    return snapshot();
  }
  inspection = await helper('inspect') as Inspection;
  const distro = inspection.distros.find(i=>i.name === config.distro);
  if (distro) {
    try {
      const script = await linuxPath(path.join(assets,'linux/inspect.sh'));
      inspection.linux = JSON.parse(await capture('wsl.exe',['-d',config.distro,'-u',config.user,'--exec','bash',script],120000));
    } catch (error) {
      // Discover the existing default user rather than assume the Windows account name.
      try {
        const user = (await capture('wsl.exe',['-d',config.distro,'--exec','id','-un'])).trim();
        if (user !== 'root' && /^[a-z_][a-z0-9_-]{0,31}$/.test(user)) {
          config.user = user;
          const script = await linuxPath(path.join(assets,'linux/inspect.sh'));
          inspection.linux = JSON.parse(await capture('wsl.exe',['-d',config.distro,'-u',user,'--exec','bash',script],120000));
        } else inspection.error = '기존 Ubuntu의 개발 계정을 선택하세요. root는 설치 계정으로 사용할 수 없습니다.';
      } catch {inspection.error = `Ubuntu 확인 실패: ${String(error)}`;}
    }
    config.installLocation = distro.location;
    if (inspection.linux) {
      if (!config.gitName) config.gitName = inspection.linux.gitName;
      if (!config.gitEmail) config.gitEmail = inspection.linux.gitEmail;
    }
  }
  await persist();
  return snapshot();
}
async function guarded(action: () => Promise<unknown>) {
  if (busy) throw Error('진행 중인 작업이 끝난 후 다시 시도하세요.');
  busy = true;
  try {return await action();} finally {busy = false; await persist();}
}
async function confirm(message: string, detail: string) {
  return (await dialog.showMessageBox(window,{type:'question',buttons:['취소','진행'],defaultId:0,cancelId:0,message,detail})).response === 1;
}
async function previewContent() {
  await inspect();
  if (inspection?.linux?.osId !== 'ubuntu') throw Error('Ubuntu 환경 확인을 먼저 완료하세요.');
  const script=await linuxPath(path.join(assets,'linux/content.py'));
  const result=JSON.parse(await capture('wsl.exe',['-d',config.distro,'-u',config.user,'--exec','python3',script,'preview'],120000)) as ContentPreview;
  if(!/^[0-9a-f]{40}$/.test(result.commit)) throw Error('GitHub 커밋 확인에 실패했습니다.');
  contentPreview=result; contentTarget=contentKey(config);
  config.contentCommit=result.commit;
  await persist();
  return snapshot();
}
async function updateContent() {
  const groups=config.selected.filter(id=>CONTENT_GROUPS.includes(id));
  if (!groups.length) throw Error('설치 구성에서 커맨드·스킬 대상을 선택하세요.');
  if (!contentPreview || contentTarget!==contentKey(config) || config.contentCommit!==contentPreview.commit) throw Error('적용할 버전과 변경 내용을 먼저 확인하세요.');
  const script=await linuxPath(path.join(assets,'linux/content.py'));
  const directory=path.join(stateDir,`content-${Date.now()}`);
  await fs.mkdir(directory,{recursive:true});
  // Keep installation results in their existing log; this update has its own audit log.
  const log=path.join(directory,'result.json');
  try {
    const result=JSON.parse(await capture('wsl.exe',['-d',config.distro,'-u',config.user,'--exec','python3',script,'apply','--commit',contentPreview.commit,...groups.flatMap(group=>['--group',group])],300000));
    await atomic(log,{status:'completed',...result});
    for(const group of groups)await appendEvent(group,'completed',`GitHub ${result.commit.slice(0,12)} 적용 완료`);
    contentPreview={...contentPreview,installedCommit:result.commit,changes:[]};
    if(inspection?.linux)inspection.linux.contentCommit=result.commit;
    return snapshot();
  } catch(error) {
    await atomic(log,{status:'failed',message:String(error)});
    throw error;
  }
}
async function run(step?: string) {
  config = validate(config,catalog);
  if (step && (!catalog.some(i=>i.id===step) || !config.selected.includes(step))) throw Error('선택된 설치 항목만 실행할 수 있습니다.');
  if ((!step || CONTENT_GROUPS.includes(step)) && config.selected.some(id=>CONTENT_GROUPS.includes(id)) && !config.contentCommit) throw Error('변경 내용 확인 화면에서 커맨드·스킬 버전을 먼저 확인하세요.');
  await inspect();
  if (!inspection?.supported || !inspection.linux) throw Error('환경 확인과 Ubuntu 준비를 먼저 완료하세요.');
  if (inspection.linux.osId !== 'ubuntu') throw Error('이 설치기는 Ubuntu만 지원합니다.');
  if (inspection.distros.find(i=>i.name===config.distro)?.version !== 2) throw Error('WSL2 배포판을 선택하세요.');
  if ((!step || step==='orca-patch') && config.selected.includes('orca-patch') && !inspection.patchSupported) throw Error('현재 Orca 파일은 패치 대상이 아닙니다. 패치 선택을 해제하세요.');
  const directory = path.join(stateDir, `run-${Date.now()}`);
  await fs.mkdir(directory,{recursive:true});
  const configFile = path.join(directory,'config.json');
  currentEvents = path.join(directory,'events.jsonl');
  await atomic(configFile,config);
  phase = 'install';
  await persist();
  const script = await linuxPath(path.join(assets,'linux/app-launch.sh'));
  const result = await helper('launch',{config,script,arguments:[await linuxPath(configFile),await linuxPath(currentEvents),step || '']});
  const history = await events();
  if (!history.some(e=>e.step==='_run' && ['completed','incomplete','paused','failed'].includes(e.status))) {
    await appendEvent('_run','failed',`터미널이 종료되었습니다 (${result.exitCode}). sudo 인증과 터미널 출력을 확인하고 재시도하세요.`);
  }
  phase = 'connect';
  await inspect();
  return snapshot();
}

async function main() {
  if (!app.requestSingleInstanceLock()) {app.quit(); return;}
  await app.whenReady();
  stateDir = process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA!, 'dev-bootstrap') : path.join(app.getPath('userData'),'dev-bootstrap-preview');
  assets = app.isPackaged ? path.join(process.resourcesPath,'bootstrap') : path.resolve(__dirname,'../..');
  await fs.mkdir(stateDir,{recursive:true});
  catalog = JSON.parse(await fs.readFile(path.join(assets,'shared/catalog.json'),'utf8'));
  config = defaults(catalog);
  try {
    const state = JSON.parse(await fs.readFile(path.join(stateDir,'state.json'),'utf8'));
    config = validate(state.config,catalog); phase = state.phase; currentEvents = state.currentEvents || '';
    if (currentEvents && !path.resolve(currentEvents).startsWith(path.resolve(stateDir)+path.sep)) currentEvents='';
  } catch { /* First launch or invalid old state: use safe defaults. */ }
  window = new BrowserWindow({width:1160,height:850,minWidth:900,minHeight:650,backgroundColor:'#f5f7fa',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',event=>event.preventDefault());
  app.on('second-instance',()=>{window.show(); window.focus();});
  window.on('close',event=>{if(busy){event.preventDefault(); void dialog.showMessageBox(window,{message:'설치가 실행 중입니다.',detail:'현재 단계 후 중지를 누르고 실행 터미널이 끝날 때까지 기다려 주세요.'});}});
  ipcMain.handle('snapshot',snapshot);
  ipcMain.handle('catalog',()=>catalog);
  ipcMain.handle('save',async(_event,value)=>{if(busy)throw Error('설치 중에는 구성을 변경할 수 없습니다.'); const next=validate(value,catalog); if(contentKey(config)!==contentKey(next)){contentPreview=undefined;next.contentCommit='';} if(config.distro!==next.distro||config.user!==next.user)inspection=undefined; if(JSON.stringify(config)!==JSON.stringify(next)) currentEvents=''; config=next; await persist(); return snapshot();});
  ipcMain.handle('inspect',()=>guarded(inspect));
  ipcMain.handle('orca-install',()=>guarded(async()=>{
    const current=await helper('inspect') as Inspection;
    if(!current.supported)throw Error('Windows 11 x64에서 실행하세요.');
    if(current.orcaInstalled)throw Error('Orca가 이미 설치되어 있습니다. 업데이트는 Orca 앱에서 진행하세요.');
    const installer=await downloadOrca(path.join(stateDir,'downloads'));
    const error=await shell.openPath(installer);
    if(error)throw Error(`Orca 설치 창을 열지 못했습니다: ${error}`);
    return snapshot();
  }));
  ipcMain.handle('content-preview' ,()=>guarded(previewContent));
  ipcMain.handle('content-update',()=>guarded(updateContent));
  ipcMain.handle('prepare',()=>guarded(async()=>{const result=await helper('prepare'); phase=result.reboot?'reboot':'inspect'; await inspect(); return {reboot:result.reboot};}));
  ipcMain.handle('install',()=>guarded(async()=>{
    config=validate(config,catalog);
    const current=await helper('inspect') as Inspection;
    const existing=current.distros.find(i=>i.name===config.distro);
    if(existing && config.installLocation && existing.location.replace(/\\$/,'').toLowerCase()!==config.installLocation.replace(/\\$/,'').toLowerCase())throw Error('기존 Ubuntu는 자동 이동하지 않습니다. 현재 위치를 사용하세요.');
    if(existing && existing.version!==2)throw Error('WSL1 배포판입니다. 별도 백업 후 WSL2 전환을 진행하세요.');
    const result=await helper('install',{config}); phase=result.restartWsl?'wsl-restart':'configure'; await inspect(); return result;
  }));
  ipcMain.handle('run',(_event,step)=>guarded(()=>run(step)));
  ipcMain.handle('stop',async()=>{if(currentEvents && busy)await fs.writeFile(currentEvents.replace(/\.jsonl$/,'.stop'),'stop');});
  ipcMain.handle('login',(_event,tool)=>guarded(async()=>{
    if(!['gh','claude','codex'].includes(tool))throw Error('Unknown login target');
    const script=await linuxPath(path.join(assets,'linux/login.sh'));
    await helper('launch',{config,script,arguments:[tool]}); await inspect(); return snapshot();
  }));
  ipcMain.handle('shutdown',()=>guarded(async()=>{if(await confirm('WSL을 다시 시작할까요?','실행 중인 모든 WSL 작업이 종료됩니다. 작업을 저장하세요.')){await helper('shutdown');phase='configure';await inspect();}return snapshot();}));
  ipcMain.handle('reboot',()=>guarded(async()=>{if(await confirm('Windows를 재부팅할까요?','30초 후 재부팅합니다. 작업을 저장하고, 부팅 후 앱을 다시 열어 주세요.'))await helper('reboot');}));
  ipcMain.handle('logs',async()=>{await shell.openPath(stateDir);});
  await window.loadFile(path.join(__dirname,'../dist/index.html'));
}
void main().catch(error=>{dialog.showErrorBox('Dev Bootstrap',String(error));app.quit();});
app.on('window-all-closed',()=>{app.quit();});
