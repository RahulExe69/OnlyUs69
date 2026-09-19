import React, { useEffect, useRef } from 'react';
import { ShaderThemeProps } from './types';

/**
 * MoonlightShader
 * "Midnight Sky & Luminous Moon"
 * 
 * An elegant, serene night sky WebGL shader for the Moonlight theme:
 * - Serene Night Sky: Deep midnight blue and obsidian atmosphere (#0B0D18 to #11121B)
 * - Bright Glowing Moon: Suspended luminous moon with volumetric lunar halo, atmospheric glow,
 *   and realistic procedural lunar crater textures
 * - Multi-Layer Starfield: Distant micro-stars, medium twinkling stars, and prominent cross-flare stars
 * - Periodic Shooting Star: Occasional meteor streak drifting gracefully across the celestial sky
 * - Zero Touch Response: Completely passive and tranquil background without touch or cursor distortion
 * - Low-Power WebGL Profile: Smooth 60 FPS, DPR capped at 1.0, premultiplied alpha, optimized for chat contrast
 */
export const MoonlightShader: React.FC<ShaderThemeProps> = ({
  className = "absolute inset-0 pointer-events-none z-0 overflow-hidden",
  paused = false,
  opacity = 1.0,
  speed = 1.0,
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;

  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    let animId: number;
    let gl: WebGLRenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let isVisible = !document.hidden;

    let lastTime = performance.now();
    let accumulatedTime = Math.random() * 50.0;

    const handleResize = () => resizeCanvas();
    window.addEventListener('resize', handleResize, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize, { passive: true });
    }

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && canvasEl.parentElement) {
      resizeObserver = new ResizeObserver(() => resizeCanvas());
      resizeObserver.observe(canvasEl.parentElement);
    }

    function initWebGL(): WebGLRenderingContext | null {
      if (!canvasEl) return null;
      const context = (canvasEl.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        powerPreference: 'low-power',
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
      }) || canvasEl.getContext('experimental-webgl')) as WebGLRenderingContext | null;

      if (!context) return null;

      const vsSource = `
        precision mediump float;
        attribute vec2 a_position;
        varying vec2 vUv;
        void main() {
          vUv = 0.5 * (a_position + 1.0);
          gl_Position = vec4(a_position, 0.0, 1.0);
        }
      `;

      // Moonlight Procedural WebGL Fragment Shader: Night Sky with Stars & Bright Moon
      const fsSource = `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif

        varying vec2 vUv;
        uniform float u_time;
        uniform float u_ratio;
        uniform float u_opacity;

        // Hash function for procedural stars & noise
        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        // 2D Value Noise
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);

          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));

          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }

        // Fractional Brownian Motion for cosmic nebula & lunar craters
        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p = rot * p * 2.02 + vec2(1.2, 5.7);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec2 uv = vUv;
          // Aspect-corrected coordinate space with center at (0, 0)
          vec2 p = (uv - 0.5) * vec2(u_ratio, 1.0);

          // Theme Color Palette
          vec3 colSkyDeep   = vec3(0.035, 0.039, 0.067); // #090A11 Deepest Night Sky
          vec3 colSkyIndigo = vec3(0.067, 0.071, 0.114); // #11121D Midnight Obsidian
          vec3 colMoonPearl = vec3(0.965, 0.960, 1.000); // #F6F4FF Celestial Pearl Light
          vec3 colMoonGlow  = vec3(0.820, 0.760, 1.000); // #D1C2FF Soft Lunar Aura
          vec3 colStarCyan  = vec3(0.420, 0.780, 1.000); // #6BC7FF Pale Starlight Cyan
          vec3 colStarLilac = vec3(0.760, 0.680, 1.000); // #C2ADFF Moonlight Lilac

          vec3 finalColor = vec3(0.0);
          float totalAlpha = 0.0;

          // --------------------------------------------------------------------
          // 1. NIGHT SKY ATMOSPHERE & SUBTLE COSMIC NEBULA
          // --------------------------------------------------------------------
          // Smooth vertical sky gradient
          float skyGrad = smoothstep(-0.6, 0.6, p.y);
          vec3 skyBase = mix(colSkyDeep, colSkyIndigo, skyGrad);
          finalColor += skyBase;
          totalAlpha += 0.35;

          // Very faint, ethereal cosmic dust drifting in the deep night
          float tNebula = u_time * 0.04;
          float nebula1 = fbm(p * 1.8 + vec2(tNebula * 0.2, -tNebula * 0.15));
          float nebula2 = fbm(p * 2.4 - vec2(tNebula * 0.1, tNebula * 0.25));
          float nebulaHaze = smoothstep(0.42, 0.78, nebula1 * 0.6 + nebula2 * 0.4) * 0.16;

          finalColor += mix(colStarLilac, colStarCyan, nebula2) * nebulaHaze;
          totalAlpha += nebulaHaze * 0.4;

          // --------------------------------------------------------------------
          // 2. THE BRIGHT GLOWING MOON
          // --------------------------------------------------------------------
          // Suspended gracefully in the upper celestial hemisphere
          vec2 moonPos = vec2(0.24 * u_ratio, 0.22);
          float moonRadius = 0.084;
          vec2 dMoon = p - moonPos;
          float distMoon = length(dMoon);

          // Volumetric Lunar Corona & Diffuse Atmospheric Radiance
          // Wide soft outer glow
          float moonOuterGlow = 0.08 / (distMoon * 1.6 + 0.12);
          moonOuterGlow = pow(clamp(moonOuterGlow, 0.0, 1.2), 1.35);

          // Intense inner corona glow close to the lunar rim
          float moonInnerGlow = 0.045 / (distMoon * 3.2 + 0.04);
          moonInnerGlow = pow(clamp(moonInnerGlow, 0.0, 1.5), 1.5);

          finalColor += colMoonGlow * (moonOuterGlow * 0.45);
          finalColor += colMoonPearl * (moonInnerGlow * 0.65);
          totalAlpha += moonOuterGlow * 0.35 + moonInnerGlow * 0.55;

          // --- BRIGHT LUNAR DISK WITH REALISTIC SURFACE DETAILS ---
          if (distMoon < moonRadius) {
            vec2 norm2D = dMoon / moonRadius;
            float z = sqrt(max(0.0, 1.0 - dot(norm2D, norm2D)));

            // Procedural lunar maria & crater plains
            float maria = fbm(norm2D * 16.0);
            float fineCraters = fbm(norm2D * 38.0);
            float surfaceDetail = mix(0.85, 1.0, maria * 0.7 + fineCraters * 0.3);

            // Bright, luminous lunar illumination
            // Glowing bright disk with soft spherical limb-darkening at edges
            float limb = pow(z, 0.28);
            float innerCore = smoothstep(0.0, 1.0, z);

            // Radiant moon surface color: bright, luminous white with gentle lunar maria
            vec3 moonSurface = mix(colMoonGlow * 0.78, colMoonPearl, surfaceDetail);
            moonSurface = mix(moonSurface, vec3(1.0, 0.99, 0.97), innerCore * 0.4) * limb;

            // Intense bright rim glow
            float rimGlow = pow(1.0 - z, 3.0) * 0.35;
            moonSurface += colMoonPearl * rimGlow;

            // Sharp, anti-aliased lunar perimeter
            float moonMask = smoothstep(moonRadius, moonRadius - 0.002, distMoon);
            finalColor = mix(finalColor, moonSurface * 1.4, moonMask);
            totalAlpha = max(totalAlpha, moonMask * 0.98);
          }

          // --------------------------------------------------------------------
          // 3. MULTI-LAYER STARFIELD (TWINKLING STARS ACROSS NIGHT SKY)
          // --------------------------------------------------------------------
          
          // Layer A: Dense field of distant micro-stars
          vec2 microGrid = p * 42.0;
          vec2 microId = floor(microGrid);
          float microRnd = hash(microId);
          if (microRnd > 0.88) {
            vec2 microFract = fract(microGrid) - 0.5;
            float mDist = length(microFract);
            float mTwinkle = sin(u_time * (1.8 + microRnd * 4.0) + microRnd * 6.28) * 0.35 + 0.65;
            float mCore = smoothstep(0.08, 0.01, mDist) * 0.55 * mTwinkle;
            vec3 mCol = mix(colMoonPearl, colStarCyan, microRnd * 0.5);
            finalColor += mCol * mCore;
            totalAlpha += mCore * 0.5;
          }

          // Layer B: Medium twinkling celestial stars
          vec2 medGrid = p * 20.0;
          vec2 medId = floor(medGrid);
          float medRnd = hash(medId);
          if (medRnd > 0.91) {
            vec2 medFract = fract(medGrid) - 0.5;
            float medDist = length(medFract);
            float medTwinkle = sin(u_time * (2.2 + medRnd * 3.5) + medRnd * 6.28) * 0.45 + 0.55;
            float medCore = (0.010 / (medDist + 0.045)) * medTwinkle;
            vec3 medCol = mix(colMoonPearl, colStarLilac, fract(medRnd * 17.3));
            finalColor += medCol * medCore;
            totalAlpha += medCore * 0.6;
          }

          // Layer C: Prominent bright stars with cross-diffraction flares
          vec2 brightGrid = p * 11.0;
          vec2 brightId = floor(brightGrid);
          float brightRnd = hash(brightId);
          if (brightRnd > 0.94) {
            vec2 bFract = fract(brightGrid) - 0.5;
            float bDist = length(bFract);
            float bTwinkle = sin(u_time * (1.5 + brightRnd * 2.8) + brightRnd * 6.28) * 0.4 + 0.6;

            // Delicate 4-point cross diffraction flare
            float flare = max(
              smoothstep(0.22, 0.0, abs(bFract.x)) * smoothstep(0.024, 0.0, abs(bFract.y)),
              smoothstep(0.22, 0.0, abs(bFract.y)) * smoothstep(0.024, 0.0, abs(bFract.x))
            ) * 0.75;

            float bCore = (0.014 / (bDist + 0.038)) * bTwinkle;
            vec3 bCol = mix(colMoonPearl, colStarCyan, fract(brightRnd * 7.9));

            finalColor += bCol * (bCore + flare * bTwinkle * 0.85);
            totalAlpha += (bCore * 0.7 + flare * 0.5);
          }

          // --------------------------------------------------------------------
          // 4. PERIODIC GENTLE SHOOTING STAR
          // --------------------------------------------------------------------
          // Streaks across the night sky every ~8.5 seconds
          float shootCycle = mod(u_time * 0.35, 8.5);
          if (shootCycle < 1.0) {
            float progress = shootCycle / 1.0;
            vec2 shootOrigin = vec2(-0.55 * u_ratio, 0.40);
            vec2 shootDir = normalize(vec2(1.25, -0.60));
            vec2 shootHead = shootOrigin + shootDir * (progress * 1.4);

            vec2 toHead = p - shootHead;
            float projection = dot(toHead, -shootDir);

            if (projection > 0.0 && projection < 0.26) {
              float perpDist = length(toHead + shootDir * projection);
              float streak = (1.0 - projection / 0.26) * smoothstep(0.006, 0.0, perpDist);
              finalColor += colMoonPearl * (streak * 1.6) + colStarCyan * (streak * 0.9);
              totalAlpha += streak * 0.85;
            }
          }

          // --------------------------------------------------------------------
          // 5. CHAT READABILITY VIGNETTE & PREMULTIPLIED OUTPUT
          // --------------------------------------------------------------------
          // Gentle radial vignette keeping the center chat column comfortable for reading
          float vignette = smoothstep(1.4, 0.35, length(uv - vec2(0.5, 0.5)));
          totalAlpha *= vignette;

          // Global opacity multiplier
          totalAlpha = clamp(totalAlpha * u_opacity, 0.0, 0.88);

          // WebGL premultiplied alpha composite over #11121B theme background
          gl_FragColor = vec4(finalColor * totalAlpha, totalAlpha);
        }
      `;

      function createShader(glCtx: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
        const shader = glCtx.createShader(type);
        if (!shader) return null;
        glCtx.shaderSource(shader, source);
        glCtx.compileShader(shader);
        if (!glCtx.getShaderParameter(shader, glCtx.COMPILE_STATUS)) {
          console.warn('MoonlightShader compilation error:', glCtx.getShaderInfoLog(shader));
          glCtx.deleteShader(shader);
          return null;
        }
        return shader;
      }

      const vs = createShader(context, context.VERTEX_SHADER, vsSource);
      const fs = createShader(context, context.FRAGMENT_SHADER, fsSource);

      if (!vs || !fs) return null;

      const prog = context.createProgram();
      if (!prog) return null;

      context.attachShader(prog, vs);
      context.attachShader(prog, fs);
      context.linkProgram(prog);

      if (!context.getProgramParameter(prog, context.LINK_STATUS)) {
        console.warn('MoonlightShader program link error:', context.getProgramInfoLog(prog));
        return null;
      }

      program = prog;

      const positionBuffer = context.createBuffer();
      context.bindBuffer(context.ARRAY_BUFFER, positionBuffer);
      context.bufferData(
        context.ARRAY_BUFFER,
        new Float32Array([
          -1.0, -1.0,
           1.0, -1.0,
          -1.0,  1.0,
          -1.0,  1.0,
           1.0, -1.0,
           1.0,  1.0,
        ]),
        context.STATIC_DRAW
      );

      const posAttrib = context.getAttribLocation(program, 'a_position');
      context.enableVertexAttribArray(posAttrib);
      context.vertexAttribPointer(posAttrib, 2, context.FLOAT, false, 0, 0);

      // Premultiplied alpha blending
      context.enable(context.BLEND);
      context.blendFunc(context.ONE, context.ONE_MINUS_SRC_ALPHA);

      return context;
    }

    function resizeCanvas() {
      if (!canvasEl || !gl || !program) return;
      const parent = canvasEl.parentElement;
      const w = parent?.clientWidth || window.innerWidth;
      const h = parent?.clientHeight || window.innerHeight;

      // Cap DPR at 1.0 for low-power GPU efficiency and battery preservation
      const dpr = Math.min(window.devicePixelRatio || 1, 1.0);
      const pixelW = Math.floor(w * dpr);
      const pixelH = Math.floor(h * dpr);

      if (canvasEl.width !== pixelW || canvasEl.height !== pixelH) {
        canvasEl.width = pixelW;
        canvasEl.height = pixelH;
      }

      gl.viewport(0, 0, pixelW, pixelH);

      const uRatio = gl.getUniformLocation(program, 'u_ratio');
      if (uRatio) {
        gl.useProgram(program);
        gl.uniform1f(uRatio, pixelW / (pixelH || 1));
      }
    }

    gl = initWebGL();
    if (!gl || !program) return;

    resizeCanvas();

    const uTimeLoc = gl.getUniformLocation(program, 'u_time');
    const uRatioLoc = gl.getUniformLocation(program, 'u_ratio');
    const uOpacityLoc = gl.getUniformLocation(program, 'u_opacity');

    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible) {
        lastTime = performance.now();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(animId);
    };

    const handleContextRestored = () => {
      gl = initWebGL();
      if (gl) {
        resizeCanvas();
        lastTime = performance.now();
        render(performance.now());
      }
    };

    canvasEl.addEventListener('webglcontextlost', handleContextLost);
    canvasEl.addEventListener('webglcontextrestored', handleContextRestored);

    function render(time: number) {
      if (!isVisible || pausedRef.current || !gl || !program) {
        animId = requestAnimationFrame(render);
        return;
      }

      const delta = Math.min(time - lastTime, 64) * 0.001;
      lastTime = time;

      accumulatedTime += delta * speedRef.current;

      gl.useProgram(program);

      if (uTimeLoc) gl.uniform1f(uTimeLoc, accumulatedTime);
      if (uOpacityLoc) gl.uniform1f(uOpacityLoc, opacityRef.current);
      if (uRatioLoc) {
        const ratio = (canvasEl?.width || 1) / (canvasEl?.height || 1);
        gl.uniform1f(uRatioLoc, ratio);
      }

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animId = requestAnimationFrame(render);
    }

    render(performance.now());

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
      if (resizeObserver) resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (canvasEl) {
        canvasEl.removeEventListener('webglcontextlost', handleContextLost);
        canvasEl.removeEventListener('webglcontextrestored', handleContextRestored);
      }
      if (gl && program) {
        gl.deleteProgram(program);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
};
