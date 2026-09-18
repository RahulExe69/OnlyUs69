import React from 'react';

export interface ShaderThemeProps {
  className?: string;
  paused?: boolean;
  opacity?: number;
  speed?: number;
  color?: [number, number, number] | number[];
  style?: React.CSSProperties;
}
