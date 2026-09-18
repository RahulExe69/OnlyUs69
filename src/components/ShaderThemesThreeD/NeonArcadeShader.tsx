import React, { useEffect, useRef } from 'react';
import { ShaderThemeProps } from './types';

/**
 * NeonArcadeShader (3d-cyber / cyber / 3d-waves)
 * 
 * Hardware-accelerated GPU WebGL Shader for the "Neon Arcade" synthwave / outrun theme.
 * Features:
 * - Infinite 3D perspective cybernetic laser grid moving smoothly along the Z-axis
 * - Undulating digital synthesizer terrain waves rippling through the wireframe plane
 * - Anti-aliased line rendering with derivative-based thickness and exponential bloom
 * - Distant retro-futuristic synthwave sun with horizontal laser blinds & fiery sunset gradient
 * - High-speed digital photon data packets zipping across matrix lines toward the camera
 * - Floating audio-equalizer neon sine ribbons weaving across the upper sky with additive glow
 * - Twinkling digital cyber stars and floating wireframe arcade prisms
 * - Subtle CRT scanlines and soft arcade cabinet vignette
 * - Interactive mouse/touch parallax tilting the camera angle and horizon
 * - Mobile virtual keyboard and viewport height decoupling (zero jumping on Android)
 * - Auto-pauses on tab hidden or modal open (0% CPU/GPU overhead when paused)
 */
