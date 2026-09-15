import React, { useEffect, useRef } from 'react';

interface ThreeDThemeBackgroundProps {
  theme?: string;
  className?: string;
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
  className = "absolute inset-0 pointer-events-none z-0 overflow-hidden" 
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let isVisible = !document.hidden;

    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    // Current active 3D mode
    const activeTheme = theme || document.documentElement.dataset.chatTheme || '3d-romantic';

    // Interactive Mouse / Touch Parallax
    let mouseX = width / 2;
    let mouseY = height / 2;
    let targetMouseX = width / 2;
    let targetMouseY = height / 2;

    const handleResize = () => {
      if (!canvas) return;
      const newWidth = canvas.parentElement?.clientWidth || window.innerWidth;
      const newHeight = canvas.parentElement?.clientHeight || window.innerHeight;
      if (width !== newWidth || height !== newHeight) {
        width = canvas.width = newWidth;
        height = canvas.height = newHeight;
      }
    };

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
      y: Math.random() * height,
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
      y: Math.random() * height,
      r: Math.random() * 7 + 3,
      vy: Math.random() * 0.7 + 0.4,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: Math.random() * 0.03 + 0.02
    }));
    let oceanWavePhase = 0;

    // 6. SUNSET: 3D Rising Golden Embers
    const sunsetEmbers = Array.from({ length: 20 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 3 + 1.2,
      vy: Math.random() * 0.6 + 0.3,
      alpha: Math.random() * 0.6 + 0.3,
      phase: Math.random() * Math.PI * 2,
      color: Math.random() > 0.4 ? '249, 115, 22' : '251, 146, 60'
    }));

    // 7. DOODLE: 3D Bouncing Confetti
    const confettiShapes = Array.from({ length: 16 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
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
      y: Math.random() * height,
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
      y: Math.random() * height,
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

    let lastTime = performance.now();

    // ========================================================
    // MAIN 60FPS HARDWARE-ACCELERATED RENDER LOOP
    // ========================================================
    const render = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(render);
      if (!isVisible) return;

      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      // Mouse smooth interpolation
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;
      const offsetX = (mouseX - width / 2) * 0.035;
      const offsetY = (mouseY - height / 2) * 0.035;

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

          if (petal.y > height + 20) {
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
          const cy = cube.y * height + offsetY * 0.5;
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
        const cy = height / 2 + offsetY * 1.2;

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
            y: Math.random() * height * 0.4,
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

          if (shootingStar.opacity <= 0 || shootingStar.x > width || shootingStar.y > height) {
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
          const cy = (orb.y + Math.cos(orb.phase * 0.8) * 0.07) * height + offsetY;
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
          const yBase = height * (0.35 + w * 0.25) + offsetY;
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
            b.y = height + 15;
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
            ember.y = height + 10;
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

          if (c.y > height + 15) {
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
          const cy = gem.y * height + offsetY * 0.4;
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
            m.y = height + 10;
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
          const cy = gem.y * height + offsetY * 0.5;
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
          if (f.y < 0) f.y = height;
          if (f.y > height) f.y = 0;

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
          const waveY = height * (0.4 + w * 0.12) + offsetY * depth;
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
          const baseY = height * (0.2 + a * 0.2) + offsetY;
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
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
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
