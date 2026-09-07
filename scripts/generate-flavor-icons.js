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

// Full-bleed Notes app icon (used for standard square, round, & adaptive launchers)
const NOTES_FULL_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="fullBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FBBF24" />
      <stop offset="40%" stop-color="#F59E0B" />
      <stop offset="100%" stop-color="#D97706" />
    </linearGradient>
    <linearGradient id="sheetGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#FFFDF7" />
    </linearGradient>
    <linearGradient id="foldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E5E7EB" />
      <stop offset="100%" stop-color="#D1D5DB" />
    </linearGradient>
    <filter id="cardShadow" x="-15%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#78350F" flood-opacity="0.32" />
    </filter>
  </defs>

  <!-- Full-bleed background filling 100% of canvas -->
  <rect x="0" y="0" width="512" height="512" fill="url(#fullBgGrad)" />

  <!-- Centered White Notepad with Folded Corner & Subtle Shadow -->
  <g filter="url(#cardShadow)">
    <path d="M 96,60 L 340,60 L 416,136 L 416,452 A 28,28 0 0,1 388,480 L 124,480 A 28,28 0 0,1 96,452 Z" fill="url(#sheetGrad)" />
    <path d="M 340,60 L 340,136 L 416,136 Z" fill="url(#foldGrad)" />
    <path d="M 340,136 L 340,148 L 416,136 Z" fill="#9CA3AF" opacity="0.35" />
  </g>

  <!-- Top accent bar on notepad -->
  <path d="M 124,96 L 316,96" stroke="#F59E0B" stroke-width="14" stroke-linecap="round" />

  <!-- Notepad Ruled Content Lines -->
  <rect x="124" y="152" width="264" height="16" rx="8" fill="#E5E7EB" />
  <rect x="124" y="206" width="216" height="16" rx="8" fill="#E5E7EB" />
  <rect x="124" y="260" width="248" height="16" rx="8" fill="#E5E7EB" />
  <rect x="124" y="314" width="180" height="16" rx="8" fill="#E5E7EB" />

  <!-- Checklist item & pencil -->
  <circle cx="136" cy="380" r="10" fill="#10B981" />
  <path d="M 131,380 L 135,384 L 141,376" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
  <rect x="158" y="372" width="140" height="16" rx="8" fill="#D1D5DB" />

  <!-- Stylized Pencil in Bottom Right -->
  <g transform="translate(350, 390) rotate(-45)">
    <rect x="-10" y="-44" width="20" height="60" rx="4" fill="#D97706" />
    <path d="M -10,16 L 0,36 L 10,16 Z" fill="#FDE68A" />
    <polygon points="-3,31 0,36 3,31" fill="#1F2937" />
    <rect x="-10" y="-56" width="20" height="12" rx="4" fill="#F43F5E" />
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
  const nusratAvatarFallbackBuffer = Buffer.from(NUSRAT_AVATAR_FALLBACK_SVG);
  const faviconBuffer = fs.readFileSync(faviconPath);

  console.log('🚀 Generating Android launcher & notification assets...');

  // 1. Generate Mipmap Launcher Icons
  for (const { name, size, statSize } of DENSITIES) {
    const mipmapName = `mipmap-${name}`;
    const rahulDir = path.join(rahulRes, mipmapName);
    const nusratDir = path.join(nusratRes, mipmapName);
    fs.mkdirSync(rahulDir, { recursive: true });
    fs.mkdirSync(nusratDir, { recursive: true });

    // Rahul Launcher Icons (Full favicon)
    await sharp(faviconBuffer)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(rahulDir, 'ic_launcher.png'));

    await sharp(faviconBuffer)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(rahulDir, 'ic_launcher_round.png'));

    await sharp(faviconBuffer)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(rahulDir, 'ic_launcher_foreground.png'));

    // Nusrat Launcher Icons (100% Full-bleed without blank borders on any phone shape)
    await sharp(notesFullBuffer)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(nusratDir, 'ic_launcher.png'));

    await sharp(notesFullBuffer)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(nusratDir, 'ic_launcher_round.png'));

    await sharp(notesFullBuffer)
      .resize(size, size, { fit: 'cover' })
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
}

main().catch((err) => {
  console.error('❌ Failed to generate flavor icons:', err);
  process.exit(1);
});
