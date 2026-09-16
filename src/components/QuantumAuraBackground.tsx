import React from 'react';
import { ThreeDThemeBackground } from './ThreeDThemeBackground';

export interface QuantumAuraBackgroundProps {
  theme?: string;
  className?: string;
  paused?: boolean;
}

export const QuantumAuraBackground: React.FC<QuantumAuraBackgroundProps> = (props) => {
  return <ThreeDThemeBackground {...props} />;
};
