// Firefly, after the photo of one on a grass blade at night: a long, soft beetle
// whose dark wing cases (elytra) cover almost all of him, with a salmon-orange
// shield (the pronotum) hooding his small black head, a dark spot in its middle,
// long beaded antennae, six thin legs, and the lantern: the last two segments of
// his abdomen, pale cream when dark and a yellow-green glow when he flashes.
//
// He is rigged: one skeleton of bones (body, head, a chain down each antenna, a
// chain down the abdomen, a hinge for each wing case and hind wing, and hip, knee
// and ankle for each leg), and every surface is skinned to it. Where a limb bends,
// the vertices near the joint follow both bones, so nothing parts from the body
// however he is posed.
//
// Two poses, picked in the viewer: perched (standing, antennae feeling the air,
// flashing slowly) and flying (hovering nose up with the wing cases raised, the
// hind wings beating and the legs hanging, flashing faster). The glow is a pulsing
// emissive patch on the abdomen's skin, a soft halo card that faces the camera,
// and a small light that tints whatever is underneath him.
registerModel({
  name: 'firefly',
  label: 'Firefly',
  build({ THREE, psx, canvasTexture, mergeGeometries, rand }) {
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const UP = V(0, 1, 0);
    const { lerp, smoothstep } = THREE.MathUtils;
    const SIDES = [-1, 1];

    // He is modelled large (about 4.6 units from jaws to tail) and then shrunk to
    // life size. The koi and the cat are built at roughly 11 cm to the unit (a 60 cm
    // koi is 5.4 units long); a firefly is about 1.4 cm, an eighth of a unit.
    const SCALE = 0.125 / 4.6;

    // his own colours
    const COLOURS = {
      elytra: '#2b221b', elytraRib: '#3a2e24', elytraEdge: '#8c7748',
      shield: '#c9774f', shieldEdge: '#ddb274', shieldSpot: '#1d1612',
      belly: '#3b2c20', bellyBand: '#6b5338', lanternOff: '#c8c088',
      head: 0x18130f, eye: 0x0c0c10, leg: 0x3a2b1e, antenna: 0x221a14,
      glow: new THREE.Color(0xc8ff58),           // the flash: a yellow-green, as in the photo
    };

    // ----------------------------------------------------------- helpers
    // A surface laid over a (u, v) grid, with the grid itself as texture coordinates
    // unless `at` hands back its own.
    function grid(nu, nv, at) {
      const pos = [], uv = [], index = [];
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
        const [p, tu = i / nu, tv = j / nv] = [].concat(at(i / nu, j / nv));
        pos.push(p.x, p.y, p.z); uv.push(tu, tv);
      }
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
        index.push(a, c, b, b, c, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(index);
      g.computeVertexNormals();
      return g;
    }
    function ball(c, rx, ry = rx, rz = rx, w = 10, h = 8) {
      return new THREE.SphereGeometry(1, w, h).scale(rx, ry, rz).translate(c.x, c.y, c.z);
    }
    function rod(a, b, ra, rb = ra, sides = 6) {     // a tapered cylinder from a to b
      const d = V().subVectors(b, a), len = d.length();
      const g = new THREE.CylinderGeometry(rb, ra, len, sides, 1, true).translate(0, len / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
      return g.translate(a.x, a.y, a.z);
    }
    const grain = Array.from({ length: 64 * 64 }, () => rand());

    // ---------------------------------------------------------- skeleton
    // Built facing +z, standing with his feet on y = 0. Every bone sits at its joint
    // with no turn of its own in the rest pose, so a bone's axes are the model's.
    const root = new THREE.Group();
    root.scale.setScalar(SCALE);
    const bones = [];
    function bone(parent, joint) {
      const b = new THREE.Bone();
      b.userData.joint = joint.clone();
      b.position.copy(joint);
      if (parent) b.position.sub(parent.userData.joint);
      b.userData.rest = b.position.clone();
      b.userData.index = bones.length;
      bones.push(b);
      (parent || root).add(b);
      return b;
    }
    // Skinning: each vertex follows up to two bones. `rigid` ties a shape to one
    // bone; `chain` ties it to a run of bones along the joints at `points` (one more
    // point than bones: the far end), sharing the vertices near each joint between
    // the bones that meet there so the joint bends instead of parting.
    function skin(geometry, weigh) {
      const p = geometry.attributes.position, index = [], weight = [];
      for (let i = 0; i < p.count; i++) {
        const [a, wa, b = 0, wb = 0] = weigh(V(p.getX(i), p.getY(i), p.getZ(i)));
        index.push(a, b, 0, 0); weight.push(wa, wb, 0, 0);
      }
      geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(index, 4));
      geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weight, 4));
      return geometry;
    }
    const rigid = (geometry, b) => skin(geometry, () => [b.userData.index, 1]);
    const SHARE = 0.25;                          // how far along a bone each joint's bend spreads
    function chain(geometry, run, points) {
      const span = new THREE.Line3(), near = V();
      return skin(geometry, (p) => {
        let best = 0, f = 0, d = Infinity;
        for (let i = 0; i < run.length; i++) {
          span.set(points[i], points[i + 1]);
          const t = span.closestPointToPointParameter(p, true);
          const dist = span.at(t, near).distanceToSquared(p);
          if (dist < d) { d = dist; best = i; f = t; }
        }
        const me = run[best].userData.index;
        if (f < SHARE && best > 0) {
          const w = 0.5 + 0.5 * f / SHARE;
          return [me, w, run[best - 1].userData.index, 1 - w];
        }
        if (f > 1 - SHARE && best < run.length - 1) {
          const w = 0.5 + 0.5 * (1 - f) / SHARE;
          return [me, w, run[best + 1].userData.index, 1 - w];
        }
        return [me, 1];
      });
    }
    // shapes waiting to be merged into one skinned mesh per material
    const shapes = { belly: [], dark: [], shield: [], head: [], eye: [], antenna: [], elytra: [], wing: [] };

    // ---------------------------------------------------------- textures
    // Wing case: across from the seam (left) to the outer edge (right), along from the
    // shoulder (top) to the tip. Near-black brown with faint ribs running its length,
    // a pale rim down the outer edge, and a little mottling.
    const elytraTex = canvasTexture(64, 64, (ctx, w, h) => {
      ctx.fillStyle = COLOURS.elytra; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = COLOURS.elytraRib;
      for (const x of [9, 20, 31, 42]) ctx.fillRect(x, 0, 2, h);
      for (let i = 0; i < w * h; i++) {
        if (grain[i] < 0.82) continue;
        ctx.fillStyle = `rgba(${grain[i] > 0.93 ? '90,72,52' : '14,10,8'},0.35)`;
        ctx.fillRect(i % w, (i / w) | 0, 1, 1);
      }
      ctx.fillStyle = COLOURS.elytraEdge; ctx.fillRect(w - 6, 0, 4, h);
      ctx.fillStyle = 'rgba(140,119,72,0.4)'; ctx.fillRect(0, 0, 2, h);  // the seam catches a little light
    });
    // Shield, seen from above (front at the top): salmon, paler toward the rim, with a
    // dark spot in the middle drawn out toward the back.
    const shieldTex = canvasTexture(64, 64, (ctx, w, h) => {
      const rim = ctx.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, w / 2);
      rim.addColorStop(0, COLOURS.shield); rim.addColorStop(0.7, COLOURS.shield); rim.addColorStop(1, COLOURS.shieldEdge);
      ctx.fillStyle = rim; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(160,70,60,0.35)';                       // a rosy blush beside the spot
      ctx.beginPath(); ctx.ellipse(w / 2, h * 0.55, 20, 16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLOURS.shieldSpot;
      ctx.beginPath(); ctx.ellipse(w / 2, h * 0.6, 8, 16, 0, 0, Math.PI * 2); ctx.fill();
    });
    // Abdomen: round it across (belly at both edges, back in the middle), along it
    // from the tail (top of the canvas) to the waist. Dark segments with paler
    // joints; the lantern is the whole of the last two segments, cream all the way
    // round. (On a real firefly the light organ is on the underside and the back of
    // those segments is a darker plate; here the back glows too, a little less, so
    // the lit section reads as one piece from any side.)
    const ABDOMEN_SEGMENTS = 8, LANTERN_SEGMENTS = 2;
    const bandRow = (s, h) => Math.round((1 - s / ABDOMEN_SEGMENTS) * h);
    const bellyTex = canvasTexture(32, 64, (ctx, w, h) => {
      ctx.fillStyle = COLOURS.belly; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = COLOURS.lanternOff; ctx.fillRect(0, 0, w, bandRow(ABDOMEN_SEGMENTS - LANTERN_SEGMENTS, h));
      ctx.fillStyle = COLOURS.bellyBand;
      for (let s = 1; s < ABDOMEN_SEGMENTS - LANTERN_SEGMENTS; s++) ctx.fillRect(0, bandRow(s, h) - 1, w, 2);
      ctx.fillStyle = 'rgba(120,112,70,0.6)';                       // the crease between the two lit segments
      ctx.fillRect(0, bandRow(ABDOMEN_SEGMENTS - 1, h), w, 1);
    });
    // the same lantern, as a mask for where the glow shows: full underneath, easing
    // to three quarters along the back
    const lanternMask = canvasTexture(32, 64, (ctx, w, h) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      const across = ctx.createLinearGradient(0, 0, w, 0);
      across.addColorStop(0, '#fff'); across.addColorStop(0.3, '#fff'); across.addColorStop(0.5, '#bbb');
      across.addColorStop(0.7, '#fff'); across.addColorStop(1, '#fff');
      ctx.fillStyle = across; ctx.fillRect(0, 0, w, bandRow(ABDOMEN_SEGMENTS - LANTERN_SEGMENTS, h));
    });
    // the tail end must not bleed round into the waist when filtered
    for (const t of [bellyTex, lanternMask]) t.wrapT = THREE.ClampToEdgeWrapping;
    // Hind wing, hinge at the left, leading edge at the top: smoky and see-through,
    // with darker veins fanning from a solid root at the hinge.
    const wingTex = canvasTexture(64, 32, (ctx, w, h) => {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 4); ctx.quadraticCurveTo(40, 0, 62, 10);
      ctx.quadraticCurveTo(66, 24, 46, 28); ctx.quadraticCurveTo(20, 30, 0, 18);
      ctx.closePath(); ctx.clip();
      ctx.fillStyle = 'rgba(120,108,96,0.45)'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(50,40,32,0.9)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, 5); ctx.quadraticCurveTo(40, 0, 62, 10); ctx.stroke();   // the stiff leading edge
      ctx.lineWidth = 1;
      for (const [x, y] of [[50, 14], [44, 22], [30, 27], [16, 24]]) {
        ctx.beginPath(); ctx.moveTo(2, 10); ctx.quadraticCurveTo(x * 0.5, y * 0.6 + 4, x, y); ctx.stroke();
      }
      const base = ctx.createLinearGradient(0, 0, 10, 0);
      base.addColorStop(0, 'rgba(50,40,32,1)'); base.addColorStop(1, 'rgba(50,40,32,0)');
      ctx.fillStyle = base; ctx.fillRect(0, 0, 10, h);
      ctx.restore();
    });
    // the halo round the lantern: soft, brightest in the middle
    const haloTex = canvasTexture(32, 32, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });

    // --------------------------------------------------------- materials
    // The wing cases and eyes have a little shine, as a beetle's do; Phong gives it.
    const materials = {
      elytra: psx(new THREE.MeshPhongMaterial({
        map: elytraTex, side: THREE.DoubleSide, shininess: 40, specular: 0x4a4038,
      })),
      shield: psx(new THREE.MeshPhongMaterial({ map: shieldTex, shininess: 30, specular: 0x403028 })),
      belly: psx(new THREE.MeshLambertMaterial({ map: bellyTex, emissiveMap: lanternMask, emissive: 0x000000 })),
      head: psx(new THREE.MeshLambertMaterial({ color: COLOURS.head })),
      eye: psx(new THREE.MeshPhongMaterial({ color: COLOURS.eye, shininess: 90, specular: 0x9090a0 })),
      dark: psx(new THREE.MeshLambertMaterial({ color: COLOURS.leg })),
      antenna: psx(new THREE.MeshLambertMaterial({ color: COLOURS.antenna })),
      wing: psx(new THREE.MeshLambertMaterial({
        map: wingTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, emissive: 0x302820,
      })),
    };
    // `selfLit` tells a page that tints its picture by the hour (the pond) to leave
    // this one alone: it is a light, and night should not dim it
    const haloMaterial = psx(new THREE.MeshBasicMaterial({
      map: haloTex, color: COLOURS.glow, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0, userData: { selfLit: true },
    }));

    // ------------------------------------------------------------- body
    // `hips` carries everything and turns about his middle, so he can tip nose up
    // in flight.
    const CENTRE = V(0, 0.85, 0);
    const hips = bone(null, CENTRE);

    // Abdomen: a lofted tube from the waist (z = 1) to the tail, ringed by its
    // segments, rounding shut at the tip and drooping toward it, so the lantern
    // shows below and behind the tips of the wing cases. Four bones run down it.
    const ABDOMEN_FRONT = 1.0, ABDOMEN_LENGTH = 3.4;
    const spine = (v) => V(0, 0.8 - 0.2 * v * v, ABDOMEN_FRONT - v * ABDOMEN_LENGTH);
    const abdomenJoints = [0.03, 0.3, 0.55, 0.78, 1].map(spine);
    const abdomen = [];
    for (let i = 0; i < 4; i++) abdomen.push(bone(abdomen[i - 1] || hips, abdomenJoints[i]));
    shapes.belly.push(chain(grid(14, 32, (u, v) => {
      const end = v > 0.8 ? Math.sqrt(Math.max(0, 1 - ((v - 0.8) / 0.2) ** 2)) : 1;
      const ring = 1 - 0.05 * Math.pow(Math.abs(Math.sin(v * ABDOMEN_SEGMENTS * Math.PI)), 0.5);
      const k = (1 - 0.1 * v) * end * ring, a = u * Math.PI * 2, mid = spine(v);
      return V(0.52 * k * Math.sin(a), mid.y - 0.27 * k * Math.cos(a), mid.z);
    }), abdomen, abdomenJoints));
    // the waist under the shield and the front of the wing cases, where the legs join
    shapes.dark.push(rigid(ball(V(0, 0.78, 1.15), 0.4, 0.28, 0.65, 12, 8), hips));

    // Shield: a low dome over the front. Its rim reaches forward over the head and
    // back over the shoulders of the wing cases, which slide out from under it.
    const SHIELD = V(0, 1.02, 1.32), SW = 0.68, SH = 0.28, SD = 0.55;
    shapes.shield.push(rigid(grid(18, 8, (u, v) => {
      const a = u * Math.PI * 2, r = Math.sin(v * 0.62 * Math.PI), y = Math.cos(v * 0.62 * Math.PI);
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      return [V(SHIELD.x + SW * x, SHIELD.y + SH * y, SHIELD.z + SD * z), 0.5 + x * 0.5, 0.5 + z * 0.5];
    }), hips));

    // Head: small and black, tucked under the shield's front rim, with big round eyes
    // and short jaws. It turns at the neck.
    const HEAD = V(0, 0.8, 1.95);
    const head = bone(hips, V(0, 0.82, 1.7));
    shapes.head.push(rigid(ball(HEAD, 0.25, 0.24, 0.3, 12, 8), head));
    for (const s of SIDES) {
      shapes.head.push(rigid(rod(V(s * 0.08, 0.66, 2.12), V(s * 0.02, 0.6, 2.3), 0.04, 0.015, 5), head));
      shapes.eye.push(rigid(ball(V(s * 0.19, 0.84, 2.05), 0.15, 0.17, 0.15, 10, 8), head));
    }

    // Antennae: eleven beads each, rising from between the eyes, out and forward,
    // bending over toward the tip, on a chain of four bones so they curl as they sway.
    const antennae = SIDES.map((s) => {
      const path = new THREE.CatmullRomCurve3([
        V(s * 0.1, 0.98, 2.12), V(s * 0.22, 1.3, 2.45), V(s * 0.4, 1.6, 2.95), V(s * 0.5, 1.68, 3.45),
      ]);
      const joints = [0, 0.25, 0.5, 0.75, 1].map((t) => path.getPoint(t));
      const run = [];
      for (let i = 0; i < 4; i++) run.push(bone(run[i - 1] || head, joints[i]));
      const SEGMENTS = 11;
      for (let i = 0; i < SEGMENTS; i++) {
        const a = path.getPoint(i / SEGMENTS), b = path.getPoint((i + 1) / SEGMENTS);
        const r = lerp(0.035, 0.02, i / SEGMENTS);
        shapes.antenna.push(chain(rod(a, b, r * 0.8, r, 5), run, joints), chain(ball(b, r * 1.25, r * 1.25, r * 1.25, 6, 4), run, joints));
      }
      return run;
    });

    // Wing cases: two shells meeting at the seam down his back. Each is a slice of a
    // flattened tube wrapping from the seam down past his side, with a little
    // thickness: the outline goes out along the top surface and back along the
    // underside, and the two close together at the shoulder and the tip, so a
    // raised case is a solid lid and not a hollow gutter. Its shoulder is lower and
    // narrower than the rest and sits under the back rim of the shield, where the
    // hinge is, so the case stays tucked in there when it lifts. Each one's tip is
    // rounded on its own: the shell runs longest halfway out from the seam.
    const SHOULDER_Z = 0.98, ACROSS = 10;
    const elytra = SIDES.map((s) => {
      const hinge = bone(hips, V(s * 0.1, 1.06, 0.93));
      const shell = grid(ACROSS * 2 + 2, 22, (u, v) => {
        const i = Math.round(u * (ACROSS * 2 + 2));
        const under = i > ACROSS && i <= ACROSS * 2 + 1;          // on the way back, underneath
        const across = under ? (ACROSS * 2 + 1 - i) / ACROSS : (i % (ACROSS * 2 + 2)) / ACROSS;
        const a = across * 1.9;                                    // round from the seam, past the side
        const out = Math.min(Math.sin(a), 1);
        const length = 2.5 + 0.42 * Math.sqrt(Math.max(0, 1 - (2 * out - 1) ** 2));
        const tuck = 1 - smoothstep(v, 0, 0.2);                    // the shoulder, under the shield
        const thick = under ? 0.05 * Math.sqrt(Math.min(1, v / 0.05, (1 - v) / 0.05)) : 0;
        const w = 0.62 * (1 + 0.05 * Math.sin(v * Math.PI)) * (1 - 0.18 * v ** 3) - 0.06 * tuck - thick;
        const h = 0.42 * (1 - 0.3 * v ** 2) - 0.14 * tuck - thick, y = 0.82 - 0.08 * v;
        return [V(s * w * Math.sin(a), y + h * Math.cos(a), SHOULDER_Z - v * length), across, v];
      });
      shapes.elytra.push(rigid(shell, hinge));
      return hinge;
    });

    // Hind wings: folded away under the cases at rest, spread and beating in flight.
    // They hinge on top of the waist just behind the shield, under the raised cases.
    const wings = SIDES.map((s) => {
      const at = V(s * 0.2, 0.98, 0.72);
      const hinge = bone(hips, at);
      shapes.wing.push(rigid(new THREE.PlaneGeometry(2.4, 1.1).rotateX(Math.PI / 2)
        .translate(1.2, 0, -0.33).scale(s, 1, 1).translate(at.x, at.y, at.z), hinge));
      return hinge;
    });

    // Legs: front, middle and hind pairs from the underside of the waist. Each is a
    // femur out to the knee, then a tibia down to the floor and a short beaded foot
    // along it, on hip, knee and ankle bones; the front feet reach forward and the
    // hind ones back. The middle and hind knees stay under the rim of the wing cases.
    const LEGS = [
      { z: 1.45, knee: [0.8, 0.95, 0.45], foot: [1.1, 0.85], toe: 0.3 },
      { z: 1.12, knee: [0.95, 0.72, 0.05], foot: [1.25, 0.15], toe: 0.05 },
      { z: 0.8, knee: [0.95, 0.68, -0.5], foot: [1.15, -0.95], toe: -0.3 },
    ];
    const legs = [];
    LEGS.forEach(({ z, knee, foot, toe }, pair) => {
      for (const s of SIDES) {
        const H = V(s * 0.24, 0.56, z);
        const K = V(s * knee[0], knee[1], z + knee[2]);
        const F = V(s * foot[0], 0.06, z + foot[1]);
        const T = V(s * (foot[0] + 0.12), 0.03, z + foot[1] + toe);
        const hip = bone(hips, H), shin = bone(hip, K), ankle = bone(shin, F);
        const run = [hip, shin, ankle], joints = [H, K, F, T];
        const parts = [
          ball(H, 0.06, 0.06, 0.06, 6, 4), rod(H, K, 0.05, 0.04),
          ball(K, 0.043, 0.043, 0.043, 6, 4), rod(K, F, 0.036, 0.026),
        ];
        for (let i = 0; i < 4; i++) {
          const a = V().lerpVectors(F, T, i / 4), b = V().lerpVectors(F, T, (i + 1) / 4);
          parts.push(rod(a, b, 0.024, 0.02, 5), ball(b, 0.026, 0.026, 0.026, 5, 4));
        }
        for (const g of parts) shapes.dark.push(chain(g, run, joints));
        legs.push({ s, pair, hip, shin, ankle });
      }
    });

    // Skin: one mesh per material, all on the one skeleton.
    root.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(bones);
    const meshes = {};
    for (const [name, list] of Object.entries(shapes)) {
      const mesh = new THREE.SkinnedMesh(mergeGeometries(list), materials[name]);
      list.forEach((g) => g.dispose());
      mesh.frustumCulled = false;                // its bounds are those of the rest pose, not the pose he is in
      root.add(mesh);
      mesh.bind(skeleton);
      meshes[name] = mesh;
    }
    meshes.wing.renderOrder = 1;                 // after the solid parts, so they show through

    // Lantern glow: a halo card that always faces the camera, and a light, both
    // carried by the last bone of the abdomen, just under the tail.
    const tail = abdomen[abdomen.length - 1];
    const LANTERN = V(0, 0.5, -2.0);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), haloMaterial);
    halo.position.subVectors(LANTERN, tail.userData.joint);
    halo.renderOrder = 2;
    const turned = new THREE.Quaternion();
    halo.onBeforeRender = (renderer, scene, camera) => {   // undo the tail's turn, then face the camera
      tail.getWorldQuaternion(turned).invert();
      halo.quaternion.copy(turned.multiply(camera.quaternion));
    };
    tail.add(halo);
    // the light reaches, and falls off, in the world's units, so both shrink with him
    const LAMP_REACH = 5 * SCALE, LAMP_POWER = 2.2 * SCALE * SCALE;
    const lamp = new THREE.PointLight(COLOURS.glow, 0, LAMP_REACH, 2);
    lamp.position.copy(halo.position).add(V(0, -0.1, 0));
    tail.add(lamp);

    // ------------------------------------------------------------- poses
    let pose = 'perched';
    function setVariant(name) {
      pose = name;
      for (const b of bones) { b.position.copy(b.userData.rest); b.rotation.set(0, 0, 0); }
      meshes.wing.visible = name === 'flying';
    }

    // A flash rises fast and fades slower, with a faint ember between. Perched, one
    // slow flash every few seconds; flying, a quicker pair. The clock starts partway
    // into a flash so the first frame shows him lit.
    function flash(time) {
      const period = pose === 'flying' ? 2.2 : 3.4;
      const p = (time + 0.22) % period;
      const one = (t) => (t < 0 ? 0 : t < 0.12 ? t / 0.12 : Math.exp(-(t - 0.12) * 5));
      return 0.06 + 0.94 * Math.min(1, one(p) + (pose === 'flying' ? one(p - 0.5) : 0));
    }

    // A scene that directs him itself (the pond) can take over the lantern with
    // `setGlow(0..1)`, `setGlow(null)` handing it back to his own rhythm, and can
    // swell the halo with `setHaloSize` so the flash carries at a distance.
    let directed = null, haloSize = 1;
    function update(dt, time) {
      const flying = pose === 'flying';
      const glow = directed ?? flash(time);
      materials.belly.emissive.copy(COLOURS.glow).multiplyScalar(1.15 * glow);
      haloMaterial.opacity = 0.75 * glow;
      halo.scale.setScalar(haloSize * (0.7 + 0.3 * glow));
      lamp.intensity = LAMP_POWER * glow;

      // antennae feel about, each on its own beat, the sway running out along the chain
      antennae.forEach((run, i) => run.forEach((b, j) => {
        b.rotation.x = 0.05 * Math.sin(time * 1.3 + i * 2.1 - j * 0.7) + 0.02 * Math.sin(time * 3.1 + i - j);
        b.rotation.z = SIDES[i] * 0.04 * Math.sin(time * 0.9 + i * 1.7 - j * 0.5);
      }));
      head.rotation.set(0.04 * Math.sin(time * 0.6), 0.1 * Math.sin(time * 0.43), 0);

      // the abdomen hangs a little in flight, and its tip dips with each flash
      abdomen.forEach((b, j) => {
        b.rotation.x = (flying ? -0.07 : 0) - 0.02 * j * glow + 0.012 * Math.sin(time * 1.7 - j * 0.8);
      });

      if (!flying) {
        // breathing: the wing cases lift a hair now and then
        const lift = 0.03 * Math.max(0, Math.sin(time * 0.8)) ** 4;
        elytra.forEach((e, i) => { e.rotation.z = SIDES[i] * lift; });
        return;
      }

      // flying: hover nose up and bob, wing cases swung up and out on their hinges,
      // hind wings beating
      hips.position.set(0, CENTRE.y + 1.1 + 0.12 * Math.sin(time * 2.2), 0.05 * Math.sin(time * 1.1));
      hips.rotation.x = -0.42 + 0.04 * Math.sin(time * 2.2 + 1);
      const beat = Math.sin(time * 40);
      elytra.forEach((e, i) => {
        const s = SIDES[i];
        e.rotation.set(0.1, -s * 0.3, s * (0.8 + 0.03 * beat));    // tips swung apart, clear of the hind wings
      });
      wings.forEach((w, i) => {
        const s = SIDES[i];
        w.rotation.set(0.1, s * 0.25, s * (0.2 + 0.7 * beat));
      });
      // legs hang: femurs swing down, knees fold, feet trail, all swaying with the hover
      for (const { s, pair, hip, shin, ankle } of legs) {
        const sway = 0.05 * Math.sin(time * 2.2 + pair);
        hip.rotation.set(0, 0, -s * (0.75 + sway));
        shin.rotation.set(0, 0, s * (0.45 + sway));
        ankle.rotation.set(-0.3, 0, s * 0.2);
      }
    }
    setVariant('perched');

    return {
      object: root, update,
      variants: [{ name: 'perched', label: 'Perched' }, { name: 'flying', label: 'Flying' }],
      variantLabel: 'Pose', setVariant,
      setGlow: (level) => { directed = level; }, setHaloSize: (size) => { haloSize = size; }, lamp,
      bounds: new THREE.Box3(V(-1.4, 0, -2.3).multiplyScalar(SCALE), V(1.4, 2.6, 3.5).multiplyScalar(SCALE)),
      shadow: { x: 1.2 * SCALE, z: 2.2 * SCALE },
      // from his front quarter, a little above: head to the right, as in the photo
      view: { back: 1.25, rise: 0.3, turn: -1.1 },
    };
  },
});
