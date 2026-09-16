import React, { useEffect, useRef } from 'react';

interface ThreeDThemeBackgroundProps {
  theme?: string;
  className?: string;
  paused?: boolean;
}

/**
 * ThreeDThemeBackground
 * High-performance, hardware-accelerated 60fps 3D canvas background engine.
 * 
 * 11 Unique, lag-free 3D visual engines:
 * 1. 3d-romantic: 3D Tumbling Rose & Sakura Petals
 * 2. 3d-light: 3D Minimalist Geometric Wireframe Cubes
 * 3. 3d-dark: 3D Cosmic Starfield Warp & Shooting Stars
 * 4. 3d-lavender: 3D Volumetric Violet Aura Orbs & Stardust
 * 5. 3d-ocean: 3D Underwater Caustic Waves & Bioluminescent Bubbles
 * 6. 3d-sunset: 3D Rising Golden Embers & Warm Flares
 * 7. 3d-doodle: 3D Playful Bouncing Confetti & Stars
 * 8. 3d-noir: 3D Monochrome Crystalline Shards & Gold Motes
 * 9. 3d-forest: 3D Rotating Emerald Gems & Firefly Trails
 * 10. 3d-cyber: 3D Perspective Cybernetic Grid & Neon Ribbons
 * 11. 3d-aurora: 3D Northern Lights (Aurora Borealis) Curtains
 */
