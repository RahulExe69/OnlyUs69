import React, { useRef, useState, useEffect } from 'react';

interface ShaderBorderBeamProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  beamColors?: string[];
  duration?: number; // seconds for full 360 rotation
  borderWidth?: number; // in pixels
  borderRadius?: string; // tailwind class like rounded-2xl, rounded-3xl, rounded-full
  innerRadius?: string; // tailwind class for inner content
  glow?: boolean; // whether to emit an outer ambient blurred glow
  glowIntensity?: number; // 0 to 1
  beamLength?: number; // degrees of the beam arc, default 100
  interactive?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  role?: string;
  tabIndex?: number;
  id?: string;
}

export const ShaderBorderBeam: React.FC<ShaderBorderBeamProps> = ({
  children,
  className = "",
  containerClassName = "",
  beamColors = ['var(--theme-accent)', 'rgba(255, 255, 255, 0.75)', 'var(--theme-accent)'],
  duration = 7.0,
  borderWidth = 1.5,
  borderRadius = "rounded-2xl",
  innerRadius = "rounded-[calc(1rem-1.5px)]",
  glow = true,
  glowIntensity = 0.35,
  beamLength = 90,
  interactive = true,
  onClick,
  style,
  role,
  tabIndex,
  id,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Generate the CSS conic-gradient string dynamically based on beamColors & beamLength
  // It concentrates colors in an active arc (e.g. 0deg to beamLength), fading to transparent
  const colorStops = beamColors.map((col, idx) => {
    const p = ((idx + 1) / beamColors.length) * beamLength;
    return `${col} ${p}deg`;
  }).join(', ');

  const conicGradient = `conic-gradient(from 0deg at 50% 50%, transparent 0deg, ${colorStops}, transparent ${beamLength + 15}deg, transparent 360deg)`;

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
    setMousePos(null);
  };

  return (
    <div
      ref={containerRef}
      id={id}
      onClick={onClick}
      role={role}
      tabIndex={tabIndex}
      onPointerMove={handlePointerMove}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={handlePointerLeave}
      className={`relative group ${borderRadius} ${containerClassName}`}
      style={{
        padding: `${borderWidth}px`,
        ...style,
      }}
    >
      {/* Outer Volumetric Shader Glow (radiant ambient aura around the card) */}
      {glow && (
        <div
          aria-hidden="true"
          className={`absolute -inset-1.5 sm:-inset-2 ${borderRadius} pointer-events-none transition-opacity duration-500 overflow-hidden`}
          style={{
            filter: 'blur(14px)',
            opacity: isHovered ? Math.min(1, glowIntensity * 1.3) : glowIntensity,
            zIndex: 0,
          }}
        >
          <div
            className="absolute inset-[-150%] will-change-transform"
            style={{
              background: conicGradient,
              animation: `shader-beam-spin ${duration}s linear infinite`,
            }}
          />
        </div>
      )}

      {/* Razor-Sharp Shader Border Beam (clipped by inner content) */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 ${borderRadius} pointer-events-none overflow-hidden`}
        style={{ zIndex: 1 }}
      >
        <div
          className="absolute inset-[-150%] will-change-transform"
          style={{
            background: conicGradient,
            animation: `shader-beam-spin ${duration}s linear infinite`,
          }}
        />
      </div>

      {/* Interactive Cursor Spotlight Sheen */}
      {interactive && mousePos && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 ${borderRadius} pointer-events-none opacity-100 transition-opacity duration-300`}
          style={{
            zIndex: 2,
            background: `radial-gradient(160px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255, 255, 255, 0.12), transparent 70%)`,
          }}
        />
      )}

      {/* Inner Content Slot */}
      <div
        className={`relative ${innerRadius} w-full h-full overflow-hidden ${className}`}
        style={{ zIndex: 3 }}
      >
        {children}
      </div>

      <style>{`
        @keyframes shader-beam-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};
