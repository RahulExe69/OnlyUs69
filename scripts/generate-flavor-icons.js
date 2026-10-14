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

// Reimagined Notes icon: sage background, warm paper, folded corner, and subtle checklist mark.
const NOTES_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="sageBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#B8C6A0" />
      <stop offset="52%" stop-color="#829A72" />
      <stop offset="100%" stop-color="#536D4F" />
    </linearGradient>
    <radialGradient id="sageGlow" cx="28%" cy="20%" r="90%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.16" />
      <stop offset="100%" stop-color="#1F3A2B" stop-opacity="0.20" />
    </radialGradient>
    <linearGradient id="paper" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFDF3" />
      <stop offset="100%" stop-color="#F0EAD6" />
    </linearGradient>
    <linearGradient id="fold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#EEE7D0" />
      <stop offset="100%" stop-color="#D8D1B9" />
    </linearGradient>
    <filter id="paperShadow" x="-30%" y="-25%" width="160%" height="165%">
      <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#1B3022" flood-opacity="0.30" />
    </filter>
  </defs>

  <rect width="512" height="512" fill="url(#sageBg)" />
  <rect width="512" height="512" fill="url(#sageGlow)" />
  <g filter="url(#paperShadow)">
    <path d="M160 118 H300 L364 182 V365 Q364 384 345 384 H167 Q148 384 148 365 V137 Q148 118 167 118 Z" fill="url(#paper)" />
    <path d="M300 118 V164 Q300 182 318 182 H364 Z" fill="url(#fold)" />
    <path d="M300 164 Q300 182 318 182 H364" fill="none" stroke="#C8C0A8" stroke-opacity="0.55" stroke-width="4" />
  </g>

  <g fill="#8A9A7B">
    <rect x="181" y="205" width="152" height="12" rx="6" />
    <rect x="181" y="244" width="152" height="12" rx="6" />
    <rect x="181" y="283" width="93" height="12" rx="6" />
  </g>
  <path d="M290 290 L302 302 L326 276" fill="none" stroke="#728D5B" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" />
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

  const notesFullBuffer = Buffer.from(NOTES_ICON_SVG);
  // A single square master keeps both legacy and adaptive launcher PNGs visually consistent.
  const notesForegroundBuffer = Buffer.from(NOTES_ICON_SVG);
  const nusratAvatarFallbackBuffer = Buffer.from(NUSRAT_AVATAR_FALLBACK_SVG);
  // Use the checked-in high-density launcher PNG as the master so the OnlyUs artwork remains identical.
  // The legacy WebP favicon is not reliably decoded by Sharp on every CI runner.
  const currentOnlyUsPngPath = path.join(mainRes, 'mipmap-xxxhdpi', 'ic_launcher.png');
  let faviconBuffer;
  try {
    faviconBuffer = fs.readFileSync(currentOnlyUsPngPath);
    await sharp(faviconBuffer).metadata();
    console.log('Using the existing high-density OnlyUs launcher PNG as the artwork source.');
  } catch (pngError) {
    faviconBuffer = fs.readFileSync(faviconPath);
    await sharp(faviconBuffer).metadata();
    console.warn(`⚠️ Existing launcher PNG could not be decoded; using ${faviconPath} as the OnlyUs icon source.`);
  }

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
    // Keep the existing OnlyUs artwork intact, but leave enough clear space for launcher masks.
    // The source PNG already has rounded transparent corners, so 78% keeps visible art within the safe zone.
    const safeRahulFgSize = Math.round(size * 0.78);
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
    const legacyRahulSize = Math.round(size * 0.78);
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

    // --- Notes Launcher Icons (Reimagined sage-and-ivory checklist) ---
    // Master art is centered with generous margins; raster outputs below are PNGs at each density.
    await sharp(notesForegroundBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(nusratDir, 'ic_launcher_foreground.png'));

    // Legacy square icon: full-bleed sage tile with the centered note mark
    await sharp(notesFullBuffer)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(nusratDir, 'ic_launcher.png'));

    // Legacy round icon: same PNG artwork clipped to the circular launcher mask
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
