import React from 'react';
import { NebulaShader, ShaderThemeProps } from './ShaderThemesThreeD';

export type NeuralNoiseBackgroundProps = ShaderThemeProps;

export const NeuralNoiseBackground: React.FC<NeuralNoiseBackgroundProps> = (props) => {
  return <NebulaShader {...props} />;
};

export default NeuralNoiseBackground;