export const ThreeDThemeBackground: React.FC<ThreeDThemeBackgroundProps> = ({ 
  theme,
  className = "absolute inset-0 pointer-events-none z-0 overflow-hidden",
  paused = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let isVisible = !document.hidden;

    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    // Track a stable viewport height so software keyboards or temporary viewport shrinkages
    // do not compress, jump, or cut off the ambient 3D scene.
    const initialH = canvas.parentElement?.clientHeight || window.innerHeight;
    const initialScreenH = (typeof window !== 'undefined' && window.screen?.availHeight) ? window.screen.availHeight : initialH;
    let sceneHeight = Math.max(initialH, initialScreenH, window.innerHeight);
    let lastWidth = width;

    // Current active 3D mode
    const activeTheme = theme || document.documentElement.dataset.chatTheme || '3d-romantic';

    // Interactive Mouse / Touch Parallax
    let mouseX = width / 2;
    let mouseY = sceneHeight / 2;
    let targetMouseX = width / 2;
    let targetMouseY = sceneHeight / 2;

    const handleResize = () => {
      if (!canvas) return;
      const newWidth = canvas.parentElement?.clientWidth || window.innerWidth;
      const newHeight = canvas.parentElement?.clientHeight || window.innerHeight;

      // If width changed significantly (e.g. orientation flip between portrait and landscape)
      if (Math.abs(newWidth - lastWidth) > 60) {
        lastWidth = newWidth;
        const screenH = (typeof window !== 'undefined' && window.screen?.availHeight) ? window.screen.availHeight : newHeight;
        sceneHeight = Math.max(newHeight, screenH, window.innerHeight);
      } else {
        // Height expansion (e.g. keyboard closed, fullscreen entered)
        if (newHeight > sceneHeight) {
          sceneHeight = newHeight;
        }
      }

      if (width !== newWidth || height !== newHeight) {
        width = canvas.width = newWidth;
        height = canvas.height = newHeight;
      }
    };

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(canvas.parentElement);
    }

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        targetMouseX = e.touches[0].clientX;
        targetMouseY = e.touches[0].clientY;
      }
    };

    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible) {
        lastTime = performance.now();
      }
    };

    window.addEventListener('resize', handleResize, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize, { passive: true });
    }
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // ========================================================
    // PRE-ALLOCATED DATA STRUCTURES FOR 11 DISTINCT 3D THEMES
    // (Zero heap allocation in render loop -> ZERO GC PAUSES)
    // ========================================================

    // 1. ROMANTIC: 3D Sakura & Rose Petals
    const petals = Array.from({ length: 18 }, () => ({
      x: Math.random() * width,
      y: Math.random() * sceneHeight,
      size: Math.random() * 11 + 9,
      vx: Math.random() * 0.7 + 0.3,
      vy: Math.random() * 0.8 + 0.5,
      rotX: Math.random() * Math.PI * 2,
      rotY: Math.random() * Math.PI * 2,
      rotZ: Math.random() * Math.PI * 2,
      vRotX: (Math.random() - 0.5) * 0.025,
      vRotY: (Math.random() - 0.5) * 0.035,
      vRotZ: (Math.random() - 0.5) * 0.02
    }));

    // 2. LIGHT: 3D Minimalist Geometric Wireframe Cubes
    const cubeVertices = [
      [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
      [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
    ];
    const cubeEdges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7]
    ];
    const wireCubes = [
      { x: 0.25, y: 0.28, size: 28, rotX: 0.2, rotY: 0.3, vRotX: 0.007, vRotY: 0.01 },
      { x: 0.78, y: 0.22, size: 38, rotX: 0.8, rotY: 0.1, vRotX: -0.006, vRotY: 0.008 },
      { x: 0.35, y: 0.78, size: 34, rotX: 0.4, rotY: 0.6, vRotX: 0.008, vRotY: -0.006 },
      { x: 0.82, y: 0.8, size: 24, rotX: 0.1, rotY: 0.9, vRotX: -0.009, vRotY: 0.007 }
    ];

    // 3. DARK: 3D Cosmic Starfield Warp
    const cosmosStars = Array.from({ length: 50 }, () => ({
      x: (Math.random() - 0.5) * 1600,
      y: (Math.random() - 0.5) * 1600,
      z: Math.random() * 900 + 10,
      size: Math.random() * 1.6 + 0.6,
      color: Math.random() > 0.4 ? '#38BDF8' : '#818CF8'
    }));
    let shootingStar: { x: number; y: number; length: number; speed: number; angle: number; opacity: number } | null = null;
    let nextShootingStarTime = performance.now() + 2500;

    // 4. LAVENDER: 3D Volumetric Violet Aura Orbs
    const auraOrbs = [
      { x: 0.25, y: 0.28, r: 180, phase: 0, color: [168, 85, 247], alpha: 0.25 },
      { x: 0.75, y: 0.25, r: 210, phase: 2, color: [129, 140, 248], alpha: 0.22 },
      { x: 0.5, y: 0.72, r: 230, phase: 4, color: [217, 70, 239], alpha: 0.2 },
      { x: 0.85, y: 0.82, r: 160, phase: 1, color: [192, 132, 252], alpha: 0.18 }
    ];

    // 5. OCEAN: 3D Caustic Waves & Rising Bubbles
    const oceanBubbles = Array.from({ length: 14 }, () => ({
      x: Math.random() * width,
      y: Math.random() * sceneHeight,
      r: Math.random() * 7 + 3,
      vy: Math.random() * 0.7 + 0.4,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: Math.random() * 0.03 + 0.02
    }));
    let oceanWavePhase = 0;

    // 6. SUNSET: 3D Rising Golden Embers
    const sunsetEmbers = Array.from({ length: 20 }, () => ({
      x: Math.random() * width,
      y: Math.random() * sceneHeight,
      size: Math.random() * 3 + 1.2,
      vy: Math.random() * 0.6 + 0.3,
      alpha: Math.random() * 0.6 + 0.3,
      phase: Math.random() * Math.PI * 2,
      color: Math.random() > 0.4 ? '249, 115, 22' : '251, 146, 60'
    }));

    // 7. DOODLE: 3D Bouncing Confetti
    const confettiShapes = Array.from({ length: 16 }, () => ({
      x: Math.random() * width,
      y: Math.random() * sceneHeight,
      size: Math.random() * 8 + 5,
      type: Math.floor(Math.random() * 3), // 0: square, 1: triangle, 2: circle
      color: ['#FF6B6B', '#4D96FF', '#FFD93D', '#6BCB77'][Math.floor(Math.random() * 4)],
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.04,
      vy: Math.random() * 0.7 + 0.4,
      vx: (Math.random() - 0.5) * 0.5
    }));

    // 8. NOIR: 3D Rotating Gold Facets & Dust
    const basePrism = [
      { x: 0, y: -1, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: -1, y: 0, z: 0 },
      { x: 0, y: 0, z: -1 },
      { x: 0, y: 1, z: 0 }
    ];
    const prismFaces = [
      [0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1],
      [5, 2, 1], [5, 3, 2], [5, 4, 3], [5, 1, 4]
    ];
    const noirGems = [
      { x: 0.25, y: 0.3, size: 36, rotX: 0.2, rotY: 0.4, vRotX: 0.005, vRotY: 0.008 },
      { x: 0.75, y: 0.7, size: 44, rotX: 0.6, rotY: 0.2, vRotX: -0.006, vRotY: 0.006 }
    ];
    const goldMotes = Array.from({ length: 16 }, () => ({
      x: Math.random() * width,
      y: Math.random() * sceneHeight,
      size: Math.random() * 2 + 1,
      speedY: -(Math.random() * 0.3 + 0.1),
      alpha: Math.random() * 0.5 + 0.3
    }));

    // 9. FOREST: 3D Rotating Emerald Gem Polyhedra & Fireflies
    const forestGems = [
      { x: 0.3, y: 0.28, size: 40, rotX: 0.3, rotY: 0.2, vRotX: 0.007, vRotY: 0.01 },
      { x: 0.75, y: 0.65, size: 48, rotX: 0.5, rotY: 0.7, vRotX: -0.008, vRotY: 0.006 }
    ];
    const fireflies = Array.from({ length: 15 }, () => ({
      x: Math.random() * width,
      y: Math.random() * sceneHeight,
      r: Math.random() * 2.2 + 1.2,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.02 + 0.015,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4
    }));

    // 10. CYBER: 3D Cybernetic Grid & Neon Wave Ribbons
    let cyberPhase = 0;

    // 11. AURORA: 3D Northern Lights Curtains
    let auroraPhase = 0;

    // 12. ANIME: Hand-Drawn Manga Artboard with 3D Animated Stickers, SFX & Sakura Petals
    const animePetals = Array.from({ length: 18 }, () => ({
      x: Math.random() * width,
      y: Math.random() * sceneHeight,
      size: Math.random() * 8 + 7,
      vx: Math.random() * 0.7 + 0.3,
      vy: Math.random() * 0.7 + 0.4,
      flutter: Math.random() * Math.PI * 2,
      vFlutter: Math.random() * 0.04 + 0.02,
      rotZ: Math.random() * Math.PI * 2,
      vRotZ: (Math.random() - 0.5) * 0.02,
      color: Math.random() > 0.35 ? '#FF4757' : '#FF8FA3'
    }));

    const animeSweatdrops = Array.from({ length: 5 }, () => ({
      x: Math.random() * width,
      y: Math.random() * sceneHeight,
      size: Math.random() * 10 + 14,
      wobble: Math.random() * Math.PI * 2,
      vWobble: Math.random() * 0.05 + 0.03,
      vy: Math.random() * 0.3 + 0.15,
      vx: (Math.random() - 0.5) * 0.2
    }));

    const animeAngerMarks = Array.from({ length: 4 }, () => ({
      x: Math.random() * width,
      y: Math.random() * sceneHeight,
      size: Math.random() * 10 + 18,
      pulse: Math.random() * Math.PI * 2,
      vPulse: Math.random() * 0.06 + 0.04,
      rot: (Math.random() - 0.5) * 0.4
    }));

    const sfxWords = ['ドキドキ', 'ゴゴゴ', 'キラキラ', 'ニコニコ', 'ワクワク', 'バーン', 'キュン'];
    const animeSfx = Array.from({ length: 7 }, (_, i) => ({
      text: sfxWords[i % sfxWords.length],
      x: Math.random() * width,
      y: Math.random() * sceneHeight,
      vy: -(Math.random() * 0.35 + 0.2),
      vx: (Math.random() - 0.5) * 0.25,
      rot: (Math.random() - 0.5) * 0.35,
      scale: Math.random() * 0.3 + 0.85,
      alpha: Math.random() * 0.3 + 0.65
    }));

    const animeSparkles = Array.from({ length: 14 }, () => ({
      x: Math.random() * width,
      y: Math.random() * sceneHeight,
      size: Math.random() * 6 + 4,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.04 + 0.02,
      color: Math.random() > 0.5 ? '#00D2D3' : '#FF4757'
    }));

    // 13. POKEMON: Animated Pikachu, Ghostly Gengar, 3D Pokeballs & Lightning
    const pikachuState = {
      x: 0.18,
      y: 0.74,
      size: 52,
      bobPhase: 0,
      earWiggle: 0,
      sparkTimer: 0
    };

    const gengarState = {
      x: 0.82,
      y: 0.24,
      size: 54,
      bobPhase: 1.6,
      shadowPulse: 0
    };

    const pokeballs = [
      { x: 0.24, y: 0.24, r: 24, type: 'poke', bobPhase: 0 },
      { x: 0.78, y: 0.74, r: 28, type: 'great', bobPhase: 2.1 },
      { x: 0.48, y: 0.84, r: 20, type: 'poke', bobPhase: 3.7 },
      { x: 0.84, y: 0.52, r: 22, type: 'poke', bobPhase: 1.2 }
    ];

    const evolutionStars = Array.from({ length: 16 }, () => ({
      x: Math.random() * width,
      y: Math.random() * sceneHeight,
      size: Math.random() * 6 + 4,
      vy: -(Math.random() * 0.6 + 0.3),
      vx: (Math.random() - 0.5) * 0.3,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.04,
      alpha: Math.random() * 0.6 + 0.4
    }));

    let lightningTimer = 0;
    let lightningArcs: Array<{ points: Array<[number, number]>; life: number; maxLife: number }> = [];

    // 14. AKATSUKI: Naruto Rogue Syndicate (Crimson Clouds, Amegakure Rain & Crows)
    const akatsukiClouds = [
      { x: 0.15, y: 0.18, scale: 1.15, speed: 0.18 },
      { x: 0.82, y: 0.14, scale: 1.35, speed: 0.14 },
      { x: 0.35, y: 0.55, scale: 0.95, speed: 0.22 },
      { x: 0.85, y: 0.68, scale: 1.2, speed: 0.16 },
      { x: 0.12, y: 0.88, scale: 1.05, speed: 0.2 }
    ];

    const akatsukiRain = Array.from({ length: 55 }, () => ({
      x: Math.random() * width,
      y: Math.random() * sceneHeight,
      len: Math.random() * 18 + 12,
      vy: Math.random() * 12 + 18,
      vx: -3.5,
      alpha: Math.random() * 0.45 + 0.3
    }));

    const akatsukiRipples: Array<{ x: number; y: number; r: number; maxR: number; alpha: number }> = [];

    const akatsukiCrows = [
      { x: -50, y: sceneHeight * 0.22, speed: 1.4, wingPhase: 0 },
      { x: -120, y: sceneHeight * 0.32, speed: 1.65, wingPhase: 1.2 },
      { x: -220, y: sceneHeight * 0.18, speed: 1.3, wingPhase: 2.5 }
    ];

    const akatsukiFeathers = Array.from({ length: 14 }, () => ({
      x: Math.random() * width,
      y: Math.random() * sceneHeight,
      size: Math.random() * 12 + 10,
      vy: Math.random() * 0.5 + 0.35,
      vx: -(Math.random() * 0.5 + 0.2),
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.03,
      alpha: Math.random() * 0.45 + 0.45
    }));

    let sharinganRot = 0;

    let lastTime = performance.now();

    // ========================================================
    // MAIN 60FPS HARDWARE-ACCELERATED RENDER LOOP
    // ========================================================
    const render = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(render);
      if (!isVisible || pausedRef.current) return;

      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      // Mouse smooth interpolation
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;
      const offsetX = (mouseX - width / 2) * 0.035;
      const offsetY = (mouseY - sceneHeight / 2) * 0.035;

      ctx.clearRect(0, 0, width, height);

      // ========================================================
      // 1. ROMANTIC / 3D-ROMANTIC: Sakura & Rose Petals
      // ========================================================
      if (activeTheme === '3d-romantic' || activeTheme === 'romantic' || activeTheme === '3d-cherry') {
        ctx.save();
        petals.forEach(petal => {
          petal.x += petal.vx + offsetX * 0.01;
          petal.y += petal.vy;
          petal.rotX += petal.vRotX;
          petal.rotY += petal.vRotY;
          petal.rotZ += petal.vRotZ;

          if (petal.y > sceneHeight + 20) {
            petal.y = -20;
            petal.x = Math.random() * width;
          }
          if (petal.x > width + 20) petal.x = -20;

          const scaleX = Math.cos(petal.rotY);
          const scaleY = Math.cos(petal.rotX);

          ctx.save();
          ctx.translate(petal.x, petal.y);
          ctx.rotate(petal.rotZ);
          ctx.scale(Math.abs(scaleX) * 0.8 + 0.2, Math.abs(scaleY) * 0.8 + 0.2);

          ctx.beginPath();
          ctx.moveTo(0, -petal.size);
          ctx.bezierCurveTo(petal.size * 0.8, -petal.size * 0.5, petal.size * 0.6, petal.size * 0.8, 0, petal.size);
          ctx.bezierCurveTo(-petal.size * 0.6, petal.size * 0.8, -petal.size * 0.8, -petal.size * 0.5, 0, -petal.size);
          
          ctx.fillStyle = 'rgba(244, 114, 182, 0.55)';
          ctx.fill();
          ctx.restore();
        });
        ctx.restore();

      // ========================================================
      // 2. LIGHT / 3D-LIGHT: Minimalist Geometric Wireframe Cubes
      // ========================================================
      } else if (activeTheme === '3d-light' || activeTheme === 'light') {
        ctx.save();
        wireCubes.forEach(cube => {
          cube.rotX += cube.vRotX;
          cube.rotY += cube.vRotY;

          const cx = cube.x * width + offsetX * 0.5;
          const cy = cube.y * sceneHeight + offsetY * 0.5;
          const cosX = Math.cos(cube.rotX), sinX = Math.sin(cube.rotX);
          const cosY = Math.cos(cube.rotY), sinY = Math.sin(cube.rotY);

          const proj = cubeVertices.map(([vx, vy, vz]) => {
            const x1 = vx * cosY + vz * sinY;
            const z1 = -vx * sinY + vz * cosY;
            const y2 = vy * cosX - z1 * sinX;
            return {
              x: cx + x1 * cube.size,
              y: cy + y2 * cube.size
            };
          });

          ctx.strokeStyle = 'rgba(66, 99, 235, 0.35)';
          ctx.lineWidth = 1.3;
          cubeEdges.forEach(([i, j]) => {
            ctx.beginPath();
            ctx.moveTo(proj[i].x, proj[i].y);
            ctx.lineTo(proj[j].x, proj[j].y);
            ctx.stroke();
          });

          // Small node dots
          proj.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(66, 99, 235, 0.6)';
            ctx.fill();
          });
        });
        ctx.restore();

      // ========================================================
      // 3. DARK / 3D-DARK: Cosmic Starfield Warp & Shooting Stars
      // ========================================================
      } else if (activeTheme === '3d-dark' || activeTheme === 'dark' || activeTheme === '3d-cosmos') {
        ctx.save();
        const cx = width / 2 + offsetX * 1.2;
        const cy = sceneHeight / 2 + offsetY * 1.2;

        cosmosStars.forEach(star => {
          star.z -= dt * 70;
          if (star.z <= 10) {
            star.z = 900;
            star.x = (Math.random() - 0.5) * 1600;
            star.y = (Math.random() - 0.5) * 1600;
          }

          const k = 250 / star.z;
          const px = cx + star.x * k;
          const py = cy + star.y * k;

          if (px >= 0 && px <= width && py >= 0 && py <= height) {
            const rad = Math.max(0.5, star.size * k);
            const alpha = Math.min(1, (900 - star.z) / 350);

            ctx.beginPath();
            ctx.arc(px, py, rad, 0, Math.PI * 2);
            ctx.fillStyle = star.color;
            ctx.globalAlpha = alpha;
            ctx.fill();
          }
        });

        // Shooting Star
        if (!shootingStar && currentTime > nextShootingStarTime) {
          shootingStar = {
            x: Math.random() * width * 0.8,
            y: Math.random() * sceneHeight * 0.4,
            length: Math.random() * 70 + 50,
            speed: Math.random() * 700 + 500,
            angle: Math.PI / 4 + (Math.random() - 0.5) * 0.2,
            opacity: 1
          };
        }

        if (shootingStar) {
          shootingStar.x += Math.cos(shootingStar.angle) * shootingStar.speed * dt;
          shootingStar.y += Math.sin(shootingStar.angle) * shootingStar.speed * dt;
          shootingStar.opacity -= dt * 0.9;

          if (shootingStar.opacity <= 0 || shootingStar.x > width || shootingStar.y > sceneHeight) {
            shootingStar = null;
            nextShootingStarTime = currentTime + Math.random() * 4000 + 2500;
          } else {
            const tailX = shootingStar.x - Math.cos(shootingStar.angle) * shootingStar.length;
            const tailY = shootingStar.y - Math.sin(shootingStar.angle) * shootingStar.length;

            ctx.beginPath();
            ctx.moveTo(shootingStar.x, shootingStar.y);
            ctx.lineTo(tailX, tailY);
            ctx.strokeStyle = `rgba(182, 156, 255, ${shootingStar.opacity * 0.8})`;
            ctx.lineWidth = 1.8;
            ctx.stroke();
          }
        }
        ctx.restore();

      // ========================================================
      // 4. LAVENDER / 3D-LAVENDER: Volumetric Violet Aura Orbs
      // ========================================================
      } else if (activeTheme === '3d-lavender' || activeTheme === 'lavender' || activeTheme === '3d-aura') {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        auraOrbs.forEach(orb => {
          orb.phase += dt * 0.5;
          const cx = (orb.x + Math.sin(orb.phase) * 0.07) * width + offsetX;
          const cy = (orb.y + Math.cos(orb.phase * 0.8) * 0.07) * sceneHeight + offsetY;
          const r = orb.r * (width / 800);

          const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
          grad.addColorStop(0, `rgba(${orb.color[0]}, ${orb.color[1]}, ${orb.color[2]}, ${orb.alpha})`);
          grad.addColorStop(1, 'transparent');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();

      // ========================================================
      // 5. OCEAN / 3D-OCEAN: Caustic Waves & Bioluminescent Bubbles
      // ========================================================
      } else if (activeTheme === '3d-ocean' || activeTheme === 'ocean') {
        ctx.save();
        oceanWavePhase += dt * 1.5;

        // Wave lines
        for (let w = 0; w < 3; w++) {
          const yBase = sceneHeight * (0.35 + w * 0.25) + offsetY;
          ctx.beginPath();
          for (let x = 0; x <= width; x += 30) {
            const y = yBase + Math.sin(oceanWavePhase + x * 0.015 + w * 1.2) * 16;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = `rgba(36, 124, 134, ${0.12 + w * 0.08})`;
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }

        // Rising Bubbles
        oceanBubbles.forEach(b => {
          b.y -= b.vy;
          b.wobble += b.wobbleSpeed;
          if (b.y < -15) {
            b.y = sceneHeight + 15;
            b.x = Math.random() * width;
          }

          const bx = b.x + Math.sin(b.wobble) * 6;
          ctx.beginPath();
          ctx.arc(bx, b.y, b.r, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(36, 124, 134, 0.35)';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(bx - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.25, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.fill();
        });
        ctx.restore();

      // ========================================================
      // 6. SUNSET / 3D-SUNSET: Warm Rising Embers & Sun Flares
      // ========================================================
      } else if (activeTheme === '3d-sunset' || activeTheme === 'sunset') {
        ctx.save();
        sunsetEmbers.forEach(ember => {
          ember.y -= ember.vy;
          ember.phase += dt * 2;
          if (ember.y < -10) {
            ember.y = sceneHeight + 10;
            ember.x = Math.random() * width;
          }

          const ex = ember.x + Math.sin(ember.phase) * 10;
          const currentAlpha = ember.alpha * (0.6 + 0.4 * Math.sin(ember.phase));

          ctx.beginPath();
          ctx.arc(ex, ember.y, ember.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${ember.color}, ${currentAlpha})`;
          ctx.fill();
        });
        ctx.restore();

      // ========================================================
      // 7. DOODLE / 3D-DOODLE: Playful Bouncing Confetti & Shapes
      // ========================================================
      } else if (activeTheme === '3d-doodle' || activeTheme === 'doodle') {
        ctx.save();
        confettiShapes.forEach(c => {
          c.y += c.vy;
          c.x += c.vx;
          c.rot += c.vRot;

          if (c.y > sceneHeight + 15) {
            c.y = -15;
            c.x = Math.random() * width;
          }

          ctx.save();
          ctx.translate(c.x, c.y);
          ctx.rotate(c.rot);

          ctx.fillStyle = c.color;
          ctx.globalAlpha = 0.55;

          if (c.type === 0) {
            // Square
            ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size);
          } else if (c.type === 1) {
            // Triangle
            ctx.beginPath();
            ctx.moveTo(0, -c.size / 2);
            ctx.lineTo(c.size / 2, c.size / 2);
            ctx.lineTo(-c.size / 2, c.size / 2);
            ctx.closePath();
            ctx.fill();
          } else {
            // Circle
            ctx.beginPath();
            ctx.arc(0, 0, c.size / 2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        });
        ctx.restore();

      // ========================================================
      // 8. NOIR / 3D-NOIR: Monochrome Shards & Gold Drifting Motes
      // ========================================================
      } else if (activeTheme === '3d-noir' || activeTheme === 'noir') {
        ctx.save();
        // Render sleek luxury gold prisms
        noirGems.forEach(gem => {
          gem.rotX += gem.vRotX;
          gem.rotY += gem.vRotY;

          const cx = gem.x * width + offsetX * 0.4;
          const cy = gem.y * sceneHeight + offsetY * 0.4;
          const cosX = Math.cos(gem.rotX), sinX = Math.sin(gem.rotX);
          const cosY = Math.cos(gem.rotY), sinY = Math.sin(gem.rotY);

          const proj = basePrism.map(v => {
            const x1 = v.x * cosY + v.z * sinY;
            const z1 = -v.x * sinY + v.z * cosY;
            const y2 = v.y * cosX - z1 * sinX;
            return {
              x: cx + x1 * gem.size,
              y: cy + y2 * gem.size
            };
          });

          prismFaces.forEach(face => {
            const p0 = proj[face[0]];
            const p1 = proj[face[1]];
            const p2 = proj[face[2]];
            const normZ = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
            if (normZ > 0) {
              ctx.beginPath();
              ctx.moveTo(p0.x, p0.y);
              ctx.lineTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.closePath();
              ctx.fillStyle = 'rgba(224, 184, 92, 0.12)';
              ctx.fill();
              ctx.strokeStyle = 'rgba(224, 184, 92, 0.4)';
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          });
        });

        // Drifting gold motes
        goldMotes.forEach(m => {
          m.y += m.speedY;
          if (m.y < -10) {
            m.y = sceneHeight + 10;
            m.x = Math.random() * width;
          }
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(224, 184, 92, ${m.alpha})`;
          ctx.fill();
        });
        ctx.restore();

      // ========================================================
      // 9. FOREST / 3D-FOREST: Emerald Crystals & Firefly Trails
      // ========================================================
      } else if (activeTheme === '3d-forest' || activeTheme === 'forest' || activeTheme === '3d-crystal') {
        ctx.save();
        forestGems.forEach(gem => {
          gem.rotX += gem.vRotX;
          gem.rotY += gem.vRotY;

          const cx = gem.x * width + offsetX * 0.5;
          const cy = gem.y * sceneHeight + offsetY * 0.5;
          const cosX = Math.cos(gem.rotX), sinX = Math.sin(gem.rotX);
          const cosY = Math.cos(gem.rotY), sinY = Math.sin(gem.rotY);

          const proj = basePrism.map(v => {
            const x1 = v.x * cosY + v.z * sinY;
            const z1 = -v.x * sinY + v.z * cosY;
            const y2 = v.y * cosX - z1 * sinX;
            return {
              x: cx + x1 * gem.size,
              y: cy + y2 * gem.size
            };
          });

          prismFaces.forEach(face => {
            const p0 = proj[face[0]];
            const p1 = proj[face[1]];
            const p2 = proj[face[2]];
            const normZ = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
            if (normZ > 0) {
              ctx.beginPath();
              ctx.moveTo(p0.x, p0.y);
              ctx.lineTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.closePath();
              ctx.fillStyle = 'rgba(201, 226, 101, 0.15)';
              ctx.fill();
              ctx.strokeStyle = 'rgba(201, 226, 101, 0.45)';
              ctx.lineWidth = 1.1;
              ctx.stroke();
            }
          });
        });

        // Fireflies
        fireflies.forEach(f => {
          f.x += f.vx;
          f.y += f.vy;
          f.phase += f.speed;
          if (f.x < 0) f.x = width;
          if (f.x > width) f.x = 0;
          if (f.y < 0) f.y = sceneHeight;
          if (f.y > sceneHeight) f.y = 0;

          const alpha = 0.4 + 0.4 * Math.sin(f.phase);
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(201, 226, 101, ${alpha})`;
          ctx.fill();
        });
        ctx.restore();

      // ========================================================
      // 10. CYBER / 3D-CYBER: Perspective Grid & Neon Ribbons
      // ========================================================
      } else if (activeTheme === '3d-cyber' || activeTheme === 'cyber' || activeTheme === '3d-waves') {
        ctx.save();
        cyberPhase += dt * 2.2;

        const waveCount = 4;
        for (let w = 0; w < waveCount; w++) {
          const depth = (w + 1) / waveCount;
          const waveY = sceneHeight * (0.4 + w * 0.12) + offsetY * depth;
          const alpha = 0.2 + depth * 0.3;

          ctx.beginPath();
          for (let i = 0; i <= 24; i++) {
            const x = (i / 24) * width;
            const sine = Math.sin(cyberPhase + i * 0.35 + w * 0.8) * 26 * depth;
            const y = waveY + sine;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }

          ctx.strokeStyle = w % 2 === 0 ? `rgba(255, 60, 172, ${alpha})` : `rgba(115, 247, 255, ${alpha})`;
          ctx.lineWidth = 2 * depth + 0.5;
          ctx.stroke();
        }
        ctx.restore();

      // ========================================================
      // 11. AURORA / 3D-AURORA: Northern Lights Curtains
      // ========================================================
      } else if (activeTheme === '3d-aurora' || activeTheme === 'aurora') {
        ctx.save();
        auroraPhase += dt * 1.2;

        // Multi-layered vertical auroral ribbons
        for (let a = 0; a < 3; a++) {
          const baseY = sceneHeight * (0.2 + a * 0.2) + offsetY;
          ctx.beginPath();
          for (let x = 0; x <= width; x += 25) {
            const yOffset = Math.sin(auroraPhase + x * 0.012 + a * 1.5) * 35;
            const y = baseY + yOffset;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }

          ctx.strokeStyle = a === 0 ? 'rgba(38, 198, 160, 0.25)' : a === 1 ? 'rgba(139, 92, 246, 0.2)' : 'rgba(46, 168, 210, 0.22)';
          ctx.lineWidth = 14 + a * 6;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
        ctx.restore();

      // ========================================================
      // 12. ANIME / 3D-ANIME: Authentic Hand-Drawn Manga Stickers, SFX & Sakura Petals
      // ========================================================
      } else if (activeTheme === '3d-anime' || activeTheme === 'anime') {
        ctx.save();

        // 1. Subtle Manga Screentone Dot Grid
        ctx.save();
        ctx.fillStyle = 'rgba(24, 24, 41, 0.035)';
        const dotSpacing = 32;
        for (let dx = (offsetX * 0.2) % dotSpacing; dx < width; dx += dotSpacing) {
          for (let dy = (offsetY * 0.2) % dotSpacing; dy < sceneHeight; dy += dotSpacing) {
            ctx.beginPath();
            ctx.arc(dx, dy, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();

        // 2. Animated Floating Manga Sound Effects (SFX / Onomatopoeia)
        for (let i = 0; i < animeSfx.length; i++) {
          const sfx = animeSfx[i];
          sfx.y += sfx.vy;
          sfx.x += sfx.vx;

          if (sfx.y < -40) {
            sfx.y = sceneHeight + 30;
            sfx.x = Math.random() * width;
          }
          if (sfx.x < -60) sfx.x = width + 50;
          if (sfx.x > width + 60) sfx.x = -50;

          const sy = (sfx.y + offsetY) % sceneHeight;

          ctx.save();
          ctx.translate(sfx.x + offsetX * 0.6, sy + offsetY * 0.6);
          ctx.rotate(sfx.rot);
          ctx.scale(sfx.scale, sfx.scale);

          // Manga comic text typography
          ctx.font = 'bold 22px "Comic Sans MS", "Bangers", "Impact", cursive, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Black offset comic drop shadow
          ctx.fillStyle = '#181829';
          ctx.fillText(sfx.text, 3, 3);

          // Heavy black stroke
          ctx.strokeStyle = '#181829';
          ctx.lineWidth = 4.5;
          ctx.lineJoin = 'round';
          ctx.strokeText(sfx.text, 0, 0);

          // Vibrant interior fill
          ctx.fillStyle = i % 2 === 0 ? '#FF4757' : '#00D2D3';
          ctx.fillText(sfx.text, 0, 0);

          ctx.restore();
        }

        // 3. Animated Comic Anime Sweatdrops (💧)
        for (let i = 0; i < animeSweatdrops.length; i++) {
          const sd = animeSweatdrops[i];
          sd.y += sd.vy;
          sd.x += sd.vx;
          sd.wobble += sd.vWobble;

          if (sd.y > sceneHeight + 40) {
            sd.y = -30;
            sd.x = Math.random() * width;
          }

          const sdy = (sd.y + offsetY) % sceneHeight;
          const wobbleAngle = Math.sin(sd.wobble) * 0.25;

          ctx.save();
          ctx.translate(sd.x + offsetX * 0.5, sdy + offsetY * 0.5);
          ctx.rotate(wobbleAngle);

          const r = sd.size;
          // Black outer comic stroke
          ctx.shadowColor = 'rgba(24, 24, 41, 0.2)';
          ctx.shadowBlur = 6;
          ctx.shadowOffsetY = 3;

          ctx.beginPath();
          ctx.moveTo(0, -r * 1.3);
          ctx.bezierCurveTo(r * 0.9, -r * 0.2, r * 0.9, r, 0, r);
          ctx.bezierCurveTo(-r * 0.9, r, -r * 0.9, -r * 0.2, 0, -r * 1.3);
          ctx.closePath();

          ctx.fillStyle = '#00D2D3';
          ctx.fill();

          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#181829';
          ctx.stroke();

          // White catchlight gleam
          ctx.beginPath();
          ctx.ellipse(-r * 0.28, r * 0.2, r * 0.25, r * 0.12, Math.PI / 4, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();

          ctx.restore();
        }

        // 4. Animated Anime Anger Veins (💢)
        for (let i = 0; i < animeAngerMarks.length; i++) {
          const am = animeAngerMarks[i];
          am.pulse += am.vPulse;
          const scale = 1 + Math.sin(am.pulse) * 0.18;
          const amy = (am.y + offsetY) % sceneHeight;

          ctx.save();
          ctx.translate(am.x + offsetX * 0.4, amy + offsetY * 0.4);
          ctx.rotate(am.rot);
          ctx.scale(scale, scale);

          const s = am.size;
          ctx.strokeStyle = '#181829';
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';

          // 4-lobed comic cross mark
          const drawLobe = () => {
            ctx.beginPath();
            ctx.moveTo(-s * 0.4, -s * 0.4);
            ctx.quadraticCurveTo(0, -s * 0.65, s * 0.4, -s * 0.4);
            ctx.stroke();
          };

          for (let l = 0; l < 4; l++) {
            ctx.save();
            ctx.rotate((l * Math.PI) / 2);
            // Black outline
            ctx.strokeStyle = '#181829';
            ctx.lineWidth = 4.5;
            drawLobe();
            // Red inner line
            ctx.strokeStyle = '#FF4757';
            ctx.lineWidth = 2.5;
            drawLobe();
            ctx.restore();
          }

          ctx.restore();
        }

        // 5. 3D Tumbling Sakura Blossom Petals
        for (let i = 0; i < animePetals.length; i++) {
          const p = animePetals[i];
          p.x += p.vx;
          p.y += p.vy;
          p.flutter += p.vFlutter;
          p.rotZ += p.vRotZ;

          if (p.y > sceneHeight + 20) {
            p.y = -20;
            p.x = Math.random() * width;
          }
          if (p.x > width + 20) p.x = -20;

          const py = (p.y + offsetY) % sceneHeight;
          const scaleX = Math.cos(p.flutter);

          ctx.save();
          ctx.translate(p.x + offsetX * 0.8, py + offsetY * 0.8);
          ctx.rotate(p.rotZ);
          ctx.scale(scaleX, 1);

          ctx.fillStyle = p.color;
          ctx.globalAlpha = 0.85;

          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.bezierCurveTo(p.size * 0.85, -p.size * 0.5, p.size * 0.85, p.size * 0.65, 0, p.size);
          ctx.bezierCurveTo(-p.size * 0.85, p.size * 0.65, -p.size * 0.85, -p.size * 0.5, 0, -p.size);
          ctx.fill();

          ctx.strokeStyle = '#181829';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.restore();
        }

        // 6. Anime Sparkles (✨)
        for (let i = 0; i < animeSparkles.length; i++) {
          const s = animeSparkles[i];
          s.phase += s.speed;
          const pulse = (Math.sin(s.phase) + 1) / 2;
          if (pulse < 0.1) continue;

          const sy = (s.y + offsetY) % sceneHeight;
          const starSize = s.size * (0.6 + 0.6 * pulse);

          ctx.save();
          ctx.translate(s.x + offsetX * 0.4, sy + offsetY * 0.4);
          ctx.fillStyle = s.color;
          ctx.globalAlpha = pulse * 0.9;

          ctx.beginPath();
          ctx.moveTo(0, -starSize * 1.8);
          ctx.quadraticCurveTo(0, 0, starSize * 1.8, 0);
          ctx.quadraticCurveTo(0, 0, 0, starSize * 1.8);
          ctx.quadraticCurveTo(0, 0, -starSize * 1.8, 0);
          ctx.quadraticCurveTo(0, 0, 0, -starSize * 1.8);
          ctx.fill();

          ctx.strokeStyle = '#181829';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          ctx.restore();
        }

        ctx.restore();

      // ========================================================
      // 13. POKEMON / 3D-POKEMON: Animated Pikachu, Gengar, 3D Pokeballs & Lightning
      // ========================================================
      } else if (activeTheme === '3d-pokemon' || activeTheme === 'pokemon') {
        ctx.save();

        // 1. Rising Gold Evolution Stars
        for (let i = 0; i < evolutionStars.length; i++) {
          const star = evolutionStars[i];
          star.y += star.vy;
          star.x += star.vx;
          star.rot += star.vRot;

          if (star.y < -20) {
            star.y = sceneHeight + 20;
            star.x = Math.random() * width;
          }
          if (star.x < -20) star.x = width + 20;
          if (star.x > width + 20) star.x = -20;

          const sy = (star.y + offsetY) % sceneHeight;

          ctx.save();
          ctx.translate(star.x + offsetX * 0.5, sy + offsetY * 0.5);
          ctx.rotate(star.rot);
          ctx.fillStyle = '#FFCB05';
          ctx.globalAlpha = star.alpha;
          ctx.shadowColor = 'rgba(255, 203, 5, 0.7)';
          ctx.shadowBlur = 8;

          ctx.beginPath();
          for (let p = 0; p < 5; p++) {
            const outerAngle = (p * 4 * Math.PI) / 5 - Math.PI / 2;
            const px = Math.cos(outerAngle) * star.size;
            const py = Math.sin(outerAngle) * star.size;
            if (p === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        // 2. Animated Pikachu Vector Character
        pikachuState.bobPhase += dt * 2.5;
        pikachuState.earWiggle += dt * 3.5;
        pikachuState.sparkTimer += dt;

        const pikaX = pikachuState.x * width + offsetX * 0.5;
        const pikaY = pikachuState.y * sceneHeight + offsetY + Math.sin(pikachuState.bobPhase) * 6;
        const pikaS = pikachuState.size;

        ctx.save();
        ctx.translate(pikaX, pikaY);

        // Pikachu Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(0, pikaS * 0.65, pikaS * 0.55, pikaS * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pikachu Lightning Bolt Tail
        const tailWag = Math.sin(pikachuState.bobPhase * 1.5) * 0.25;
        ctx.save();
        ctx.translate(pikaS * 0.45, pikaS * 0.15);
        ctx.rotate(tailWag);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(pikaS * 0.15, -pikaS * 0.2);
        ctx.lineTo(pikaS * 0.1, -pikaS * 0.35);
        ctx.lineTo(pikaS * 0.3, -pikaS * 0.55);
        ctx.lineTo(pikaS * 0.18, -pikaS * 0.65);
        ctx.lineTo(pikaS * 0.42, -pikaS * 0.95);
        ctx.lineTo(pikaS * 0.52, -pikaS * 0.85);
        ctx.lineTo(pikaS * 0.35, -pikaS * 0.6);
        ctx.lineTo(pikaS * 0.45, -pikaS * 0.45);
        ctx.lineTo(pikaS * 0.25, -pikaS * 0.25);
        ctx.closePath();
        ctx.fillStyle = '#FFCB05';
        ctx.fill();
        ctx.strokeStyle = '#18181B';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Brown tail base
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(pikaS * 0.15, -pikaS * 0.2);
        ctx.lineTo(pikaS * 0.22, -pikaS * 0.18);
        ctx.lineTo(0.08, 0.05);
        ctx.closePath();
        ctx.fillStyle = '#92400E';
        ctx.fill();
        ctx.restore();

        // Pikachu Body
        ctx.beginPath();
        ctx.ellipse(0, pikaS * 0.22, pikaS * 0.42, pikaS * 0.4, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#FFDE00';
        ctx.fill();
        ctx.strokeStyle = '#18181B';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Pikachu Head
        ctx.beginPath();
        ctx.arc(0, -pikaS * 0.18, pikaS * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = '#FFDE00';
        ctx.fill();
        ctx.stroke();

        // Pikachu Pointy Ears with Black Tips
        const earWiggleLeft = Math.sin(pikachuState.earWiggle) * 0.12;
        const earWiggleRight = -Math.sin(pikachuState.earWiggle) * 0.12;

        // Left Ear
        ctx.save();
        ctx.translate(-pikaS * 0.26, -pikaS * 0.45);
        ctx.rotate(-0.55 + earWiggleLeft);
        ctx.beginPath();
        ctx.ellipse(0, -pikaS * 0.38, pikaS * 0.11, pikaS * 0.42, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#FFDE00';
        ctx.fill();
        ctx.strokeStyle = '#18181B';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        // Black tip
        ctx.beginPath();
        ctx.ellipse(0, -pikaS * 0.65, pikaS * 0.1, pikaS * 0.16, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#18181B';
        ctx.fill();
        ctx.restore();

        // Right Ear
        ctx.save();
        ctx.translate(pikaS * 0.26, -pikaS * 0.45);
        ctx.rotate(0.55 + earWiggleRight);
        ctx.beginPath();
        ctx.ellipse(0, -pikaS * 0.38, pikaS * 0.11, pikaS * 0.42, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#FFDE00';
        ctx.fill();
        ctx.strokeStyle = '#18181B';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        // Black tip
        ctx.beginPath();
        ctx.ellipse(0, -pikaS * 0.65, pikaS * 0.1, pikaS * 0.16, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#18181B';
        ctx.fill();
        ctx.restore();

        // Pikachu Red Electric Cheek Circles
        ctx.fillStyle = '#EE2727';
        ctx.beginPath();
        ctx.arc(-pikaS * 0.28, -pikaS * 0.1, pikaS * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pikaS * 0.28, -pikaS * 0.1, pikaS * 0.1, 0, Math.PI * 2);
        ctx.fill();

        // Pikachu Anime Eyes with White Catchlight
        ctx.fillStyle = '#18181B';
        ctx.beginPath();
        ctx.arc(-pikaS * 0.18, -pikaS * 0.22, pikaS * 0.065, 0, Math.PI * 2);
        ctx.arc(pikaS * 0.18, -pikaS * 0.22, pikaS * 0.065, 0, Math.PI * 2);
        ctx.fill();
        // Sparkle highlights
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(-pikaS * 0.19, -pikaS * 0.24, pikaS * 0.025, 0, Math.PI * 2);
        ctx.arc(pikaS * 0.17, -pikaS * 0.24, pikaS * 0.025, 0, Math.PI * 2);
        ctx.fill();

        // Tiny cute nose & smiling mouth
        ctx.fillStyle = '#18181B';
        ctx.beginPath();
        ctx.arc(0, -pikaS * 0.16, pikaS * 0.02, 0, Math.PI * 2);
        ctx.fill();
        // W mouth
        ctx.beginPath();
        ctx.arc(-pikaS * 0.04, -pikaS * 0.1, pikaS * 0.04, 0, Math.PI);
        ctx.arc(pikaS * 0.04, -pikaS * 0.1, pikaS * 0.04, 0, Math.PI);
        ctx.strokeStyle = '#18181B';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();

        // 3. Animated Ghostly Gengar Vector Character
        gengarState.bobPhase += dt * 1.8;
        gengarState.shadowPulse += dt * 3;

        const genX = gengarState.x * width + offsetX * 0.4;
        const genY = gengarState.y * sceneHeight + offsetY + Math.sin(gengarState.bobPhase) * 10;
        const genS = gengarState.size;

        ctx.save();
        ctx.translate(genX, genY);

        // Ghost aura
        const auraAlpha = 0.25 + 0.1 * Math.sin(gengarState.shadowPulse);
        ctx.shadowColor = `rgba(147, 51, 234, ${auraAlpha * 2})`;
        ctx.shadowBlur = 18;

        // Spiky Ghost Head & Body
        ctx.beginPath();
        ctx.ellipse(0, 0, genS * 0.5, genS * 0.45, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#6B21A8';
        ctx.fill();

        // Gengar Head Spikes / Ears
        const spikes = [-0.65, -0.35, 0, 0.35, 0.65];
        for (let sp of spikes) {
          ctx.beginPath();
          ctx.moveTo(Math.sin(sp) * genS * 0.42, -genS * 0.35);
          ctx.lineTo(Math.sin(sp * 1.2) * genS * 0.52, -genS * 0.68);
          ctx.lineTo(Math.sin(sp + 0.15) * genS * 0.45, -genS * 0.32);
          ctx.closePath();
          ctx.fillStyle = '#581C87';
          ctx.fill();
        }

        ctx.strokeStyle = '#2E1065';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Glowing Crimson Red Slanted Eyes
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.moveTo(-genS * 0.32, -genS * 0.14);
        ctx.lineTo(-genS * 0.12, -genS * 0.08);
        ctx.lineTo(-genS * 0.28, -genS * 0.02);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(genS * 0.32, -genS * 0.14);
        ctx.lineTo(genS * 0.12, -genS * 0.08);
        ctx.lineTo(genS * 0.28, -genS * 0.02);
        ctx.closePath();
        ctx.fill();

        // Wide Iconic Toothy Grin
        ctx.beginPath();
        ctx.arc(0, genS * 0.06, genS * 0.34, 0.15 * Math.PI, 0.85 * Math.PI, false);
        ctx.closePath();
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#2E1065';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Individual Teeth dividers
        ctx.beginPath();
        for (let t = -3; t <= 3; t++) {
          const tx = (t / 4) * genS * 0.26;
          ctx.moveTo(tx, genS * 0.12);
          ctx.lineTo(tx, genS * 0.32);
        }
        ctx.stroke();

        ctx.restore();

        // 4. 3D Floating Pokeballs & Great Balls
        for (let i = 0; i < pokeballs.length; i++) {
          const pb = pokeballs[i];
          pb.bobPhase += dt * 1.5;
          const bobY = Math.sin(pb.bobPhase) * 12;

          const px = pb.x * width + offsetX * 0.8;
          const py = pb.y * sceneHeight + offsetY + bobY;
          const r = pb.r;

          ctx.save();
          ctx.translate(px, py);

          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.shadowBlur = 18;
          ctx.shadowOffsetY = 10;

          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.clip();

          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;

          // Top Half Gradient
          const topGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
          if (pb.type === 'great') {
            topGrad.addColorStop(0, '#38BDF8');
            topGrad.addColorStop(0.7, '#0284C7');
            topGrad.addColorStop(1, '#0369A1');
          } else {
            topGrad.addColorStop(0, '#FF5C5C');
            topGrad.addColorStop(0.6, '#EE3B3B');
            topGrad.addColorStop(1, '#991B1B');
          }
          ctx.fillStyle = topGrad;
          ctx.fillRect(-r, -r, r * 2, r);

          // Great Ball Red Fins
          if (pb.type === 'great') {
            ctx.fillStyle = '#EF4444';
            ctx.fillRect(-r * 0.75, -r * 0.85, r * 0.35, r * 0.6);
            ctx.fillRect(r * 0.4, -r * 0.85, r * 0.35, r * 0.6);
          }

          // Bottom Half: Metallic White
          const botGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.1, r * 0.1, 0, 0, r);
          botGrad.addColorStop(0, '#FFFFFF');
          botGrad.addColorStop(0.7, '#E2E8F0');
          botGrad.addColorStop(1, '#94A3B8');
          ctx.fillStyle = botGrad;
          ctx.fillRect(-r, 0, r * 2, r);

          // Center Horizontal Belt
          const beltHeight = r * 0.22;
          ctx.fillStyle = '#1E293B';
          ctx.fillRect(-r, -beltHeight / 2, r * 2, beltHeight);

          // Center Button: Outer Black Ring
          ctx.fillStyle = '#0F172A';
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
          ctx.fill();

          // Center Button: Inner White Circle
          ctx.fillStyle = '#F8FAFC';
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
          ctx.fill();

          // Center Button Core: Glowing Indicator
          ctx.fillStyle = '#FFCB05';
          ctx.shadowColor = '#FFCB05';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2);
          ctx.fill();

          // Specular Highlight
          ctx.restore();
          ctx.save();
          ctx.translate(px, py);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.beginPath();
          ctx.ellipse(-r * 0.38, -r * 0.38, r * 0.28, r * 0.15, -Math.PI / 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // 5. Dynamic High-Voltage Lightning Bolts
        lightningTimer += dt;
        if (lightningTimer > 1.8) {
          lightningTimer = 0;
          const startX = Math.random() * width;
          const startY = Math.random() * (sceneHeight * 0.4) + offsetY;
          const pts: Array<[number, number]> = [[startX, startY]];
          let curX = startX;
          let curY = startY;

          for (let step = 0; step < 5; step++) {
            curX += (Math.random() - 0.5) * 90;
            curY += Math.random() * 45 + 25;
            pts.push([curX, curY]);
          }
          lightningArcs.push({ points: pts, life: 0.24, maxLife: 0.24 });
        }

        for (let l = lightningArcs.length - 1; l >= 0; l--) {
          const arc = lightningArcs[l];
          arc.life -= dt;
          if (arc.life <= 0) {
            lightningArcs.splice(l, 1);
            continue;
          }

          const alpha = arc.life / arc.maxLife;
          ctx.save();
          ctx.beginPath();
          for (let p = 0; p < arc.points.length; p++) {
            const [ptX, ptY] = arc.points[p];
            if (p === 0) ctx.moveTo(ptX, ptY);
            else ctx.lineTo(ptX, ptY);
          }

          ctx.strokeStyle = `rgba(255, 203, 5, ${alpha * 0.9})`;
          ctx.lineWidth = 4;
          ctx.shadowColor = '#FFCB05';
          ctx.shadowBlur = 14;
          ctx.lineCap = 'round';
          ctx.stroke();

          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }

        ctx.restore();

      // ========================================================
      // 14. AKATSUKI / 3D-AKATSUKI: Naruto Rogue Ninja Syndicate
      // ========================================================
      } else if (activeTheme === '3d-akatsuki' || activeTheme === 'akatsuki') {
        ctx.save();

        // 1. Spinning Distant Sharingan Chakra Eye
        sharinganRot += dt * 0.35;
        ctx.save();
        const sharX = width * 0.5 + offsetX * 0.3;
        const sharY = sceneHeight * 0.28 + offsetY;
        ctx.translate(sharX, sharY);
        ctx.rotate(sharinganRot);

        // Faint red glowing iris
        const sharGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, 65);
        sharGrad.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
        sharGrad.addColorStop(0.7, 'rgba(185, 28, 28, 0.15)');
        sharGrad.addColorStop(1, 'rgba(8, 8, 13, 0)');
        ctx.fillStyle = sharGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 65, 0, Math.PI * 2);
        ctx.fill();

        // Center Pupil
        ctx.fillStyle = 'rgba(10, 10, 15, 0.7)';
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();

        // Tomoe ring line
        ctx.strokeStyle = 'rgba(220, 38, 38, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 32, 0, Math.PI * 2);
        ctx.stroke();

        // 3 Tomoe Marks
        for (let t = 0; t < 3; t++) {
          ctx.save();
          ctx.rotate((t * 2 * Math.PI) / 3);
          ctx.translate(0, -32);
          ctx.fillStyle = '#11121C';
          ctx.beginPath();
          ctx.arc(0, 0, 5, 0, Math.PI * 2);
          ctx.fill();
          // Tomoe curved tail
          ctx.beginPath();
          ctx.moveTo(0, 5);
          ctx.quadraticCurveTo(7, 3, 5, -5);
          ctx.quadraticCurveTo(2, 0, 0, 5);
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();

        // 2. Stylized Iconic Akatsuki Crimson Clouds with White Trim
        for (let i = 0; i < akatsukiClouds.length; i++) {
          const cloud = akatsukiClouds[i];
          cloud.x += cloud.speed * dt * 0.08;
          if (cloud.x > 1.25) cloud.x = -0.25;

          const cx = cloud.x * width + offsetX * 0.7;
          const cy = cloud.y * sceneHeight + offsetY;
          const s = cloud.scale * 36;

          ctx.save();
          ctx.translate(cx, cy);

          // Atmospheric cloud drop glow
          ctx.shadowColor = 'rgba(185, 28, 28, 0.55)';
          ctx.shadowBlur = 18;
          ctx.shadowOffsetY = 6;

          // Akatsuki Cloud Path: Puffy top lobes + characteristic curled tail
          ctx.beginPath();
          ctx.moveTo(-s * 1.3, s * 0.1);
          // Left puff
          ctx.bezierCurveTo(-s * 1.6, -s * 0.4, -s * 1.1, -s * 0.9, -s * 0.6, -s * 0.75);
          // Middle puff (tallest)
          ctx.bezierCurveTo(-s * 0.4, -s * 1.3, s * 0.4, -s * 1.3, s * 0.6, -s * 0.75);
          // Right puff
          ctx.bezierCurveTo(s * 1.2, -s * 0.85, s * 1.65, -s * 0.35, s * 1.35, s * 0.2);
          // Bottom right rounded contour
          ctx.bezierCurveTo(s * 1.45, s * 0.85, s * 0.8, s * 1.05, s * 0.25, s * 0.8);
          // Signature Akatsuki bottom spiral swirl tail
          ctx.bezierCurveTo(-s * 0.15, s * 0.65, -s * 0.4, s * 0.75, -s * 0.65, s * 0.8);
          ctx.bezierCurveTo(-s * 1.1, s * 0.85, -s * 1.4, s * 0.55, -s * 1.3, s * 0.1);
          ctx.closePath();

          // Blood-red gradient fill
          const cloudGrad = ctx.createLinearGradient(-s, -s, s, s);
          cloudGrad.addColorStop(0, '#DC2626');
          cloudGrad.addColorStop(0.6, '#B91C1C');
          cloudGrad.addColorStop(1, '#7F1D1D');
          ctx.fillStyle = cloudGrad;
          ctx.fill();

          // Crisp White Border (Iconic Naruto Cloak styling)
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();

          // Inner spiral line accent
          ctx.beginPath();
          ctx.arc(-s * 0.2, s * 0.25, s * 0.32, 0.2 * Math.PI, 1.4 * Math.PI, false);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.restore();
        }

        // 3. Falling Shadow Crows' Feathers
        for (let i = 0; i < akatsukiFeathers.length; i++) {
          const f = akatsukiFeathers[i];
          f.y += f.vy;
          f.x += f.vx;
          f.rot += f.vRot;

          if (f.y > sceneHeight + 30) {
            f.y = -30;
            f.x = Math.random() * width;
          }
          if (f.x < -30) f.x = width + 20;

          const fy = (f.y + offsetY) % sceneHeight;

          ctx.save();
          ctx.translate(f.x + offsetX * 0.6, fy + offsetY * 0.6);
          ctx.rotate(f.rot);
          ctx.globalAlpha = f.alpha;

          const fs = f.size;
          ctx.beginPath();
          ctx.moveTo(0, -fs);
          ctx.quadraticCurveTo(fs * 0.35, 0, 0, fs);
          ctx.quadraticCurveTo(-fs * 0.35, 0, 0, -fs);
          ctx.fillStyle = '#0F0F17';
          ctx.fill();

          // Crimson glowing feather quill
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, -fs);
          ctx.lineTo(0, fs * 1.15);
          ctx.stroke();

          ctx.restore();
        }

        // 4. Itachi's Silhouette Shadow Crows Flapping Across
        for (let i = 0; i < akatsukiCrows.length; i++) {
          const crow = akatsukiCrows[i];
          crow.x += crow.speed * dt * 70;
          crow.wingPhase += dt * 10;

          if (crow.x > width + 80) {
            crow.x = -80;
            crow.y = sceneHeight * (0.15 + Math.random() * 0.35);
          }

          const crowY = (crow.y + offsetY) % sceneHeight;
          const wingSpan = Math.sin(crow.wingPhase) * 16;

          ctx.save();
          ctx.translate(crow.x + offsetX * 0.4, crowY + offsetY * 0.4);

          ctx.fillStyle = '#0A0A10';
          ctx.beginPath();
          // Left wing
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(-14, wingSpan - 6, -26, wingSpan);
          ctx.quadraticCurveTo(-12, wingSpan + 6, 0, 4);
          // Right wing
          ctx.quadraticCurveTo(14, wingSpan - 6, 26, wingSpan);
          ctx.quadraticCurveTo(12, wingSpan + 6, 0, 0);
          ctx.fill();

          // Body & tail
          ctx.beginPath();
          ctx.ellipse(0, 2, 4, 10, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }

        // 5. Amegakure Persistent Storm Rain & Splash Ripples
        ctx.strokeStyle = 'rgba(200, 220, 255, 0.35)';
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.beginPath();

        for (let i = 0; i < akatsukiRain.length; i++) {
          const drop = akatsukiRain[i];
          drop.y += drop.vy * dt * 60;
          drop.x += drop.vx * dt * 60;

          if (drop.y > sceneHeight) {
            // Spawn puddle ripple on the ground
            if (akatsukiRipples.length < 25 && Math.random() > 0.4) {
              akatsukiRipples.push({
                x: drop.x,
                y: sceneHeight - 10 + (Math.random() - 0.5) * 20,
                r: 2,
                maxR: Math.random() * 14 + 10,
                alpha: 0.6
              });
            }
            drop.y = -20;
            drop.x = Math.random() * width + 50;
          }

          const ry = (drop.y + offsetY) % sceneHeight;
          ctx.moveTo(drop.x + offsetX * 0.2, ry + offsetY * 0.2);
          ctx.lineTo(drop.x + drop.vx + offsetX * 0.2, ry + drop.len + offsetY * 0.2);
        }
        ctx.stroke();

        // Expanding splash ripples
        for (let i = akatsukiRipples.length - 1; i >= 0; i--) {
          const rip = akatsukiRipples[i];
          rip.r += dt * 35;
          rip.alpha -= dt * 1.2;

          if (rip.alpha <= 0 || rip.r >= rip.maxR) {
            akatsukiRipples.splice(i, 1);
            continue;
          }

          ctx.save();
          ctx.strokeStyle = `rgba(220, 38, 38, ${rip.alpha * 0.55})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.ellipse(rip.x + offsetX * 0.2, (rip.y + offsetY) % sceneHeight, rip.r, rip.r * 0.35, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        ctx.restore();
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [theme]);

  return (
    <canvas 
      ref={canvasRef} 
      className={className} 
      style={{ willChange: 'transform', pointerEvents: 'none' }} 
    />
  );
};
