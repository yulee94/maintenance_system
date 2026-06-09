import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const mobileDir = path.join(root, "mobile");
const assetsDir = path.join(mobileDir, "assets");
const screenshotDir = path.join(mobileDir, "release", "screenshots", "ko-KR");

await fs.mkdir(assetsDir, { recursive: true });
await fs.mkdir(path.join(screenshotDir, "ios-6.7"), { recursive: true });
await fs.mkdir(path.join(screenshotDir, "android-phone"), { recursive: true });

await writePng("icon.png", iconSvg({ transparent: false }), 1024, 1024);
await writePng("adaptive-icon.png", iconSvg({ transparent: true }), 1024, 1024);
await writePng("splash-icon.png", splashSvg(), 1024, 1024);

const screens = [
  {
    file: "01-login",
    title: "역할별 테스트 계정",
    subtitle: "관리자, 정비사, 임원 화면을 바로 확인",
    items: ["ko.ms / 관리자", "jegal.ts / 정비사", "kim.ms / 임원"],
    accent: "#155eef"
  },
  {
    file: "02-today",
    title: "오늘 업무 현황",
    subtitle: "미결, 완료, 내 작업, 긴급 건을 한눈에 확인",
    items: ["미결 12건", "완료 8건", "긴급 P1 3건"],
    accent: "#11845b"
  },
  {
    file: "03-maintenance",
    title: "정비 완료보고",
    subtitle: "조치내용과 현장 사진을 첨부해 보고",
    items: ["장비 상태", "고장 부위", "교체 부품 사진"],
    accent: "#b25c00"
  },
  {
    file: "04-ai",
    title: "AI 업무 지원",
    subtitle: "유사 고장 이력과 보고서 초안 지원",
    items: ["반복 고장 경고", "권한별 자료 제한", "보고서 초안 작성"],
    accent: "#7047eb"
  }
];

for (const screen of screens) {
  await sharp(Buffer.from(storeScreenshotSvg(screen, 1290, 2796)))
    .png()
    .toFile(path.join(screenshotDir, "ios-6.7", `${screen.file}.png`));
  await sharp(Buffer.from(storeScreenshotSvg(screen, 1080, 1920)))
    .png()
    .toFile(path.join(screenshotDir, "android-phone", `${screen.file}.png`));
}

console.log("Generated mobile review assets.");

async function writePng(fileName, svg, width, height) {
  await sharp(Buffer.from(svg)).resize(width, height).png().toFile(path.join(assetsDir, fileName));
}

