import React, { useEffect, useRef } from 'react';

export interface DreamyRomanticShaderBackgroundProps {
  className?: string;
  paused?: boolean;
  opacity?: number;
  speed?: number;
}

/**
 * DreamyRomanticShaderBackground
 * 
 * High-performance, GPU-accelerated WebGL fragment shader for the default OnlyUs theme.
 * Replaces old cartoonish 2D falling petals with a dreamy, modern, ethereal liquid silk
 * and rose-quartz aura with warm candlelight sheens and delicate stardust drift.
 * 
 * Performance & Battery Safeguards:
 * - Pure GPU fragment shader (0% CPU main-thread overhead -> zero typing or scroll lag)
 * - Canvas DPR capped at 1.0 (no multi-million pixel overdraw on high-DPI phones)
 * - Pauses automatically when paused=true or when document.hidden
 * - Full WebGL resource disposal on unmount
 */
export const DreamyRomanticShaderBackground: React.FC<DreamyRomanticShaderBackgroundProps> = ({
  className = "absolute inset-0 pointer-events-none z-0 overflow-hidden",
  paused = false,
  opacity = 0.85,
  speed = 0.00065,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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

      // Dreamy Sakura Blossom WebGL Shader
      // High-performance 3D tumbling cherry blossom petals with authentic V-cleft notches,
      // 3D perspective pitch/roll physics, delicate milky-white to pink gradient,
      // multilayer bokeh depth-of-field, and warm spring morning sunlight.
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

        // Fast pseudo-random hash for cellular noise
        vec4 hash4(vec2 p) {
          vec4 p4 = fract(vec4(p.xyxy) * vec4(443.897, 441.423, 437.195, 444.129));
          p4 += dot(p4, p4.wzxy + 19.19);
          return fract((p4.xxyz + p4.yzzw) * p4.zywx);
        }

        // 2D Rotation matrix
        mat2 rot2D(float a) {
          float c = cos(a);
          float s = sin(a);
          return mat2(c, -s, s, c);
        }

        // Authentic Sakura Petal signed distance function with signature top V-cleft
        float sdSakuraPetal(vec2 p) {
          p.x = abs(p.x);
          float y = p.y;
          
          // Boundary cutoff
          if (y < -0.55 || y > 0.55) return 1.0;
          
          // Smooth teardrop contour that swells gracefully in the upper mid-section
          float w = 0.38 * sqrt(max(0.0, 1.0 - y * y * 3.3)) * (1.0 + 0.42 * y);
          
          // Signature Sakura V-cleft notch at the petal crown (y > 0.24)
          if (y > 0.24) {
            float notchH = (y - 0.24) / 0.28;
            w -= 0.17 * pow(max(0.0, notchH), 2.1);
          }
          
          return p.x - max(0.004, w);
        }

        // Multi-cellular sakura petal layer with 3D tumbling & aerodynamic wind
        void renderSakuraLayer(
          inout vec3 accCol,
          inout float accA,
          vec2 uv,
          float t,
          float scale,
          float speedMul,
          float blurEdge,
          float opacityMul
        ) {
          // Dynamic spring breeze: wind gust oscillating naturally
          float windGust = sin(t * 0.45 + uv.y * 1.4) * 0.28 + 0.32;
          vec2 wind = vec2(windGust, 0.85) * speedMul * t;
          
          vec2 pos = uv * scale + wind;
          vec2 id = floor(pos);
          vec2 f = fract(pos) - 0.5;

          for (int dy = -1; dy <= 1; dy++) {
            for (int dx = -1; dx <= 1; dx++) {
              vec2 nId = id + vec2(float(dx), float(dy));
              vec4 rnd = hash4(nId);
              
              // Organic petal center offset inside each cell
              vec2 center = vec2(float(dx), float(dy)) + (rnd.xy - 0.5) * 0.55;
              
              // Individual breeze flutter
              float flutterFreq = 1.8 + rnd.z * 1.4;
              center.x += sin(t * flutterFreq + rnd.w * 6.28) * 0.18;
              center.y += cos(t * (flutterFreq * 0.8) + rnd.z * 6.28) * 0.10;
              
              vec2 delta = f - center;
              
              // 3D Tumbling & Perspective Orientation:
              // 1. Planar 2D spin
              float angle = t * (0.8 + rnd.w * 0.6) + rnd.z * 6.28;
              vec2 p = rot2D(angle) * delta;
              
              // 2. 3D pitch/roll flip (slenderizes as petal turns sideways)
              float flip = sin(t * (1.9 + rnd.w * 1.4) + rnd.z * 6.28);
              float absFlip = max(0.11, abs(flip));
              p.x /= absFlip;
              
              // 3. 3D petal curl / cup (natural bow curve that catches sunlight)
              p.y += (p.x * p.x) * 0.38 * sign(flip);
              
              // Organic size variation
              float pSize = 0.34 + rnd.z * 0.20;
              p /= pSize;
              
              // Evaluate Sakura Petal SDF
              float d = sdSakuraPetal(p);
              
              // Anti-aliased edge (or bokeh blur for distant layer)
              float alpha = smoothstep(blurEdge, -0.01, d);
              
              if (alpha > 0.001) {
                // Realistic Cherry Blossom Color Gradient:
                // Delicate milky white-pink center (#FFF2F7) blending into vibrant
                // cherry blossom blush (#FFA6C2) and deep petal base (#FF5A88)
                float distFromCenter = length(vec2(p.x * 2.2, p.y + 0.15));
                
                vec3 colBase   = vec3(1.0, 0.35, 0.53); // #FF5A88 deep cherry blossom base
                vec3 colRim    = vec3(1.0, 0.65, 0.76); // #FFA6C2 soft sakura pink rim
                vec3 colCenter = vec3(1.0, 0.95, 0.97); // #FFF2F7 delicate milky sakura white
                
                vec3 petalCol = mix(colCenter, colRim, clamp(distFromCenter * 1.25, 0.0, 1.0));
                petalCol = mix(petalCol, colBase, clamp(-p.y * 1.15 + 0.18, 0.0, 0.78));
                
                // 3D light sheen & curl shading
                float lighting = 0.84 + 0.32 * cos(p.x * 6.0 + p.y * 3.0);
                if (flip < 0.0) {
                  petalCol *= vec3(0.96, 0.88, 0.92); // Petal underside subtle shade
                }
                petalCol *= lighting;
                
                // Light translucency through petal edge
                float rimGlow = smoothstep(0.08, 0.0, abs(d));
                petalCol += vec3(0.18, 0.08, 0.12) * rimGlow;
                
                float finalA = alpha * opacityMul * (0.75 + 0.25 * absFlip);
                
                // Front-to-back alpha compositing
                accCol += petalCol * finalA * (1.0 - accA);
                accA += finalA * (1.0 - accA);
                
                if (accA >= 0.98) return;
              }
            }
          }
        }

        // Ambient Sakura Pollen / Sunlight Dust Particles
        float sakuraPollen(vec2 uv, float t) {
          vec2 p = uv * 6.0 + vec2(t * 0.4, t * 0.6);
          vec2 grid = fract(p) - 0.5;
          vec2 id = floor(p);
          
          float rnd = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
          float dist = length(grid + vec2(sin(t + rnd * 6.28) * 0.2, cos(t + rnd * 6.28) * 0.2));
          
          float size = 0.02 + 0.025 * sin(t * 1.5 + rnd * 6.28);
          float spark = smoothstep(size, 0.0, dist) * step(0.70, rnd);
          return spark * (0.4 + 0.4 * sin(t * 2.2 + rnd * 10.0));
        }

        void main() {
          vec2 uv = vUv;
          uv.x *= u_ratio;
          float t = u_time * u_speed * 1.5;

          // 1. Romantic Spring Atmosphere Backdrop
          // Warm spring sunlight filtering through the upper corner
          vec2 sunPos = vec2(0.85 * u_ratio, 0.95);
          float sunDist = length(uv - sunPos);
          float sunGlow = exp(-sunDist * 1.3) * 0.35;
          vec3 sunCol = vec3(1.0, 0.96, 0.88) * sunGlow;

          // Soft ambient cherry blossom aura (soft pale blush waves)
          float auraWave = sin(uv.x * 2.2 + uv.y * 1.8 + t * 0.5) * 0.5 + 0.5;
          vec3 auraCol = mix(vec3(1.0, 0.94, 0.96), vec3(1.0, 0.86, 0.91), auraWave);

          vec3 sceneCol = auraCol + sunCol;
          float sceneA = 0.22;

          // 2. Distant Sakura Layer (Dreamy Bokeh Petals, Soft Depth of Field)
          renderSakuraLayer(
            sceneCol,
            sceneA,
            uv,
            t,
            7.5,      // Scale (more, smaller petals in the distance)
            0.65,     // Speed multiplier (gentle slow background drift)
            0.09,     // Blur edge (soft bokeh blur)
            0.45      // Opacity multiplier
          );

          // 3. Midground Sakura Layer (Crisp, Tumbling, Fluttering in Spring Breeze)
          renderSakuraLayer(
            sceneCol,
            sceneA,
            uv,
            t,
            4.2,      // Scale (prominent, beautiful petals)
            0.95,     // Speed multiplier (natural wind speed)
            0.025,    // Sharp anti-aliased edge
            0.88      // High opacity
          );

          // 4. Ambient Sakura Pollen / Sunlight Dust
          float pollen = sakuraPollen(uv, t);
          sceneCol += vec3(1.0, 0.95, 0.85) * pollen * 0.85;
          sceneA = clamp(sceneA + pollen * 0.3, 0.0, 1.0);

          // 5. Final Opacity blend with Theme
          float finalAlpha = clamp(sceneA * u_opacity, 0.15, 0.82);

          gl_FragColor = vec4(sceneCol, finalAlpha);
        }
      `;

      if (!canvas) return null;
      const context = (canvas.getContext('webgl', {
        powerPreference: 'low-power',
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
      }) || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;

      if (!context) {
        console.warn('[DreamyRomanticShader] WebGL not supported');
        return null;
      }

      gl = context;

      vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
      fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
      if (!vertexShader || !fragmentShader) return null;

      shaderProgram = gl.createProgram();
      if (!shaderProgram) return null;

      gl.attachShader(shaderProgram, vertexShader);
      gl.attachShader(shaderProgram, fragmentShader);
      gl.linkProgram(shaderProgram);

      if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.warn('[DreamyRomanticShader] Link error:', gl.getProgramInfoLog(shaderProgram));
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

      // Set initial uniforms
      if (uniforms.u_speed) {
        gl.uniform1f(uniforms.u_speed, speed);
      }
      if (uniforms.u_opacity) {
        gl.uniform1f(uniforms.u_opacity, opacity);
      }

      // Handle WebGL context loss safely on mobile WebView lifecycle
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
        console.warn('[DreamyRomanticShader] Compile error:', glCtx.getShaderInfoLog(shader));
        glCtx.deleteShader(shader);
        return null;
      }
      return shader;
    }

    function resizeCanvas() {
      if (!canvas || !gl) return;
      const parent = canvas.parentElement;
      const width = parent?.clientWidth || window.innerWidth;
      const height = parent?.clientHeight || window.innerHeight;

      // Cap at 1.0 DPR for max GPU efficiency and low battery consumption on Android phones
      const dpr = 1.0;
      const targetWidth = Math.floor(width * dpr);
      const targetHeight = Math.floor(height * dpr);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
        if (uniforms.u_ratio) {
          gl.uniform1f(uniforms.u_ratio, canvas.width / canvas.height);
        }
      }
    }

    function render(currentTime: number) {
      if (isCleanedUp) return;

      // Throttle to 60 FPS
      if (currentTime - lastRenderTime >= 15) {
        lastRenderTime = currentTime;

        if (!pausedRef.current && !document.hidden && gl) {
          gl.uniform1f(uniforms.u_time, currentTime);
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
  }, [opacity, speed]);

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ pointerEvents: 'none' }}
      />
    </div>
  );
};

export default DreamyRomanticShaderBackground;
