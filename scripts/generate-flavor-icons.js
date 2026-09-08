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

// Realistic amber Notes app icon (full-bleed with amber gradient for legacy launcher)
const NOTES_FULL_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="fullBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FBBF24" />
      <stop offset="45%" stop-color="#F59E0B" />
      <stop offset="100%" stop-color="#D97706" />
    </linearGradient>
    <linearGradient id="sheetGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#FFFDF7" />
    </linearGradient>
    <linearGradient id="foldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F1F5F9" />
      <stop offset="100%" stop-color="#CBD5E1" />
    </linearGradient>
    <filter id="padShadow" x="-25%" y="-20%" width="150%" height="150%">
      <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#78350F" flood-opacity="0.30" />
    </filter>
  </defs>

  <!-- Full background for legacy square icons -->
  <rect x="0" y="0" width="512" height="512" fill="url(#fullBgGrad)" />

  <!-- Centered Notepad Sheet (Comfortably inside the 65% safe zone) -->
  <g filter="url(#padShadow)">
    <path d="M 152,128 L 314,128 L 368,182 L 368,384 A 20,20 0 0,1 348,404 L 172,404 A 20,20 0 0,1 152,384 Z" fill="url(#sheetGrad)" />
    <!-- Folded dog-ear corner -->
    <path d="M 314,128 L 314,182 L 368,182 Z" fill="url(#foldGrad)" />
    <path d="M 314,182 L 314,190 L 368,182 Z" fill="#94A3B8" opacity="0.3" />
  </g>

  <!-- Top accent header strip -->
  <rect x="174" y="152" width="124" height="10" rx="5" fill="#F59E0B" />

  <!-- Ruled notebook lines -->
  <rect x="174" y="194" width="168" height="9" rx="4.5" fill="#E2E8F0" />
  <rect x="174" y="234" width="140" height="9" rx="4.5" fill="#E2E8F0" />
  <rect x="174" y="274" width="156" height="9" rx="4.5" fill="#E2E8F0" />

  <!-- Checklist item: green check bullet + note title line -->
  <circle cx="184" cy="318" r="8" fill="#10B981" />
  <path d="M 180,318 L 183,321 L 188,315" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
  <rect x="200" y="314" width="108" height="9" rx="4.5" fill="#CBD5E1" />

  <!-- Stylized Pencil in bottom right corner -->
  <g transform="translate(328, 336) rotate(-42)">
    <rect x="-8" y="-36" width="16" height="50" rx="3" fill="#D97706" />
    <path d="M -8,14 L 0,30 L 8,14 Z" fill="#FDE68A" />
    <polygon points="-2.5,25 0,30 2.5,25" fill="#1F2937" />
    <rect x="-8" y="-46" width="16" height="10" rx="3" fill="#F43F5E" />
  </g>
</svg>
`;

// Adaptive Foreground for Notes: Transparent background with the notepad centered in safe zone
const NOTES_FOREGROUND_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="sheetGradFg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#FFFDF7" />
    </linearGradient>
    <linearGradient id="foldGradFg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F1F5F9" />
      <stop offset="100%" stop-color="#CBD5E1" />
    </linearGradient>
    <filter id="padShadowFg" x="-25%" y="-20%" width="150%" height="150%">
      <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#78350F" flood-opacity="0.32" />
    </filter>
  </defs>

  <!-- Centered Notepad Sheet (Comfortably inside the 65% safe zone) -->
  <g filter="url(#padShadowFg)">
    <path d="M 152,128 L 314,128 L 368,182 L 368,384 A 20,20 0 0,1 348,404 L 172,404 A 20,20 0 0,1 152,384 Z" fill="url(#sheetGradFg)" />
    <!-- Folded dog-ear corner -->
    <path d="M 314,128 L 314,182 L 368,182 Z" fill="url(#foldGradFg)" />
    <path d="M 314,182 L 314,190 L 368,182 Z" fill="#94A3B8" opacity="0.3" />
  </g>

  <!-- Top accent header strip -->
  <rect x="174" y="152" width="124" height="10" rx="5" fill="#F59E0B" />

  <!-- Ruled notebook lines -->
  <rect x="174" y="194" width="168" height="9" rx="4.5" fill="#E2E8F0" />
  <rect x="174" y="234" width="140" height="9" rx="4.5" fill="#E2E8F0" />
  <rect x="174" y="274" width="156" height="9" rx="4.5" fill="#E2E8F0" />

  <!-- Checklist item: green check bullet + note title line -->
  <circle cx="184" cy="318" r="8" fill="#10B981" />
  <path d="M 180,318 L 183,321 L 188,315" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
  <rect x="200" y="314" width="108" height="9" rx="4.5" fill="#CBD5E1" />

  <!-- Stylized Pencil in bottom right corner -->
  <g transform="translate(328, 336) rotate(-42)">
    <rect x="-8" y="-36" width="16" height="50" rx="3" fill="#D97706" />
    <path d="M -8,14 L 0,30 L 8,14 Z" fill="#FDE68A" />
    <polygon points="-2.5,25 0,30 2.5,25" fill="#1F2937" />
    <rect x="-8" y="-46" width="16" height="10" rx="3" fill="#F43F5E" />
  </g>
</svg>
`;

// Clean, elegant Nusrat initial avatar fallback (only used if Nusrat has not uploaded a real photo yet)
const NUSRAT_AVATAR_FALLBACK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F43F5E" />
      <stop offset="50%" stop-color="#E11D48" />
      <stop offset="100%" stop-color="#9F1239" />
    </linearGradient>
  </defs>
  <circle cx="256" cy="256" r="256" fill="url(#avatarGrad)" />
  <circle cx="256" cy="256" r="250" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-opacity="0.3" />
  <text x="256" y="325" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="210" font-weight="700" fill="#FFFFFF" text-anchor="middle">N</text>
