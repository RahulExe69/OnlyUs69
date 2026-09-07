import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const DENSITIES = [
  { name: 'mdpi', size: 48, statSize: 24 },
  { name: 'hdpi', size: 72, statSize: 36 },
  { name: 'xhdpi', size: 96, statSize: 48 },
  { name: 'xxhdpi', size: 144, statSize: 72 },
  { name: 'xxxhdpi', size: 192, statSize: 96 }
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

// Android Status Bar Notification Small Icon: must be pure white on transparent
const ONLYUS_STAT_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
  <path fill="#FFFFFF" d="M48,80 C46.2,78.5 12,52 12,31 C12,18.8 21.8,9 34,9 C40.2,9 45.8,12 48,16.5 C50.2,12 55.8,9 62,9 C74.2,9 84,18.8 84,31 C84,52 49.8,78.5 48,80 Z" />
  <circle cx="68" cy="24" r="4.5" fill="#FFFFFF" />
  <circle cx="76" cy="18" r="2.5" fill="#FFFFFF" />
</svg>
`;

// Nusrat's Profile Avatar for Notifications: Romantic rose circular avatar with stylized portrait and 'N' monogram
const NUSRAT_AVATAR_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FB7185" />
      <stop offset="50%" stop-color="#E11D48" />
      <stop offset="100%" stop-color="#9F1239" />
    </linearGradient>
    <linearGradient id="innerGlow" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#4C0519" flood-opacity="0.3" />
    </filter>
  </defs>

  <!-- Circular Base -->
  <circle cx="256" cy="256" r="248" fill="url(#avatarGrad)" />
  <circle cx="256" cy="256" r="248" fill="url(#innerGlow)" />
  <circle cx="256" cy="256" r="244" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-opacity="0.4" />

  <!-- Stylized Floral / Heart Hair Garland Accent -->
  <path d="M190,140 Q256,110 322,140 Q300,165 256,160 Q212,165 190,140 Z" fill="#FFE4E6" opacity="0.9" />
  <circle cx="256" cy="138" r="14" fill="#FFFFFF" />
  <circle cx="220" cy="144" r="10" fill="#FECDD3" />
  <circle cx="292" cy="144" r="10" fill="#FECDD3" />
  <circle cx="195" cy="154" r="7" fill="#FDA4AF" />
  <circle cx="317" cy="154" r="7" fill="#FDA4AF" />

  <!-- Elegant Head & Neck Silhouette -->
  <circle cx="256" cy="205" r="54" fill="#FFF1F2" filter="url(#shadow)" />
  
  <!-- Flowing Hair waves -->
  <path d="M198,195 Q180,240 190,300 Q205,330 220,340 Q210,270 216,210 Z" fill="#4C0519" opacity="0.85" />
  <path d="M314,195 Q332,240 322,300 Q307,330 292,340 Q302,270 296,210 Z" fill="#4C0519" opacity="0.85" />
  <path d="M202,175 Q256,145 310,175 Q318,220 310,240 Q256,220 202,240 Z" fill="#881337" />

  <!-- Shoulder curve -->
  <path d="M150,380 C150,310 200,285 256,285 C312,285 362,310 362,380 C362,420 330,440 256,440 C182,440 150,420 150,380 Z" fill="#FFE4E6" filter="url(#shadow)" />

  <!-- Monogram Badge: 'N' with Heart -->
  <circle cx="360" cy="360" r="56" fill="#FFFFFF" filter="url(#shadow)" />
  <circle cx="360" cy="360" r="50" fill="#E11D48" />
  <text x="360" y="380" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="52" font-weight="900" fill="#FFFFFF" text-anchor="middle">N</text>
  <path d="M360,332 C358,330 350,323 350,317 C350,313 353,310 357,310 C359,310 360,312 360,313 C360,312 361,310 363,310 C367,310 370,313 370,317 C370,323 362,330 360,332 Z" fill="#FFFFFF" />
</svg>
`;

async function main() {
  const faviconPath = path.join(process.cwd(), 'public', 'favicon.webp');
  const rahulRes = path.join(process.cwd(), 'android', 'app', 'src', 'rahul', 'res');
  const nusratRes = path.join(process.cwd(), 'android', 'app', 'src', 'nusrat', 'res');
  const mainRes = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res');

  const notesBuffer = Buffer.from(NOTES_SVG);
  const statIconBuffer = Buffer.from(ONLYUS_STAT_SVG);
  const nusratAvatarBuffer = Buffer.from(NUSRAT_AVATAR_SVG);
  const faviconBuffer = fs.readFileSync(faviconPath);

  // 1. Generate Mipmap Launcher Icons
  for (const { name, size } of DENSITIES) {
    const mipmapName = `mipmap-${name}`;
    const rahulDir = path.join(rahulRes, mipmapName);
    const nusratDir = path.join(nusratRes, mipmapName);
    fs.mkdirSync(rahulDir, { recursive: true });
    fs.mkdirSync(nusratDir, { recursive: true });

    // Rahul Launcher Icons
    await sharp(faviconBuffer)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(rahulDir, 'ic_launcher.png'));

    await sharp(faviconBuffer)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(rahulDir, 'ic_launcher_round.png'));

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

    // Nusrat Launcher Icons
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

  // 2. Generate Drawable Icons for Notifications (both rahul & main)
  const drawableTargetDirs = [
    { base: mainRes },
    { base: rahulRes }
  ];

  for (const { name, size, statSize } of DENSITIES) {
    const drawableDensityName = `drawable-${name}`;

    for (const target of drawableTargetDirs) {
      const dir = path.join(target.base, drawableDensityName);
      fs.mkdirSync(dir, { recursive: true });

      // Small Status Bar Notification Icon (pure white silhouette)
      await sharp(statIconBuffer)
        .resize(statSize, statSize, { fit: 'contain' })
        .png()
        .toFile(path.join(dir, 'ic_stat_onlyus.png'));

      // Also create ic_stat_notify.png as an alias
      await sharp(statIconBuffer)
        .resize(statSize, statSize, { fit: 'contain' })
        .png()
        .toFile(path.join(dir, 'ic_stat_notify.png'));

      // Nusrat's Profile Avatar (Large Icon for notifications)
      await sharp(nusratAvatarBuffer)
        .resize(size, size, { fit: 'cover' })
        .png()
        .toFile(path.join(dir, 'ic_nusrat_avatar.png'));

      // Launcher icon in drawable (fallback so resolveSmallIcon & resolveLargeIcon find it)
      await sharp(faviconBuffer)
        .resize(size, size, { fit: 'cover' })
        .png()
        .toFile(path.join(dir, 'ic_launcher.png'));

      await sharp(faviconBuffer)
        .resize(size, size, { fit: 'cover' })
        .png()
        .toFile(path.join(dir, 'ic_launcher_round.png'));
    }
  }

  // Also write base drawable/ defaults in main and rahul
  for (const target of drawableTargetDirs) {
    const baseDrawable = path.join(target.base, 'drawable');
    fs.mkdirSync(baseDrawable, { recursive: true });

    await sharp(statIconBuffer)
      .resize(48, 48, { fit: 'contain' })
      .png()
      .toFile(path.join(baseDrawable, 'ic_stat_onlyus.png'));

    await sharp(statIconBuffer)
      .resize(48, 48, { fit: 'contain' })
      .png()
      .toFile(path.join(baseDrawable, 'ic_stat_notify.png'));

    await sharp(nusratAvatarBuffer)
      .resize(192, 192, { fit: 'cover' })
      .png()
      .toFile(path.join(baseDrawable, 'ic_nusrat_avatar.png'));

    await sharp(faviconBuffer)
      .resize(192, 192, { fit: 'cover' })
      .png()
      .toFile(path.join(baseDrawable, 'ic_launcher.png'));

    await sharp(faviconBuffer)
      .resize(192, 192, { fit: 'cover' })
      .png()
      .toFile(path.join(baseDrawable, 'ic_launcher_round.png'));
  }

  // 3. Setup mipmap-anydpi-v26 for both flavors
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

  console.log('Successfully generated all Android launcher icons, status bar icons, and avatar drawables for Rahul and Nusrat!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
