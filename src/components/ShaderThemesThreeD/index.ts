import React from 'react';
import { OnlyUsShader } from './OnlyUsShader';
import { NebulaShader } from './NebulaShader';
import { LavenderHaze } from './LavenderHaze';
import { LavenderShader } from './LavenderShader';
import { AkatsukiShader } from './AkatsukiShader';
import { NeonArcadeShader } from './NeonArcadeShader';
import { CleanSlateShader } from './CleanSlateShader';
import { MoonlightShader } from './MoonlightShader';
import { ShaderThemeProps } from './types';

export * from './types';
export { OnlyUsShader } from './OnlyUsShader';
export { NebulaShader } from './NebulaShader';
export { LavenderHaze } from './LavenderHaze';
export { LavenderShader } from './LavenderShader';
export { AkatsukiShader } from './AkatsukiShader';
export { NeonArcadeShader } from './NeonArcadeShader';
export { CleanSlateShader } from './CleanSlateShader';
export { MoonlightShader } from './MoonlightShader';

/**
 * Registry mapping theme identifiers to their dedicated WebGL shader components.
 * As each 3D theme is converted into a dedicated shader, it is registered here.
 */
export const SHADER_THEME_REGISTRY: Record<string, React.FC<ShaderThemeProps>> = {
  // OnlyUs (Default Romantic Sakura Blossom Engine)
  '3d-romantic': OnlyUsShader,
  '3d-cherry': OnlyUsShader,

  // Moonlight (Cinematic Procedural Moon, God-Rays & Deep Water Reflection Shader)
  '3d-dark': MoonlightShader,
  '3d-cosmos': MoonlightShader,

  // Clean Slate (Architectural Liquid Quartz & Prismatic Caustic WebGL Shader)
  '3d-light': CleanSlateShader,

  // Nebula (Neural Noise Procedural Cosmic Filament WebGL Shader)
  '3d-neural': NebulaShader,

  // Lavender Haze (Velvety Violet & Lilac Volumetric Aura WebGL Shader)
  '3d-lavender': LavenderHaze,
  '3d-aura': LavenderHaze,

  // Akatsuki (Naruto Rogue Syndicate Crimson Clouds, Sharingan & Storm Rain)
  '3d-akatsuki': AkatsukiShader,

  // Neon Arcade (Outrun Synthwave Cyber Grid, Horizon Sun & Equalizer Sine Waves)
  '3d-cyber': NeonArcadeShader,
  '3d-waves': NeonArcadeShader,
};



/**
 * Checks if a given theme has a dedicated WebGL shader implementation in ShaderThemesThreeD.
 */
export function hasDedicatedShader(themeName?: string): boolean {
  if (!themeName) return false;
  const key = themeName.toLowerCase().trim();
  return Boolean(SHADER_THEME_REGISTRY[key]);
}

/**
 * Retrieves the dedicated WebGL shader component for a theme, or null if it uses the canvas fallback.
 */
export function getShaderThemeComponent(themeName?: string): React.FC<ShaderThemeProps> | null {
  if (!themeName) return null;
  const key = themeName.toLowerCase().trim();
  return SHADER_THEME_REGISTRY[key] || null;
}