function iconSvg({ transparent }) {
  return `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="120" y1="80" x2="900" y2="940" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#155EEF"/>
      <stop offset="0.52" stop-color="#1F6F5F"/>
      <stop offset="1" stop-color="#0F172A"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="22" stdDeviation="28" flood-color="#07111f" flood-opacity="0.25"/>
    </filter>
  </defs>
  ${transparent ? "" : '<rect width="1024" height="1024" rx="220" fill="url(#bg)"/>'}
  ${transparent ? '<circle cx="512" cy="512" r="386" fill="url(#bg)"/>' : ""}
  <g filter="url(#shadow)">
    <path d="M326 318h372c45 0 82 37 82 82v256c0 45-37 82-82 82H326c-45 0-82-37-82-82V400c0-45 37-82 82-82Z" fill="#fff" opacity="0.96"/>
    <path d="M343 428h338M343 524h338M343 620h186" stroke="#172033" stroke-width="46" stroke-linecap="round"/>
    <path d="M614 634l55 55 128-151" fill="none" stroke="#16A34A" stroke-width="58" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

function splashSvg() {
  return `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="#F4F7FB"/>
  <g transform="translate(224 174)">
    ${iconSvg({ transparent: false }).match(/<defs>[\s\S]*<\/defs>|<g filter="url\(#shadow\)">[\s\S]*<\/g>/g)?.join("") ?? ""}
  </g>
  <text x="512" y="850" text-anchor="middle" font-family="Arial, Malgun Gothic, sans-serif" font-size="58" font-weight="800" fill="#172033">정비 운영</text>
</svg>`;
}

function storeScreenshotSvg(screen, width, height) {
  const phoneWidth = Math.round(width * 0.72);
  const phoneHeight = Math.round(height * 0.64);
  const phoneX = Math.round((width - phoneWidth) / 2);
  const phoneY = Math.round(height * 0.24);
  const safeX = phoneX + Math.round(phoneWidth * 0.08);
  const cardWidth = phoneWidth - Math.round(phoneWidth * 0.16);
  const topFont = Math.round(width * 0.055);
  const titleFont = Math.round(width * 0.065);
  const bodyFont = Math.round(width * 0.031);
  const itemGap = Math.round(phoneHeight * 0.1);

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${width}" y2="${height}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#F4F7FB"/>
      <stop offset="0.56" stop-color="#E8F1FF"/>
      <stop offset="1" stop-color="#E7F7EF"/>
    </linearGradient>
    <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#0f172a" flood-opacity="0.16"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <text x="${width * 0.1}" y="${height * 0.085}" font-family="Arial, Malgun Gothic, sans-serif" font-size="${topFont}" font-weight="800" fill="${screen.accent}">정비 운영</text>
  <text x="${width * 0.1}" y="${height * 0.145}" font-family="Arial, Malgun Gothic, sans-serif" font-size="${titleFont}" font-weight="900" fill="#172033">${escapeXml(screen.title)}</text>
  <text x="${width * 0.1}" y="${height * 0.19}" font-family="Arial, Malgun Gothic, sans-serif" font-size="${bodyFont}" font-weight="700" fill="#64748B">${escapeXml(screen.subtitle)}</text>

  <rect x="${phoneX}" y="${phoneY}" width="${phoneWidth}" height="${phoneHeight}" rx="${Math.round(phoneWidth * 0.09)}" fill="#101615"/>
  <rect x="${phoneX + 18}" y="${phoneY + 18}" width="${phoneWidth - 36}" height="${phoneHeight - 36}" rx="${Math.round(phoneWidth * 0.07)}" fill="#F8FAF9"/>
  <rect x="${safeX}" y="${phoneY + 72}" width="${cardWidth}" height="${Math.round(phoneHeight * 0.16)}" rx="22" fill="#FFFFFF" filter="url(#cardShadow)"/>
  <text x="${safeX + 36}" y="${phoneY + 130}" font-family="Arial, Malgun Gothic, sans-serif" font-size="${bodyFont}" font-weight="800" fill="#64748B">오늘의 핵심</text>
  <text x="${safeX + 36}" y="${phoneY + 190}" font-family="Arial, Malgun Gothic, sans-serif" font-size="${Math.round(bodyFont * 1.45)}" font-weight="900" fill="#172033">${escapeXml(screen.title)}</text>

  ${screen.items
    .map((item, index) => {
      const y = phoneY + Math.round(phoneHeight * 0.32) + index * itemGap;
      return `
        <rect x="${safeX}" y="${y}" width="${cardWidth}" height="${Math.round(phoneHeight * 0.075)}" rx="18" fill="#FFFFFF" filter="url(#cardShadow)"/>
        <circle cx="${safeX + 42}" cy="${y + Math.round(phoneHeight * 0.037)}" r="14" fill="${screen.accent}"/>
        <text x="${safeX + 78}" y="${y + Math.round(phoneHeight * 0.047)}" font-family="Arial, Malgun Gothic, sans-serif" font-size="${bodyFont}" font-weight="800" fill="#172033">${escapeXml(item)}</text>`;
    })
    .join("")}

  <rect x="${safeX}" y="${phoneY + Math.round(phoneHeight * 0.73)}" width="${cardWidth}" height="${Math.round(phoneHeight * 0.12)}" rx="22" fill="${screen.accent}"/>
  <text x="${safeX + 36}" y="${phoneY + Math.round(phoneHeight * 0.785)}" font-family="Arial, Malgun Gothic, sans-serif" font-size="${bodyFont}" font-weight="900" fill="#FFFFFF">현장 업무를 빠르게 확인</text>
  <text x="${safeX + 36}" y="${phoneY + Math.round(phoneHeight * 0.825)}" font-family="Arial, Malgun Gothic, sans-serif" font-size="${Math.round(bodyFont * 0.78)}" font-weight="700" fill="#DDEBFF">staging 심사용 화면 초안</text>
</svg>`;
}

function escapeXml(value) {
  return value.replace(/[<>&"']/g, (char) => {
    switch (char) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      case "'":
        return "&apos;";
      default:
        return char;
    }
  });
}