</svg>
`;

async function main() {
  const faviconPath = path.join(process.cwd(), 'public', 'favicon.webp');
  const rahulRes = path.join(process.cwd(), 'android', 'app', 'src', 'rahul', 'res');
  const nusratRes = path.join(process.cwd(), 'android', 'app', 'src', 'nusrat', 'res');
  const mainRes = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res');

  const notesFullBuffer = Buffer.from(NOTES_FULL_SVG);
  const notesForegroundBuffer = Buffer.from(NOTES_FOREGROUND_SVG);
  const nusratAvatarFallbackBuffer = Buffer.from(NUSRAT_AVATAR_FALLBACK_SVG);
  const faviconBuffer = fs.readFileSync(faviconPath);

  console.log('🚀 Generating Android launcher & notification assets...');

  // 1. Generate Mipmap Launcher Icons
  for (const { name, size, statSize } of DENSITIES) {
    const mipmapName = `mipmap-${name}`;
    const rahulDir = path.join(rahulRes, mipmapName);
    const nusratDir = path.join(nusratRes, mipmapName);
    const mainDir = path.join(mainRes, mipmapName);
    fs.mkdirSync(rahulDir, { recursive: true });
    fs.mkdirSync(nusratDir, { recursive: true });
    fs.mkdirSync(mainDir, { recursive: true });

    // --- Rahul Launcher Icons (Safe Zone scaled, never zoomed or cut off) ---
    // Safe zone for adaptive icon foreground is ~66% of the canvas
    const safeRahulFgSize = Math.round(size * 0.66);
    const rahulFgIcon = await sharp(faviconBuffer)
      .resize(safeRahulFgSize, safeRahulFgSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const rahulForeground = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([{ input: rahulFgIcon, gravity: 'center' }])
      .png()
      .toBuffer();

    await sharp(rahulForeground).toFile(path.join(rahulDir, 'ic_launcher_foreground.png'));
    await sharp(rahulForeground).toFile(path.join(mainDir, 'ic_launcher_foreground.png'));

    // Legacy standard & round icons for Rahul
    const legacyRahulSize = Math.round(size * 0.85);
    const rahulLegacyIcon = await sharp(faviconBuffer)
      .resize(legacyRahulSize, legacyRahulSize, { fit: 'contain', background: { r: 255, g: 248, b: 246, alpha: 1 } })
      .png()
      .toBuffer();

    const rahulStandard = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 255, g: 248, b: 246, alpha: 1 }
      }
    })
      .composite([{ input: rahulLegacyIcon, gravity: 'center' }])
      .png()
      .toBuffer();

    await sharp(rahulStandard).toFile(path.join(rahulDir, 'ic_launcher.png'));
    await sharp(rahulStandard).toFile(path.join(mainDir, 'ic_launcher.png'));

    const roundCircleSvg = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`
    );
    await sharp(rahulStandard)
      .composite([{ input: roundCircleSvg, blend: 'dest-in' }])
      .png()
      .toFile(path.join(rahulDir, 'ic_launcher_round.png'));
    await sharp(rahulStandard)
      .composite([{ input: roundCircleSvg, blend: 'dest-in' }])
      .png()
      .toFile(path.join(mainDir, 'ic_launcher_round.png'));

    // --- Nusrat Launcher Icons (Realistic Notepad, Safe Zone Centered) ---
    // Adaptive Foreground: Notepad page on transparent background, perfectly inside the 65% safe circle
    await sharp(notesForegroundBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(nusratDir, 'ic_launcher_foreground.png'));

    // Legacy square icon: Full amber gradient tile with notepad centered
    await sharp(notesFullBuffer)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(nusratDir, 'ic_launcher.png'));

    // Legacy round icon: Circular amber tile with notepad centered
    await sharp(notesFullBuffer)
      .resize(size, size, { fit: 'cover' })
      .composite([{ input: roundCircleSvg, blend: 'dest-in' }])
      .png()
      .toFile(path.join(nusratDir, 'ic_launcher_round.png'));
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

      // Small Status Bar Notification Icon: Generated directly from the circular favicon!
      // This guarantees the notification icon is the OnlyUs favicon, NOT a white heart!
      const circleSvg = Buffer.from(
        `<svg width="${statSize}" height="${statSize}"><circle cx="${statSize / 2}" cy="${statSize / 2}" r="${statSize / 2}" fill="white"/></svg>`
      );
      await sharp(faviconBuffer)
        .resize(statSize, statSize, { fit: 'cover' })
        .composite([{ input: circleSvg, blend: 'dest-in' }])
        .png()
        .toFile(path.join(dir, 'ic_stat_onlyus.png'));

      await sharp(faviconBuffer)
        .resize(statSize, statSize, { fit: 'cover' })
        .composite([{ input: circleSvg, blend: 'dest-in' }])
        .png()
        .toFile(path.join(dir, 'ic_stat_notify.png'));

      // Clean monogram fallback avatar (in case partner has not yet set a photo)
      await sharp(nusratAvatarFallbackBuffer)
        .resize(size, size, { fit: 'cover' })
        .png()
        .toFile(path.join(dir, 'ic_nusrat_avatar.png'));

      // App favicon in drawable folder
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

  console.log('✅ All flavor launcher & notification icons generated successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Failed to generate flavor icons:', err);
  process.exit(1);
});
