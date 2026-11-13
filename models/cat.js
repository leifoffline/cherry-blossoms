// White cat, after the sketch: a wide head on a small egg body, thin limbs, black
// line face. He is built from rigid pieces joined at real joints (neck, shoulders,
// elbows, wrists, hips, knees, ear bases, and a chain down the tail), and idles:
// bouncing on his knees, bobbing his head, swinging his arms, swaying his tail,
// blinking and now and then flicking an ear.
registerModel({
  name: 'cat',
  label: 'Cat',
  build({ THREE, psx, mergeGeometries }) {
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const UP = V(0, 1, 0);

    // ---------------------------------------------------------------- pieces
    // Each piece is a group that turns about its own pivot (a joint) and hangs off a
    // parent piece. Shapes are laid out in whole-cat coordinates, in the rest pose,
    // and go into whichever piece is being built.
    const cat = new THREE.Group();
    cat.userData.pivot = V(0, 0, 0);
    // white with a little glow of its own: the lit side would burn out at full white,
    // and the side away from the sun would otherwise go grey
    const whiteMaterial = psx(new THREE.MeshLambertMaterial({ color: 0xd0d0d0, emissive: 0x959595, flatShading: true }));
    const pinkMaterial = psx(new THREE.MeshLambertMaterial({ color: 0xf2b6c4, flatShading: true }));
    const inkMaterial = psx(new THREE.MeshBasicMaterial({ color: 0x141414 }));
    let white, pink;
    function piece(parent, pivot, shape) {
      const group = new THREE.Group();
      group.userData.pivot = pivot.clone();
      group.position.subVectors(pivot, parent.userData.pivot);
      group.userData.rest = group.position.clone();
      white = []; pink = [];
      const solid = (geometries, material) => {       // merge shapes into one mesh of this piece
        const mesh = new THREE.Mesh(mergeGeometries(geometries).translate(-pivot.x, -pivot.y, -pivot.z), material);
        geometries.forEach((g) => g.dispose());
        group.add(mesh);
        return mesh;
      };
      shape(solid);
      if (white.length) solid(white, whiteMaterial);
      if (pink.length) solid(pink, pinkMaterial);
      parent.add(group);
      return group;
    }
    function ball(centre, rx, ry = rx, rz = rx, w = 14, h = 10) {
      const g = new THREE.SphereGeometry(1, w, h).scale(rx, ry, rz);
      white.push(g);
      return g.translate(centre.x, centre.y, centre.z);
    }
    function limb(a, b, ra, rb = ra) {
      const d = V().subVectors(b, a), len = d.length();
      const g = new THREE.CylinderGeometry(rb, ra, len, 10, 1, true).translate(0, len / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
      white.push(g.translate(a.x, a.y, a.z));
    }

    // where the joints sit in the rest pose
    const HEAD = V(0, 3.75, 0), HA = 2.2, HB = 1.3, HC = 1.7;      // wide, but with real depth front to back
    const NECK = V(0, 2.6, 0);
    const HIPS = V(0, 1.3, 0);
    const shoulder = (side) => V(side * 0.36, 2.3, 0);             // inside the body, so the arm never parts from it
    const wrist = (side) => V(side * 1.2, 1.4, 0.15);
    const hip = (side) => V(side * 0.3, 1.3, 0);
    const ankle = (side) => V(side * 0.38, 0.15, 0);
    const SIDES = [-1, 1];

    // ------------------------------------------------------------ torso, tail
    const torso = piece(cat, HIPS, () => {
      // an egg, a little wider at the bottom
      const g = new THREE.SphereGeometry(1, 20, 16).scale(0.68, 0.78, 0.6);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const k = 1 - 0.2 * (p.getY(i) / 0.78);
        p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
      }
      white.push(g.translate(0, 1.85, 0));
    });

    // tail: grows from the middle of his lower back, then curls out and up to his left,
    // as a chain of short links
    const tail = [];
    {
      const path = new THREE.CatmullRomCurve3([
        V(0, 1.3, -0.3), V(0.2, 1.22, -0.85), V(0.8, 1.5, -1.1), V(1.45, 2.05, -1.0), V(2.0, 2.6, -0.8),
      ]);
      const LINKS = 6, R = 0.17;
      let parent = torso;
      for (let i = 0; i < LINKS; i++) {
        const span = [];
        for (let k = 0; k <= 4; k++) span.push(path.getPoint((i + k / 4) / LINKS));
        parent = piece(parent, span[0], () => {
          white.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(span), 4, R, 10, false));
          ball(span[0], R, R, R, 10, 8);                          // rounds the joint off when it bends
          if (i === LINKS - 1) ball(span[4], 0.19, 0.19, 0.19, 12, 8);
        });
        tail.push(parent);
      }
    }

    // ------------------------------------------------------------------ arms
    // shoulder > upper arm > elbow > forearm > wrist > paw
    const arms = SIDES.map((side) => {
      const elbow = shoulder(side).lerp(wrist(side), 0.5);
      const upper = piece(torso, shoulder(side), () => {
        ball(shoulder(side), 0.18);
        limb(shoulder(side), elbow, 0.18, 0.17);
      });
      const fore = piece(upper, elbow, () => {
        ball(elbow, 0.172);
        limb(elbow, wrist(side), 0.17, 0.16);
      });
      const paw = piece(fore, wrist(side), () => ball(wrist(side), 0.27));
      return { side, upper, fore, paw };
    });

    // ------------------------------------------------------------------ legs
    // hip > thigh > knee > shin > ankle > foot. The feet stay planted: each frame the
    // knee is placed so the leg reaches from wherever the hip has moved to down to
    // the ankle. Leg pieces hang off the cat itself and are posed directly.
    const legs = SIDES.map((side) => {
      const knee = hip(side).lerp(ankle(side), 0.5);
      const thigh = piece(cat, hip(side), () => {
        ball(hip(side), 0.2);
        limb(hip(side), knee, 0.2, 0.19);
      });
      const shin = piece(cat, knee, () => {
        ball(knee, 0.192);
        limb(knee, ankle(side), 0.19, 0.17);
      });
      piece(cat, ankle(side), () => {       // a flat foot pointing straight ahead
        ball(ankle(side), 0.17);
        ball(ankle(side).add(V(0, 0, 0.2)), 0.25, 0.14, 0.42);
      });
      return {
        thigh, shin, hip: hip(side).sub(HIPS), ankle: ankle(side),
        along: ankle(side).sub(hip(side)).normalize(),            // the way the leg points at rest
        bone: hip(side).distanceTo(knee),
      };
    });

    // ------------------------------------------------------------------ head
    // The head is an ellipsoid pushed out where a cat's face is full: a muzzle around
    // the nose and mouth, a soft whisker pad sitting in the bowl of each half of the
    // mouth (with a crease between them under the nose), and a cheek low on each side. `u` is a direction from the
    // head's centre; the same function shapes the mesh and places the face on it.
    const smooth = THREE.MathUtils.smoothstep;
    const CHEEK = V(0.72, -0.4, 0.57).normalize();
    function headPoint(u, lift = 0) {
      const muzzle = Math.exp(-((u.x / 0.42) ** 2 + ((u.y + 0.22) / 0.4) ** 2)) * smooth(u.z, 0, 0.4);
      const cheek = (side) => Math.exp(-((u.x - side * CHEEK.x) ** 2 + (u.y - CHEEK.y) ** 2 + (u.z - CHEEK.z) ** 2) / 0.42 ** 2);
      const pad = (side) => Math.exp(-(((u.x - side * 0.22) / 0.17) ** 2 + ((u.y + 0.2) / 0.19) ** 2)) * smooth(u.z, 0, 0.4);
      const puff = 0.2 * muzzle + 0.2 * (pad(-1) + pad(1)) + 0.22 * (cheek(-1) + cheek(1));
      const outward = V(u.x / HA, u.y / HB, u.z / HC).normalize();
      return V(u.x * HA, u.y * HB, u.z * HC).addScaledVector(outward, puff + lift).add(HEAD);
    }
    // Features are placed by where they sit on the front of the head (x across,
    // y up from the head's centre) and wrapped onto its surface.
    function onFace(x, y, lift = 0.025) {
      const ux = x / HA, uy = y / HB;
      return headPoint(V(ux, uy, Math.sqrt(Math.max(0, 1 - ux * ux - uy * uy))), lift);
    }
    const LINE = 0.045;                          // half the thickness of a drawn line
    const stroke = (points) => new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points.map(([x, y]) => onFace(x, y))), points.length * 8, LINE, 8, false);

    const dab = (x, y) => {                      // a round blot, for line ends and joins
      const at = onFace(x, y);
      return new THREE.SphereGeometry(LINE * 1.05, 8, 6).translate(at.x, at.y, at.z);
    };

    let eyesOpen, eyesClosed;
    const head = piece(torso, NECK, (solid) => {
      const g = new THREE.SphereGeometry(1, 72, 48);   // fine enough to hold the whisker pads
      const p = g.attributes.position, u = V();
      for (let i = 0; i < p.count; i++) {
        const q = headPoint(u.fromBufferAttribute(p, i).normalize());
        p.setXYZ(i, q.x, q.y, q.z);
      }
      white.push(g);

      const EYE_X = 1.37, EYE_Y = 0.3;
      const open = [], closed = [], fixed = [];
      for (const side of SIDES) {
        // open eye: a small dot set wide on the face
        const dot = new THREE.SphereGeometry(0.11, 12, 8).scale(1.25, 1, 1);
        const at = onFace(side * EYE_X, EYE_Y, 0);
        open.push(dot.translate(at.x, at.y, at.z));

        // closed eye: a short line in the same spot, only a little wider than the dot
        // and barely drooping, so the blink reads as the dot squeezing shut
        const lid = [];
        for (let u = -1; u <= 1.001; u += 0.5) lid.push([side * (EYE_X + u * 0.23), EYE_Y - 0.03 + 0.06 * u * u]);
        closed.push(stroke(lid));

        // one half of the mouth, from under the nose out toward the cheek
        fixed.push(stroke([[0, -0.12], [side * 0.19, -0.36], [side * 0.465, -0.51], [side * 0.765, -0.405], [side * 1.035, -0.195]]));
        fixed.push(dab(side * 1.035, -0.195));
      }
      // a short line joins the nose to the mouth, with a dab where the three lines meet
      fixed.push(stroke([[0, -0.04], [0, -0.08], [0, -0.12]]), dab(0, -0.12));
      const nose = new THREE.ConeGeometry(0.16, 0.2, 3).rotateX(Math.PI).scale(1, 1, 0.5);
      const at = onFace(0, 0.02);
      fixed.push(nose.translate(at.x, at.y, at.z));

      solid(fixed, inkMaterial);
      eyesOpen = solid(open, inkMaterial);
      eyesClosed = solid(closed, inkMaterial);
      eyesClosed.visible = false;
    });

    // ears: cones leaning outward, shallow in front and full and rounded behind, each
    // with a pink inner face, hinged at the base
    const earTilt = { '-1': 0.7, '1': 0.35 };   // his right ear flops out further, as drawn
    const ears = SIDES.map((side) => piece(head, V(side * 1.42, 4.6, 0), () => {
      const place = (g) => g.rotateZ(-side * earTilt[side]).translate(side * 1.5, 4.95, 0);
      const shell = new THREE.ConeGeometry(0.58, 1.05, 16, 4);
      const p = shell.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * (p.getZ(i) > 0 ? 0.45 : 1.15));
      white.push(place(shell));
      pink.push(place(new THREE.ConeGeometry(0.36, 0.66, 12).scale(1, 1, 0.45).translate(0, -0.12, 0.13)));
    }));

    // ------------------------------------------------------------ animation
    const BOB = 3.2;                             // idle speed; one bounce takes about two seconds
    const BLINK = 0.16;                          // seconds the eyes stay shut
    const FLICK = 0.28;                          // seconds an ear flick lasts
    let untilBlink = 2, shut = 0;
    let untilFlick = 4, flick = 0, flickEar = 0;
    const hipAt = V(), kneeAt = V(), reach = V(), forward = V(), FRONT = V(0, 0, 1);

    function update(dt, time) {
      const phase = time * BOB;
      const beat = Math.sin(phase);

      // torso: sinks and rises on the knees, shifting its weight from side to side
      torso.position.copy(torso.userData.rest);
      torso.position.y += -0.055 + 0.03 * beat;
      torso.position.x += 0.035 * Math.sin(phase * 0.5);
      torso.rotation.z = -0.025 * Math.sin(phase * 0.5);

      // legs: bend each knee forward by whatever the leg has to spare
      for (const leg of legs) {
        hipAt.copy(leg.hip).applyEuler(torso.rotation).add(torso.position);
        reach.subVectors(leg.ankle, hipAt);
        const half = Math.min(reach.length() / 2, leg.bone);
        reach.normalize();
        forward.copy(FRONT).addScaledVector(reach, -FRONT.dot(reach)).normalize();
        kneeAt.copy(hipAt).addScaledVector(reach, half).addScaledVector(forward, Math.sqrt(leg.bone ** 2 - half ** 2));
        leg.thigh.position.copy(hipAt);
        leg.thigh.quaternion.setFromUnitVectors(leg.along, reach.subVectors(kneeAt, hipAt).normalize());
        leg.shin.position.copy(kneeAt);
        leg.shin.quaternion.setFromUnitVectors(leg.along, reach.subVectors(leg.ankle, kneeAt).normalize());
      }

      // head: bobs a beat behind the body, nods a little and tips from side to side
      head.position.y = head.userData.rest.y + 0.045 * Math.sin(phase - 0.6);
      head.rotation.x = 0.03 * Math.sin(phase - 0.9);
      head.rotation.z = 0.035 * Math.sin(phase * 0.5);

      // arms: swing from the shoulder in turn; the elbow and wrist follow a little late,
      // the elbow only ever bending forward
      for (const arm of arms) {
        const swing = (lag) => arm.side * Math.sin(phase - lag);
        arm.upper.rotation.x = 0.2 * swing(0);
        arm.upper.rotation.z = arm.side * 0.05 * beat;
        arm.fore.rotation.x = -0.24 + 0.2 * swing(0.7);
        arm.paw.rotation.x = 0.25 * swing(1.4);
      }

      // tail: a slow wave travelling out to the tip
      tail.forEach((link, i) => {
        link.rotation.y = 0.11 * Math.sin(phase * 0.5 - i * 0.6);
        link.rotation.z = 0.05 * Math.sin(phase - i * 0.5);
      });

      // ears: every so often one flicks outward
      if (flick > 0) {
        flick -= dt;
        const side = SIDES[flickEar];
        ears[flickEar].rotation.z = flick > 0 ? -side * 0.3 * Math.sin((1 - flick / FLICK) * Math.PI * 2) ** 2 : 0;
      } else if ((untilFlick -= dt) <= 0) {
        flick = FLICK; flickEar = Math.random() < 0.5 ? 0 : 1; untilFlick = 3 + Math.random() * 5;
      }

      // blink
      if (shut > 0) {
        shut -= dt;
        if (shut <= 0) untilBlink = Math.random() < 0.2 ? 0.18 : 2 + Math.random() * 3.5;  // now and then a double blink
      } else {
        untilBlink -= dt;
        if (untilBlink <= 0) shut = BLINK;
      }
      eyesClosed.visible = shut > 0;
      eyesOpen.visible = !eyesClosed.visible;
    }
    update(0, 0);

    // his big head fills a snug frame, so start further back and level with him
    return { object: cat, update, view: { back: 1.35, rise: 0.04 } };
  },
});
