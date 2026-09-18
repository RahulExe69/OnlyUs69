import React, { useEffect, useRef } from 'react';

interface LiquidCardShaderProps {
  className?: string;
  intensity?: number;
  speed?: number;
}

function parseColorToRgb(colorStr: string): [number, number, number] {
  if (!colorStr) return [255, 79, 139]; // default romantic rose
  const trimmed = colorStr.trim();
  
  if (trimmed.startsWith('#')) {
    const hex = trimmed.replace('#', '');
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
      ];
    }
    if (hex.length >= 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    }
  }
  
  const match = trimmed.match(/\d+/g);
  if (match && match.length >= 3) {
    return [parseInt(match[0], 10), parseInt(match[1], 10), parseInt(match[2], 10)];
  }
  
  return [255, 79, 139];
}

export const LiquidCardShader: React.FC<LiquidCardShaderProps> = ({
  className = "absolute inset-0 pointer-events-none overflow-hidden",
  intensity = 0.45,
  speed = 0.0006,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;
    let isVisible = !document.hidden;

    // Lightweight 100x50 grid smoothed by CSS for silky 60-120fps with negligible overhead
    const W = 100;
    const H = 50;
    canvas.width = W;
    canvas.height = H;

    const imgData = ctx.createImageData(W, H);
    const data = imgData.data;

    let touchX = 0.5;
    let touchY = 0.5;
    let touchStrength = 0;

    const parent = canvas.parentElement;

    // Detect theme accent color dynamically
    const updateThemeColor = () => {
      if (typeof window === 'undefined') return [255, 79, 139] as [number, number, number];
      const target = parent || document.documentElement;
      const computed = getComputedStyle(target);
      const rawAccent = computed.getPropertyValue('--theme-accent') || '#ff4f8b';
      return parseColorToRgb(rawAccent);
    };

    let themeRgb = updateThemeColor();

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientY : (e as MouseEvent).clientY;
      touchX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      touchY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      touchStrength = 0.7; // gentle, non-aggressive ripple
    };

    if (parent) {
      parent.addEventListener('mousemove', handlePointerMove, { passive: true });
      parent.addEventListener('touchmove', handlePointerMove, { passive: true });
    }

    const handleVisibility = () => {
      isVisible = !document.hidden;
      if (isVisible) {
        themeRgb = updateThemeColor();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    let t = 0;
    let lastNow = performance.now();
    let themeCheckTimer = 0;

    const render = (now: number) => {
      if (!isVisible) {
        animId = requestAnimationFrame(render);
        return;
      }

      const dt = Math.min(64, now - lastNow);
      lastNow = now;
      t += dt * speed;

      // Periodically refresh theme color in case user switched themes live in settings
      themeCheckTimer += dt;
      if (themeCheckTimer > 1500) {
        themeCheckTimer = 0;
        themeRgb = updateThemeColor();
      }

      // Smooth decay for touch ripple
      touchStrength *= 0.95;

      const [baseR, baseG, baseB] = themeRgb;

      let idx = 0;
      for (let y = 0; y < H; y++) {
        const ny = y / H;
        for (let x = 0; x < W; x++) {
          const nx = x / W;

          // Slow, organic multi-harmonic silk wave (gentle, relaxing breathing motion)
          const wave1 = Math.sin(nx * 3.0 + t * 1.0) * Math.cos(ny * 2.5 - t * 0.7);
          const wave2 = Math.sin((nx + ny) * 2.2 - t * 0.9) * 0.5;

          // Gentle interactive ripple
          const dist = Math.sqrt((nx - touchX) ** 2 + (ny - touchY) ** 2);
          const ripple = Math.sin(dist * 12.0 - t * 3.5) * Math.exp(-dist * 3.5) * touchStrength * 0.5;

          const val = (wave1 + wave2 + ripple) * 0.5 + 0.5;
          const clamped = Math.max(0, Math.min(1, val));

          // Theme-Harmonized Silk Caustics:
          // Smoothly interpolates from a deeper shade of the theme color to a soft, warm luminous highlight
          const highlight = clamped * 0.35;
          const r = Math.min(255, Math.floor(baseR * 0.7 + (255 - baseR * 0.7) * highlight));
          const g = Math.min(255, Math.floor(baseG * 0.7 + (255 - baseG * 0.7) * highlight));
          const b = Math.min(255, Math.floor(baseB * 0.7 + (255 - baseB * 0.7) * highlight));

          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
          idx += 4;
        }
      }

      ctx.putImageData(imgData, 0, 0);
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (parent) {
        parent.removeEventListener('mousemove', handlePointerMove);
        parent.removeEventListener('touchmove', handlePointerMove);
      }
    };
  }, [speed]);

  return (
    <div className={className} aria-hidden="true">
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover scale-105 filter blur-[12px] opacity-75"
        style={{
          opacity: intensity,
          mixBlendMode: 'screen',
        }}
      />
      {/* Calm, luxurious pearl silk sheen sweep */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-25 mix-blend-overlay"
        style={{
          background: 'linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)',
          backgroundSize: '250% 250%',
          animation: 'calm-silk-sheen 9s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes calm-silk-sheen {
          0% { background-position: 200% 0%; }
          50% { background-position: -200% 0%; }
          100% { background-position: 200% 0%; }
        }
      `}</style>
    </div>
  );
};
