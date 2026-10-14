import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Brand-pink launcher background; this matches the dominant lower/mid tone of the OnlyUs tile.
const ONLYUS_BACKGROUND = { r: 244, g: 76, b: 128, alpha: 1 };
const ONLYUS_BACKGROUND_HEX = '#F44C80';

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
  // Use the checked-in full-size drawable PNG as the immutable master so rerunning this script
  // never compounds the safe padding on already-padded launcher images. It is regenerated at the
  // same size from this buffer later in the script, so its artwork remains unchanged between builds.
  // The legacy WebP favicon is not reliably decoded by Sharp on every CI runner.
  const currentOnlyUsPngPath = path.join(process.cwd(), 'assets', 'onlyus-icon-master.png');
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

  // Clean the legacy source's near-black corner pixels and preserve its rounded tile edge.
  const sourceRaster = await sharp(faviconBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < sourceRaster.data.length; i += sourceRaster.info.channels) {
    if (sourceRaster.data[i] < 32 && sourceRaster.data[i + 1] < 32 && sourceRaster.data[i + 2] < 32) {
      sourceRaster.data[i + 3] = 0;
    }
  }
  faviconBuffer = await sharp(sourceRaster.data, {
    raw: {
      width: sourceRaster.info.width,
      height: sourceRaster.info.height,
      channels: sourceRaster.info.channels
    }
  }).png().toBuffer();

  // Upscale the small legacy source before extracting its alpha matte to avoid jagged cutout edges.
  faviconBuffer = await sharp(faviconBuffer)
    .resize(400, 400, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  const sourceMeta = await sharp(faviconBuffer).metadata();
  const sourceWidth = sourceMeta.width || 192;
  const sourceHeight = sourceMeta.height || sourceWidth;
  const sourceCornerRadius = Math.round(Math.min(sourceWidth, sourceHeight) * 0.23);
  const roundedSourceMask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sourceWidth}" height="${sourceHeight}" viewBox="0 0 ${sourceWidth} ${sourceHeight}"><rect width="${sourceWidth}" height="${sourceHeight}" rx="${sourceCornerRadius}" fill="#FFFFFF"/></svg>`
  );
  const onlyUsTileBuffer = await sharp(faviconBuffer)
    .ensureAlpha()
    .composite([{ input: roundedSourceMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // Build a transparent foreground by separating the sculpted heart/people mark from the pink tile.
  // The geometry bounds the mark; a per-row pink backdrop estimate preserves gradients and soft edges.
  const shapeSvg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
      <rect width="400" height="400" fill="#000"/>
      <path d="M62 141 L76 128 L98 120 L124 118 L151 124 L175 137 L192 160 L200 187 L209 160 L228 137 L252 125 L280 120 L305 125 L326 138 L338 160 L341 184 L333 212 L315 238 L290 262 L262 283 L233 304 L200 343 L167 304 L138 283 L110 262 L87 238 L71 212 L61 184 Z" fill="#fff"/>
      <circle cx="134" cy="89" r="38" fill="#fff"/>
      <circle cx="268" cy="109" r="36" fill="#fff"/>
    </svg>
  `);
  const shapeMask = await sharp(shapeSvg)
    .resize(sourceWidth, sourceHeight, { fit: 'fill' })
    .greyscale()
    .blur(0.5)
    .raw()
    .toBuffer();

  const tileRaw = await sharp(onlyUsTileBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const channels = tileRaw.info.channels;
  const rowBackground = Array.from({ length: sourceHeight }, () => [
    { left: 244, right: 244 }, { left: 76, right: 76 }, { left: 128, right: 128 }
  ]);
  const median = values => {
    if (!values.length) return 0;
    values.sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  };
  const rowSamples = (y, from, to, channel) => {
    const vals = [];
    for (let x = Math.max(0, from); x < Math.min(sourceWidth, to); x++) {
      const idx = (y * sourceWidth + x) * channels;
      if (tileRaw.data[idx + 3] > 180 && shapeMask[y * sourceWidth + x] < 18) vals.push(tileRaw.data[idx + channel]);
    }
    return vals;
  };

  for (let y = 0; y < sourceHeight; y++) {
    for (let channel = 0; channel < 3; channel++) {
      // These fixed side bands stay outside the logo, even on rows crossing the heads and torsos.
      const left = rowSamples(y, 14, 50, channel);
      const right = rowSamples(y, sourceWidth - 50, sourceWidth - 14, channel);
      const fallbackLeft = rowSamples(y, 5, 65, channel);
      const fallbackRight = rowSamples(y, sourceWidth - 65, sourceWidth - 5, channel);
      const l = median(left.length >= 4 ? left : fallbackLeft);
      const r = median(right.length >= 4 ? right : fallbackRight);
      rowBackground[y][channel] = { left: l, right: r };
    }
  }

  // Smooth the estimated edge colors vertically, then interpolate across each scanline.
  const smoothBackground = rowBackground.map((_, y) => [0, 1, 2].map(channel => {
    const leftVals = [], rightVals = [];
    for (let k = Math.max(0, y - 2); k <= Math.min(sourceHeight - 1, y + 2); k++) {
      leftVals.push(rowBackground[k][channel].left);
      rightVals.push(rowBackground[k][channel].right);
    }
    return {
      left: leftVals.reduce((a, b) => a + b, 0) / leftVals.length,
      right: rightVals.reduce((a, b) => a + b, 0) / rightVals.length
    };
  }));

  const matteRaw = Buffer.alloc(sourceWidth * sourceHeight);
  for (let y = 0; y < sourceHeight; y++) {
    const bounds = smoothBackground[y];
    for (let x = 0; x < sourceWidth; x++) {
      const idx = (y * sourceWidth + x) * channels;
      const pixel = y * sourceWidth + x;
      if (tileRaw.data[idx + 3] === 0 || shapeMask[pixel] === 0) {
        matteRaw[pixel] = 0;
        continue;
      }
      const t = sourceWidth > 1 ? x / (sourceWidth - 1) : 0;
      let distance = 0;
      for (let channel = 0; channel < 3; channel++) {
        const bg = bounds[channel].left * (1 - t) + bounds[channel].right * t;
        const delta = tileRaw.data[idx + channel] - bg;
        distance += delta * delta;
      }
      distance = Math.sqrt(distance);
      const linear = Math.max(0, Math.min(1, (distance - 10) / 29));
      matteRaw[pixel] = Math.round(255 * linear * linear * (3 - 2 * linear));
    }
  }
  // Smooth the extracted alpha matte at high resolution to remove compression speckles along highlights.
  const smoothMatte = await sharp(matteRaw, {
    raw: { width: sourceWidth, height: sourceHeight, channels: 1 }
  }).blur(1.1).raw().toBuffer();
  const foregroundRaw = Buffer.from(tileRaw.data);
  for (let y = 0; y < sourceHeight; y++) {
    for (let x = 0; x < sourceWidth; x++) {
      const idx = (y * sourceWidth + x) * channels;
      const pixel = y * sourceWidth + x;
      const shape = shapeMask[pixel] / 255;
      const sourceAlpha = tileRaw.data[idx + 3] / 255;
      foregroundRaw[idx + 3] = Math.round(255 * (smoothMatte[pixel] / 255) * shape * sourceAlpha);
    }
  }
  const onlyUsForegroundBuffer = await sharp(foregroundRaw, {
    raw: { width: sourceWidth, height: sourceHeight, channels }
  }).png().toBuffer();
  // Keep the complete original icon around only for reference; generated launchers use the separated mark.
  faviconBuffer = onlyUsTileBuffer;

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
    const safeRahulFgSize = Math.round(size * 0.90);
    const rahulFgIcon = await sharp(onlyUsForegroundBuffer)
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
    const legacyRahulSize = Math.round(size * 0.90);
    const rahulLegacyIcon = await sharp(onlyUsForegroundBuffer)
      .resize(legacyRahulSize, legacyRahulSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const rahulStandard = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: ONLYUS_BACKGROUND
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

      const drawableRoundCircleSvg = Buffer.from(
        `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`
      );
      // App icon in drawable folder: isolated foreground over the solid brand-pink canvas.
      const drawableMark = await sharp(onlyUsForegroundBuffer)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      const drawableIcon = await sharp({
        create: { width: size, height: size, channels: 4, background: ONLYUS_BACKGROUND }
      }).composite([{ input: drawableMark, gravity: 'center' }]).png().toBuffer();
      await sharp(drawableIcon).png().toFile(path.join(dir, 'ic_launcher.png'));
      await sharp(drawableIcon)
        .composite([{ input: drawableRoundCircleSvg, blend: 'dest-in' }])
        .png()
        .toFile(path.join(dir, 'ic_launcher_round.png'));
    }
  }

  // Export standalone 512x512 PNG masters for download/use outside Android resources.
  const iconExportDir = path.join(process.cwd(), 'generated-icons');
  fs.mkdirSync(iconExportDir, { recursive: true });
  const onlyUsMasterSize = 512;
  const onlyUsSafeSize = Math.round(onlyUsMasterSize * 0.90);
  const onlyUsMasterArtwork = await sharp(onlyUsForegroundBuffer)
    .resize(onlyUsSafeSize, onlyUsSafeSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const onlyUsMaster = await sharp({
    create: {
      width: onlyUsMasterSize,
      height: onlyUsMasterSize,
      channels: 4,
      background: ONLYUS_BACKGROUND
    }
  }).composite([{ input: onlyUsMasterArtwork, gravity: 'center' }]).png().toBuffer();
  await sharp(onlyUsMaster).png().toFile(path.join(iconExportDir, 'OnlyUs.png'));
  await sharp(onlyUsForegroundBuffer)
    .resize(onlyUsMasterSize, onlyUsMasterSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(iconExportDir, 'OnlyUs-Foreground.png'));
  await sharp(notesFullBuffer)
    .resize(512, 512, { fit: 'cover' })
    .png()
    .toFile(path.join(iconExportDir, 'Notes.png'));

  console.log('✅ All flavor launcher & notification icons generated successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Failed to generate flavor icons:', err);
  process.exit(1);
});
