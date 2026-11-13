// Cherry blossom tree: the same tree index.html grows, packaged as a viewer model.
//
// A model file calls registerModel({ name, label, build }). build(ctx) returns either
// an Object3D standing on the origin (y = 0 is the floor), or
// { object, update(dt, time), bounds, view } when it animates or wants to set its own
// framing box or opening camera view (see showModel in viewer.html).
registerModel({
  name: 'cherry-tree',
  label: 'Cherry tree',
  build({ THREE, rand, psx, canvasTexture, mergeGeometries, sunDir, windDir }) {
    const PALETTE = {
      bark: 0x8a6048,
      blossoms: [0xffe6f0, 0xffd3e3, 0xffc0d8, 0xffaecd],
      petal: 0xffc4da,
    };
    const PETAL_COUNT = 160;
    const rr = (a, b) => a + (b - a) * rand();
    const pick = (list) => list[(rand() * list.length) | 0];
    const randomUnit = () => new THREE.Vector3(rr(-1, 1), rr(-1, 1), rr(-1, 1)).normalize();

    // index.html paints its grass texture from the same number stream before growing
    // the tree; skipping that many numbers makes a seed grow the same tree in both pages
    for (let i = 0; i < 6760; i++) rand();

    // ------------------------------------------------------------ textures
    const barkTex = canvasTexture(8, 16, (ctx) => {
      const browns = ['#ffffff', '#e6d8cf', '#cdbbae', '#f2e8e2'];
      for (let x = 0; x < 8; x++) {
        const streak = pick(browns);
        for (let y = 0; y < 16; y++) {
          ctx.fillStyle = rand() < 0.3 ? pick(browns) : streak; ctx.fillRect(x, y, 1, 1);
        }
      }
    });

    // a bunch of blossom: little five-petal flowers scattered on a transparent square,
    // thicker in the middle and ragged at the edge, with a few dark buds
    const blossomTex = canvasTexture(32, 32, (ctx) => {
      const petals = ['#ffffff', '#ffffff', '#fff2f7', '#ffe4ee', '#ffd6e6'];
      const flower = (x, y) => {
        ctx.fillStyle = pick(petals);
        ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
        if (rand() < 0.6) ctx.fillRect(x - 1 + 2 * ((rand() * 2) | 0), y - 1 + 2 * ((rand() * 2) | 0), 1, 1);
        ctx.fillStyle = rand() < 0.5 ? '#e87aa4' : '#f29dbd';
        ctx.fillRect(x, y, 1, 1);
      };
      for (let i = 0; i < 9; i++) {
        const a = rr(0, 6.28), r = rr(2, 13);
        ctx.fillStyle = pick(['#c2567f', '#a8506a', '#8a5a48']);
        ctx.fillRect(Math.round(16 + Math.cos(a) * r), Math.round(16 + Math.sin(a) * r), 1, 1);
      }
      for (let i = 0; i < 46; i++) {
        const a = rr(0, 6.28), r = Math.pow(rand(), 0.75) * 13;
        flower(Math.round(16 + Math.cos(a) * r), Math.round(16 + Math.sin(a) * r));
      }
    });

    // ---------------------------------------------------------------- tree
    // A straight trunk forking into five rising limbs, a few levels of branches,
    // and bunches of blossom on the outer ones.
    const MAX_DEPTH = 5;
    const MIN_R = 0.035;
    const UP = new THREE.Vector3(0, 1, 0);
    const segments = [];
    const blobs = []; // { p: Vector3, s: radius }

    function addSegment(a, b, ra, rb) {
      const d = new THREE.Vector3().subVectors(b, a);
      const len = d.length();
      const g = new THREE.CylinderGeometry(rb, ra, len, ra > 0.12 ? 6 : 4, 1, true);
      g.translate(0, len / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
      g.translate(a.x, a.y, a.z);
      segments.push(g);
    }

    function addBlob(p, size) {
      blobs.push({ p: p.clone().addScaledVector(randomUnit(), rr(0, 0.25)), s: size * rr(0.8, 1.2) });
    }

    function grow(start, dir, length, radius, depth) {
      const steps = depth === 0 ? 3 : 2;
      const endR = Math.max(radius * 0.75, MIN_R);
      const p = start.clone();
      const d = dir.clone();
      for (let i = 0; i < steps; i++) {
        d.addScaledVector(randomUnit(), depth === 0 ? 0.05 : 0.22); // gnarl
        if (depth >= 1 && depth <= 2) d.y += 0.08;                  // limbs reach upward
        if (depth === MAX_DEPTH) d.y -= 0.06;                       // tips arch over
        d.normalize();
        const q = p.clone().addScaledVector(d, length / steps);
        let ra = THREE.MathUtils.lerp(radius, endR, i / steps);
        const rb = THREE.MathUtils.lerp(radius, endR, (i + 1) / steps);
        if (depth === 0 && i === 0) ra *= 1.4;                      // root flare
        addSegment(p, q, ra, rb);
        p.copy(q);
        if (depth >= MAX_DEPTH - 2) addBlob(p, 0.42);
      }
      if (depth === MAX_DEPTH) { addBlob(p, 0.52); return; }

      const n = depth === 0 ? 5 : (rand() < 0.4 ? 3 : 2);
      const base = new THREE.Vector3().crossVectors(d, randomUnit()).normalize();
      for (let k = 0; k < n; k++) {
        const axis = base.clone().applyAxisAngle(d, (k / n) * Math.PI * 2 + rr(-0.45, 0.45));
        const cd = d.clone().applyAxisAngle(axis, depth === 0 ? rr(0.55, 0.95) : rr(0.35, 0.8));
        cd.y = Math.max(cd.y, depth < 3 ? 0.15 : -0.3);
        cd.normalize();
        const childLen = depth === 0 ? rr(1.7, 2.1) : length * rr(0.78, 0.9);
        grow(p, cd, childLen, Math.max(endR * rr(0.62, 0.75), MIN_R), depth + 1);
      }
    }
    grow(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.05, 1, 0.02).normalize(), 2.6, 0.3, 0);

    const canopy = new THREE.Box3().setFromPoints(blobs.map((b) => b.p));
    const canopyCentre = canopy.getCenter(new THREE.Vector3());

    const tree = new THREE.Group();
    tree.add(new THREE.Mesh(
      mergeGeometries(segments),
      psx(new THREE.MeshLambertMaterial({ color: PALETTE.bark, map: barkTex, flatShading: true }), 1)
    ));
    segments.forEach((g) => g.dispose());

    const dummy = new THREE.Object3D();
    const tmpColor = new THREE.Color();
    {
      // each bunch is three crossed squares carrying the cut-out blossom texture
      const card = new THREE.PlaneGeometry(1, 1);
      const bunch = mergeGeometries([card, card.clone().rotateY(Math.PI / 2), card.clone().rotateX(Math.PI / 2)]);
      const mesh = new THREE.InstancedMesh(
        bunch,
        psx(new THREE.MeshBasicMaterial({ map: blossomTex, alphaTest: 0.5, side: THREE.DoubleSide }), 1),
        blobs.length
      );
      const outward = new THREE.Vector3();
      blobs.forEach((b, i) => {
        dummy.position.copy(b.p);
        dummy.rotation.set(rr(0, 6.28), rr(0, 6.28), rr(0, 6.28));
        dummy.scale.setScalar(b.s * 2.6);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        // shading is baked into colour: darker low in the canopy, brighter on the side facing the sun
        const height = (b.p.y - canopy.min.y) / (canopy.max.y - canopy.min.y);
        const sunny = Math.max(0, outward.subVectors(b.p, canopyCentre).normalize().dot(sunDir));
        tmpColor.set(pick(PALETTE.blossoms)).multiplyScalar((0.74 + 0.16 * height + 0.14 * sunny) * rr(0.94, 1.04));
        mesh.setColorAt(i, tmpColor);
      });
      mesh.frustumCulled = false;
      tree.add(mesh);
    }

    // ------------------------------------------------------ falling petals
    const petalMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.2, 0.16),
      new THREE.MeshBasicMaterial({ color: PALETTE.petal, side: THREE.DoubleSide }),
      PETAL_COUNT
    );
    petalMesh.frustumCulled = false;
    tree.add(petalMesh);

    const R = (a, b) => a + (b - a) * Math.random();
    const petals = Array.from({ length: PETAL_COUNT }, () => ({
      pos: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(),
      vy: 0, phase: 0, delay: 0, rest: 0, landed: false,
    }));
    function respawn(p, first) {
      const b = blobs[(Math.random() * blobs.length) | 0];
      p.pos.set(b.p.x + R(-b.s, b.s), b.p.y - b.s * 0.5, b.p.z + R(-b.s, b.s));
      p.rot.set(R(0, 6.28), R(0, 6.28), R(0, 6.28));
      p.spin.set(R(-3, 3), R(-3, 3), R(-3, 3));
      p.vy = R(0.5, 1.0);
      p.phase = R(0, 6.28);
      p.delay = first ? R(0, 10) : R(0, 3);
      p.landed = false;
    }
    petals.forEach((p) => respawn(p, true));

    function updatePetals(dt, t) {
      for (let i = 0; i < PETAL_COUNT; i++) {
        const p = petals[i];
        let visible = true;
        if (p.delay > 0) {
          p.delay -= dt; visible = false;
        } else if (p.landed) {
          p.rest -= dt;
          if (p.rest <= 0) { respawn(p, false); visible = false; }
        } else {
          const gust = 0.5 + 0.5 * Math.sin(t * 0.9 + p.pos.x * 0.35 + p.pos.z * 0.25);
          const drift = 0.12 + 0.4 * gust;
          p.pos.x += (windDir.x * drift + Math.sin(t * 2.1 + p.phase) * 0.3) * dt;
          p.pos.z += (windDir.z * drift + Math.cos(t * 1.7 + p.phase) * 0.3) * dt;
          p.pos.y -= p.vy * (0.75 + 0.25 * Math.sin(t * 3.0 + p.phase)) * dt;
          p.rot.x += p.spin.x * dt; p.rot.y += p.spin.y * dt; p.rot.z += p.spin.z * dt;
          if (p.pos.y <= 0.07) {
            p.pos.y = 0.07; p.landed = true; p.rest = R(4, 10);
            p.rot.set(-Math.PI / 2, 0, R(0, 6.28));
          }
        }
        dummy.position.copy(p.pos);
        dummy.rotation.copy(p.rot);
        dummy.scale.setScalar(visible ? 1 : 0);
        dummy.updateMatrix();
        petalMesh.setMatrixAt(i, dummy.matrix);
      }
      petalMesh.instanceMatrix.needsUpdate = true;
    }
    // run the petals forward a little so some are already in the air on load
    for (let t = 0; t < 12; t += 0.05) updatePetals(0.05, t);

    // frame the canopy, not the drifting petals
    const bounds = canopy.clone().expandByScalar(0.8);
    bounds.min.y = 0;

    return { object: tree, update: updatePetals, bounds };
  },
});
