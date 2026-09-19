import React, { useEffect, useRef } from 'react';
import { ShaderThemeProps } from './types';

/**
 * MoonlightShader
 * "Celestial Astrolabe & Lunar Auroral Veil"
 * 
 * An elevated, dreamlike celestial WebGL shader for the Moonlight theme:
 * - 3D Gyroscopic Astrolabe Rings: Concentric orbital rings revolving around a suspended crescent moon
 *   with rotating planetary beads and true 3D lunar occlusion
 * - Lunar Auroral Silks: Flowing, translucent ribbons of moonlit aurora undulating across the midnight sky
 * - Gravitational Lensing & Reactive Cosmic Dust: Interactive touch/cursor distortion with refractive ripples
 * - Astrolabe Constellation Grid: Twinkling celestial stars with faint geometric alignment rays
 * - Optimized WebGL Low-Power Profile: Smooth 60 FPS, premultiplied alpha, perfectly balanced for chat contrast
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

    let targetMouseX = 0.0;
    let targetMouseY = 0.0;
    let currentMouseX = 0.0;
    let currentMouseY = 0.0;
    let mouseClickWave = 0.0;

    let lastTime = performance.now();
    let accumulatedTime = Math.random() * 50.0;

    const handleMouseMove = (e: MouseEvent) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      targetMouseX = (e.clientX / w) * 2.0 - 1.0;
      targetMouseY = (e.clientY / h) * 2.0 - 1.0;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const w = window.innerWidth || 1;
        const h = window.innerHeight || 1;
        targetMouseX = (e.touches[0].clientX / w) * 2.0 - 1.0;
        targetMouseY = (e.touches[0].clientY / h) * 2.0 - 1.0;
        mouseClickWave = 1.0;
      }
    };

    const handleClick = () => {
      mouseClickWave = 1.0;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('click', handleClick, { passive: true });

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

      // Moonlight Procedural WebGL Fragment Shader: Celestial Astrolabe & Auroral Veil
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
        uniform vec2 u_mouse;
        uniform float u_ripple;

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

        // Fractional Brownian Motion for cosmic nebulae & lunar surface
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

        // 2D Rotation Helper
        vec2 rotate(vec2 p, float a) {
          float s = sin(a);
          float c = cos(a);
          return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
        }

        // Helper to draw an ellipse ring with glow and rotating orbital bead
        void drawAstrolabeRing(
          vec2 p,
          vec2 center,
          float rx,
          float ry,
          float rotAngle,
          float ringThick,
          float beadAngle,
          vec3 ringColor,
          float moonRadius,
          bool frontZ,
          inout vec3 colorAcc,
          inout float alphaAcc
        ) {
          vec2 dP = p - center;
          vec2 rP = rotate(dP, -rotAngle);

          // Normalized ellipse distance
          float normDist = length(rP / vec2(rx, ry));
          float distToEdge = abs(normDist - 1.0) * min(rx, ry);

          // Sharp ring stroke with surrounding volumetric neon glow
          float ringSharp = smoothstep(ringThick, ringThick * 0.2, distToEdge);
          float ringGlow  = (ringThick * 0.35) / (distToEdge + ringThick * 0.8);

          // 3D Occlusion: if the ring segment is on the back hemisphere and behind the moon sphere, occlude it
          float distToMoonCenter = length(dP);
          if (!frontZ && distToMoonCenter < moonRadius) {
            return;
          }

          // Planetary bead traveling along the ring arc
          vec2 beadPos = vec2(rx * cos(beadAngle), ry * sin(beadAngle));
          float distToBead = length(rP - beadPos);
          float beadCore = smoothstep(0.008, 0.001, distToBead);
          float beadGlow = 0.006 / (distToBead + 0.012);

          float totalRing = ringSharp * 0.9 + ringGlow * 0.45;
          float totalBead = beadCore * 1.5 + beadGlow * 0.85;

          // Add to accumulators
          colorAcc += ringColor * totalRing;
          colorAcc += (ringColor * 0.7 + vec3(0.9, 0.95, 1.0) * 0.6) * totalBead;
          alphaAcc += (totalRing * 0.55 + totalBead * 0.85);
        }

        void main() {
          vec2 uv = vUv;
          // Aspect-corrected coordinate space with center at (0, 0)
          vec2 p = (uv - 0.5) * vec2(u_ratio, 1.0);

          // Interactive mouse / touch parallax
          vec2 parallax = u_mouse * 0.04;
          p += parallax;

          // Gravitational lens ripple triggered by clicks or touch
          if (u_ripple > 0.01) {
            float distM = length(p - u_mouse * vec2(u_ratio, 1.0) * 0.5);
            float rippleWave = sin(distM * 35.0 - u_time * 6.0) * exp(-distM * 4.0) * u_ripple * 0.02;
            p += normalize(p + 0.0001) * rippleWave;
          }

          // Theme Color Palette
          vec3 colMidnight  = vec3(0.067, 0.071, 0.106); // #11121B Deep Obsidian Midnight
          vec3 colLilac     = vec3(0.714, 0.612, 1.000); // #B69CFF Moonlight Lilac
          vec3 colCyan      = vec3(0.329, 0.757, 1.000); // #54C1FF Starlight Cyan
          vec3 colMoonPearl = vec3(0.965, 0.960, 1.000); // #F6F4FF Celestial Pearl
          vec3 colDeepAura  = vec3(0.482, 0.353, 0.902); // #7B5AE6 Deep Violet Space

          vec3 finalColor = vec3(0.0);
          float totalAlpha = 0.0;

          // --------------------------------------------------------------------
          // 1. ETHEREAL LUNAR AURORAL VEIL (Silk Ribbons drifting across canvas)
          // --------------------------------------------------------------------
          // Sinuous harmonic wave sheets creating a soft translucent aurora
          float t = u_time * 0.25;

          // Ribbon 1: Upper Celestial Lilac Veil
          float wave1 = sin(p.x * 1.8 + t * 0.8) * 0.16 + cos(p.x * 3.2 - t * 0.6) * 0.08 + sin(p.x * 5.1 + t) * 0.03;
          float distW1 = abs(p.y - 0.12 - wave1);
          float glowW1 = 0.022 / (distW1 + 0.065);
          glowW1 = pow(glowW1, 1.3);

          // Ribbon 2: Diagonal Cyan Starlight Ribbon
          float wave2 = sin(p.x * 2.2 - t * 0.9 + 1.5) * 0.20 + cos(p.x * 4.1 + t * 0.5) * 0.07;
          float distW2 = abs(p.y + 0.15 - wave2);
          float glowW2 = 0.018 / (distW2 + 0.075);
          glowW2 = pow(glowW2, 1.3);

          // Ribbon 3: Deep Atmospheric Shimmer (diagonal sweeping aura)
          float sweep = sin(p.x * 1.4 + p.y * 1.8 - t * 0.5);
          float sweepFbm = fbm(p * 2.2 + vec2(t * 0.08, -t * 0.05));
          float auroraMist = smoothstep(0.3, 0.8, sweep * 0.5 + sweepFbm * 0.5) * 0.22;

          finalColor += colLilac * (glowW1 * 0.65);
          finalColor += colCyan * (glowW2 * 0.55);
          finalColor += colDeepAura * auroraMist;
          totalAlpha += glowW1 * 0.40 + glowW2 * 0.35 + auroraMist * 0.45;

          // --------------------------------------------------------------------
          // 2. CELESTIAL ASTROLABE CENTERPIECE (The Suspended Moon & Orbital Rings)
          // --------------------------------------------------------------------
          // Suspended gracefully in the upper-right hemisphere
          vec2 moonPos = vec2(0.25 * u_ratio, 0.20) + u_mouse * 0.02;
          float moonRadius = 0.092;
          vec2 dMoon = p - moonPos;
          float distMoon = length(dMoon);

          // Volumetric Lunar Corona & Diffuse Radiance
          float moonHalo = 0.075 / (distMoon * 1.7 + 0.06);
          moonHalo = clamp(moonHalo, 0.0, 1.4);

          // Radial Astrolabe Navigation Rays (subtle 8-point compass rays)
          float rayAngle = atan(dMoon.y, dMoon.x);
          float compassRays = pow(abs(cos(rayAngle * 4.0 + u_time * 0.05)), 18.0) * (0.04 / (distMoon * 2.5 + 0.2));

          finalColor += colLilac * (moonHalo * 0.5) + colCyan * (moonHalo * 0.25);
          finalColor += colMoonPearl * compassRays;
          totalAlpha += moonHalo * 0.35 + compassRays * 0.6;

          // --- GYROSCOPIC ASTROLABE RINGS ---
          // Ring 1 (Inner Astrolabe Ring): Tilted ~35 deg, rotating planetary bead
          drawAstrolabeRing(
            p, moonPos,
            moonRadius * 1.65, moonRadius * 0.72,
            0.58 + sin(u_time * 0.1) * 0.08,
            0.0022,
            u_time * 0.85,
            colLilac,
            moonRadius,
            sin(u_time * 0.85) > 0.0, // 3D depth check
            finalColor,
            totalAlpha
          );

          // Ring 2 (Middle Orbital Astrolabe Ring): Tilted ~ -45 deg, counter-rotating
          drawAstrolabeRing(
            p, moonPos,
            moonRadius * 2.35, moonRadius * 1.05,
            -0.72 + cos(u_time * 0.08) * 0.06,
            0.0018,
            -u_time * 0.55 + 2.1,
            colCyan,
            moonRadius,
            cos(-u_time * 0.55 + 2.1) > 0.0,
            finalColor,
            totalAlpha
          );

          // Ring 3 (Outer Armillary Celestial Circle): Large eccentric equatorial ring
          drawAstrolabeRing(
            p, moonPos,
            moonRadius * 3.20, moonRadius * 1.45,
            0.18 + sin(u_time * 0.05) * 0.05,
            0.0015,
            u_time * 0.32 + 4.2,
            colMoonPearl,
            moonRadius,
            sin(u_time * 0.32 + 4.2) > 0.0,
            finalColor,
            totalAlpha
          );

          // --- PROCEDURAL 3D LUNAR SPHERE & CRESCENT ---
          if (distMoon < moonRadius) {
            vec2 norm2D = dMoon / moonRadius;
            float z = sqrt(max(0.0, 1.0 - dot(norm2D, norm2D)));

            // Procedural crater & lunar mare noise
            float craters = fbm(dMoon * 38.0);
            craters = mix(0.82, 1.0, craters);

            // Direction of light: creating a classic glowing crescent moon
            vec3 lightDir = normalize(vec3(-0.65, 0.45, 0.65));
            float NdotL = dot(vec3(norm2D, z), lightDir);
            float crescent = smoothstep(-0.15, 0.45, NdotL);
            crescent = pow(crescent, 1.2) * craters;

            // Earthshine: delicate glow on dark side so the full sphere is subtly visible
            float earthshine = (1.0 - crescent) * 0.12 * craters;

            // Limb darkening on rim
            float limb = pow(z, 0.4);

            vec3 moonColor = mix(colLilac * 0.5, colMoonPearl, crescent) * limb;
            moonColor += colCyan * earthshine;

            // Sharp anti-aliased lunar perimeter
            float moonMask = smoothstep(moonRadius, moonRadius - 0.0025, distMoon);
            finalColor = mix(finalColor, moonColor, moonMask);
            totalAlpha = max(totalAlpha, moonMask * 0.94);
          }

          // --------------------------------------------------------------------
          // 3. TWINKLING MULTI-DEPTH STARS & CONSTELLATION NODES
          // --------------------------------------------------------------------
          vec2 gridP = p * 28.0;
          vec2 starId = floor(gridP);
          float starRnd = hash(starId);

          if (starRnd > 0.92) {
            vec2 starFract = fract(gridP) - 0.5;
            float sDist = length(starFract);
            float twinkle = sin(u_time * (2.0 + starRnd * 5.0) + starRnd * 6.28) * 0.5 + 0.5;

            // Cross diffraction flare on brightest stars
            float flare = max(
              smoothstep(0.18, 0.0, abs(starFract.x)) * smoothstep(0.02, 0.0, abs(starFract.y)),
              smoothstep(0.18, 0.0, abs(starFract.y)) * smoothstep(0.02, 0.0, abs(starFract.x))
            ) * 0.6;

            float starCore = (0.012 / (sDist + 0.035)) * twinkle;
            vec3 sCol = mix(colMoonPearl, colCyan, fract(starRnd * 13.7));

            finalColor += sCol * (starCore + flare * twinkle);
            totalAlpha += (starCore * 0.6 + flare * 0.4);
          }

          // Periodic Shooting Star across the celestial backdrop
          float shootTime = mod(u_time * 0.32, 9.0);
          if (shootTime < 1.1) {
            float progress = shootTime / 1.1;
            vec2 shootOrigin = vec2(-0.5 * u_ratio, 0.42);
            vec2 shootDir = normalize(vec2(1.3, -0.65));
            vec2 shootHead = shootOrigin + shootDir * (progress * 1.3);

            vec2 toHead = p - shootHead;
            float projection = dot(toHead, -shootDir);

            if (projection > 0.0 && projection < 0.28) {
              float perpDist = length(toHead + shootDir * projection);
              float streak = (1.0 - projection / 0.28) * smoothstep(0.007, 0.0, perpDist);
              finalColor += colCyan * (streak * 1.8) + colMoonPearl * (streak * 0.9);
              totalAlpha += streak * 0.85;
            }
          }

          // --------------------------------------------------------------------
          // 4. CHAT READABILITY VIGNETTE & PREMULTIPLIED OUTPUT
          // --------------------------------------------------------------------
          // Gentle radial vignette keeping the center chat column comfortable for reading
          float vignette = smoothstep(1.35, 0.35, length(uv - vec2(0.5, 0.5)));
          totalAlpha *= vignette;

          // Global opacity multiplier
          totalAlpha = clamp(totalAlpha * u_opacity, 0.0, 0.86);

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
    const uMouseLoc = gl.getUniformLocation(program, 'u_mouse');
    const uRippleLoc = gl.getUniformLocation(program, 'u_ripple');

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

      // Smooth mouse interpolation
      currentMouseX += (targetMouseX - currentMouseX) * 0.04;
      currentMouseY += (targetMouseY - currentMouseY) * 0.04;

      // Fade out ripple wave
      if (mouseClickWave > 0.001) {
        mouseClickWave *= 0.94;
      } else {
        mouseClickWave = 0.0;
      }

      gl.useProgram(program);

      if (uTimeLoc) gl.uniform1f(uTimeLoc, accumulatedTime);
      if (uOpacityLoc) gl.uniform1f(uOpacityLoc, opacityRef.current);
      if (uMouseLoc) gl.uniform2f(uMouseLoc, currentMouseX, currentMouseY);
      if (uRippleLoc) gl.uniform1f(uRippleLoc, mouseClickWave);
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
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('click', handleClick);
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
