import React from 'react';
import { OnlyUsShader, ShaderThemeProps } from './ShaderThemesThreeD';

export type DreamyRomanticShaderBackgroundProps = ShaderThemeProps;

export const DreamyRomanticShaderBackground: React.FC<DreamyRomanticShaderBackgroundProps> = (props) => {
  return <OnlyUsShader {...props} />;
};

export default DreamyRomanticShaderBackground;

