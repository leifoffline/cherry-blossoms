// Koi: one fish, ten coats. The body is a lofted tube with a painted skin wrapped
// round it (nose to tail across the picture, belly > back > belly up it), and the
// varieties differ only in what is painted on that skin and on the fins. The
// butterfly koi also swaps in longer fins. He hangs in the air and swims on the
// spot: a wave runs down the spine, the fins ripple, the paired fins paddle, and
// now and then he blinks. His skin is shaded as if wet (see `wet` below).
registerModel({
  name: 'koi',
  label: 'Koi',
  build({ THREE, psx, canvasTexture, mergeGeometries, seed }) {
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const { lerp, smoothstep } = THREE.MathUtils;
    const TAU = Math.PI * 2;

    // ------------------------------------------------------------ body shape
    // Built with the nose toward +z. `t` runs along the body: 0 at the nose, 1 where
    // the tail fin starts. `v` runs round it: 0 at the belly, 0.5 along the back.
    const LENGTH = 4, NOSE_Z = 2.6, HOVER = 1.7;
    const zAt = (t) => NOSE_Z - t * LENGTH;
    // along, half-width, half-height, height of the middle
    const STATIONS = [
      [0.00, 0.00, 0.00, -0.06],
      [0.02, 0.15, 0.12, -0.06],
      [0.07, 0.26, 0.23, -0.04],
      [0.14, 0.34, 0.34, -0.01],
      [0.24, 0.41, 0.45, 0.02],
      [0.36, 0.44, 0.51, 0.03],
      [0.50, 0.41, 0.50, 0.03],
      [0.64, 0.33, 0.43, 0.03],
      [0.78, 0.22, 0.32, 0.03],
      [0.90, 0.12, 0.22, 0.03],
      [1.00, 0.06, 0.18, 0.03],
    ];
    const spline = (a, b, c, d, f) =>
      0.5 * (2 * b + (c - a) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (3 * b - a - 3 * c + d) * f * f * f);
    function shape(t) {                          // the cross-section at t, smoothed between stations
      t = Math.min(Math.max(t, 0), 1);
      let i = 0;
      while (i < STATIONS.length - 2 && STATIONS[i + 1][0] < t) i++;
      const f = (t - STATIONS[i][0]) / (STATIONS[i + 1][0] - STATIONS[i][0]);
      const at = (k, col) => STATIONS[Math.min(Math.max(k, 0), STATIONS.length - 1)][col];
      const col = (c) => spline(at(i - 1, c), at(i, c), at(i + 1, c), at(i + 2, c), f);
      return { w: Math.max(0, col(1)), h: Math.max(0, col(2)), y: col(3) };
    }
    function skin(t, v, lift = 0) {              // a point on the body's surface
      const s = shape(t), a = v * TAU;
      return V((s.w + lift) * Math.sin(a), s.y - (s.h + lift) * Math.cos(a), zAt(t));
    }

    const RINGS = [0, 0.02, 0.07, 0.14, 0.19, 0.24, 0.3, 0.36, 0.43, 0.5, 0.57, 0.64, 0.71, 0.78, 0.84, 0.9, 0.95, 1];
    const AROUND = 12;
    function bodyGeometry() {
      const pos = [], uv = [], index = [];
      const ring = (t, z, closed) => {
        for (let j = 0; j <= AROUND; j++) {
          const p = closed ? V(0, shape(t).y, z) : skin(t, j / AROUND);
          pos.push(p.x, p.y, z);
          uv.push(t, j / AROUND);
        }
      };
      for (const t of RINGS) ring(t, zAt(t), false);
      ring(1, zAt(1) - 0.06, true);              // closes the stump the tail fin grows from
      for (let i = 0; i < RINGS.length; i++) for (let j = 0; j < AROUND; j++) {
        const a = i * (AROUND + 1) + j, b = a + 1, c = a + AROUND + 1, d = c + 1;
        index.push(a, c, b, b, c, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(index);
      g.computeVertexNormals();
      return g;
    }
    // barbels: two small whiskers at each corner of the mouth, coloured from the chin
    function barbel(t, v, length, side) {
      const g = new THREE.ConeGeometry(0.02, length, 5).translate(0, length / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), V(side * 0.55, -0.75, 0.35).normalize()));
      const at = skin(t, v, -0.01), uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.03, 0.03);
      return g.translate(at.x, at.y, at.z);
    }

    // mouth: a ring of thick lips at the tip of the snout, turned a little downward,
    // round a dark opening. The lips take the colour of the nose.
    const MOUTH = V(0, -0.1, NOSE_Z - 0.03), MOUTH_TILT = 0.4;
    const atMouth = (g) => g.scale(1.3, 0.85, 1).rotateX(MOUTH_TILT).translate(MOUTH.x, MOUTH.y, MOUTH.z);
    function lips() {
      const g = atMouth(new THREE.TorusGeometry(0.086, 0.042, 6, 10)), uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.02, 0.5);
      return g;
    }
    const gape = () => atMouth(new THREE.SphereGeometry(0.084, 10, 6).scale(1, 1, 0.55));

    // ------------------------------------------------------------------ fins
    // A fin is a sheet stretched from a row of points on the body to a row of tips.
    // `flop` records how far out along the fin each point is, for the ripple.
    function sheet(bases, tips, rows = 3) {
      const n = bases.length, pos = [], uv = [], flop = [], index = [];
      for (let i = 0; i < n; i++) for (let r = 0; r <= rows; r++) {
        const f = r / rows, p = bases[i].clone().lerp(tips[i], f);
        pos.push(p.x, p.y, p.z); uv.push(i / (n - 1), f); flop.push(f);
      }
      for (let i = 0; i < n - 1; i++) for (let r = 0; r < rows; r++) {
        const a = i * (rows + 1) + r, b = a + 1, c = a + rows + 1, d = c + 1;
        index.push(a, c, b, b, c, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('flop', new THREE.Float32BufferAttribute(flop, 1));
      g.setIndex(index);
      return g;
    }
    const spread = (n, make) => Array.from({ length: n }, (_, i) => make(i / (n - 1)));

    function dorsalFin(k) {                      // long and low, tallest near the front
      const bases = [], tips = [];
      spread(9, (u) => {
        const t = lerp(0.33, 0.74, u), s = shape(t);
        const height = k * lerp(0.14, 0.5, smoothstep(u, 0, 0.22)) * lerp(1, 0.42, smoothstep(u, 0.2, 1));
        const base = V(0, s.y + s.h - 0.05, zAt(t));
        bases.push(base);
        tips.push(base.clone().add(V(0, height, -height * (0.45 + 0.25 * k) - 0.04)));
      });
      return sheet(bases, tips);
    }
    function analFin(k) {
      const bases = [], tips = [];
      spread(4, (u) => {
        const t = lerp(0.76, 0.85, u), s = shape(t);
        const base = V(0, s.y - s.h + 0.04, zAt(t));
        bases.push(base);
        tips.push(base.clone().addScaledVector(V(0, -0.72, -0.7), 0.42 * k * lerp(1, 0.4, u * u)));
      });
      return sheet(bases, tips);
    }
    function tailFin(k) {                        // forked: long rays top and bottom, short in the middle
      const s = shape(1), bases = [], tips = [];
      spread(9, (u) => {
        const up = 1 - 2 * u;                    // 1 at the top ray, -1 at the bottom
        const angle = up * 0.6;
        const length = 1.15 * k * (0.6 + 0.4 * Math.abs(up) ** 1.4) * (1 - 0.1 * Math.abs(up) ** 6);
        const base = V(0, s.y + up * s.h * 0.9, zAt(1) + 0.08);
        bases.push(base);
        tips.push(base.clone().add(V(0, Math.sin(angle) * length - (k - 1) * 0.12 * length, -Math.cos(angle) * length)));
      });
      return sheet(bases, tips, 4);
    }
    // a paddle: rays fan out from a short root, the leading ray the longest
    function paddle(root, out, back, { rays, fan, length, rootLength }) {
      const bases = [], tips = [];
      spread(rays, (u) => {
        const base = root.clone().add(V(0, 0, (0.5 - u) * rootLength));
        const angle = u * fan;
        const dir = out.clone().multiplyScalar(Math.cos(angle)).addScaledVector(back, Math.sin(angle));
        bases.push(base);
        tips.push(base.clone().addScaledVector(dir, length * (1 - 0.45 * u * u) * (u === 0 ? 0.93 : 1)));
      });
      return sheet(bases, tips);
    }

    // ------------------------------------------------------------- the paint
    const WHITE = [246, 242, 234], CREAM = [238, 228, 210], BLACK = [26, 24, 30];
    const RED = [226, 50, 22], ORANGE = [242, 122, 22], YELLOW = [248, 208, 44];
    const GOLD = [236, 178, 34], PALE_GOLD = [252, 222, 110];
    const SLATE = [62, 88, 136], SKY = [150, 196, 228], ICE = [206, 220, 232], NAVY = [34, 54, 104];
    const mix = (a, b, f) => [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];

    function hash(x, y, n) {
      let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(n + seed * 131, 1274126177);
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }
    function noise(x, y, n) {
      const xi = Math.floor(x), yi = Math.floor(y), s = (f) => f * f * (3 - 2 * f);
      const u = s(x - xi), w = s(y - yi);
      return lerp(lerp(hash(xi, yi, n), hash(xi + 1, yi, n), u), lerp(hash(xi, yi + 1, n), hash(xi + 1, yi + 1, n), u), w);
    }
    // soft-edged blotches; `fa` and `fs` set how many fit along and around the fish
    const blotch = (n, fa, fs) => (a, s) =>
      0.65 * noise(a * fa, s * fs + 40, n) + 0.35 * noise(a * fa * 2.3 + 9, s * fs * 2.3 + 60, n + 1);
    // a swell and dip along the body, so markings come as a few separate steps from
    // head to tail rather than one sheet
    const steps = (n, count, a) => 0.13 * Math.sin(a * TAU * count + hash(n, 7, 3) * TAU);
    const HEAD = 0.2;                            // the gill cover ends here; no scales in front of it

    // Each coat is a function giving the colour at a point of the skin: `a` along the
    // fish (0 nose, 1 tail), `s` round it (0 on the back, -1 and 1 on the belly), `m`
    // the distance down from the back whichever side. `x` and `y` are the pixel.
    function patched(n, colour) {                // patches down the back, clear of nose, tail and belly
      const patch = blotch(n, 4.6, 1.3);
      return (a, s, m) => {
        if (a < 0.065 || a > 0.93) return null;
        const reach = lerp(0.3, 0.62, smoothstep(a, HEAD - 0.04, HEAD + 0.06));   // on the head, only the crown
        return patch(a, s) + steps(n, 3.1, a) - 0.6 * smoothstep(m, reach - 0.2, reach + 0.05) > 0.5 ? colour : null;
      };
    }
    function spotted(n, cut = 0.64) {            // small ink spots on the back, never on the head
      const spot = blotch(n, 10, 4.2);
      return (a, s, m) => a > HEAD + 0.02 && a < 0.96 && spot(a, s) - 0.5 * smoothstep(m, 0.3, 0.62) > cut;
    }
    const scaleRim = (x, y) => {                 // the curved rear edge of each scale, rows staggered
      const row = y >> 2, ly = y & 3, lx = (x + (row & 1) * 2) & 3;
      return (lx === 3 && (ly === 1 || ly === 2)) || (lx === 2 && (ly === 0 || ly === 3));
    };
    function blueBacked(back) {                  // asagi and shusui: blue above, red flanks and cheeks
      const wobble = blotch(71, 7, 2);
      return (a, s, m, x, y) => {
        const edge = (wobble(a, s) - 0.5) * 0.2;
        if (a < HEAD) return m < 0.4 ? ICE : m > 0.56 + edge && m < 0.86 && a > 0.07 ? RED : WHITE;
        if (m < 0.58 + edge) return back(a, m, x, y);
        return m < 0.84 + edge ? RED : WHITE;
      };
    }

    const VARIETIES = [
      {
        name: 'kohaku', label: 'Kohaku', fins: { root: CREAM, tip: WHITE },
        coat() { const hi = patched(11, RED); return (a, s, m) => hi(a, s, m) || WHITE; },
      },
      {
        name: 'sanke', label: 'Taisho Sanke', fins: { root: CREAM, tip: WHITE, streak: BLACK },
        coat() {
          const hi = patched(23, RED), sumi = spotted(29);
          return (a, s, m) => (sumi(a, s, m) ? BLACK : hi(a, s, m) || WHITE);
        },
      },
      {
        name: 'showa', label: 'Showa', fins: { root: BLACK, tip: WHITE },
        coat() {
          const band = blotch(31, 2.7, 0.55), hi = blotch(37, 3.6, 1.6);
          return (a, s, m) => {
            if (band(a, s) > 0.53) return BLACK;                  // ink wraps right round the body
            return hi(a, s) - 0.5 * smoothstep(m, 0.5, 0.85) > 0.5 ? RED : WHITE;
          };
        },
      },
      {
        name: 'utsuri', label: 'Utsurimono', fins: { root: BLACK, tip: YELLOW, streak: BLACK },
        coat() { const band = blotch(43, 3.6, 0.7); return (a, s) => (band(a, s) + steps(43, 3.4, a) > 0.56 ? YELLOW : BLACK); },
      },
      {
        name: 'bekko', label: 'Bekko', fins: { root: ORANGE, tip: [252, 214, 160] },
        coat() {
          const sumi = spotted(53, 0.62);
          return (a, s, m) => (sumi(a, s, m) ? BLACK : mix(ORANGE, [250, 196, 120], smoothstep(m, 0.55, 0.95)));
        },
      },
      {
        name: 'asagi', label: 'Asagi', fins: { root: RED, tip: [250, 222, 210] }, scales: 0,
        coat() { return blueBacked((a, m, x, y) => (scaleRim(x, y) ? [168, 194, 224] : SLATE)); },
      },
      {
        name: 'shusui', label: 'Shusui', fins: { root: RED, tip: [250, 222, 210] }, scales: 0,
        // no scales but one row of big dark ones down the spine
        coat() { return blueBacked((a, m, x) => (m < 0.1 && x % 5 < 3 ? NAVY : mix(SKY, ICE, smoothstep(m, 0.1, 0.5)))); },
      },
      {
        name: 'tancho', label: 'Tancho', fins: { root: CREAM, tip: WHITE },
        coat() { return (a, s) => (((a - 0.118) / 0.05) ** 2 + (s / 0.3) ** 2 < 1 ? RED : WHITE); },
      },
      {
        name: 'ogon', label: 'Ogon', fins: { root: GOLD, tip: PALE_GOLD }, scales: 0.8,
        coat() { return (a, s, m) => mix(mix(PALE_GOLD, GOLD, smoothstep(m, 0, 0.45)), PALE_GOLD, smoothstep(m, 0.6, 1)); },
      },
      {
        name: 'butterfly', label: 'Butterfly Koi', fins: { root: [250, 214, 190], tip: WHITE }, long: true,
        coat() {
          const hi = patched(67, [238, 84, 20]), sumi = spotted(73, 0.68);
          return (a, s, m) => (sumi(a, s, m) ? BLACK : hi(a, s, m) || WHITE);
        },
      },
    ];

    const SKIN_W = 128, SKIN_H = 64, FIN_SIZE = 16;
    function paintSkin(ctx, variety) {
      const img = ctx.createImageData(SKIN_W, SKIN_H), coat = variety.coat();
      const rim = variety.scales ?? 0.86;        // how dark the scale edges are; 0 for none
      for (let y = 0; y < SKIN_H; y++) for (let x = 0; x < SKIN_W; x++) {
        const a = (x + 0.5) / SKIN_W, s = 1 - ((y + 0.5) / SKIN_H) * 2, m = Math.abs(s);
        const colour = coat(a, s, m, x, y);
        let shade = 1;
        if (rim && a > HEAD + 0.01 && a < 0.97 && m < 0.84 && scaleRim(x, y)) shade = rim;
        // the edge of the gill cover, a line curving down each side of the head
        if (m > 0.14 && m < 0.86 && x === Math.round(SKIN_W * (HEAD + 0.005 - 0.07 * (m - 0.45) ** 2))) shade = 0.7;
        // the corner of the mouth, a crease running back and down from the lips
        if (a < 0.06 && Math.abs(m - (0.64 + 2.2 * a)) < 0.035) shade = 0.5;
        const i = (y * SKIN_W + x) * 4;
        for (let k = 0; k < 3; k++) img.data[i + k] = colour[k] * shade;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }
    function paintFin(ctx, { root, tip, streak }) {   // root colour fading to the tip, with rays
      const img = ctx.createImageData(FIN_SIZE, FIN_SIZE);
      for (let y = 0; y < FIN_SIZE; y++) for (let x = 0; x < FIN_SIZE; x++) {
        const out = 1 - y / (FIN_SIZE - 1);
        let colour = mix(root, tip, smoothstep(out, 0.08, 0.6));
        if (streak && x % 6 === 2 && out < 0.85) colour = streak;
        const shade = x % 3 === 0 ? 0.88 : 1;
        const i = (y * FIN_SIZE + x) * 4;
        for (let k = 0; k < 3; k++) img.data[i + k] = colour[k] * shade;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }

    // ------------------------------------------------------------- assembly
    const skinTex = canvasTexture(SKIN_W, SKIN_H, () => {});
    const finTex = canvasTexture(FIN_SIZE, FIN_SIZE, () => {});
    // Wet: on top of the viewer's shader, the skin gets what a fish under water has.
    // A highlight from a light overhead that slides along the back as he bends, a
    // pale sheen where the surface turns away from the eye, and ripples of light
    // drifting over his upper side. The ripples are fixed in the world, so he swims
    // through them.
    function wet(material, amount) {
      const viewerShader = material.onBeforeCompile;
      material.onBeforeCompile = (shader, renderer) => {
        viewerShader(shader, renderer);
        shader.uniforms.uWet = { value: amount };
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vWetPos;')
          .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWetPos = wPos.xyz;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', /* glsl */`#include <common>
            uniform float uTime;
            uniform float uWet;
            varying vec3 vWetPos;`)
          .replace('#include <opaque_fragment>', /* glsl */`{
              vec3 wetN = normalize(normal), wetV = normalize(vViewPosition);
              vec3 wetLight = normalize((viewMatrix * vec4(0.2, 1.0, 0.3, 0.0)).xyz);
              float facing = max(dot(wetN, wetV), 0.0);
              float top = max((vec4(wetN, 0.0) * viewMatrix).y, 0.0);       // how far the surface faces up
              float gleam = pow(max(dot(wetN, normalize(wetLight + wetV)), 0.0), 64.0);
              float sheen = pow(1.0 - facing, 3.0) * (0.35 + 0.65 * top);
              vec2 q = vWetPos.xz * 2.3;
              float ripple = pow(0.5 + 0.5 * sin(q.x + 1.6 * sin(q.y * 0.9 + uTime * 0.9) + uTime * 0.6), 5.0)
                           + pow(0.5 + 0.5 * sin(q.y * 1.3 + 1.4 * sin(q.x * 1.1 - uTime * 0.7) - uTime * 0.4), 5.0);
              outgoingLight += uWet * (vec3(1.0, 0.98, 0.94) * 0.6 * gleam
                + vec3(0.72, 0.88, 1.0) * 0.13 * sheen
                + vec3(0.85, 0.96, 1.0) * 0.09 * ripple * top);
            }
            #include <opaque_fragment>`);
      };
      material.customProgramCacheKey = () => 'psx-wet';
      return material;
    }
    // dimmed, with a little glow of its own, so white skin neither burns out in the sun
    // nor goes grey in the shade
    const glow = (map, extra) => psx(new THREE.MeshLambertMaterial({
      map, color: 0xd0d0d0, emissive: 0x747474, emissiveMap: map, ...extra,
    }));
    const skinMaterial = wet(glow(skinTex), 1);
    const finMaterial = wet(glow(finTex, { side: THREE.DoubleSide }), 0.45);
    const inkMaterial = psx(new THREE.MeshBasicMaterial({ color: 0x101014 }));
    const glintMaterial = psx(new THREE.MeshBasicMaterial({ color: 0xffffff }));   // the catchlight in each eye
    const irisMaterial = psx(new THREE.MeshLambertMaterial({ color: 0xd8c890, emissive: 0x404030 }));

    const root = new THREE.Group();
    root.rotation.y = -Math.PI / 2;              // swimming to the left
    const fish = new THREE.Group();
    root.add(fish);

    // `soft` parts are bent every frame; each remembers its shape at rest
    const soft = [];
    function part(parent, geometry, material, paired = false) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      parent.add(mesh);
      const p = geometry.attributes.position;
      const entry = { p, geometry, mesh, rest: p.array.slice(), flop: geometry.attributes.flop?.array, paired };
      soft.push(entry);
      return entry;
    }
    const merged = (geometries) => {
      const g = mergeGeometries(geometries);
      geometries.forEach((x) => x.dispose());
      return g;
    };

    const SIDES = [-1, 1];
    let eyesOpen, eyesShut;
    part(fish, merged([
      bodyGeometry(), lips(),
      ...SIDES.flatMap((side) => [barbel(0.022, 0.5 + side * 0.37, 0.17, side), barbel(0.045, 0.5 + side * 0.4, 0.11, side)]),
    ]), skinMaterial).smooth = true;
    {
      const iris = [], pupil = [], glint = [], lid = [], lash = [];
      for (const side of SIDES) {
        const at = skin(0.088, 0.5 - side * 0.185);
        iris.push(new THREE.SphereGeometry(0.075, 10, 8).scale(0.45, 1, 1).translate(at.x, at.y, at.z));
        pupil.push(new THREE.SphereGeometry(0.048, 8, 6).scale(0.5, 1, 1).translate(at.x + side * 0.022, at.y, at.z + 0.005));
        // shut: a lid the colour of the skin around the eye, with a dark line across it
        const cover = new THREE.SphereGeometry(0.084, 10, 8).scale(0.78, 1, 1).translate(at.x + side * 0.004, at.y, at.z);
        for (let i = 0, uv = cover.attributes.uv; i < uv.count; i++) uv.setXY(i, 0.088, 0.5 - side * 0.185);
        lid.push(cover);
        lash.push(new THREE.BoxGeometry(0.012, 0.016, 0.13).translate(at.x + side * 0.068, at.y - 0.006, at.z));
        glint.push(new THREE.SphereGeometry(0.017, 6, 4).translate(at.x + side * 0.044, at.y + 0.022, at.z + 0.022));
      }
      part(fish, gape(), inkMaterial);
      eyesOpen = [part(fish, merged(iris), irisMaterial), part(fish, merged(pupil), inkMaterial), part(fish, merged(glint), glintMaterial)];
      eyesShut = [part(fish, merged(lid), skinMaterial), part(fish, merged(lash), inkMaterial)];
    }

    // fins are rebuilt when a variety wants a different length
    const finParts = [], paired = [];
    let finLength = 0;
    function buildFins(k) {
      for (const entry of finParts.splice(0)) soft.splice(soft.indexOf(entry), 1);
      for (const fin of paired.splice(0)) { fish.remove(fin.group); fin.group.children[0].geometry.dispose(); }
      const old = fish.getObjectByName('fins');
      if (old) { fish.remove(old); old.children[0].geometry.dispose(); }
      finLength = k;

      const spine = new THREE.Group();
      spine.name = 'fins';
      fish.add(spine);
      const g = merged([dorsalFin(1 + (k - 1) * 0.6), analFin(k), tailFin(k)]);
      g.computeVertexNormals();
      finParts.push(part(spine, g, finMaterial));

      // pectoral fins low behind the gills, pelvic fins under the belly; each hangs
      // from its own root so it can paddle
      for (const side of SIDES) for (const kind of ['pectoral', 'pelvic']) {
        const front = kind === 'pectoral';
        const pivot = front ? skin(0.225, 0.5 - side * 0.37, -0.03) : skin(0.53, 0.5 - side * 0.43, -0.03);
        const out = (front ? V(side * 0.85, -0.3, -0.3) : V(side * 0.5, -0.6, -0.6)).normalize();
        const back = (front ? V(side * 0.1, -0.15, -1) : V(side * 0.1, 0.1, -1)).normalize();
        const fin = paddle(pivot, out, back, front
          ? { rays: 6, fan: 1.0, length: 0.8 * k, rootLength: 0.2 }
          : { rays: 5, fan: 0.8, length: 0.46 * k, rootLength: 0.14 });
        fin.translate(-pivot.x, -pivot.y, -pivot.z);
        fin.computeVertexNormals();
        const group = new THREE.Group();
        group.position.copy(pivot);
        fish.add(group);
        finParts.push(part(group, fin, finMaterial, true));
        paired.push({ group, pivot, side, front });
      }
    }

    function setVariant(name) {
      const variety = VARIETIES.find((v) => v.name === name) || VARIETIES[0];
      paintSkin(skinTex.image.getContext('2d'), variety);
      paintFin(finTex.image.getContext('2d'), variety.fins);
      skinTex.needsUpdate = finTex.needsUpdate = true;
      const k = variety.long ? 1.9 : 1;
      if (k !== finLength) buildFins(k);
    }
    setVariant(VARIETIES[0].name);

    // ------------------------------------------------------------ animation
    const SWIM = 3.4;
    const BLINK = 0.16;                          // seconds the eyes stay shut
    let untilBlink = 2.5, shut = 0;
    // how far the spine is pushed sideways at z: a wave that grows toward the tail
    function sway(z, phase) {
      const t = Math.min((NOSE_Z - z) / LENGTH, 1.5);
      return (0.03 + 0.19 * t * t) * Math.sin(phase - t * 3.4);
    }
    function update(dt, time) {
      const phase = time * SWIM, ripple = 0.035 * finLength ** 1.6;
      for (const { p, geometry, rest, flop, paired: isPaired, smooth } of soft) {
        const at = p.array;
        for (let i = 0, k = 0; i < p.count; i++, k += 3) {
          const z = rest[k + 2], f = flop ? flop[i] ** 2 : 0;
          if (isPaired) at[k + 1] = rest[k + 1] + f * ripple * Math.sin(phase * 1.3 + z * 5);
          else at[k] = rest[k] + sway(z, phase) + f * ripple * Math.sin(phase * 1.6 + z * 3 + rest[k + 1] * 2);
        }
        p.needsUpdate = true;
        if (smooth) geometry.computeVertexNormals();   // so the highlight follows the bend
      }
      // paired fins ride the spine and paddle, the two sides out of step
      for (const { group, pivot, side, front } of paired) {
        const beat = phase * 0.7 + (side > 0 ? 0 : 0.9) + (front ? 0 : 1.6), size = front ? 1 : 0.6;
        group.position.x = pivot.x + sway(pivot.z, phase);
        group.rotation.z = side * size * (-0.08 + 0.26 * Math.sin(beat));
        group.rotation.y = side * size * (0.18 + 0.16 * Math.sin(beat - 1.1));
      }
      // blink
      if (shut > 0) {
        shut -= dt;
        if (shut <= 0) untilBlink = Math.random() < 0.15 ? 0.2 : 2.5 + Math.random() * 4;   // now and then a double blink
      } else if ((untilBlink -= dt) <= 0) shut = BLINK;
      for (const eye of eyesOpen) eye.mesh.visible = shut <= 0;
      for (const eye of eyesShut) eye.mesh.visible = shut > 0;

      fish.position.y = HOVER + 0.07 * Math.sin(time * 1.1);
      fish.rotation.z = 0.04 * Math.sin(phase * 0.5);
      fish.rotation.x = 0.025 * Math.sin(time * 1.1 + 1.2);
    }
    update(0, 0);

    return {
      object: root, update,
      variants: VARIETIES.map(({ name, label }) => ({ name, label })), variantLabel: 'Pattern', setVariant,
      // framed on the fish itself rather than on the gap beneath him, seen from his
      // front quarter and a little above
      bounds: new THREE.Box3(V(-2.7, 0, -0.9), V(2.7, HOVER * 2, 0.9)),
      shadow: { x: 2.3, z: 0.6 },
      view: { back: 0.92, rise: 0.22, turn: -0.5 },
    };
  },
});
