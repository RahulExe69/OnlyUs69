import React, { useEffect, useRef } from 'react';

interface RomanticCardAmbianceProps {
  className?: string;
  heartCount?: number;
  starCount?: number;
}

interface HeartParticle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  wobbleSpeed: number;
  wobbleAmp: number;
  wobbleOffset: number;
  opacity: number;
  maxOpacity: number;
  color: string;
  rotation: number;
  rotSpeed: number;
}

interface StarParticle {
  x: number;
  y: number;
  size: number;
  phase: number;
  speed: number;
  color: string;
}

const HEART_COLORS = [
  'rgba(255, 182, 193, ', // Light pink
  'rgba(255, 105, 180, ', // Hot pink
  'rgba(255, 218, 224, ', // Soft blush
  'rgba(255, 240, 245, ', // Lavender blush
  'rgba(254, 205, 211, ', // Rose 200
  'rgba(253, 164, 175, ', // Rose 300
];

const STAR_COLORS = [
  '#FFF9C4', // Soft golden twinkle
  '#FFE082', // Amber glow
  '#FFFFFF', // Pure starlight
  '#F8BBD0', // Soft pink starlight
];

export const RomanticCardAmbiance: React.FC<RomanticCardAmbianceProps> = ({
  className = '',
  heartCount = 10,
  starCount = 16,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 320);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 96);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener('resize', handleResize);

    // Initialize romantic floating hearts
    const hearts: HeartParticle[] = Array.from({ length: heartCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: 7 + Math.random() * 9,
      speedY: 0.25 + Math.random() * 0.45,
      speedX: (Math.random() - 0.5) * 0.2,
      wobbleSpeed: 0.02 + Math.random() * 0.03,
      wobbleAmp: 6 + Math.random() * 10,
      wobbleOffset: Math.random() * Math.PI * 2,
      opacity: 0.1 + Math.random() * 0.35,
      maxOpacity: 0.45 + Math.random() * 0.45,
      color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
      rotation: (Math.random() - 0.5) * 0.4,
      rotSpeed: (Math.random() - 0.5) * 0.01,
    }));

    // Initialize twinkling stardust
    const stars: StarParticle[] = Array.from({ length: starCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: 1 + Math.random() * 2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.03 + Math.random() * 0.04,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
    }));

    // Helper to draw a smooth vector heart
    const drawHeart = (
      context: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      size: number,
      rotation: number,
      fillColor: string
    ) => {
      context.save();
      context.translate(cx, cy);
      context.rotate(rotation);
      context.beginPath();

      const topCurveHeight = size * 0.3;
      context.moveTo(0, topCurveHeight);

      // Top left curve
      context.bezierCurveTo(
        -size / 2,
        -topCurveHeight,
        -size,
        topCurveHeight / 3,
        0,
        size
      );

      // Top right curve
      context.bezierCurveTo(
        size,
        topCurveHeight / 3,
        size / 2,
        -topCurveHeight,
        0,
        topCurveHeight
      );

      context.fillStyle = fillColor;
      context.shadowColor = 'rgba(255, 105, 180, 0.45)';
      context.shadowBlur = 8;
      context.fill();
      context.restore();
    };

    // Helper to draw a 4-point twinkling sparkle
    const drawSparkle = (
      context: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      size: number,
      alpha: number,
      color: string
    ) => {
      if (alpha <= 0.02) return;
      context.save();
      context.translate(cx, cy);
      context.fillStyle = color;
      context.globalAlpha = alpha;
      context.shadowColor = color;
      context.shadowBlur = 6;

      context.beginPath();
      // Draw 4-point diamond star
      const r = size * 2.5;
      context.moveTo(0, -r);
      context.quadraticCurveTo(0, 0, r, 0);
      context.quadraticCurveTo(0, 0, 0, r);
      context.quadraticCurveTo(0, 0, -r, 0);
      context.quadraticCurveTo(0, 0, 0, -r);
      context.fill();

      context.restore();
    };

    let tick = 0;

    const render = () => {
      tick += 1;
      ctx.clearRect(0, 0, width, height);

      // 1. Soft Breathing Center Heartbeat Glow
      const heartbeat = 0.5 + 0.5 * Math.sin(tick * 0.04);
      const pulseRadius = Math.max(width, height) * (0.45 + heartbeat * 0.08);
      const heartGlow = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        0,
        width * 0.5,
        height * 0.5,
        pulseRadius
      );
      heartGlow.addColorStop(0, `rgba(255, 192, 203, ${0.12 + heartbeat * 0.08})`);
      heartGlow.addColorStop(0.5, `rgba(255, 105, 180, ${0.06 + heartbeat * 0.04})`);
      heartGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = heartGlow;
      ctx.fillRect(0, 0, width, height);

      // 2. Draw Twinkling Stardust Motes
      stars.forEach((star) => {
        star.phase += star.speed;
        const currentAlpha = 0.2 + 0.65 * (0.5 + 0.5 * Math.sin(star.phase));
        drawSparkle(ctx, star.x, star.y, star.size, currentAlpha, star.color);
      });

      // 3. Draw and Animate Floating Hearts
      hearts.forEach((h) => {
        h.y -= h.speedY;
        h.wobbleOffset += h.wobbleSpeed;
        h.rotation += h.rotSpeed;

        const currentX = h.x + Math.sin(h.wobbleOffset) * h.wobbleAmp;

        // Wrap around smoothly
        if (h.y < -h.size * 2) {
          h.y = height + h.size;
          h.x = Math.random() * width;
        }

        // Soft fade in near bottom, fade out near top
        let alpha = h.maxOpacity;
        if (h.y > height - 20) {
          alpha = ((height - h.y) / 20) * h.maxOpacity;
        } else if (h.y < 25) {
          alpha = (h.y / 25) * h.maxOpacity;
        }

        drawHeart(
          ctx,
          currentX,
          h.y,
          h.size,
          h.rotation,
          `${h.color}${Math.max(0, Math.min(1, alpha))})`
        );
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [heartCount, starCount]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ zIndex: 1 }}
    />
  );
};
