import React from 'react';
import { LavenderHaze } from './LavenderHaze';
import { ShaderThemeProps } from './types';

export const LavenderShader: React.FC<ShaderThemeProps> = (props) => {
  return <LavenderHaze {...props} />;
};

export default LavenderShader;
