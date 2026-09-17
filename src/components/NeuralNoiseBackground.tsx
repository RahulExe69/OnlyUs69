import React from 'react';
import { NeuralNoise } from './ui/neural-noise';

export interface NeuralNoiseBackgroundProps {
  className?: string;
  paused?: boolean;
  color?: [number, number, number] | number[];
  opacity?: number;
  speed?: number;
}

export const NeuralNoiseBackground: React.FC<NeuralNoiseBackgroundProps> = ({
  className = "absolute inset-0 pointer-events-none z-0 overflow-hidden",
  paused = false,
  color = [0.9, 0.2, 0.4],
  opacity = 0.95,
  speed = 0.001,
}) => {
  return (
    <div className={className}>
      <NeuralNoise 
        color={color} 
        opacity={opacity} 
        speed={speed} 
        paused={paused}
      />
    </div>
  );
};

export default NeuralNoiseBackground;
