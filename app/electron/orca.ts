import type { ProgressUpdate } from './progress';
import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export function installerAsset(release:any) {
  const asset=release?.assets?.find((entry:any)=>entry.name==='orca-windows-setup.exe');
  if(release?.draft||release?.prerelease||!asset||!/^sha256:[0-9a-f]{64}$/.test(asset.digest)||!Number.isSafeInteger(asset.size)||asset.size<=0||asset.size>1024**3)throw Error('공식 Orca 설치 파일의 크기·체크섬을 확인할 수 없습니다.');
  const url=new URL(asset.browser_download_url);
  if(url.origin!=='https://github.com'||!url.pathname.startsWith('/stablyai/orca/releases/download/')||!url.pathname.endsWith('/orca-windows-setup.exe')||url.search||url.hash)throw Error('공식 Orca 다운로드 주소가 아닙니다.');
  return {url:url.href,size:asset.size,sha256:asset.digest.slice(7),version:String(release.tag_name)};
}
// Download only the official stable Windows installer. Never silently install or update a running app.
export async function downloadOrca(directory:string, fetcher:typeof fetch=fetch,report:(update:ProgressUpdate)=>void=()=>{}) {
  report({label:'Orca 공식 최신 안정판과 체크섬 확인'});
  const response=await fetcher('https://api.github.com/repos/stablyai/orca/releases/latest',{headers:{Accept:'application/vnd.github+json','User-Agent':'dev-bootstrap'},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`Orca 배포 확인 실패 (HTTP ${response.status})`);
  const asset=installerAsset(await response.json());
  await fs.mkdir(directory,{recursive:true});
  const file=path.join(directory,'orca-windows-setup.exe');
  const partial=file+'.download';
  try {
    report({label:'Orca 설치 파일 다운로드',completed:0,total:asset.size,unit:'bytes'});
    const download=await fetcher(asset.url,{signal:AbortSignal.timeout(300000)});
    if(!download.ok||!download.body)throw Error(`Orca 다운로드 실패 (HTTP ${download.status})`);
    let size=0;
    const source=Readable.fromWeb(download.body as any);
    source.on('data',(chunk:Buffer)=>{size+=chunk.length;report({label:'Orca 설치 파일 다운로드',completed:size,total:asset.size,unit:'bytes'});if(size>asset.size)source.destroy(Error('Orca 설치 파일 크기가 다릅니다.'));});
    await pipeline(source,createWriteStream(partial,{flags:'w'}));
    report({label:'Orca 설치 파일 SHA-256 검증'});
    const hash=createHash('sha256');
    for await(const chunk of createReadStream(partial))hash.update(chunk);
    if(size!==asset.size||hash.digest('hex')!==asset.sha256)throw Error('Orca 설치 파일 체크섬 검증에 실패했습니다. 실행하지 않았습니다.');
    await fs.rm(file,{force:true});
    await fs.rename(partial,file);
    await fs.writeFile(path.join(directory,'orca-installer.json'),JSON.stringify(asset,null,2));
    return file;
  } finally {await fs.rm(partial,{force:true});}
}
