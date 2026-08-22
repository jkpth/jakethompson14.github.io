import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const globeParticleVertex = `
attribute float a_size;
attribute float a_layer;

uniform float u_time;
uniform float u_pointSize;

varying float v_layer;
varying float v_depth;
varying float v_falloff;

void main() {
  vec3 pos = position;
  float breathe = 1.0 + sin(u_time * 0.65 + a_layer * 4.0) * 0.012;
  pos *= breathe;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = u_pointSize * a_size * (1.0 / max(0.18, -mvPosition.z));
  gl_Position = projectionMatrix * mvPosition;

  v_layer = a_layer;
  v_depth = smoothstep(-1.8, 1.8, pos.z);
  v_falloff = smoothstep(2.45, 0.25, length(pos));
}
`;

const globeParticleFragment = `
precision highp float;

uniform vec3 u_coreColor;
uniform vec3 u_accentColor;

varying float v_layer;
varying float v_depth;
varying float v_falloff;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float alpha = smoothstep(0.5, 0.0, d);
  alpha *= alpha;

  vec3 color = mix(u_coreColor, u_accentColor, smoothstep(0.35, 1.0, v_layer));
  color += vec3(1.0) * v_depth * 0.08;
  color = mix(color * 0.42, color, clamp(v_falloff + v_layer * 0.28, 0.0, 1.0));
  alpha *= mix(0.52, 1.0, clamp(v_falloff + v_layer * 0.24, 0.0, 1.0));

  gl_FragColor = vec4(color, alpha);
}
`;

function hexToRgb01(hex) {
  const clean = hex.replace('#', '').trim();
  const value = clean.length === 3
    ? clean.split('').map((char) => char + char).join('')
    : clean;

  return new THREE.Color(
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255
  );
}

function buildGlobeParticleGeometry(options = {}) {
  const sphereCount = options.sphereCount || 2600;
  const ringCount = options.ringCount || 1300;
  const radius = options.radius || 1.35;
  const ringRadius = options.ringRadius || 2.05;
  const ringThickness = options.ringThickness || 0.12;
  const total = sphereCount + ringCount;

  const positions = new Float32Array(total * 3);
  const sizes = new Float32Array(total);
  const layers = new Float32Array(total);

  for (let i = 0; i < sphereCount; i++) {
    const z = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const r = radius * (0.58 + Math.pow(Math.random(), 0.42) * 0.42);
    const root = Math.sqrt(1 - z * z);
    const index = i * 3;

    positions[index] = Math.cos(theta) * root * r;
    positions[index + 1] = Math.sin(theta) * root * r;
    positions[index + 2] = z * r;
    sizes[i] = 0.72 + Math.random() * 0.72;
    layers[i] = Math.random() * 0.28;
  }

  for (let i = 0; i < ringCount; i++) {
    const pointIndex = sphereCount + i;
    const angle = Math.random() * Math.PI * 2;
    const r = ringRadius + (Math.random() - 0.5) * ringThickness;
    const y = (Math.random() - 0.5) * ringThickness * 0.58;
    const index = pointIndex * 3;

    positions[index] = Math.cos(angle) * r;
    positions[index + 1] = y;
    positions[index + 2] = Math.sin(angle) * r;
    sizes[pointIndex] = 0.62 + Math.random() * 0.58;
    layers[pointIndex] = 0.72 + Math.random() * 0.28;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('a_size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('a_layer', new THREE.BufferAttribute(layers, 1));
  return geometry;
}

function initGlobeParticles(canvas, options = {}) {
  if (!canvas) return () => {};

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, options.maxDpr || 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, options.cameraDistance || 5.6);

  const accent = options.accentColor
    ? new THREE.Color(options.accentColor)
    : hexToRgb01(getComputedStyle(document.documentElement).getPropertyValue('--brand-accent').trim() || '#64b5f6');

  const geometry = buildGlobeParticleGeometry(options);
  const material = new THREE.ShaderMaterial({
    vertexShader: globeParticleVertex,
    fragmentShader: globeParticleFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      u_time: { value: 0 },
      u_pointSize: { value: options.pointSize || 18 },
      u_coreColor: { value: new THREE.Color(options.coreColor || 0xf8fafc) },
      u_accentColor: { value: accent },
    },
  });

  const particles = new THREE.Points(geometry, material);
  particles.rotation.x = options.tiltX ?? -0.42;
  particles.rotation.z = options.tiltZ ?? 0.22;
  scene.add(particles);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pointer = new THREE.Vector2(0, 0);
  let rafId = 0;

  function resize() {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, options.maxDpr || 1.6));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function handlePointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    pointer.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  }

  function render(time = 0) {
    const t = time * 0.001;
    material.uniforms.u_time.value = t;

    const mouseStrength = options.mouseStrength ?? 0.08;
    const breath = reduceMotion ? 0 : Math.sin(t * 0.55) * 0.045;
    particles.rotation.y = t * (options.rotationSpeed || 0.12);
    particles.rotation.x = (options.tiltX ?? -0.42) + pointer.y * mouseStrength;
    particles.rotation.z = (options.tiltZ ?? 0.22) + pointer.x * mouseStrength;
    particles.scale.setScalar(1 + breath);

    renderer.render(scene, camera);
    if (!reduceMotion) rafId = requestAnimationFrame(render);
  }

  function handleResize() {
    cancelAnimationFrame(rafId);
    resize();
    render();
  }

  resize();
  render();
  window.addEventListener('resize', handleResize);
  window.addEventListener('pointermove', handlePointerMove);

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('pointermove', handlePointerMove);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  };
}

const isMobile = window.matchMedia('(max-width: 768px)').matches;

initGlobeParticles(document.querySelector('[data-globe-particles]'), {
  sphereCount: isMobile ? 900 : 1800,
  ringCount: isMobile ? 450 : 900,
  accentColor: '#64b5f6',
  radius: 1.35,
  ringRadius: 2.05,
  rotationSpeed: 0.08,
  mouseStrength: 0.05,
  pointSize: isMobile ? 14 : 16,
  maxDpr: isMobile ? 1.25 : 1.6,
});
