// Stone lantern: a yukimi-doro, the snow-viewing lantern of Japanese gardens, after
// the photo of an old mossy one. Four broad legs arch out from under a low dome;
// on the dome sits a stack of discs, then the firebox, a hexagon with real openings
// cut through its walls (round moon windows front and back, square ones beside
// them), then a wide hexagonal roof whose corners lift a little, and a low cushion
// of a knob on top. Weathered granite, with moss gathered on everything that faces
// up and creeping up the feet.
//
// Lit, a candle burns in the firebox: a small flame and a warm glow seen through
// the windows, and the insides of the openings catch its light. The viewer shows
// it unlit or lit; a scene can set how brightly it burns with `setLit(0..1)`.
//
// Built at the koi and cat's scale, about 11 cm to the unit: some 7.3 units, or
// 80 cm, tall, with its feet 3.5 units out from the middle.
registerModel({
  name: 'stone-lantern',
  label: 'Stone lantern',
  build({ THREE, psx, canvasTexture, mergeGeometries, rand }) {
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const { lerp, smoothstep } = THREE.MathUtils;
    const TAU = Math.PI * 2;

    const COLOURS = {
      granite: ['#a3a29a', '#adaca3', '#b7b6ad', '#c1c0b6'], speckDark: '#7c7c75', speckLight: '#dcdad2',
      lichen: '#c9c9a2', moss: new THREE.Color('#6d8a4e'), mossDeep: new THREE.Color('#4f6b3d'),
      inside: 0x3a3936, flame: 0xffc878, glow: new THREE.Color(0xffb35c),
    };

    // ------------------------------------------------------------- texture
    // Granite: soft blotches of a few greys, black and white grains, and a few pale
    // rings of lichen. It wraps, and is laid on every part from whichever side the
    // part faces most squarely (see `finish`), so its grain is the same size all over.
    const lattice = Array.from({ length: 64 }, () => rand());
    const blotch = (x, y) => {                   // smooth noise on an 8 by 8 wrapping lattice
      const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
      const at = (i, j) => lattice[((yi + j) & 7) * 8 + ((xi + i) & 7)];
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      return lerp(lerp(at(0, 0), at(1, 0), sx), lerp(at(0, 1), at(1, 1), sx), sy);
    };
    const graniteTex = canvasTexture(64, 64, (ctx, w, h) => {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const n = blotch(x / 8, y / 8) * 0.7 + blotch(x / 4 + 3, y / 4 + 5) * 0.3, g = rand();
        ctx.fillStyle = g < 0.05 ? COLOURS.speckDark : g > 0.94 ? COLOURS.speckLight
          : COLOURS.granite[Math.min(3, Math.floor(n * 4 + (rand() - 0.5) * 0.8))];
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.strokeStyle = COLOURS.lichen; ctx.globalAlpha = 0.55;
      for (let i = 0; i < 5; i++) {
        const x = rand() * w, y = rand() * h, r = 1.5 + rand() * 3;
        for (const [dx, dy] of [[0, 0], [w, 0], [0, h], [-w, 0], [0, -h]]) {
          ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, TAU); ctx.stroke();
        }
      }
    });
    const glowTex = canvasTexture(32, 32, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });

    // --------------------------------------------------------- finishing
    // Every part ends here: split into separate triangles, given texture
    // coordinates by box projection (one repeat every 2.6 units) and coloured by
    // where it is. Moss grows on what faces up, in patches, and damp climbs the feet;
    // what faces down, under the roof and the discs, is in shadow.
    const TILE = 2.6;
    const mossAt = (p) => 0.5 + 0.25 * Math.sin(p.x * 1.7 + Math.sin(p.z * 2.3) * 1.5) + 0.25 * Math.sin(p.z * 1.9 + p.y * 1.3 + Math.sin(p.x * 2.9));
    function finish(geometry) {
      const g = geometry.index ? geometry.toNonIndexed() : geometry;
      const p = g.attributes.position, n = g.attributes.normal, count = p.count;
      const uv = new Float32Array(count * 2), colour = new Float32Array(count * 3);
      const a = V(), b = V(), c = V(), face = V(), at = V(), col = new THREE.Color();
      for (let i = 0; i < count; i += 3) {
        a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
        face.subVectors(c, b).cross(a.clone().sub(b));
        const ax = Math.abs(face.x), ay = Math.abs(face.y), az = Math.abs(face.z);
        for (let k = 0; k < 3; k++) {
          at.fromBufferAttribute(p, i + k);
          const [u, v] = ay >= ax && ay >= az ? [at.x, at.z] : ax >= az ? [at.z, at.y] : [at.x, at.y];
          uv[(i + k) * 2] = u / TILE; uv[(i + k) * 2 + 1] = v / TILE;
          const up = n.getY(i + k), m = mossAt(at);
          const moss = Math.min(1, smoothstep(up, 0.2, 0.8) * smoothstep(m, 0.3, 0.62)
            + 0.3 * smoothstep(m, 0.65, 0.9) + 0.55 * (1 - smoothstep(at.y, 0, 0.9)) * smoothstep(m, 0.2, 0.6));
          col.setRGB(0.96, 0.96, 0.95).lerp(m > 0.6 ? COLOURS.mossDeep : COLOURS.moss, moss * 0.85);
          col.multiplyScalar(up < -0.4 ? 0.62 : 1);
          colour.set([col.r, col.g, col.b], (i + k) * 3);
        }
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.BufferAttribute(colour, 3));
      return g;
    }
    // a lathe or other closed shape whose normals came out pointing inward is turned inside out
    function outward(geometry, centre) {
      const p = geometry.attributes.position, n = geometry.attributes.normal;
      let top = 0;
      for (let i = 1; i < p.count; i++) if (p.getY(i) > p.getY(top)) top = i;
      if (n.getY(top) > 0 || (centre && n.getY(top) === 0)) return geometry;
      for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
      const index = geometry.index.array;
      for (let i = 0; i < index.length; i += 3) [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]];
      return geometry;
    }
    const outside = [], inside = [];
    const disc = (rTop, rBottom, y0, y1, sides = 24) =>
      outside.push(finish(new THREE.CylinderGeometry(rTop, rBottom, y1 - y0, sides).translate(0, (y0 + y1) / 2, 0)));

    // ---------------------------------------------------------------- legs
    // Each leg follows an arch in its own upright plane: out from under the dome
    // nearly level, then over and down to stand almost upright. Its cross-section is
    // a rounded slab, broad across and thinner through, narrowing toward the foot and
    // flaring a little where it meets the ground.
    const ARCH = [[0.5, 3.15], [3.0, 3.35], [3.45, 0.0]];      // (out, height) of a quadratic curve
    const archAt = (t) => {
      const s = 1 - t, [p0, p1, p2] = ARCH;
      return [s * s * p0[0] + 2 * s * t * p1[0] + t * t * p2[0], s * s * p0[1] + 2 * s * t * p1[1] + t * t * p2[1],
        2 * s * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]), 2 * s * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])];
    };
    const ALONG = 18, ROUND = 14;
    for (let leg = 0; leg < 4; leg++) {
      const turn = leg * TAU / 4 + TAU / 8;     // set on the diagonals, so one stands toward each quarter
      const pos = [], index = [];
      for (let j = 0; j <= ALONG; j++) {
        const t = j / ALONG, [r, y, dr, dy] = archAt(t), len = Math.hypot(dr, dy);
        const nr = dy / len, ny = -dr / len;    // across the curve, in its plane, pointing up and out
        const flare = 1 + 0.25 * smoothstep(t, 0.85, 1);
        const wide = lerp(0.82, 0.55, t) * flare, thick = lerp(0.42, 0.34, t) * flare;
        for (let i = 0; i < ROUND; i++) {
          const a = (i / ROUND) * TAU, ca = Math.cos(a), sa = Math.sin(a);
          const sx = Math.sign(ca) * Math.abs(ca) ** 0.6, sy = Math.sign(sa) * Math.abs(sa) ** 0.6;   // a rounded rectangle
          const out = r + nr * thick * sy, up = Math.max(0, y + ny * thick * sy), side = wide * sx;
          pos.push(Math.sin(turn) * out + Math.cos(turn) * side, up, Math.cos(turn) * out - Math.sin(turn) * side);
        }
      }
      const [r1] = archAt(1);
      pos.push(Math.sin(turn) * r1, 0, Math.cos(turn) * r1);     // the middle of the sole
      for (let j = 0; j < ALONG; j++) for (let i = 0; i < ROUND; i++) {
        const a = j * ROUND + i, b = j * ROUND + ((i + 1) % ROUND), c = a + ROUND, d = b + ROUND;
        index.push(a, b, c, b, d, c);
      }
      const sole = (ALONG + 1) * ROUND;
      for (let i = 0; i < ROUND; i++) index.push(ALONG * ROUND + i, ALONG * ROUND + ((i + 1) % ROUND), sole);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(index);
      g.computeVertexNormals();
      outward(g);
      outside.push(finish(g));
    }

    // ----------------------------------------------------- dome and stack
    // the dome the legs spring from, closed underneath, then three discs: a waist,
    // a broad lip, and a thin seat for the firebox
    outside.push(finish(new THREE.SphereGeometry(2.25, 24, 8, 0, TAU, 0, Math.PI / 2).scale(1, 0.42, 1).translate(0, 2.55, 0)));
    outside.push(finish(new THREE.CircleGeometry(2.25, 24).rotateX(Math.PI / 2).translate(0, 2.55, 0)));
    disc(1.35, 1.45, 3.45, 3.8);
    disc(1.8, 1.72, 3.8, 4.12);
    disc(1.25, 1.3, 4.12, 4.24);

    // ------------------------------------------------------------ firebox
    // Six walls, each a slab with its window cut right through (round on the front
    // and back, square on the faces beside them, the last two solid), stood round a
    // hexagon with a post at each corner to close the joints. The faces of the slabs
    // that look inward, and the sides of the openings, go in the darker inside
    // material, which glows when the lantern is lit.
    const BOX_Y = 4.24, BOX_H = 1.6, CORNER = 1.2, APOTHEM = CORNER * Math.cos(Math.PI / 6), WALL = 0.22;
    const WINDOWS = ['round', 'square', null, 'round', 'square', null];
    WINDOWS.forEach((window, k) => {
      const shape = new THREE.Shape();
      shape.moveTo(-CORNER / 2, 0); shape.lineTo(CORNER / 2, 0); shape.lineTo(CORNER / 2, BOX_H); shape.lineTo(-CORNER / 2, BOX_H);
      shape.closePath();
      if (window === 'round') shape.holes.push(new THREE.Path().absarc(0, BOX_H / 2, 0.38, 0, TAU, true));
      if (window === 'square') {
        const s = 0.3, hole = new THREE.Path();
        hole.moveTo(-s, BOX_H / 2 - s); hole.lineTo(-s, BOX_H / 2 + s); hole.lineTo(s, BOX_H / 2 + s); hole.lineTo(s, BOX_H / 2 - s);
        hole.closePath();
        shape.holes.push(hole);
      }
      const slab = new THREE.ExtrudeGeometry(shape, { depth: WALL, bevelEnabled: false, curveSegments: 16 })
        .translate(0, BOX_Y, APOTHEM - WALL).rotateY(k * TAU / 6);
      // sort its triangles: those facing out from the middle are the outside
      const p = slab.attributes.position, n = slab.attributes.normal, keep = { out: [], in: [] };
      const centre = V(), normal = V();
      for (let i = 0; i < p.count; i += 3) {
        centre.set(0, 0, 0); normal.set(0, 0, 0);
        for (let m = 0; m < 3; m++) {
          centre.x += p.getX(i + m) / 3; centre.z += p.getZ(i + m) / 3;
          normal.x += n.getX(i + m); normal.z += n.getZ(i + m); normal.y += n.getY(i + m);
        }
        const facing = normal.normalize().dot(centre.normalize());
        (facing > 0.5 ? keep.out : keep.in).push(i);
      }
      for (const [list, into] of [[keep.out, outside], [keep.in, inside]]) {
        const part = new THREE.BufferGeometry();
        for (const name of ['position', 'normal']) {
          const src = slab.attributes[name], out = new Float32Array(list.length * 9);
          list.forEach((i, j) => { for (let m = 0; m < 9; m++) out[j * 9 + m] = src.array[i * 3 + m]; });
          part.setAttribute(name, new THREE.BufferAttribute(out, 3));
        }
        into.push(finish(part));
      }
      slab.dispose();
      if (window === 'round') {                // a raised ring round the moon window
        outside.push(finish(new THREE.TorusGeometry(0.46, 0.055, 6, 24).translate(0, BOX_Y + BOX_H / 2, APOTHEM + 0.02).rotateY(k * TAU / 6)));
      }
      const corner = (k + 0.5) * TAU / 6;
      outside.push(finish(new THREE.CylinderGeometry(0.16, 0.16, BOX_H, 8)
        .translate(Math.sin(corner) * CORNER, BOX_Y + BOX_H / 2, Math.cos(corner) * CORNER)));
    });

    // --------------------------------------------------------------- roof
    // Turned on a lathe, flat underneath, thick at the rim and sloping up to the
    // middle, then pulled toward a hexagon lined up with the firebox, with each of
    // the six corners lifted a little at the edge.
    const ROOF_Y = BOX_Y + BOX_H;
    const profile = [
      [0.01, ROOF_Y], [1.6, ROOF_Y], [2.9, ROOF_Y + 0.02], [3.2, ROOF_Y + 0.06], [3.32, ROOF_Y + 0.16],
      [3.28, ROOF_Y + 0.28], [3.1, ROOF_Y + 0.34], [2.2, ROOF_Y + 0.58], [1.2, ROOF_Y + 0.8], [0.6, ROOF_Y + 0.87], [0.01, ROOF_Y + 0.89],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const roof = new THREE.LatheGeometry(profile, 36);
    {
      const p = roof.attributes.position, sector = TAU / 6;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
        if (r < 0.05) continue;
        const a = Math.atan2(x, z), off = ((a % sector) + sector * 1.5) % sector - sector / 2;   // from the middle of a side
        const hex = Math.cos(sector / 2) / Math.cos(off);
        const k = lerp(1, lerp(1, hex, 0.65) / 0.95, smoothstep(r, 0.8, 2.6));
        const lift = 0.16 * smoothstep(Math.abs(off), sector * 0.3, sector / 2) * smoothstep(r, 2.5, 3.3);
        p.setXYZ(i, x * k, p.getY(i) + lift, z * k);
      }
      roof.computeVertexNormals();
      outward(roof);
    }
    outside.push(finish(roof));
    // the knob: a low cushion sunk into the top of the roof
    outside.push(finish(new THREE.SphereGeometry(0.95, 18, 10).scale(1, 0.6, 1).translate(0, ROOF_Y + 1.15, 0)));

    // ---------------------------------------------------------- materials
    const stone = new THREE.Mesh(mergeGeometries(outside),
      psx(new THREE.MeshLambertMaterial({ map: graniteTex, vertexColors: true })));
    // the inside: dark at any hour (no daylight gets in), lit only by the candle;
    // marked self-lit so a scene that tints its picture by the hour leaves it be
    const insideMaterial = psx(new THREE.MeshLambertMaterial({
      map: graniteTex, vertexColors: true, color: COLOURS.inside, emissive: 0x000000, userData: { selfLit: true },
    }));
    const hollow = new THREE.Mesh(mergeGeometries(inside), insideMaterial);
    [...outside, ...inside].forEach((g) => g.dispose());

    // the candle: a small flame, and a glow card behind the walls that shows through
    // the windows; the walls hide the rest of it
    const MIDDLE = V(0, BOX_Y + BOX_H * 0.45, 0);
    const flameMaterial = psx(new THREE.MeshBasicMaterial({ color: COLOURS.flame, userData: { selfLit: true } }));
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6).scale(1, 1.7, 1), flameMaterial);
    flame.position.copy(MIDDLE);
    const glowMaterial = psx(new THREE.MeshBasicMaterial({
      map: glowTex, color: COLOURS.glow, transparent: true, depthWrite: false, opacity: 0,
      blending: THREE.AdditiveBlending, userData: { selfLit: true },
    }));
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), glowMaterial);
    glow.position.copy(MIDDLE);
    glow.renderOrder = 3;
    const parentTurn = new THREE.Quaternion();

    // and a wide, faint aura round the whole firebox, so from far off the lantern
    // reads as lit even where its windows are only a pixel or two
    const auraMaterial = glowMaterial.clone();
    auraMaterial.onBeforeCompile = glowMaterial.onBeforeCompile;
    auraMaterial.customProgramCacheKey = glowMaterial.customProgramCacheKey;
    const aura = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), auraMaterial);
    aura.position.copy(MIDDLE);
    aura.renderOrder = 3;
    aura.onBeforeRender = glow.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
      root.getWorldQuaternion(parentTurn).invert();
      parentTurn.multiply(camera.quaternion);
      glow.quaternion.copy(parentTurn); aura.quaternion.copy(parentTurn);
    };

    const root = new THREE.Group();
    root.add(stone, hollow, flame, glow, aura);

    // ------------------------------------------------------------ burning
    let lit = 0;
    const setLit = (level) => { lit = level; };
    function update(dt, time) {
      const flicker = 0.88 + 0.07 * Math.sin(time * 11.3) + 0.05 * Math.sin(time * 17.9 + 1.3);
      const level = lit * flicker;
      flame.visible = lit > 0.02;
      flame.scale.set(1, 0.85 + 0.15 * flicker, 1);
      glowMaterial.opacity = 0.95 * level;
      auraMaterial.opacity = 0.35 * level;
      insideMaterial.emissive.copy(COLOURS.glow).multiplyScalar(0.75 * level);
    }
    function setVariant(name) { setLit(name === 'lit' ? 1 : 0); }
    setVariant('unlit');

    return {
      object: root, update, setLit,
      variants: [{ name: 'unlit', label: 'Unlit' }, { name: 'lit', label: 'Lit' }], variantLabel: 'Candle', setVariant,
      view: { back: 1.35, rise: 0.1, turn: 0.35 },
    };
  },
});
