'use client';
import React, { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { motion, Transition } from 'motion/react';
import { getThemeGlowColors } from '../../src/lib/themes';

export type GlowEffectProps = {
  className?: string;
  style?: React.CSSProperties;
  colors?: string[];
  theme?: string;
  mode?:
    | 'rotate'
    | 'pulse'
    | 'breathe'
    | 'colorShift'
    | 'flowHorizontal'
    | 'static';
  blur?:
    | number
    | 'softest'
    | 'soft'
    | 'medium'
    | 'strong'
    | 'stronger'
    | 'strongest'
    | 'none';
  transition?: Transition;
  scale?: number;
  duration?: number;
};

export function GlowEffect({
  className,
  style,
  colors,
  theme,
  mode = 'rotate',
  blur = 'medium',
  transition,
  scale = 1,
  duration = 5,
}: GlowEffectProps) {
  // Listen to active theme changes dynamically
  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return theme || localStorage.getItem('onlyus_chat_theme') || document.documentElement.dataset.chatTheme || '3d-romantic';
    }
    return theme || '3d-romantic';
  });

  useEffect(() => {
    if (theme) {
      setCurrentTheme(theme);
      return;
    }
    const checkTheme = () => {
      const active = localStorage.getItem('onlyus_chat_theme') || document.documentElement.dataset.chatTheme || '3d-romantic';
      setCurrentTheme(active);
    };
    checkTheme();
    window.addEventListener('storage', checkTheme);
    // Also observe dataset changes on documentElement
    const observer = new MutationObserver(() => {
      checkTheme();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-chat-theme'] });
    return () => {
      window.removeEventListener('storage', checkTheme);
      observer.disconnect();
    };
  }, [theme]);

  // Compute theme-responsive glow colors
  const activeColors = useMemo(() => {
    if (colors && colors.length > 0) return colors;
    return getThemeGlowColors(currentTheme);
  }, [colors, currentTheme]);

  const BASE_TRANSITION: Transition = {
    repeat: Infinity,
    duration: duration,
    ease: 'linear',
  };

  const animations = {
    rotate: {
      background: [
        `conic-gradient(from 0deg at 50% 50%, ${activeColors.join(', ')})`,
        `conic-gradient(from 360deg at 50% 50%, ${activeColors.join(', ')})`,
      ],
      transition: {
        ...(transition ?? BASE_TRANSITION),
      },
    },
    pulse: {
      background: activeColors.map(
        (color) =>
          `radial-gradient(circle at 50% 50%, ${color} 0%, transparent 100%)`
      ),
      scale: [1 * scale, 1.1 * scale, 1 * scale],
      opacity: [0.5, 0.8, 0.5],
      transition: {
        ...(transition ?? {
          ...BASE_TRANSITION,
          repeatType: 'mirror',
        }),
      },
    },
    breathe: {
      background: [
        ...activeColors.map(
          (color) =>
            `radial-gradient(circle at 50% 50%, ${color} 0%, transparent 100%)`
        ),
      ],
      scale: [1 * scale, 1.05 * scale, 1 * scale],
      transition: {
        ...(transition ?? {
          ...BASE_TRANSITION,
          repeatType: 'mirror',
        }),
      },
    },
    colorShift: {
      background: activeColors.map((color, index) => {
        const nextColor = activeColors[(index + 1) % activeColors.length];
        return `conic-gradient(from 0deg at 50% 50%, ${color} 0%, ${nextColor} 50%, ${color} 100%)`;
      }),
      transition: {
        ...(transition ?? {
          ...BASE_TRANSITION,
          repeatType: 'mirror',
        }),
      },
    },
    flowHorizontal: {
      background: activeColors.map((color) => {
        const nextColor = activeColors[(activeColors.indexOf(color) + 1) % activeColors.length];
        return `linear-gradient(to right, ${color}, ${nextColor})`;
      }),
      transition: {
        ...(transition ?? {
          ...BASE_TRANSITION,
          repeatType: 'mirror',
        }),
      },
    },
    static: {
      background: `linear-gradient(to right, ${activeColors.join(', ')})`,
    },
  };

  const getBlurClass = (blur: GlowEffectProps['blur']) => {
    if (typeof blur === 'number') {
      return `blur-[${blur}px]`;
    }

    const presets = {
      softest: 'blur-sm',
      soft: 'blur',
      medium: 'blur-md',
      strong: 'blur-lg',
      stronger: 'blur-xl',
      strongest: 'blur-xl',
      none: 'blur-none',
    };

    return presets[blur as keyof typeof presets];
  };

  return (
    <motion.div
      style={
        {
          ...style,
          '--scale': scale,
          willChange: 'transform',
          backfaceVisibility: 'hidden',
        } as React.CSSProperties
      }
      animate={animations[mode]}
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full',
        'scale-[var(--scale)] transform-gpu',
        getBlurClass(blur),
        className
      )}
    />
  );
}
