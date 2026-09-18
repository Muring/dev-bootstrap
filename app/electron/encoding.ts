// wsl.exe writes its own messages (errors, --help, -l) as UTF-16LE without BOM, while
// Linux-side commands run through it write UTF-8. Detect by the NUL bytes UTF-16 leaves
// in ASCII, instead of stripping them and mangling non-ASCII text.
export function decodeNativeOutput(buffer: Buffer): string {
  const text = buffer.includes(0) ? buffer.toString('utf16le') : buffer.toString('utf8');
  return text.replace(/^﻿/, '');
}
