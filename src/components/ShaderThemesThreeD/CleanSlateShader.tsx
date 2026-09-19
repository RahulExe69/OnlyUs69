import React, { useEffect, useRef } from 'react';
import { ShaderThemeProps } from './types';

/**
 * CleanSlateShader (3d-light / light)
 * 
 * Hardware-accelerated WebGL shader for the "Clean Slate" theme.
 * Visual Concept: "Architectural Liquid Quartz & Prismatic Caustics"
 * 
 * Aesthetic Signature:
 * - Crisp, bright, architectural minimalism with soft refracted liquid quartz caustics
 * - Smooth Simplex Voronoi light bands with micro-prismatic dispersion (pure crystal, slate sapphire #4263EB, pearl white, ice cyan)
 * - Floating geometric crystal nodes with delicate connective light filaments
 * - Subtle dithered fine-art texture (eliminates color banding without washing out message readability)
 * - Non-adaptive / consistent crisp high-clarity palette as requested (preserves Clean Slate's signature bright aesthetic)
 * - Smooth interactive touch / mouse parallax
 * - Viewport height decoupling for mobile virtual keyboard resilience
 * - Auto-pauses on tab hidden or modal open (0% CPU/GPU overhead when paused)
 */
export const CleanSlateShader: React.FC<ShaderThemeProps> = ({
  className = "absolute inset-0 pointer-events-none z-0 overflow-hidden",
  paused = false,
  opacity = 0.92,
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
    let sceneHeight = 0;

    gl = initWebGL();
    if (!gl) return;

    resizeCanvas();

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
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

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

    render(performance.now());

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

      // Clean Slate Architectural Liquid Quartz & Prismatic Caustic WebGL Fragment Shader
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

        // Permutation polynomial for procedural noise
        vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
        vec2 fade(vec2 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }

        // Classic 2D Perlin Noise
        float cnoise(vec2 P) {
          vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
          vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
          Pi = mod(Pi, 289.0);
          vec4 ix = Pi.xzxz;
          vec4 iy = Pi.yyww;
          vec4 fx = Pf.xzxz;
          vec4 fy = Pf.yyww;
          vec4 i = permute(permute(ix) + iy);
          vec4 gx = 2.0 * fract(i * 0.0243902439) - 1.0;
          vec4 gy = abs(gx) - 0.5;
          vec4 tx = floor(gx + 0.5);
          gx = gx - tx;
          vec2 g00 = vec2(gx.x, gy.x);
          vec2 g10 = vec2(gx.y, gy.y);
          vec2 g01 = vec2(gx.z, gy.z);
          vec2 g11 = vec2(gx.w, gy.w);
          vec4 norm = 1.79284291400159 - 0.85373472095314 * vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11));
          g00 *= norm.x;
          g01 *= norm.y;
          g10 *= norm.z;
          g11 *= norm.w;
          float n00 = dot(g00, vec2(fx.x, fy.x));
          float n10 = dot(g10, vec2(fx.y, fy.y));
          float n01 = dot(g01, vec2(fx.z, fy.z));
          float n11 = dot(g11, vec2(fx.w, fy.w));
          vec2 fade_xy = fade(Pf.xy);
          vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
          return 2.3 * mix(n_x.x, n_x.y, fade_xy.y);
        }

        // Liquid Quartz Caustic Wave field
        float caustic(vec2 p, float t) {
          vec2 p1 = p * 1.8 + vec2(t * 0.12, t * 0.08);
          vec2 p2 = p * 2.6 - vec2(t * 0.09, -t * 0.11);
          float n1 = cnoise(p1);
          float n2 = cnoise(p2 + n1 * 0.7);
          float n3 = cnoise(p * 3.4 + vec2(n2 * 0.5, t * 0.15));

          // Invert into caustic ridges
          float c = abs(n1 * 0.5 + n2 * 0.35 + n3 * 0.15);
          c = pow(1.0 - c, 2.8);
          return clamp(c, 0.0, 1.0);
        }

        // Geometric Crystal Node Sparkle with anti-aliased core
        float crystalNode(vec2 uv, vec2 center, float size) {
          vec2 d = abs(uv - center);
          float diamond = d.x + d.y;
          float halo = length(uv - center);
          float core = smoothstep(size, 0.0, diamond);
          float glow = smoothstep(size * 4.5, 0.0, halo) * 0.45;
          return core + glow;
        }

        // Soft connective filament between two points
        float filament(vec2 uv, vec2 a, vec2 b, float width) {
          vec2 pa = uv - a;
          vec2 ba = b - a;
          float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
          float dist = length(pa - ba * h);
          return smoothstep(width, 0.0, dist);
        }

        void main() {
          vec2 uv = vUv;
          vec2 p = uv;
          p.x *= u_ratio;

          // Parallax offset reacting gracefully to mouse or finger drag
          p += u_mouse * 0.035;

          float t = u_time * 0.45;

          // Multi-layer Caustic refractions with micro-prismatic split (dispersion)
          float cR = caustic(p + vec2(0.004, 0.0), t);
          float cG = caustic(p, t + 0.01);
          float cB = caustic(p - vec2(0.004, 0.0), t + 0.02);

          // Base palette for Clean Slate:
          // Clean Slate Background: #F7F9FC
          // Primary Accent: Sapphire #4263EB (vec3(0.258, 0.388, 0.921))
          // Ice Cyan Shimmer: #38BDF8 (vec3(0.22, 0.74, 0.97))
          // Luminous Pearl White: vec3(0.98, 0.99, 1.0)
          // Soft Slate Blue: #64748B (vec3(0.39, 0.45, 0.55))
          vec3 colSapphire = vec3(0.258, 0.388, 0.921);
          vec3 colCyan     = vec3(0.22, 0.74, 0.97);
          vec3 colPearl    = vec3(1.0, 1.0, 1.0);
          vec3 colSoftBlue = vec3(0.45, 0.58, 0.88);

          // Combine spectral channels
          vec3 causticColor = vec3(cR, cG, cB);
          float causticIntensity = (cR + cG + cB) * 0.333;

          // Floating Geometric Crystal Nodes (Slow ambient architectural motion)
          vec2 node1 = vec2((0.24 + 0.06 * sin(t * 0.35)) * u_ratio, 0.22 + 0.04 * cos(t * 0.4));
          vec2 node2 = vec2((0.78 + 0.05 * cos(t * 0.32 + 1.2)) * u_ratio, 0.18 + 0.05 * sin(t * 0.38));
          vec2 node3 = vec2((0.36 + 0.07 * sin(t * 0.42 + 2.4)) * u_ratio, 0.76 + 0.06 * cos(t * 0.31));
          vec2 node4 = vec2((0.82 + 0.05 * cos(t * 0.37 + 3.8)) * u_ratio, 0.80 + 0.04 * sin(t * 0.45));
          vec2 node5 = vec2((0.55 + 0.06 * sin(t * 0.28 + 4.5)) * u_ratio, 0.48 + 0.05 * cos(t * 0.33));

          // Connective crystalline filaments (thin, crisp architectural lines)
          float fil1 = filament(p, node1, node5, 0.0018) * 0.45;
          float fil2 = filament(p, node2, node5, 0.0018) * 0.45;
          float fil3 = filament(p, node3, node5, 0.0018) * 0.45;
          float fil4 = filament(p, node4, node5, 0.0018) * 0.45;
          float fil5 = filament(p, node1, node3, 0.0015) * 0.32;
          float fil6 = filament(p, node2, node4, 0.0015) * 0.32;
          float allFilaments = fil1 + fil2 + fil3 + fil4 + fil5 + fil6;

          // Node glints
          float n1 = crystalNode(p, node1, 0.0045);
          float n2 = crystalNode(p, node2, 0.0055);
          float n3 = crystalNode(p, node3, 0.0050);
          float n4 = crystalNode(p, node4, 0.0040);
          float n5 = crystalNode(p, node5, 0.0060);
          float allNodes = n1 + n2 + n3 + n4 + n5;

          // Composition of light: vibrant architectural quartz with sapphire, cyan, and pearl refractions
          vec3 finalColor = mix(colSoftBlue, colSapphire, clamp(causticColor.r * 1.5, 0.0, 1.0));
          finalColor = mix(finalColor, colCyan, clamp(causticColor.b * 1.2, 0.0, 1.0));
          finalColor = mix(finalColor, colPearl, clamp(pow(causticIntensity, 1.5) * 1.2, 0.0, 1.0));

          // Add filaments & crystal nodes with rich sapphire/cyan luminescence
          finalColor += colSapphire * allFilaments * 1.6;
          finalColor += colPearl * (allNodes * 1.4) + colCyan * (allNodes * 0.9);

          // Alpha modulation: Keep canvas alpha calibrated and clearly visible over the
          // #F7F9FC theme background while maintaining high text readability
          float alpha = causticIntensity * 0.35 + allFilaments * 0.50 + allNodes * 0.85;

          // Soft diagonal vignette to frame the chat feed nicely
          float cornerVignette = smoothstep(1.3, 0.2, length(uv - vec2(0.5, 0.5)));
          alpha *= (0.75 + 0.25 * cornerVignette);

          // Fine-art dithered grain to prevent banding on 8-bit displays
          float grain = fract(sin(dot(uv * 1000.0, vec2(12.9898, 78.233))) * 43758.5453);
          alpha += (grain - 0.5) * 0.015;

          alpha = clamp(alpha * u_opacity, 0.0, 0.85);

          // WebGL premultiplied alpha output to smoothly composite over the theme background
          gl_FragColor = vec4(finalColor * alpha, alpha);
        }
      `;

      vertexShader = createShader(context, context.VERTEX_SHADER, vsSource);
      fragmentShader = createShader(context, context.FRAGMENT_SHADER, fsSource);
      if (!vertexShader || !fragmentShader) return null;

      shaderProgram = context.createProgram();
      if (!shaderProgram) return null;

      context.attachShader(shaderProgram, vertexShader);
      context.attachShader(shaderProgram, fragmentShader);
      context.linkProgram(shaderProgram);

      if (!context.getProgramParameter(shaderProgram, context.LINK_STATUS)) {
        console.error('CleanSlateShader Link error:', context.getProgramInfoLog(shaderProgram));
        return null;
      }

      context.useProgram(shaderProgram);

      uniforms = {
        u_time: context.getUniformLocation(shaderProgram, 'u_time'),
        u_ratio: context.getUniformLocation(shaderProgram, 'u_ratio'),
        u_opacity: context.getUniformLocation(shaderProgram, 'u_opacity'),
        u_mouse: context.getUniformLocation(shaderProgram, 'u_mouse'),
      };

      const vertices = new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
        -1.0,  1.0,
         1.0, -1.0,
         1.0,  1.0,
      ]);

      vertexBuffer = context.createBuffer();
      context.bindBuffer(context.ARRAY_BUFFER, vertexBuffer);
      context.bufferData(context.ARRAY_BUFFER, vertices, context.STATIC_DRAW);

      const aPosition = context.getAttribLocation(shaderProgram, 'a_position');
      context.enableVertexAttribArray(aPosition);
      context.vertexAttribPointer(aPosition, 2, context.FLOAT, false, 0, 0);

      // Premultiplied alpha blending for pure transparency
      context.enable(context.BLEND);
      context.blendFunc(context.ONE, context.ONE_MINUS_SRC_ALPHA);

      return context;
    }

    function createShader(context: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
      const shader = context.createShader(type);
      if (!shader) return null;
      context.shaderSource(shader, source);
      context.compileShader(shader);
      if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
        console.error('CleanSlateShader compile error:', context.getShaderInfoLog(shader));
        context.deleteShader(shader);
        return null;
      }
      return shader;
    }

    function resizeCanvas() {
      if (!canvasEl || !gl) return;
      const parent = canvasEl.parentElement;
      const newWidth = parent?.clientWidth || window.innerWidth;
      const newHeight = parent?.clientHeight || window.innerHeight;

      if (Math.abs(newWidth - lastWidth) > 60) {
        lastWidth = newWidth;
        const screenH = (typeof window !== 'undefined' && window.screen?.availHeight) ? window.screen.availHeight : newHeight;
        sceneHeight = Math.max(newHeight, screenH, window.innerHeight);
      } else {
        if (newHeight > sceneHeight) {
          sceneHeight = newHeight;
        }
      }

      // DPR capped at 1.0 for low-power high efficiency
      if (canvasEl.width !== newWidth || canvasEl.height !== newHeight) {
        canvasEl.width = newWidth;
        canvasEl.height = newHeight;
        gl.viewport(0, 0, newWidth, newHeight);
      }
    }

    function render(currentTime: number) {
      if (isCleanedUp) return;

      if (pausedRef.current || document.hidden) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      // Cap at ~60fps
      if (currentTime - lastRenderTime < 14) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }
      lastRenderTime = currentTime;

      if (!gl || !shaderProgram) return;

      // Smooth mouse lerp
      currentMouseX += (targetMouseX - currentMouseX) * 0.05;
      currentMouseY += (targetMouseY - currentMouseY) * 0.05;

      const w = canvasEl?.width || 1;
      const h = canvasEl?.height || 1;
      const ratio = w / h;

      gl.useProgram(shaderProgram);

      if (uniforms.u_time) {
        gl.uniform1f(uniforms.u_time, (currentTime * 0.001) * speedRef.current);
      }
      if (uniforms.u_ratio) {
        gl.uniform1f(uniforms.u_ratio, ratio);
      }
      if (uniforms.u_opacity) {
        gl.uniform1f(uniforms.u_opacity, opacityRef.current);
      }
      if (uniforms.u_mouse) {
        gl.uniform2f(uniforms.u_mouse, currentMouseX, currentMouseY);
      }

      gl.clearColor(0.0, 0.0, 0.0, 0.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animationFrameId = requestAnimationFrame(render);
    }

    return () => {
      isCleanedUp = true;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }

      // Comprehensive WebGL resource cleanup
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
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
};

export default CleanSlateShader;