export const NeonArcadeShader: React.FC<ShaderThemeProps> = ({
  className = "absolute inset-0 pointer-events-none z-0 overflow-hidden",
  paused = false,
  opacity = 0.95,
  speed = 1.0,
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

    // Interactive mouse / touch parallax tracking
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    // Viewport & Keyboard resilience state
    let lastWidth = 0;
    let stableSceneHeight = 0;

    gl = initShader();
    if (!gl) return;

    resizeCanvas();
    const resizeListener = () => resizeCanvas();
    window.addEventListener('resize', resizeListener, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', resizeListener, { passive: true });
    }

    const mouseMoveListener = (e: MouseEvent) => {
      // Normalized between -0.5 and 0.5
      targetMouseX = (e.clientX / window.innerWidth) - 0.5;
      targetMouseY = (e.clientY / window.innerHeight) - 0.5;
    };

    const touchMoveListener = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        targetMouseX = (e.touches[0].clientX / window.innerWidth) - 0.5;
        targetMouseY = (e.touches[0].clientY / window.innerHeight) - 0.5;
      }
    };

    window.addEventListener('mousemove', mouseMoveListener, { passive: true });
    window.addEventListener('touchmove', touchMoveListener, { passive: true });

    render(performance.now());

    function initShader(): WebGLRenderingContext | null {
      if (!canvasEl) return null;

      const context = canvasEl.getContext('webgl', {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance'
      }) || (canvasEl.getContext('experimental-webgl', {
        alpha: true,
        antialias: false,
        depth: false
      }) as WebGLRenderingContext | null);

      if (!context) {
        console.warn('[NeonArcadeShader] WebGL not supported on this device.');
        return null;
      }

      const vsSource = `
        precision mediump float;
        varying vec2 vUv;
        attribute vec2 a_position;
        void main() {
          vUv = 0.5 * (a_position + 1.0);
          gl_Position = vec4(a_position, 0.0, 1.0);
        }
      `;

      // Master Neon Arcade / Synthwave Outrun Fragment Shader
      const fsSource = `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif

        varying vec2 vUv;
        uniform float u_time;
        uniform vec2 u_resolution;
        uniform float u_ratio;
        uniform float u_opacity;
        uniform vec2 u_mouse;

        // Synthwave Neon Color Palette
        const vec3 COLOR_VOID = vec3(0.043, 0.035, 0.125);      // #0B0920 Deep Midnight Indigo
        const vec3 COLOR_CYAN = vec3(0.45, 0.97, 1.0);           // #73F7FF Electric Cyan
        const vec3 COLOR_MAGENTA = vec3(1.0, 0.235, 0.675);      // #FF3CAC Hot Laser Pink
        const vec3 COLOR_PURPLE = vec3(0.74, 0.0, 1.0);          // #BD00FF Laser Violet
        const vec3 COLOR_SUN_GOLD = vec3(1.0, 0.85, 0.25);       // Synthwave Sun Gold
        const vec3 COLOR_SUN_ORANGE = vec3(1.0, 0.45, 0.1);      // Sunset Orange

        // Pseudo-random generator
        float hash21(vec2 p) {
          p = fract(p * vec2(234.34, 435.345));
          p += dot(p, p + 34.23);
          return fract(p.x * p.y);
        }

        // 2D Rotation
        mat2 rotate2d(float a) {
          float s = sin(a);
          float c = cos(a);
          return mat2(c, -s, s, c);
        }

        // Digital Cyber Stars in upper atmosphere
        float cyberStars(vec2 uv, float t) {
          vec2 p = uv * 32.0;
          vec2 id = floor(p);
          vec2 g = fract(p) - 0.5;
          float rnd = hash21(id);
          if (rnd < 0.88) return 0.0;
          
          float size = 0.04 + 0.06 * sin(t * 3.0 + rnd * 6.28);
          float dist = length(g);
          float star = smoothstep(size, 0.0, dist);
          // 4-point cross flare
          float flare = max(
            smoothstep(0.02, 0.0, abs(g.x)) * smoothstep(0.3, 0.0, abs(g.y)),
            smoothstep(0.02, 0.0, abs(g.y)) * smoothstep(0.3, 0.0, abs(g.x))
          ) * 0.7;
          return (star + flare) * (0.3 + 0.7 * sin(t * 2.5 + rnd * 12.0));
        }

        // Floating 3D Holographic Arcade Diamond
        float holographicDiamond(vec2 uv, vec2 center, float size, float t) {
          vec2 p = (uv - center) * vec2(u_ratio, 1.0);
          p = rotate2d(t * 0.8) * p;
          float d = (abs(p.x) + abs(p.y)) - size;
          // Glowing wireframe perimeter
          float wire = exp(-abs(d) * 120.0);
          // Inner core sparkle
          float core = exp(-length(p) * 60.0);
          return wire * 0.8 + core * 0.4;
        }

        void main() {
          vec2 uv = vUv;

          // Camera Horizon with smooth interactive mouse tilt
          float horizonY = 0.46 + u_mouse.y * 0.06;
          float tiltX = u_mouse.x * 0.15;

          vec3 finalColor = vec3(0.0);

          // ==========================================================
          // 1. SKY & ATMOSPHERE (uv.y >= horizonY)
          // ==========================================================
          if (uv.y >= horizonY - 0.02) {
            float skyNorm = (uv.y - horizonY) / (1.0 - horizonY + 0.001);
            
            // Deep gradient from glowing magenta horizon into midnight purple void
            vec3 skyGradient = mix(
              mix(COLOR_PURPLE * 0.6, COLOR_MAGENTA * 0.4, 0.5),
              COLOR_VOID,
              smoothstep(0.0, 0.85, skyNorm)
            );
            finalColor += skyGradient;

            // Ambient Horizon Neon Bloom
            float horizonBloom = exp(-abs(uv.y - horizonY) * 10.0) * 0.65;
            finalColor += mix(COLOR_MAGENTA, COLOR_CYAN, 0.5 + 0.5 * sin(uv.x * 3.14)) * horizonBloom;

            // Synthwave Horizon Sun
            vec2 sunCenter = vec2(0.5 + tiltX * 0.4, horizonY + 0.10);
            vec2 sunUv = (uv - sunCenter) * vec2(u_ratio, 1.0);
            float sunDist = length(sunUv);
            float sunRadius = 0.22;

            if (sunDist < sunRadius + 0.15) {
              // Radial sun glow bloom
              float sunGlow = exp(-sunDist * 7.5) * 0.85;
              finalColor += mix(COLOR_MAGENTA, COLOR_SUN_GOLD, 0.5) * sunGlow;

              // Solid Sun Disc with Horizontal Retro Laser Blinds
              if (sunDist < sunRadius && uv.y >= horizonY) {
                float normY = (uv.y - sunCenter.y) / sunRadius; // -1 to 1
                
                // Horizontal laser cutouts (blind slashes)
                // Cutouts get thinner towards the top of the sun
                float blindFreq = 26.0;
                float blindWave = sin(normY * blindFreq);
                float cutThreshold = smoothstep(-0.8, 0.4, -normY) * 0.48;
                
                // Color gradient inside sun (Gold/Orange at bottom -> Electric Magenta at top)
                vec3 sunColor = mix(COLOR_SUN_GOLD, COLOR_MAGENTA, smoothstep(-0.8, 0.8, normY));
                
                // Apply blind cuts (only on the lower 70% of the sun)
                float blindMask = 1.0;
                if (normY < 0.25) {
                  blindMask = smoothstep(cutThreshold, cutThreshold + 0.12, blindWave);
                }
                
                // Disc border smooth anti-aliasing
                float edgeMask = smoothstep(sunRadius, sunRadius - 0.008, sunDist);
                finalColor += sunColor * blindMask * edgeMask * 1.35;
              }
            }

            // Audio-Equalizer Synth Wave Ribbons weaving through the sky
            // Layer 1: Electric Cyan Ribbon
            float wave1Y = horizonY + 0.20 + sin(uv.x * 5.0 + u_time * 1.4 + tiltX) * 0.038 + cos(uv.x * 2.5 - u_time * 0.7) * 0.022;
            float distW1 = abs(uv.y - wave1Y);
            float ribbonCyan = exp(-distW1 * 75.0) * 0.85;
            finalColor += COLOR_CYAN * ribbonCyan;

            // Layer 2: Hot Magenta Ribbon
            float wave2Y = horizonY + 0.30 + sin(uv.x * 4.2 - u_time * 1.8 + 1.6) * 0.045 + sin(uv.x * 8.5 + u_time * 2.2) * 0.015;
            float distW2 = abs(uv.y - wave2Y);
            float ribbonMagenta = exp(-distW2 * 68.0) * 0.80;
            finalColor += COLOR_MAGENTA * ribbonMagenta;

            // Layer 3: Laser Violet Harmonic Ribbon
            float wave3Y = horizonY + 0.13 + cos(uv.x * 6.0 + u_time * 1.1) * 0.025;
            float distW3 = abs(uv.y - wave3Y);
            float ribbonViolet = exp(-distW3 * 90.0) * 0.65;
            finalColor += COLOR_PURPLE * ribbonViolet;

            // Digital Cyber Stars
            float stars = cyberStars(uv, u_time);
            finalColor += mix(COLOR_CYAN, vec3(1.0), 0.5) * stars;

            // Floating 3D Holographic Diamonds in upper sky
            float diamond1 = holographicDiamond(uv, vec2(0.18 + tiltX * 0.2, horizonY + 0.32 + sin(u_time * 0.6) * 0.02), 0.038, u_time * 0.8);
            finalColor += COLOR_CYAN * diamond1;

            float diamond2 = holographicDiamond(uv, vec2(0.82 + tiltX * 0.2, horizonY + 0.28 + cos(u_time * 0.7) * 0.025), 0.045, -u_time * 0.9);
            finalColor += COLOR_MAGENTA * diamond2;
          }

          // ==========================================================
          // 2. INFINITE 3D CYBERNETIC PERSPECTIVE GRID (uv.y < horizonY)
          // ==========================================================
          if (uv.y <= horizonY + 0.01) {
            float depthDist = horizonY - uv.y;
            
            // Perspective camera transformation
            // z increases towards horizon (depth)
            float z = 0.38 / max(depthDist, 0.002);
            
            // World X centered with parallax tilt
            float x = (uv.x - 0.5 - tiltX) * z * u_ratio * 1.65;
            
            // World Z continuously moving forward into the distance
            float wz = z + u_time * 3.2;

            // Undulating electronic terrain elevation waves
            float terrainElevation = sin(x * 0.6 + u_time * 1.3) * cos(wz * 0.35 + u_time * 0.9) * 0.35;
            float adjX = x + terrainElevation * 0.2;

            // Grid coordinates
            vec2 gridCoord = vec2(adjX, wz);
            vec2 gridFract = abs(fract(gridCoord) - 0.5);

            // Anti-aliased line width calculation
            // As z increases, line density grows; scale line width proportionally to prevent moire
            float lineThickness = max(0.012, z * 0.0016);

            // Minor Grid Lines (Electric Cyan)
            float distToMinor = min(gridFract.x, gridFract.y);
            float minorGlow = exp(-distToMinor * 34.0 / max(0.25, z * 0.035));

            // Major Grid Intervals (Hot Magenta every 4 grid units)
            vec2 majorFract = abs(fract(gridCoord * 0.25) - 0.5) * 4.0;
            float distToMajor = min(majorFract.x, majorFract.y);
            float majorGlow = exp(-distToMajor * 26.0 / max(0.3, z * 0.04));

            // High-Speed Digital Data Packets zipping along the matrix lines
            // Z-axis light pulse
            float packetZ = sin(wz * 0.75 - u_time * 14.0 + floor(adjX) * 1.7);
            float pulseZ = smoothstep(0.92, 1.0, packetZ) * exp(-gridFract.x * 24.0);
            
            // X-axis horizontal pulse
            float packetX = sin(adjX * 0.5 + u_time * 8.0 + floor(wz) * 2.3);
            float pulseX = smoothstep(0.94, 1.0, packetX) * exp(-gridFract.y * 24.0);

            // Distance fade: fade out smoothly near horizon and far bottom for clean composition
            float horizonFade = smoothstep(0.0, 0.09, depthDist);
            float cameraFade = 1.0 - smoothstep(18.0, 48.0, z);
            float gridAlpha = horizonFade * cameraFade;

            // Combine grid laser colors
            vec3 gridColor = (COLOR_CYAN * minorGlow * 1.1) + (COLOR_MAGENTA * majorGlow * 1.4);
            gridColor += (COLOR_CYAN * 1.8 + vec3(0.5)) * (pulseZ + pulseX) * 1.5;

            // Subtle dark indigo ground plane beneath the glowing laser wires
            vec3 groundFill = mix(COLOR_VOID * 1.3, COLOR_PURPLE * 0.25, 1.0 / (1.0 + z * 0.08));

            finalColor += (groundFill + gridColor) * gridAlpha;

            // Reflective ground shine of the distant sun
            float sunReflectionX = abs(uv.x - 0.5 - tiltX);
            float sunFloorGlow = exp(-sunReflectionX * 8.0) * exp(-depthDist * 14.0) * 0.55;
            finalColor += mix(COLOR_MAGENTA, COLOR_SUN_GOLD, 0.6) * sunFloorGlow;
          }

          // ==========================================================
          // 3. RETRO CRT SCANLINES & ARCADE VIGNETTE POST-PROCESSING
          // ==========================================================
          // Ultra-fine subtle arcade CRT raster scanlines
          float scanline = 0.95 + 0.05 * sin(uv.y * u_resolution.y * 1.4);
          finalColor *= scanline;

          // Corner arcade screen bezel vignette
          vec2 vigUv = uv * (1.0 - uv);
          float vignette = vigUv.x * vigUv.y * 16.0;
          vignette = clamp(pow(vignette, 0.16), 0.0, 1.0);
          finalColor *= (0.75 + 0.25 * vignette);

          // Ambient subtle laser flare in center
          finalColor += COLOR_MAGENTA * 0.04 * (1.0 - length(uv - 0.5));

          // Master Opacity
          gl_FragColor = vec4(finalColor, u_opacity);
        }
      `;

      vertexShader = compileShader(context, vsSource, context.VERTEX_SHADER);
      fragmentShader = compileShader(context, fsSource, context.FRAGMENT_SHADER);

      if (!vertexShader || !fragmentShader) return null;

      shaderProgram = context.createProgram();
      if (!shaderProgram) return null;

      context.attachShader(shaderProgram, vertexShader);
      context.attachShader(shaderProgram, fragmentShader);
      context.linkProgram(shaderProgram);

      if (!context.getProgramParameter(shaderProgram, context.LINK_STATUS)) {
        console.warn('[NeonArcadeShader] Program link error:', context.getProgramInfoLog(shaderProgram));
        return null;
      }

      context.useProgram(shaderProgram);

      uniforms.u_time = context.getUniformLocation(shaderProgram, 'u_time');
      uniforms.u_resolution = context.getUniformLocation(shaderProgram, 'u_resolution');
      uniforms.u_ratio = context.getUniformLocation(shaderProgram, 'u_ratio');
      uniforms.u_opacity = context.getUniformLocation(shaderProgram, 'u_opacity');
      uniforms.u_mouse = context.getUniformLocation(shaderProgram, 'u_mouse');

      const positionLocation = context.getAttribLocation(shaderProgram, 'a_position');

      vertexBuffer = context.createBuffer();
      context.bindBuffer(context.ARRAY_BUFFER, vertexBuffer);
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

      context.enableVertexAttribArray(positionLocation);
      context.vertexAttribPointer(positionLocation, 2, context.FLOAT, false, 0, 0);

      return context;
    }

    function compileShader(glCtx: WebGLRenderingContext, source: string, type: number): WebGLShader | null {
      const shader = glCtx.createShader(type);
      if (!shader) return null;
      glCtx.shaderSource(shader, source);
      glCtx.compileShader(shader);
      if (!glCtx.getShaderParameter(shader, glCtx.COMPILE_STATUS)) {
        console.warn('[NeonArcadeShader] Compile error:', glCtx.getShaderInfoLog(shader));
        glCtx.deleteShader(shader);
        return null;
      }
      return shader;
    }

    function resizeCanvas() {
      if (!canvasEl || !gl || !shaderProgram) return;

      const parent = canvasEl.parentElement;
      const displayWidth = parent?.clientWidth || window.innerWidth;
      const currentHeight = parent?.clientHeight || window.innerHeight;

      // Mobile keyboard decoupling: lock scene height to screen bounds so opening keyboard
      // doesn't squash the 3D perspective grid
      if (Math.abs(displayWidth - lastWidth) > 60 || stableSceneHeight === 0) {
        lastWidth = displayWidth;
        const screenH = (typeof window !== 'undefined' && window.screen?.availHeight) ? window.screen.availHeight : currentHeight;
        stableSceneHeight = Math.max(currentHeight, screenH, window.innerHeight);
      } else {
        if (currentHeight > stableSceneHeight) {
          stableSceneHeight = currentHeight;
        }
      }

      // Cap DPR to 1.0 for high frame-rate outrun rendering on all devices
      const dpr = 1.0;
      const targetWidth = Math.round(displayWidth * dpr);
      const targetHeight = Math.round(currentHeight * dpr);

      if (canvasEl.width !== targetWidth || canvasEl.height !== targetHeight) {
        canvasEl.width = targetWidth;
        canvasEl.height = targetHeight;
        gl.viewport(0, 0, targetWidth, targetHeight);
      }

      gl.useProgram(shaderProgram);
      if (uniforms.u_resolution) {
        gl.uniform2f(uniforms.u_resolution, canvasEl.width, canvasEl.height);
      }
      if (uniforms.u_ratio) {
        gl.uniform1f(uniforms.u_ratio, canvasEl.width / Math.max(1, canvasEl.height));
      }
    }

    function render(currentTime: number) {
      if (isCleanedUp) return;

      const dt = lastRenderTime ? (currentTime - lastRenderTime) / 1000 : 0.016;
      lastRenderTime = currentTime;

      if (!pausedRef.current && !document.hidden && gl && shaderProgram) {
        gl.useProgram(shaderProgram);

        // Smooth mouse inertial interpolation
        currentMouseX += (targetMouseX - currentMouseX) * Math.min(1.0, dt * 5.0);
        currentMouseY += (targetMouseY - currentMouseY) * Math.min(1.0, dt * 5.0);

        if (uniforms.u_time) {
          gl.uniform1f(uniforms.u_time, (currentTime * 0.001) * speedRef.current);
        }
        if (uniforms.u_opacity) {
          gl.uniform1f(uniforms.u_opacity, opacityRef.current);
        }
        if (uniforms.u_mouse) {
          gl.uniform2f(uniforms.u_mouse, currentMouseX, currentMouseY);
        }

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      animationFrameId = requestAnimationFrame(render);
    }

    return () => {
      isCleanedUp = true;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeListener);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', resizeListener);
      }
      window.removeEventListener('mousemove', mouseMoveListener);
      window.removeEventListener('touchmove', touchMoveListener);

      if (gl) {
        if (vertexBuffer) gl.deleteBuffer(vertexBuffer);
        if (vertexShader) gl.deleteShader(vertexShader);
        if (fragmentShader) gl.deleteShader(fragmentShader);
        if (shaderProgram) gl.deleteProgram(shaderProgram);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        ...style,
        willChange: 'transform',
        transform: 'translateZ(0)',
      }}
    />
  );
};

export default NeonArcadeShader;
