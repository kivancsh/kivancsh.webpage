import { noise } from './common.js';

// Ambient backdrop + the period-change transition: a procedural radial noise front
// that grows out of the active record's centre, carrying a band of groove ripples.
export const bgFrag = /* glsl */ `
uniform vec3 uFrom;
uniform vec3 uTo;
uniform float uProg;
uniform vec2 uOrigin;
uniform float uAspect;
uniform float uTime;
uniform float uGlow;
varying vec2 vUv;
${noise}

void main(){
  vec2 q = vUv - uOrigin;
  q.x *= uAspect;
  float d = length(q);
  vec2 dir = q / max(d, 1e-4);

  // the noise front only exists while a colour change is travelling
  float n = 0.5;
  vec3 acc = uTo;
  float front = 0.0;
  float e = d;
  bool moving = uProg < 1.0;
  if (moving) {
    n = fbm(dir * 1.8 + vec2(uTime * 0.16, -uTime * 0.12) + d * 1.6);
    front = pow(uProg, 0.85) * 2.3;
    e = d + (n - 0.5) * 0.5;
    float m = 1.0 - smoothstep(front - 0.1, front + 0.02, e);
    acc = mix(uFrom, uTo, m);
  }

  vec3 col = vec3(0.019, 0.017, 0.016);
  float glow = exp(-d * d * 1.5);
  col += acc * (0.17 * glow + 0.03) * uGlow;

  // a giant, barely-there record behind everything
  #if QUALITY > 0
  float gr = d * 150.0;
  float fw = fwidth(gr);
  col += acc * 0.014 * (0.5 + 0.5 * sin(gr * 6.2831)) * clamp(1.0 - fw, 0.0, 1.0) * glow * uGlow;
  #endif

  // wavefront: grooves riding the noise edge
  if (moving) {
    float alive = step(0.0005, uProg) * (1.0 - smoothstep(0.62, 1.0, uProg));
    float band = exp(-pow((e - front) / 0.085, 2.0)) * alive;
    float ripple = 0.5 + 0.5 * sin(d * 120.0 - uTime * 3.0);
    float grain = vnoise(q * 40.0 + uTime);
    col += uTo * band * (0.25 + 0.75 * ripple) * (0.45 + 0.9 * n) * (0.75 + 0.5 * grain) * 0.6;
  }

  // floor bounce
  col += acc * 0.045 * smoothstep(0.38, 0.0, vUv.y) * uGlow;

  gl_FragColor = vec4(col, 1.0);
}
`;

// Final pass: vignette, a hint of chromatic edge, and the portal mask that opens a hole
// in the canvas so the blog page underneath shows through.
export const compFrag = /* glsl */ `
uniform sampler2D tScene;
uniform float uHole;
uniform float uAspect;
uniform float uTime;
uniform vec3 uAccent;
varying vec2 vUv;
${noise}

void main(){
  vec2 c = vUv - 0.5;
  vec3 col;
  #if QUALITY > 1
  float ca = dot(c, c) * 0.006;
  col.r = texture2D(tScene, vUv + c * ca).r;
  col.g = texture2D(tScene, vUv).g;
  col.b = texture2D(tScene, vUv - c * ca).b;
  #else
  col = texture2D(tScene, vUv).rgb;
  #endif

  vec2 q = c;
  q.x *= uAspect;
  float d = length(q);
  float vig = smoothstep(1.05, 0.2, d * 1.1);
  col *= mix(0.42, 1.0, vig);

  float alpha = 1.0;
  if (uHole > 0.0) {
    vec2 dir = q / max(d, 1e-4);
    float n = fbm(dir * 2.2 + vec2(uTime * 0.3, uTime * -0.2) + d * 2.0);
    float maxD = length(vec2(0.5 * uAspect, 0.5)) + 0.3;
    float front = uHole * maxD;
    float e = d + (n - 0.5) * 0.28 * smoothstep(0.0, 0.25, uHole);
    float inside = 1.0 - smoothstep(front - 0.035, front, e);
    float ring = exp(-pow((e - front) / 0.045, 2.0)) * (1.0 - smoothstep(0.75, 1.0, uHole));
    float ripple = 0.55 + 0.45 * sin(e * 190.0 - uTime * 6.0);
    col += uAccent * ring * ripple * 1.1;
    alpha = 1.0 - inside;
  }
  gl_FragColor = vec4(col * alpha, alpha);
}
`;

export const dustVert = /* glsl */ `
uniform float uTime;
uniform float uScale;
attribute float aSeed;
varying float vAlpha;
void main(){
  vec3 p = position;
  p.y += mod(uTime * (0.04 + aSeed * 0.08) + aSeed * 10.0, 10.0) - 5.0;
  p.x += sin(uTime * 0.2 + aSeed * 30.0) * 0.3;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (1.0 + aSeed * 2.4) * uScale / max(-mv.z, 0.1);
  vAlpha = 0.18 + 0.4 * fract(aSeed * 7.3);
  gl_Position = projectionMatrix * mv;
}
`;

export const dustFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * vAlpha * uOpacity;
  gl_FragColor = vec4(uColor * a, a);
}
`;
