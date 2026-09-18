import React from 'react';

interface ShaderButtonRingProps {
  children: React.ReactNode;
  className?: string;
  ringColors?: string[];
  duration?: number;
  glow?: boolean;
  glowColor?: string;
  sizeClass?: string;
  roundedClass?: string;
}

export const ShaderButtonRing: React.FC<ShaderButtonRingProps> = ({
  children,
  className = "",
  ringColors = ['#ff4f8b', '#c66cff', '#00ffff'],
  duration = 3,
  glow = true,
  glowColor = 'rgba(255, 79, 139, 0.45)',
  sizeClass = "w-9 h-9",
  roundedClass = "rounded-full",
}) => {
  const colorStops = ringColors.map((col, idx) => {
    const p = ((idx + 1) / ringColors.length) * 120;
    return `${col} ${p}deg`;
  }).join(', ');

  const conic = `conic-gradient(from 0deg, transparent 0deg, ${colorStops}, transparent 140deg, transparent 360deg)`;

  return (
    <div className={`relative flex items-center justify-center p-[2px] ${roundedClass} ${sizeClass} ${className} group`}>
      {/* Outer Glow Halo */}
      {glow && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 ${roundedClass} pointer-events-none transition-opacity duration-300 opacity-60 group-hover:opacity-100 filter blur-[4px]`}
          style={{
            background: glowColor,
          }}
        />
      )}

      {/* Rotating Shader Light Corona */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 ${roundedClass} overflow-hidden pointer-events-none`}
      >
        <div
          className="absolute inset-[-150%] will-change-transform"
          style={{
            background: conic,
            animation: `shader-button-spin ${duration}s linear infinite`,
          }}
        />
      </div>

      {/* Button Content Slot */}
      <div className={`relative z-10 w-full h-full flex items-center justify-center ${roundedClass} overflow-hidden`}>
        {children}
      </div>

      <style>{`
        @keyframes shader-button-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
