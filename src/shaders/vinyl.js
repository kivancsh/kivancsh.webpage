import { noise } from './common.js';

// Procedural vinyl: circular-groove anisotropic highlight (Kajiya–Kay along the groove
// tangent), track gaps, dead wax, lead-in, fingerprint haze, dust, printed paper label.
export const vinylVert = /* glsl */ `
varying vec2 vLocal;
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec3 vAxX;
varying vec3 vAxY;
void main(){
  vLocal = position.xy;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  mat3 m = mat3(modelMatrix);
  vNormalW = normalize(m * normal);
  vAxX = normalize(m * vec3(1.0, 0.0, 0.0));
  vAxY = normalize(m * vec3(0.0, 1.0, 0.0));
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const vinylFrag = /* glsl */ `
uniform sampler2D uLabel;
uniform float uLabelR;
uniform float uHoleR;
uniform float uDim;
uniform float uFocus;
uniform float uSeed;
uniform float uOpacity;
uniform float uGrooves;
uniform vec3 uKey;
uniform vec3 uRim;
uniform vec3 uRimColor;
uniform vec3 uKeyColor;
varying vec2 vLocal;
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec3 vAxX;
varying vec3 vAxY;
${noise}

void main(){
  vec2 p = vLocal;
  float r = length(p);
  if (r > 1.0 || r < uHoleR) discard;

  vec3 N = normalize(vNormalW) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = normalize(uKey - vWorldPos);
  vec3 L2 = normalize(uRim - vWorldPos);
  vec3 H = normalize(L + V);
  vec3 H2 = normalize(L2 + V);
  float ndv = max(dot(N, V), 0.0);
  float fres = pow(1.0 - ndv, 4.0);
  float ndl = max(dot(N, L), 0.0);

  vec3 col;
  if (r < uLabelR) {
    vec2 luv = p / uLabelR * 0.5 + 0.5;
    vec3 paper = texture2D(uLabel, luv).rgb;
    float diff = ndl * 0.62 + 0.42;
    float sheen = pow(max(dot(N, H), 0.0), 18.0) * 0.10;
    col = paper * diff * (0.78 + 0.32 * uFocus) + sheen;
    // pressed ring where the label meets the vinyl
    col *= mix(0.55, 1.0, smoothstep(uLabelR, uLabelR - 0.014, r));
    // tiny raised lip around the spindle hole
    col *= mix(0.6, 1.0, smoothstep(uHoleR, uHoleR + 0.012, r));
  } else {
    float dead = 1.0 - smoothstep(uLabelR + 0.03, uLabelR + 0.045, r);
    float lead = smoothstep(0.932, 0.944, r);
    float grooved = (1.0 - dead) * (1.0 - lead) * uGrooves;

    // track gaps (band positions vary per record)
    float gaps = 0.0;
    #if QUALITY > 0
    for (int i = 0; i < 5; i++){
      float fi = float(i);
      float gr = mix(uLabelR + 0.09, 0.915, (fi + 0.25 + 0.5 * hash21(vec2(uSeed, fi))) / 5.0);
      gaps += 1.0 - smoothstep(0.0018, 0.0042, abs(r - gr));
    }
    #endif
    grooved *= 1.0 - clamp(gaps, 0.0, 1.0);

    // micro grooves, faded out where they'd alias
    float gx = r * 520.0;
    float fw = fwidth(gx);
    float micro = mix(0.5, 0.5 + 0.5 * sin(gx * 6.2831), clamp(1.0 - fw * 0.9, 0.0, 1.0));
    float dyn = vnoise(vec2(r * 95.0 + uSeed * 13.0, 0.5));
    float dyn2 = vnoise(vec2(r * 21.0 + uSeed * 7.0, 3.5));

    // anisotropic highlight: the groove tangent turns the light into the classic bow-tie
    vec2 td = vec2(-p.y, p.x) / max(r, 1e-4);
    vec3 T = normalize(vAxX * td.x + vAxY * td.y);
    float th = dot(T, H);
    float sinT = sqrt(max(1.0 - th * th, 0.0));
    float sharp = pow(sinT, 700.0);
    float broad = pow(sinT, 48.0);
    float aniso = (sharp * 1.25 + broad * 0.32) * ndl;
    aniso *= grooved * (0.5 + 0.95 * micro) * (0.55 + 0.9 * dyn);

    float th2 = dot(T, H2);
    float s2 = sqrt(max(1.0 - th2 * th2, 0.0));
    float aniso2 = pow(s2, 110.0) * max(dot(N, L2), 0.0) * (0.45 + 0.8 * micro * grooved);

    // smooth zones (dead wax, lead-in, gaps) behave like a dark mirror
    float nh = max(dot(N, H), 0.0);
    float iso = (pow(nh, 260.0) * 1.4 + pow(nh, 26.0) * 0.06) * (1.0 - grooved * 0.85);
    float nh2 = max(dot(N, H2), 0.0);
    float iso2 = pow(nh2, 60.0) * 0.5 * (1.0 - grooved);

    vec3 base = vec3(0.011, 0.010, 0.011) + vec3(0.010) * dyn2 * grooved;

    // fingerprint haze and dust, both catch the light (skipped on the lightest tier)
    float haze = 0.0;
    float dust = 0.0;
    #if QUALITY > 0
    float smudge = fbm(p * 2.4 + uSeed * 3.1);
    haze = smoothstep(0.5, 0.86, smudge) * (broad * 0.55 + 0.05) * 0.16;
    vec2 dc = p * 150.0 + uSeed * 17.0;
    float dh = hash21(floor(dc));
    dust = step(0.9955, dh) * smoothstep(0.32, 0.0, length(fract(dc) - 0.5));
    #endif

    float boost = 0.72 + 0.55 * uFocus;
    col = base
        + uKeyColor * (aniso + iso) * boost
        + uRimColor * (aniso2 * (0.3 + 0.5 * uFocus) + iso2)
        + vec3(haze) * (0.6 + 0.6 * uFocus)
        + vec3(dust) * (0.06 + 0.7 * broad);

    // bevelled edge and grazing reflection
    float bevel = smoothstep(0.986, 1.0, r);
    col += (uKeyColor * 0.22 + uRimColor * 0.25) * bevel * (0.35 + fres);
    col += uRimColor * fres * 0.07;
  }

  col = shoulder(col);
  col *= mix(1.0, 0.1, uDim);
  gl_FragColor = vec4(col * uOpacity, uOpacity);
}
`;

export const rimFrag = /* glsl */ `
uniform float uDim;
uniform float uOpacity;
uniform vec3 uKey;
uniform vec3 uRimColor;
varying vec3 vWorldPos;
varying vec3 vNormalW;
void main(){
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = normalize(uKey - vWorldPos);
  float spec = pow(max(dot(N, normalize(L + V)), 0.0), 40.0);
  vec3 col = vec3(0.012) + vec3(0.5) * spec + uRimColor * 0.08 * pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col *= mix(1.0, 0.1, uDim);
  gl_FragColor = vec4(col * uOpacity, uOpacity);
}
`;

export const rimVert = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vNormalW;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
