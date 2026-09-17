import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {decodeNativeOutput} from '../electron/encoding';
test('wsl.exe UTF-16LE messages decode with Korean intact',()=>{
 const message="Linux용 Windows 하위 시스템이 설치되어 있지 않습니다. 'wsl.exe --install'을 사용하여 설치할 수 있습니다.\r\n";
 assert.equal(decodeNativeOutput(Buffer.from(message,'utf16le')),message);
 assert.equal(decodeNativeOutput(Buffer.from('﻿Ubuntu\r\n','utf16le')),'Ubuntu\r\n');
});
test('Linux UTF-8 output passes through unchanged',()=>{
 const json='{"user":"muring","gitName":"홍길동"}\n';
 assert.equal(decodeNativeOutput(Buffer.from(json,'utf8')),json);
 assert.equal(decodeNativeOutput(Buffer.alloc(0)),'');
});
