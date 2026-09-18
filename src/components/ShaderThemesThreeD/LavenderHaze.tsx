import React, { useEffect, useRef } from 'react';
import { ShaderThemeProps } from './types';

/**
 * LavenderHaze (3d-lavender / lavender)
 * 
 * GPU-accelerated WebGL shader for the "Lavender Haze" theme.
 * 
 * Solves the white screen blowout issue:
 * 1. WebGL Premultiplied Alpha: Uses gl_FragColor = vec4(auraColor * finalAlpha, finalAlpha)
 *    and gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA) so the browser compositor performs
 *    exact linear interpolation (LERP) over the theme's soft #F7F3FF lilac canvas.
 * 2. Dedicated Uniform Updates: Binds u_time, u_ratio, u_speed, u_opacity in the render loop.
 * 3. Palette: Rich velvet violet (#8062C7), luminous lilac (#C084FC), orchid magenta (#D946EF),
 *    and misty periwinkle (#818CF8) volumetric aura spheres with harmonic drift and twinkling stardust.
 */
export const LavenderHaze: React.FC<ShaderThemeProps> = ({
  className = "absolute inset-0 pointer-events-none z-0 overflow-hidden",
  paused = false,
  opacity = 0.85,
  speed = 0.0008,
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const speedRef = useRef(speed);
  speedRef.current = speed;

  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let gl: WebGLRenderingContext | null = null;
    let uniforms: {
      u_time: WebGLUniformLocation | null;
      u_ratio: WebGLUniformLocation | null;
      u_speed: WebGLUniformLocation | null;
      u_opacity: WebGLUniformLocation | null;
    } = {
      u_time: null,
      u_ratio: null,
      u_speed: null,
      u_opacity: null,
    };

    let animationFrameId = 0;
    let isCleanedUp = false;
    let lastRenderTime = 0;

    let vertexShader: WebGLShader | null = null;
    let fragmentShader: WebGLShader | null = null;
    let shaderProgram: WebGLProgram | null = null;
    let vertexBuffer: WebGLBuffer | null = null;

    gl = initShader();
    if (!gl) return;

    resizeCanvas();
    const resizeListener = () => resizeCanvas();
    window.addEventListener('resize', resizeListener, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', resizeListener, { passive: true });
    }

    render(performance.now());

    function initShader(): WebGLRenderingContext | null {
      const vsSource = `
        precision mediump float;
        varying vec2 vUv;
        attribute vec2 a_position;
        void main() {
          vUv = 0.5 * (a_position + 1.0);
          gl_Position = vec4(a_position, 0.0, 1.0);
        }
      `;

      // Lavender Haze Volumetric Violet Aura & Stardust Shader
      const fsSource = `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif

        varying vec2 vUv;
        uniform float u_time;
        uniform float u_ratio;
        uniform float u_speed;
        uniform float u_opacity;

        // Soft volumetric aura orb with quadratic optical falloff
        float auraOrb(vec2 uv, vec2 center, float radius) {
          float d = length(uv - center);
          float t = clamp(d / radius, 0.0, 1.0);
          // Smooth bell-shaped curve for voluminous ethereal feel
          return (1.0 - t * t) * (1.0 - t * t);
        }

        // Twinkling amethyst stardust motes
        float stardust(vec2 uv, float t) {
          vec2 p = uv * 9.0 + vec2(t * 0.06, -t * 0.09);
          vec2 grid = fract(p) - 0.5;
          vec2 id = floor(p);
          float rnd = fract(sin(dot(id, vec2(127.1, 311.7))) * 43758.5453);
          
          if (rnd < 0.65) return 0.0;
          
          vec2 center = vec2(sin(t * 0.8 + rnd * 6.28) * 0.2, cos(t * 0.7 + rnd * 6.28) * 0.2);
          float dist = length(grid - center);
          float size = 0.012 + 0.016 * sin(t * 2.0 + rnd * 6.28);
          float sparkle = smoothstep(size, 0.0, dist);
          return sparkle * (0.4 + 0.6 * sin(t * 2.5 + rnd * 10.0));
        }

        void main() {
          vec2 uv = vUv;
          uv.x *= u_ratio;
          float t = u_time * u_speed;

          // 4 Orbital paths for Volumetric Violet / Lilac Aura Spheres
          vec2 orb1_pos = vec2(
            (0.25 + 0.10 * sin(t * 0.42)) * u_ratio,
            0.28 + 0.08 * cos(t * 0.35)
          );
          vec2 orb2_pos = vec2(
            (0.75 + 0.11 * cos(t * 0.48 + 1.2)) * u_ratio,
            0.25 + 0.10 * sin(t * 0.39 + 0.8)
          );
          vec2 orb3_pos = vec2(
            (0.50 + 0.12 * sin(t * 0.36 + 2.4)) * u_ratio,
            0.72 + 0.09 * cos(t * 0.44 + 1.5)
          );
          vec2 orb4_pos = vec2(
            (0.85 + 0.08 * cos(t * 0.55 + 3.1)) * u_ratio,
            0.82 + 0.07 * sin(t * 0.50 + 2.0)
          );

          // Volumetric densities
          float d1 = auraOrb(uv, orb1_pos, 0.44 * u_ratio);
          float d2 = auraOrb(uv, orb2_pos, 0.48 * u_ratio);
          float d3 = auraOrb(uv, orb3_pos, 0.50 * u_ratio);
          float d4 = auraOrb(uv, orb4_pos, 0.38 * u_ratio);

          // Authentic Lavender Haze Palettes
          vec3 colAmethyst = vec3(0.50, 0.38, 0.78); // #8062C7 deep velvet violet
          vec3 colLilac    = vec3(0.75, 0.52, 0.98); // #C084FC luminous lilac
          vec3 colOrchid   = vec3(0.85, 0.45, 0.92); // #D946EF orchid magenta
          vec3 colMist     = vec3(0.51, 0.55, 0.97); // #818CF8 misty periwinkle

          // Composite aura colors with natural weight
          vec3 auraColor = vec3(0.0);
          float totalDensity = 0.0;

          auraColor += colAmethyst * d1;
          totalDensity += d1 * 0.22;

          auraColor += colLilac * d2;
          totalDensity += d2 * 0.24;

          auraColor += colOrchid * d3;
          totalDensity += d3 * 0.20;

          auraColor += colMist * d4;
          totalDensity += d4 * 0.18;

          // Normalize color if density exists
          if (totalDensity > 0.001) {
            auraColor /= (d1 + d2 + d3 + d4 + 0.001);
          }

          // Amethyst Stardust Twinkle
          float stars = stardust(uv, t);
          if (stars > 0.01) {
            vec3 starColor = vec3(0.95, 0.88, 1.0);
            auraColor = mix(auraColor, starColor, stars * 0.7);
            totalDensity += stars * 0.45;
          }

          // Calculated final alpha - clamped to keep background light and legible
          float finalAlpha = clamp(totalDensity * u_opacity, 0.0, 0.32);

          // CRITICAL: WebGL Premultiplied Alpha Output
          // In WebGL, RGB MUST be premultiplied by finalAlpha so the browser compositor
          // performs: Pixel = (auraColor * finalAlpha) + Background * (1 - finalAlpha)
          // This prevents washing out to white and cleanly tints the #F7F3FF background.
          gl_FragColor = vec4(auraColor * finalAlpha, finalAlpha);
        }
      `;

      if (!canvas) return null;
      const context = (canvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: true,
        powerPreference: 'low-power',
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
      }) || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;

      if (!context) {
        console.warn('[LavenderHaze] WebGL not supported');
        return null;
      }

      gl = context;

      // Standard premultiplied alpha blending
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0.0, 0.0, 0.0, 0.0);

      vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
      fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
      if (!vertexShader || !fragmentShader) return null;

      shaderProgram = gl.createProgram();
      if (!shaderProgram) return null;

      gl.attachShader(shaderProgram, vertexShader);
      gl.attachShader(shaderProgram, fragmentShader);
      gl.linkProgram(shaderProgram);

      if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.warn('[LavenderHaze] Link error:', gl.getProgramInfoLog(shaderProgram));
        return null;
      }

      gl.useProgram(shaderProgram);

      uniforms.u_time = gl.getUniformLocation(shaderProgram, 'u_time');
      uniforms.u_ratio = gl.getUniformLocation(shaderProgram, 'u_ratio');
      uniforms.u_speed = gl.getUniformLocation(shaderProgram, 'u_speed');
      uniforms.u_opacity = gl.getUniformLocation(shaderProgram, 'u_opacity');

      const positionLocation = gl.getAttribLocation(shaderProgram, 'a_position');
      vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );

      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
      }, false);

      canvas.addEventListener('webglcontextrestored', () => {
        initShader();
        resizeCanvas();
      }, false);

      return gl;
    }

    function createShader(glCtx: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
      const shader = glCtx.createShader(type);
      if (!shader) return null;
      glCtx.shaderSource(shader, source);
      glCtx.compileShader(shader);
      if (!glCtx.getShaderParameter(shader, glCtx.COMPILE_STATUS)) {
        console.warn('[LavenderHaze] Compile error:', glCtx.getShaderInfoLog(shader));
        glCtx.deleteShader(shader);
        return null;
      }
      return shader;
    }

    function resizeCanvas() {
      if (!canvas || !gl || !shaderProgram) return;
      const parent = canvas.parentElement;
      const width = parent?.clientWidth || window.innerWidth;
      const height = parent?.clientHeight || window.innerHeight;

      const dpr = 1.0;
      const targetWidth = Math.floor(width * dpr);
      const targetHeight = Math.floor(height * dpr);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
        
        gl.useProgram(shaderProgram);
        if (uniforms.u_ratio) {
          gl.uniform1f(uniforms.u_ratio, canvas.width / canvas.height);
        }
      }
    }

    function render(currentTime: number) {
      if (isCleanedUp) return;

      if (currentTime - lastRenderTime >= 15) {
        lastRenderTime = currentTime;

        if (!pausedRef.current && !document.hidden && gl && shaderProgram) {
          gl.useProgram(shaderProgram);
          gl.clear(gl.COLOR_BUFFER_BIT);

          if (uniforms.u_time) {
            gl.uniform1f(uniforms.u_time, currentTime);
          }
          if (uniforms.u_speed) {
            gl.uniform1f(uniforms.u_speed, speedRef.current);
          }
          if (uniforms.u_opacity) {
            gl.uniform1f(uniforms.u_opacity, opacityRef.current);
          }

          gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    }

    return () => {
      isCleanedUp = true;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeListener);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', resizeListener);
      }

      if (gl) {
        if (vertexBuffer) gl.deleteBuffer(vertexBuffer);
        if (vertexShader) gl.deleteShader(vertexShader);
        if (fragmentShader) gl.deleteShader(fragmentShader);
        if (shaderProgram) gl.deleteProgram(shaderProgram);
      }
    };
  }, []);

  return (
    <div className={className} style={style}>
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ pointerEvents: 'none' }}
      />
    </div>
  );
};

export default LavenderHaze;
