// Orca 창 캡처(PNG)에서 지정한 영역을 잘라내고, 내용이 있는 부분만 남긴 뒤 여백을 붙인다.
// 사용: node crop.js <in.png> <out.png> <left> <top> <width> <height> [pad=24]
// sharp 는 블로그 저장소($MUBLOG_DIR, 기본 ~/dev/mublog)의 node_modules 에서 가져온다.
// sharp.trim() 은 어두운 회색 글자가 있는 줄의 오른쪽을 잘라먹은 적이 있어 쓰지 않고,
// 배경색(맨 아래 행의 최빈색)과 다른 픽셀의 경계를 직접 구한다.
const path = require("node:path");
const mublog = process.env.MUBLOG_DIR || path.join(process.env.HOME, "dev", "mublog");
const sharp = require(path.join(mublog, "node_modules", "sharp"));
const [inp, out, l, t, w, h, padArg] = process.argv.slice(2);
if (!inp || !out || !l || !t || !w || !h) {
  console.error("usage: node crop.js <in.png> <out.png> <left> <top> <width> <height> [pad]");
  process.exit(2);
}
const pad = padArg === undefined ? 24 : Number(padArg);
(async () => {
  const buf = await sharp(inp).extract({ left: +l, top: +t, width: +w, height: +h }).png().toBuffer();
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;
  const counts = new Map();
  for (let x = 0; x < W; x++) {
    const i = ((H - 1) * W + x) * C;
    const k = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const [r, g, b] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0].split(",").map(Number);
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * C;
      if (Math.abs(data[i] - r) + Math.abs(data[i + 1] - g) + Math.abs(data[i + 2] - b) > 30) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error("영역에 배경 외 내용이 없습니다");
  const box = { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  await sharp(buf)
    .extract(box)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r, g, b } })
    .resize({ width: 1600, withoutEnlargement: true })
    .png()
    .toFile(out);
  const fin = await sharp(out).metadata();
  console.log(`${out} ${fin.width}x${fin.height} (bg ${r},${g},${b}; box ${JSON.stringify(box)})`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
