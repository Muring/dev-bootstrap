// 본문 이미지를 post-images 버킷에 올린다. 경로 규칙은 mublog 의 /api/admin/upload 와 같다:
//   posts/<slug>/image-<N>-<8hex>.<ext>   (N 은 폴더 안 기존 번호 + 1)
// 사용: node upload-images.mjs <slug> <file...>  [--dry-run]
// 결과: 각 파일의 공개 URL 을 stdout 에 "<파일명> <URL>" 로 출력한다.
// 비밀값은 $MUBLOG/.env 에서 읽기만 한다. 출력하지 않는다.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { loadEnvFile } from "node:process";
import crypto from "node:crypto";

const mublog = process.env.MUBLOG_DIR || join(process.env.HOME, "dev", "mublog");
const require = createRequire(join(mublog, "package.json"));
const { createClient } = require("@supabase/supabase-js");
loadEnvFile(join(mublog, ".env"));

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const [slug, ...files] = args.filter((a) => a !== "--dry-run");
if (!slug || files.length === 0) {
  console.error("usage: node upload-images.mjs <slug> <file...> [--dry-run]");
  process.exit(2);
}
const types = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
const MAX = 4 * 1024 * 1024;

const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
}).storage.from("post-images");

const folder = `posts/${slug}`;
const { data: existing, error: listError } = await storage.list(folder);
if (listError) throw new Error(`목록 조회 실패: ${listError.message}`);
let n = 0;
for (const entry of existing ?? []) {
  const m = /^image-(\d+)-/.exec(entry.name);
  if (m) n = Math.max(n, Number(m[1]));
}

for (const file of files) {
  const ext = extname(file).toLowerCase();
  const contentType = types[ext];
  if (!contentType) throw new Error(`지원하지 않는 확장자: ${file}`);
  const bytes = readFileSync(file);
  if (bytes.length > MAX) throw new Error(`${file} 은 4MB 를 넘습니다 (${bytes.length} bytes)`);
  n += 1;
  const path = `${folder}/image-${n}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}${ext}`;
  if (dryRun) {
    console.log(`${basename(file)} -> ${path} (${bytes.length} bytes, dry-run)`);
    continue;
  }
  const { error } = await storage.upload(path, bytes, { contentType, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(`업로드 실패 ${file}: ${error.message}`);
  const { data } = storage.getPublicUrl(path);
  const res = await fetch(data.publicUrl);
  if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) throw new Error(`공개 URL 확인 실패: ${file}`);
  const downloaded = Buffer.from(await res.arrayBuffer());
  if (!downloaded.equals(bytes)) throw new Error(`바이트 불일치: ${file}`);
  console.log(`${basename(file)} ${data.publicUrl}`);
}
