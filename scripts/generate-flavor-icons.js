import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const DENSITIES = [
  { name: 'mipmap-mdpi', size: 48 },
  { name: 'mipmap-hdpi', size: 72 },
  { name: 'mipmap-xhdpi', size: 96 },
  { name: 'mipmap-xxhdpi', size: 144 },
  { name: 'mipmap-xxxhdpi', size: 192 }
];

const NOTES_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFD646" />
      <stop offset="100%" stop-color="#F59E0B" />
    </linearGradient>
    <linearGradient id="sheetGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#FFFDF7" />
    </linearGradient>
  </defs>
  <rect x="32" y="32" width="448" height="448" rx="100" fill="url(#bgGrad)" />
  <rect x="96" y="88" width="320" height="340" rx="26" fill="url(#sheetGrad)" />
  <path d="M 96,114 A 26,26 0 0,1 122,88 L 390,88 A 26,26 0 0,1 416,114 L 416,156 L 96,156 Z" fill="#D97706" />
  <!-- Notepad spiral rings -->
  <circle cx="136" cy="88" r="9" fill="#78350F" />
  <circle cx="180" cy="88" r="9" fill="#78350F" />
  <circle cx="224" cy="88" r="9" fill="#78350F" />
  <circle cx="268" cy="88" r="9" fill="#78350F" />
  <circle cx="312" cy="88" r="9" fill="#78350F" />
  <circle cx="356" cy="88" r="9" fill="#78350F" />
  <circle cx="136" cy="88" r="5" fill="#FEF3C7" />
  <circle cx="180" cy="88" r="5" fill="#FEF3C7" />
  <circle cx="224" cy="88" r="5" fill="#FEF3C7" />
  <circle cx="268" cy="88" r="5" fill="#FEF3C7" />
  <circle cx="312" cy="88" r="5" fill="#FEF3C7" />
  <circle cx="356" cy="88" r="5" fill="#FEF3C7" />
  <!-- Lines -->
  <rect x="136" y="202" width="240" height="14" rx="7" fill="#D1D5DB" />
  <rect x="136" y="250" width="190" height="14" rx="7" fill="#D1D5DB" />
  <rect x="136" y="298" width="220" height="14" rx="7" fill="#D1D5DB" />
  <rect x="136" y="346" width="160" height="14" rx="7" fill="#D1D5DB" />
  <!-- Subtle Pen in bottom right -->
  <path d="M 320,380 L 376,324 L 396,344 L 340,400 Z" fill="#F59E0B" />
  <path d="M 314,406 L 320,380 L 340,400 Z" fill="#B45309" />
  <circle cx="316" cy="404" r="2" fill="#1F2937" />
</svg>
`;

async function main() {
  const faviconPath = path.join(process.cwd(), 'public', 'favicon.webp');
  const rahulRes = path.join(process.cwd(), 'android', 'app', 'src', 'rahul', 'res');
  const nusratRes = path.join(process.cwd(), 'android', 'app', 'src', 'nusrat', 'res');

  const notesBuffer = Buffer.from(NOTES_SVG);
  const faviconBuffer = fs.readFileSync(faviconPath);

  for (const { name, size } of DENSITIES) {
    const rahulDir = path.join(rahulRes, name);
    const nusratDir = path.join(nusratRes, name);
    fs.mkdirSync(rahulDir, { recursive: true });
    fs.mkdirSync(nusratDir, { recursive: true });

    // 1. Rahul Icons (from favicon.webp)
    await sharp(faviconBuffer)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(rahulDir, 'ic_launcher.png'));

    await sharp(faviconBuffer)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(rahulDir, 'ic_launcher_round.png'));

    // Foreground with slight inset padding (70% size for adaptive icon)
    const fgPadding = Math.round(size * 0.15);
    const fgInner = size - fgPadding * 2;
    await sharp(faviconBuffer)
      .resize(fgInner, fgInner, { fit: 'contain' })
      .extend({
        top: fgPadding,
        bottom: fgPadding,
        left: fgPadding,
        right: fgPadding,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(path.join(rahulDir, 'ic_launcher_foreground.png'));

    // 2. Nusrat Icons (Notes app)
    await sharp(notesBuffer)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(nusratDir, 'ic_launcher.png'));

    await sharp(notesBuffer)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(nusratDir, 'ic_launcher_round.png'));

    await sharp(notesBuffer)
      .resize(fgInner, fgInner, { fit: 'contain' })
      .extend({
        top: fgPadding,
        bottom: fgPadding,
        left: fgPadding,
        right: fgPadding,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(path.join(nusratDir, 'ic_launcher_foreground.png'));
  }

  // Also setup mipmap-anydpi-v26 for both flavors
  const rahulAnydpi = path.join(rahulRes, 'mipmap-anydpi-v26');
  const nusratAnydpi = path.join(nusratRes, 'mipmap-anydpi-v26');
  fs.mkdirSync(rahulAnydpi, { recursive: true });
  fs.mkdirSync(nusratAnydpi, { recursive: true });

  const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;

  fs.writeFileSync(path.join(rahulAnydpi, 'ic_launcher.xml'), adaptiveXml);
  fs.writeFileSync(path.join(rahulAnydpi, 'ic_launcher_round.xml'), adaptiveXml);
  fs.writeFileSync(path.join(nusratAnydpi, 'ic_launcher.xml'), adaptiveXml);
  fs.writeFileSync(path.join(nusratAnydpi, 'ic_launcher_round.xml'), adaptiveXml);

  console.log('Successfully generated all Android launcher icons for both Rahul and Nusrat flavors!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
