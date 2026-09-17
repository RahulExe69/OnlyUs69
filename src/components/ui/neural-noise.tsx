import React, { useEffect, useRef } from 'react';

export interface NeuralNoiseProps {
  color?: [number, number, number] | number[];
  opacity?: number;
  speed?: number;
  paused?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function NeuralNoise({ 
  color = [0.9, 0.2, 0.4], 
  opacity = 0.95, 
  speed = 0.001,
  paused = false,
  className,
  style
}: NeuralNoiseProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    let gl: WebGLRenderingContext | null = null;
    let uniforms: Record<string, WebGLUniformLocation | null> = {};
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

    if (uniforms.u_color) {
      gl.uniform3f(uniforms.u_color, color[0], color[1], color[2]);
    }
    if (uniforms.u_speed) {
      gl.uniform1f(uniforms.u_speed, speed);
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

      // Optimized lag-free procedural fragment shader:
      // - Restores full 15-octave harmonic nebula filaments and cosmic bloom
      // - Autonomous drifting nebula core (no mouse/touch tracking needed)
      // - Constant precomputed 2D rotation matrix ROT = mat2(cos(1), sin(1), -sin(1), cos(1))
      const fsSource = `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif

        varying vec2 vUv;
        uniform float u_time;
        uniform float u_ratio;
        uniform vec3 u_color;
        uniform float u_speed;

        // Constant precomputed rotation matrix for angle 1.0 radian:
        // cos(1.0) = 0.5403023, sin(1.0) = 0.8414710
        const mat2 ROT = mat2(0.5403023, 0.8414710, -0.8414710, 0.5403023);

        float neuro_shape(vec2 uv, float t, float p) {
          vec2 sine_acc = vec2(0.0);
          vec2 res = vec2(0.0);
          float scale = 8.0;
          for (int j = 0; j < 15; j++) {
            uv = ROT * uv;
            sine_acc = ROT * sine_acc;
            vec2 layer = uv * scale + float(j) + sine_acc - t;
            sine_acc += sin(layer) + 2.4 * p;
            res += (0.5 + 0.5 * cos(layer)) / scale;
            scale *= 1.2;
          }
          return res.x + res.y;
        }

        void main() {
          vec2 uv = 0.5 * vUv;
          uv.x *= u_ratio;
          float t = u_speed * u_time;

          // Autonomous celestial nebula vortex (smoothly breathes and drifts across the screen)
          vec2 nebula_center = vec2(
            0.5 + 0.16 * sin(t * 0.35 + 0.8),
            0.5 + 0.12 * cos(t * 0.28)
          );
          vec2 pointer = vUv - nebula_center;
          pointer.x *= u_ratio;
          float p = clamp(length(pointer), 0.0, 1.0);
          p = 0.5 * pow(1.0 - p, 2.0);

          float noise = neuro_shape(uv, t, p);
          noise = 1.2 * pow(noise, 3.0);
          noise += pow(noise, 10.0);
          noise = max(0.0, noise - 0.5);
          noise *= (1.0 - length(vUv - 0.5));
          vec3 col = u_color * noise;
          gl_FragColor = vec4(col, noise);
        }
      `;

      if (!canvasEl) return null;
      const context = (canvasEl.getContext('webgl', { 
        powerPreference: 'low-power',
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
      }) ||
        canvasEl.getContext('experimental-webgl')) as WebGLRenderingContext | null;
      
      if (!context) {
        console.warn('[NeuralNoise] WebGL not supported');
        return null;
      }

      vertexShader = createShader(context, vsSource, context.VERTEX_SHADER);
      fragmentShader = createShader(context, fsSource, context.FRAGMENT_SHADER);
      if (!vertexShader || !fragmentShader) return null;

      shaderProgram = createProgram(context, vertexShader, fragmentShader);
      if (!shaderProgram) return null;

      uniforms = getUniforms(context, shaderProgram);
      const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
      vertexBuffer = context.createBuffer();
      context.bindBuffer(context.ARRAY_BUFFER, vertexBuffer);
      context.bufferData(context.ARRAY_BUFFER, vertices, context.STATIC_DRAW);
      context.useProgram(shaderProgram);
      const positionLocation = context.getAttribLocation(shaderProgram, 'a_position');
      context.enableVertexAttribArray(positionLocation);
      context.vertexAttribPointer(positionLocation, 2, context.FLOAT, false, 0, 0);
      return context;
    }

    function createShader(glCtx: WebGLRenderingContext, source: string, type: number): WebGLShader | null {
      const shader = glCtx.createShader(type);
      if (!shader) return null;
      glCtx.shaderSource(shader, source);
      glCtx.compileShader(shader);
      if (!glCtx.getShaderParameter(shader, glCtx.COMPILE_STATUS)) {
        console.error('[NeuralNoise] Shader compile error:', glCtx.getShaderInfoLog(shader));
        glCtx.deleteShader(shader);
        return null;
      }
      return shader;
    }

    function createProgram(glCtx: WebGLRenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram | null {
      const program = glCtx.createProgram();
      if (!program) return null;
      glCtx.attachShader(program, vs);
      glCtx.attachShader(program, fs);
      glCtx.linkProgram(program);
      if (!glCtx.getProgramParameter(program, glCtx.LINK_STATUS)) {
        console.error('[NeuralNoise] Program link error:', glCtx.getProgramInfoLog(program));
        return null;
      }
      return program;
    }

    function getUniforms(glCtx: WebGLRenderingContext, program: WebGLProgram): Record<string, WebGLUniformLocation | null> {
      const result: Record<string, WebGLUniformLocation | null> = {};
      const uniformCount = glCtx.getProgramParameter(program, glCtx.ACTIVE_UNIFORMS);
      for (let i = 0; i < uniformCount; i++) {
        const info = glCtx.getActiveUniform(program, i);
        if (info) {
          result[info.name] = glCtx.getUniformLocation(program, info.name);
        }
      }
      return result;
    }

    function render(currentTime: number) {
      if (isCleanedUp) return;

      // Throttle rendering when tab is hidden or paused
      if (!document.hidden && !pausedRef.current && gl) {
        // Smooth 60fps throttle to avoid burning battery on 90Hz/120Hz screens
        if (currentTime - lastRenderTime >= 15) {
          lastRenderTime = currentTime;
          if (uniforms.u_time) {
            gl.uniform1f(uniforms.u_time, currentTime);
          }
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    }

    function resizeCanvas() {
      if (!canvasEl || !gl) return;
      // Cap devicePixelRatio at 1.0 for buttery smooth 60fps performance without visual loss
      const devicePixelRatio = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 1.0);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvasEl.width = Math.max(1, Math.floor(w * devicePixelRatio));
      canvasEl.height = Math.max(1, Math.floor(h * devicePixelRatio));
      if (uniforms && uniforms.u_ratio) {
        gl.uniform1f(uniforms.u_ratio, canvasEl.width / (canvasEl.height || 1));
      }
      gl.viewport(0, 0, canvasEl.width, canvasEl.height);
    }

    return () => {
      isCleanedUp = true;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener('resize', resizeListener);

      // Clean up GPU resources
      if (gl && !gl.isContextLost()) {
        if (vertexBuffer) gl.deleteBuffer(vertexBuffer);
        if (vertexShader) gl.deleteShader(vertexShader);
        if (fragmentShader) gl.deleteShader(fragmentShader);
        if (shaderProgram) gl.deleteProgram(shaderProgram);
      }
    };
  }, [color, speed]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity,
        zIndex: 0,
        ...style,
      }}
    />
  );
}
export default NeuralNoise;
