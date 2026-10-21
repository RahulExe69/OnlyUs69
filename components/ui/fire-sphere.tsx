'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const vert = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  uniform float time;
  uniform float pulseScale;

  void main() {
    vNormal = normal;
    // Gentle rhythmic heartbeat pulsation
    float beat = sin(time * 0.0035);
    float pulse = pow(max(0.0, beat), 6.0) * 0.08 + pow(max(0.0, sin(time * 0.0035 + 0.35)), 12.0) * 0.05;
    vec3 newPosition = position * (1.0 + pulse * pulseScale);
    vPosition = newPosition;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

const frag = `
  #define NUM_OCTAVES 4
  uniform vec4 resolution;
  uniform vec3 color1;
  uniform vec3 color0;
  uniform float time;
  varying vec3 vNormal;
  varying vec3 vPosition;

  float rand(vec2 n) { return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453); }

  float noise(vec2 p){
    vec2 ip = floor(p);
    vec2 u = fract(p);
    u = u*u*(3.0-2.0*u);
    float res = mix(
      mix(rand(ip),rand(ip+vec2(1.0,0.0)),u.x),
      mix(rand(ip+vec2(0.0,1.0)),rand(ip+vec2(1.0,1.0)),u.x),u.y);
    return res*res;
  }

  float fbm(vec2 x) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
    for (int i = 0; i < NUM_OCTAVES; ++i) {
      v += a * noise(x);
      x = rot * x * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  vec3 rgbcol(float r, float g, float b) { return vec3(r/255.0, g/255.0, b/255.0); }

  void main(){
    vec2 uv = normalize(vNormal).xy * 0.5 + 0.5;
    
    // Romantic floating stardust drift
    vec2 drift = vec2(sin(time * 0.0008 + uv.y * 3.1415) * 0.04, -time * 0.0002);
    vec2 newUv = uv + drift;
    float scale = 6.0;
    vec2 p = newUv * scale;
    float n = fbm(p + fbm(p * 1.5));

    // Rim aura & spherical fresnel for dreamy soft edges
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.2);
    
    // Heart shape modulation in normal space
    vec2 hp = normalize(vNormal).xy * 1.5;
    hp.x = abs(hp.x);
    hp.y = hp.y + 0.22 - sqrt(clamp(hp.x, 0.0, 1.5)) * 0.45;
    float hDist = length(hp);
    float heartAura = smoothstep(1.3, 0.2, hDist);

    // Heartbeat pulse shimmer
    float beat = sin(time * 0.0035);
    float pulseGlow = pow(max(0.0, beat), 6.0) * 0.35 + pow(max(0.0, sin(time * 0.0035 + 0.35)), 12.0) * 0.25;

    // Palette blending: lovely pink + lavender violet + starlight shimmer
    vec3 c0 = rgbcol(color0.r, color0.g, color0.b);
    vec3 c1 = rgbcol(color1.r, color1.g, color1.b);
    vec3 whiteGlow = vec3(1.0, 0.88, 0.95);

    vec3 col = mix(c0, c1, sin(n * 3.1415 + time * 0.0005) * 0.5 + 0.5);
    col = mix(col, whiteGlow, fresnel * 0.6 + pulseGlow * 0.4);

    // Ethereal transparency for halo aura surrounding avatars
    float alpha = smoothstep(0.08, 0.85, fresnel * 1.25 + n * 0.4 + heartAura * 0.3);
    alpha = clamp(alpha * (0.85 + pulseGlow * 0.2), 0.0, 0.95);

    gl_FragColor = vec4(col, alpha);
  }
`;

export type FireSphereProps = {
  /** Bloom intensity (default 1.5) */
  bloomStrength?: number;
  /** Bloom radius (default 0.7) */
  bloomRadius?: number;
  /** Bloom threshold (default 0.1) */
  bloomThreshold?: number;
  /** Primary lovely pink/magenta RGB in 0–255 (default [255, 79, 139] - #FF4F8B) */
  color0?: [number, number, number];
  /** Secondary soft lavender/rose RGB in 0–255 (default [198, 108, 255] - #C66CFF) */
  color1?: [number, number, number];
  /** Whether to animate (default true) */
  animate?: boolean;
  /** Heartbeat pulse effect strength (default 1.0) */
  pulseScale?: number;
  /** Optional extra classes for the wrapper */
  className?: string;
  /** Optional content to embed in center (e.g. Profile Picture) */
  children?: React.ReactNode;
};

function FireSphere({
  bloomStrength = 1.5,
  bloomRadius = 0.7,
  bloomThreshold = 0.1,
  color0 = [255, 79, 139], // Romantic Sakura/Rose Pink
  color1 = [198, 108, 255], // Luminous Lavender Violet
  animate = true,
  pulseScale = 1.0,
  className = '',
  children,
}: FireSphereProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  
  const apiRef = useRef<{
    uniforms?: {
      time: { value: number };
      resolution: { value: THREE.Vector4 };
      color1: { value: THREE.Vector3 };
      color0: { value: THREE.Vector3 };
      pulseScale: { value: number };
    };
    bloomPass?: UnrealBloomPass;
    renderer?: THREE.WebGLRenderer;
    composer?: EffectComposer;
    scene?: THREE.Scene;
    camera?: THREE.Camera;
    cleanup?: () => void;
    clock?: THREE.Clock;
    raf?: number;
  }>({});

  // Initialize Three.js scene with transparent alpha
  useEffect(() => {
    if (!mountRef.current) return;
    let width = mountRef.current.clientWidth || 200;
    let height = mountRef.current.clientHeight || 200;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 4.2;

    // Alpha enabled for transparent backdrop around avatars
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: 'low-power'
    });
    renderer.setClearColor(0x000000, 0);
    // Bloom post-processing can leave a rectangular haze around transparent WebGL
    // canvases on mobile GPUs. Fade the canvas edges radially so the avatar aura
    // blends into the page instead of exposing the square render target.
    renderer.domElement.style.background = 'transparent';
    renderer.domElement.style.maskImage = 'radial-gradient(ellipse closest-side, #000 48%, transparent 100%)';
    renderer.domElement.style.webkitMaskImage = 'radial-gradient(ellipse closest-side, #000 48%, transparent 100%)';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(width, height);
    mountRef.current.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height), 
      bloomStrength, 
      bloomRadius, 
      bloomThreshold
    );
    composer.addPass(bloomPass);

    const uniforms = {
      time: { value: 0.0 },
      resolution: { value: new THREE.Vector4(width, height, 1, 1) },
      color1: { value: new THREE.Vector3(...color1) },
      color0: { value: new THREE.Vector3(...color0) },
      pulseScale: { value: pulseScale },
    };

    const geometry = new THREE.SphereGeometry(1.65, 48, 48);
    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: vert,
      fragmentShader: frag,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const onResize = () => {
      if (!mountRef.current) return;
      width = mountRef.current.clientWidth || 200;
      height = mountRef.current.clientHeight || 200;
      (camera as THREE.PerspectiveCamera).aspect = width / height;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
      renderer.setSize(width, height);
      composer.setSize(width, height);
      uniforms.resolution.value.set(width, height, 1, 1);
    };
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (animate) {
        uniforms.time.value = clock.getElapsedTime() * 1000.0;
        // Subtle romantic rotation
        mesh.rotation.y += 0.003;
        mesh.rotation.z = Math.sin(clock.getElapsedTime() * 0.5) * 0.08;
      }
      composer.render();
    };
    tick();

    const cleanup = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      geometry.dispose();
      material.dispose();
      composer.dispose();
      renderer.dispose();
      scene.clear();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };

    apiRef.current = { uniforms, bloomPass, renderer, composer, scene, camera, cleanup, clock, raf };

    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update uniforms when props change
  useEffect(() => {
    const api = apiRef.current;
    if (!api.uniforms) return;
    api.uniforms.color0.value.set(...color0);
    api.uniforms.color1.value.set(...color1);
    api.uniforms.pulseScale.value = pulseScale;
  }, [color0, color1, pulseScale]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api.bloomPass) return;
    api.bloomPass.threshold = bloomThreshold;
    api.bloomPass.strength = bloomStrength;
    api.bloomPass.radius = bloomRadius;
  }, [bloomStrength, bloomRadius, bloomThreshold]);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* 3D Lovely 🩷 Heart Sphere Background */}
      <div 
        ref={mountRef} 
        className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible scale-125" 
      />
      {/* Optional Child content (Avatar / Profile Image) */}
      {children && (
        <div className="relative z-10">
          {children}
        </div>
      )}
    </div>
  );
}

export { FireSphere, FireSphere as HeartSphere, FireSphere as LoveSphere };
export default FireSphere;
