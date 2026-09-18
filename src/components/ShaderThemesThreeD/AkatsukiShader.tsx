import React, { useEffect, useRef } from 'react';
import { ShaderThemeProps } from './types';

/**
 * AkatsukiShader (3d-akatsuki / akatsuki)
 * 
 * Hardware-accelerated 3D atmosphere for the legendary Naruto rogue ninja syndicate.
 * Features:
 * - Spinning Distant Sharingan Chakra Eye with crimson iris, pupil, and 3 rotating curved tomoe marks
 * - Iconic Akatsuki Crimson Clouds with puffy lobes, curled spiral swirl tail, rich blood-red gradient, and crisp white cloak trim
 * - Amegakure Storm Downpour with fast slanted rain streaks and expanding water puddle ripples
 * - Itachi's Shadow Crows with animated flapping wings and tumbling feathers with glowing red quills
 * - 100% transparent alpha canvas so the theme's dark chakra pitch (#08080D) and neon red borders shine through
 * - Mobile keyboard & viewport height decoupling for zero jumping
 */
export const AkatsukiShader: React.FC<ShaderThemeProps> = ({
  className = "absolute inset-0 pointer-events-none z-0 overflow-hidden",
  paused = false,
  style,
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

    // Viewport height decoupling for mobile keyboard resilience
    const initialH = canvas.parentElement?.clientHeight || window.innerHeight;
    const initialScreenH = (typeof window !== 'undefined' && window.screen?.availHeight) ? window.screen.availHeight : initialH;
    let sceneHeight = Math.max(initialH, initialScreenH, window.innerHeight);
    let lastWidth = width;

    // Interactive mouse / touch parallax
    let mouseX = width / 2;
    let mouseY = sceneHeight / 2;
    let targetMouseX = width / 2;
    let targetMouseY = sceneHeight / 2;

    const handleResize = () => {
      if (!canvas) return;
      const newWidth = canvas.parentElement?.clientWidth || window.innerWidth;
      const newHeight = canvas.parentElement?.clientHeight || window.innerHeight;

      if (Math.abs(newWidth - lastWidth) > 60) {
        lastWidth = newWidth;
        const screenH = (typeof window !== 'undefined' && window.screen?.availHeight) ? window.screen.availHeight : newHeight;
        sceneHeight = Math.max(newHeight, screenH, window.innerHeight);
      } else {
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

    // 1. Akatsuki Clouds State
    const akatsukiClouds = [
      { x: 0.12, y: 0.16, scale: 1.15, speed: 0.18 },
      { x: 0.82, y: 0.14, scale: 1.35, speed: 0.14 },
      { x: 0.35, y: 0.52, scale: 0.95, speed: 0.22 },
      { x: 0.85, y: 0.68, scale: 1.2, speed: 0.16 },
      { x: 0.12, y: 0.88, scale: 1.05, speed: 0.2 }
    ];

    // 2. Persistent Amegakure Storm Rain
    const akatsukiRain = Array.from({ length: 55 }, () => ({
      x: Math.random() * width,
      y: Math.random() * sceneHeight,
      len: Math.random() * 18 + 12,
      vy: Math.random() * 12 + 18,
      vx: -3.5,
      alpha: Math.random() * 0.45 + 0.3
    }));

    // 3. Ground Puddle Ripples
    const akatsukiRipples: Array<{ x: number; y: number; r: number; maxR: number; alpha: number }> = [];

    // 4. Itachi's Silhouette Shadow Crows
    const akatsukiCrows = [
      { x: -50, y: sceneHeight * 0.22, speed: 1.4, wingPhase: 0 },
      { x: -120, y: sceneHeight * 0.32, speed: 1.65, wingPhase: 1.2 },
      { x: -220, y: sceneHeight * 0.18, speed: 1.3, wingPhase: 2.5 }
    ];

    // 5. Falling Crow Feathers
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

    const render = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(render);

      if (pausedRef.current || !isVisible) {
        lastTime = currentTime;
        return;
      }

      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      // Parallax easing
      mouseX += (targetMouseX - mouseX) * 0.04;
      mouseY += (targetMouseY - mouseY) * 0.04;
      const offsetX = (mouseX - width / 2) * 0.05;
      const offsetY = (mouseY - sceneHeight / 2) * 0.04;

      // Clear transparent canvas
      ctx.clearRect(0, 0, width, height);
      ctx.save();

      // ========================================================
      // 1. Spinning Distant Sharingan Chakra Eye
      // ========================================================
      sharinganRot += dt * 0.35;
      ctx.save();
      const sharX = width * 0.5 + offsetX * 0.3;
      const sharY = sceneHeight * 0.28 + offsetY;
      ctx.translate(sharX, sharY);
      ctx.rotate(sharinganRot);

      // Faint red glowing iris
      const sharGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, 68);
      sharGrad.addColorStop(0, 'rgba(239, 68, 68, 0.38)');
      sharGrad.addColorStop(0.7, 'rgba(185, 28, 28, 0.16)');
      sharGrad.addColorStop(1, 'rgba(8, 8, 13, 0)');
      ctx.fillStyle = sharGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 68, 0, Math.PI * 2);
      ctx.fill();

      // Center Pupil
      ctx.fillStyle = 'rgba(10, 10, 15, 0.85)';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();

      // Tomoe ring line
      ctx.strokeStyle = 'rgba(220, 38, 38, 0.4)';
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

      // ========================================================
      // 2. Stylized Iconic Akatsuki Crimson Clouds with White Trim
      // ========================================================
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

      // ========================================================
      // 3. Falling Shadow Crows' Feathers
      // ========================================================
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

      // ========================================================
      // 4. Itachi's Silhouette Shadow Crows Flapping Across
      // ========================================================
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

      // ========================================================
      // 5. Amegakure Persistent Storm Rain & Splash Ripples
      // ========================================================
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
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className={className} style={style}>
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ pointerEvents: 'none' }}
      />
    </div>
  );
};

export default AkatsukiShader;
