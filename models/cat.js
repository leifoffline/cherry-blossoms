// White cat, after the sketch: a wide head on a small egg body, thin limbs, black
// line face. He is built from rigid pieces joined at real joints (neck, shoulders,
// elbows, wrists, hips, knees, ear bases, and a chain down the tail), and idles:
// bouncing on his knees, bobbing his head, swinging his arms, swaying his tail,
// blinking and now and then flicking an ear.
//
// He has four poses, picked in the viewer: idling, waving (one arm held out and
// flapping, head tipped out of its way), ears down (the ears fold out flat to the
// sides and the head hangs), and sleeping (on his back with his arms crossed on his
// chest and one leg resting over the other knee, ears down, Zs drifting up).
//
// Walking (setWalking, the viewer's WALK toggle) is separate from the poses: he
// wanders the floor, stopping now and then, in whichever pose he is in, apart from
// sleeping, when he lies down where he stands.
registerModel({
  name: 'cat',
  label: 'Cat',
  build({ THREE, psx, canvasTexture, mergeGeometries }) {
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
    const whiteMaterial = psx(new THREE.MeshLambertMaterial({ color: 0xd0d0d0, emissive: 0x959595 }));
    const pinkMaterial = psx(new THREE.MeshLambertMaterial({ color: 0xf2b6c4 }));
    const inkMaterial = psx(new THREE.MeshBasicMaterial({ color: 0x141414 }));
    let white, pink;
    const pieces = [];
    function piece(parent, pivot, shape) {
      const group = new THREE.Group();
      pieces.push(group);
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
    const belly = torso.children[0];             // the torso's own mesh, swelled by his breathing

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
      return { side, upper, fore, paw, along: wrist(side).sub(shoulder(side)).normalize() };
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
      const foot = piece(cat, ankle(side), () => {       // a flat foot pointing straight ahead
        ball(ankle(side), 0.17);
        ball(ankle(side).add(V(0, 0, 0.2)), 0.25, 0.14, 0.42);
      });
      return {
        side, thigh, shin, foot, hip: hip(side).sub(HIPS), ankle: ankle(side),
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

    // ears: each is a cupped shell like a real cat's rather than a cone. Seen from the
    // front it is a broad triangle with bowed sides and a rounded tip; the back swells
    // out and the front is hollow, lined pink, and opens forward and a little outward.
    // Each is hinged at the middle of its own base, which lies inside the head: turning
    // there swings the tip without the base sliding about, so the ear neither sinks
    // into the head nor lifts off it.
    const EAR_TILT = 0.5, EAR_TURN = 0.3;        // lean outward, and how far the hollow faces outward
    const EAR_H = 1.3, EAR_W = 0.74, EAR_D = 0.5; // height, half width at the base, and how far the back swells
    const EAR_ROOT = 0.55;                       // how far the shell carries on into the head
    const EAR_AT = V(1.5, 5.0, 0);               // middle of the ear on his left
    const earBase = (side) => V(side * (EAR_AT.x - Math.sin(EAR_TILT) * EAR_H / 2), EAR_AT.y - Math.cos(EAR_TILT) * EAR_H / 2, 0);
    const earWidth = (v) => EAR_W * (1 - v ** 1.3) ** 0.75;       // half width, from base (v = 0) to tip
    const earDepth = (v) => EAR_D * (1 - v) ** 0.7;
    const earHollow = (u, v) => -0.62 * earDepth(v) * (1 - u * u); // the front face, deepest down the middle
    // a grid of points joined into a smooth surface; `closed` joins its two side edges
    function sheet(cols, rows, closed, at) {
      const points = [], index = [], across = closed ? cols : cols + 1;
      for (let j = 0; j <= rows; j++) for (let i = 0; i < across; i++) points.push(...at(i / cols, j / rows));
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const a = j * across + i, b = j * across + (i + 1) % across, c = a + across, d = b + across;
        index.push(a, b, c, b, d, c);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      g.setIndex(index);
      g.computeVertexNormals();
      return g;
    }
    const ears = SIDES.map((side) => piece(head, earBase(side), () => {
      const base = earBase(side);
      const place = (g) => g.rotateY(side * EAR_TURN).rotateZ(-side * EAR_TILT).translate(base.x, base.y, base.z);
      // the shell: rings running round the back (a half ellipse) and across the hollow
      // front. It carries on below its base as a root of the same section, buried in
      // the head, so that when the ear folds over no open edge lifts clear of the skull.
      white.push(place(sheet(20, 13, true, (a, t) => {
        const u = Math.sin(a * Math.PI * 2), c = Math.cos(a * Math.PI * 2);
        const y = t * (EAR_H + EAR_ROOT) - EAR_ROOT, v = Math.max(0, y / EAR_H);
        return [earWidth(v) * u, y, c < 0 ? earDepth(v) * c : earHollow(u, v)];
      })));
      // the pink lining: a smaller ear shape lying just proud of the hollow
      pink.push(place(sheet(6, 6, false, (s, t) => {
        const v = 0.76 * t, x = (s * 2 - 1) * 0.66 * earWidth(t);
        return [x, v * EAR_H, earHollow(x / earWidth(v), v) + 0.03];
      })));
    }));

    // Zs for when he sleeps: little pixel letters that always face the viewer
    const zTexture = canvasTexture(8, 8, (ctx) => {
      ctx.fillStyle = '#141414';
      ctx.fillRect(1, 1, 6, 1); ctx.fillRect(1, 6, 6, 1);
      for (let i = 0; i < 4; i++) ctx.fillRect(5 - i, 2 + i, 1, 1);
    });
    zTexture.wrapS = zTexture.wrapT = THREE.ClampToEdgeWrapping;
    const zs = [0, 1, 2].map(() => {
      const z = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTexture, transparent: true, depthWrite: false }));
      z.visible = false;
      cat.add(z);
      return z;
    });

    // ----------------------------------------------------------------- poses
    const POSES = [
      { name: 'idle', label: 'Idle' },
      { name: 'wave', label: 'Waving' },
      { name: 'sulk', label: 'Ears down' },
      { name: 'sleep', label: 'Sleeping' },
    ];
    let pose = 'idle', now = 0;
    function setVariant(name) {
      pose = POSES.some((p) => p.name === name) ? name : 'idle';
      for (const p of pieces) { p.position.copy(p.userData.rest); p.quaternion.identity(); }   // back to standing
      belly.scale.setScalar(1);
      for (const z of zs) z.visible = pose === 'sleep';
      update(0, now);
    }

    // waving: his right arm (on the left as you face him, clear of his tail)
    const WAVE = -1, WAVE_SPEED = 10;

    // sleeping: flat on his back, feet toward the viewer and off to one side so that
    // both the face and the legs can be seen. In the "lying frame" used below x runs
    // across him, y is up and z points from his head to his feet; LIE turns that frame
    // into the scene's. Within the torso, "up" now points toward his head and "forward"
    // at the sky.
    const turn = (axis, angle) => new THREE.Quaternion().setFromAxisAngle(axis, angle);
    const ACROSS = V(1, 0, 0);
    const LIE_TURN = 0.3;
    const LIE = turn(UP, LIE_TURN);
    const BED = V(0, 0.6, 1.0).applyQuaternion(LIE);              // where the hips rest: the back just touches the floor
    const LEAN = 0.05;                           // shoulders a touch higher than hips
    const LAID = LIE.clone().multiply(turn(ACROSS, -Math.PI / 2 + LEAN));
    // The head is far deeper than the body, so with its back on the floor it sits
    // propped up, chin toward the chest, which also shows the viewer his face.
    // HEAD_DROP then lets it down until the back of the head (taken as the plain
    // ellipsoid) touches the floor; the neck joint is hidden inside the head anyway.
    // It is also pushed a little way off the shoulders, and not propped too steeply,
    // so that the chin clears the arms folded on the chest.
    const HEAD_PROP = 0.7, HEAD_OUT = 0.1;
    const HEAD_DROP = BED.y + (NECK.y - HIPS.y) * Math.sin(LEAN) + (HEAD.y - NECK.y) * Math.sin(HEAD_PROP + LEAN)
      - Math.hypot(HB * Math.sin(HEAD_PROP + LEAN), HC * Math.cos(HEAD_PROP + LEAN));
    // The tail's curl lies nearly in one plane (TAIL_PLANE is its normal). Laying that
    // plane on the floor and turning it puts the tail out from under his raised leg,
    // curling round toward his feet.
    const TAIL_PLANE = V(-0.57, 0.76, -0.32).normalize();
    const TAIL_HEADING = LIE_TURN + 1.9;         // the way the tail first leaves him, as a compass turn from the viewer
    const TAIL_FLAT = (() => {
      const flat = new THREE.Quaternion().setFromUnitVectors(TAIL_PLANE, UP);
      const out = V(0.2, -0.08, -0.55).applyQuaternion(flat);     // the tail's first stretch, once flat
      return turn(UP, TAIL_HEADING - Math.atan2(out.x, out.z)).multiply(flat);
    })();
    const PROP = -1, CROSS = 1;                  // his right knee is up, and his left leg rests across it
    const q = new THREE.Quaternion(), basis = new THREE.Matrix4(), side = V(), toes = V(), headAt = V();
    function sleep(dt, time) {
      now = time;
      const breath = Math.sin(time * 1.5);
      torso.position.copy(BED);
      torso.quaternion.copy(LAID);
      belly.scale.set(1 + 0.04 * breath, 1, 1 + 0.04 * breath);

      // head: propped on its own back, lolling a little to one side
      head.position.copy(head.userData.rest).z -= HEAD_DROP;
      head.position.y += HEAD_OUT;
      head.rotation.set(HEAD_PROP + 0.012 * breath, 0, 0.08);

      // arms crossed on his chest: each upper arm comes forward round the ribs and the
      // forearm lies across to the far side, his left sloping down over his right as
      // it slopes up, so they make an X; they ride on his breathing. They sit low on
      // the chest, where the chin does not reach. Directions are in the torso's own
      // frame.
      for (const arm of arms) {
        const over = arm.side === CROSS;
        arm.upper.position.copy(arm.upper.userData.rest).z += 0.025 * breath;
        arm.upper.quaternion.setFromUnitVectors(arm.along, reach.set(arm.side * 0.14, over ? -0.35 : -0.56, over ? 0.5 : 0.34).normalize());
        reach.set(-arm.side * 0.95, over ? -0.22 : 0.08, over ? 0.2 : 0.38).normalize();
        arm.fore.quaternion.setFromUnitVectors(arm.along, reach.applyQuaternion(q.copy(arm.upper.quaternion).invert()));
        arm.paw.rotation.set(0, 0, 0);
      }

      // legs: one knee up with the foot flat on the floor, the other leg bent out to
      // the side with its ankle resting on that knee, the foot nodding slowly
      const prop = legs.find((leg) => leg.side === PROP), cross = legs.find((leg) => leg.side === CROSS);
      hipAt.copy(prop.hip).applyQuaternion(LAID).add(BED);
      prop.thigh.position.copy(hipAt);
      prop.thigh.quaternion.setFromUnitVectors(prop.along, reach.set(0.1, 0.16, 1).normalize().applyQuaternion(LIE));
      kneeAt.copy(hipAt).addScaledVector(reach, prop.bone);
      prop.shin.position.copy(kneeAt);
      prop.shin.quaternion.setFromUnitVectors(prop.along, reach.set(0, -1, 0.3).normalize().applyQuaternion(LIE));
      prop.foot.position.copy(kneeAt).addScaledVector(reach, prop.bone);
      prop.foot.quaternion.copy(LIE);

      const rest = forward.copy(kneeAt).add(side.set(-0.04, 0.37, 0.02).applyQuaternion(LIE));   // the ankle's seat on the knee
      hipAt.copy(cross.hip).applyQuaternion(LAID).add(BED);
      reach.subVectors(rest, hipAt);
      const half = reach.length() / 2;
      reach.normalize();
      side.set(1, 0.75, 0.2).applyQuaternion(LIE);                // the knee falls outward and up
      side.addScaledVector(reach, -side.dot(reach)).normalize();
      kneeAt.copy(hipAt).addScaledVector(reach, half).addScaledVector(side, Math.sqrt(cross.bone ** 2 - half ** 2));
      cross.thigh.position.copy(hipAt);
      cross.thigh.quaternion.setFromUnitVectors(cross.along, reach.subVectors(kneeAt, hipAt).normalize());
      cross.shin.position.copy(kneeAt);
      cross.shin.quaternion.setFromUnitVectors(cross.along, reach.subVectors(rest, kneeAt).normalize());
      cross.foot.position.copy(rest);
      toes.set(-0.2, 0.75 + 0.12 * Math.sin(time * 0.9), 0.6).applyQuaternion(LIE);   // toes in the air
      toes.addScaledVector(reach, -toes.dot(reach)).normalize();
      side.crossVectors(toes, reach);                             // the foot's own x: (-shin) x toes
      cross.foot.quaternion.setFromRotationMatrix(basis.makeBasis(side, kneeAt.copy(reach).negate(), toes));

      // tail: laid along the floor, the tip stirring now and then
      tail.forEach((link, i) => {
        if (i === 0) {
          link.position.copy(link.userData.rest).z -= 0.1;        // down onto the floor
          link.quaternion.copy(LAID).invert().multiply(TAIL_FLAT);
        } else link.quaternion.setFromAxisAngle(TAIL_PLANE, 0.1 * Math.sin(time * 0.7 - i * 0.7) * (i / 5));
      });
      poseEars(dt, 1);                           // ears down, and still twitching in his sleep
      eyesClosed.visible = true;
      eyesOpen.visible = false;

      // Zs rise from over his head one after another, growing and fading
      headAt.subVectors(HEAD, NECK).applyQuaternion(head.quaternion).add(head.position).applyQuaternion(LAID).add(BED);
      zs.forEach((z, i) => {
        const u = (time * 0.3 + i / zs.length) % 1;
        z.position.set(headAt.x + 1.0 + 0.7 * u + 0.12 * Math.sin(u * 7), headAt.y + 1.3 + 1.9 * u, headAt.z + 0.6);
        z.scale.setScalar(0.3 + 0.5 * u);
        z.material.opacity = Math.min(1, 4 * u, 3 * (1 - u));
      });
    }

    // ------------------------------------------------------------ animation
    const BOB = 3.2;                             // idle speed; one bounce takes about two seconds
    const BLINK = 0.16;                          // seconds the eyes stay shut
    const FLICK = 0.5;                           // seconds an ear flick takes to die away
    let untilBlink = 2, shut = 0;
    let untilFlick = 4, flick = 0, flickEar = 0;
    // ears: every so often one flicks, as a cat's does at a fly. It snaps back and a
    // little outward, then springs upright again, overshooting less each time until
    // it is still. Now and then the same ear goes twice.
    //
    // `down` (0 or 1) is where the ears are heading: up, or folded into "aeroplane
    // ears", swung out flat to the sides and rolled about their own length so the
    // hollows face the floor and the backs show on top. They ease from one to the
    // other, and slide a little way out of the head as they fold so that the whole
    // ear still shows.
    const EAR_FOLD = 1.1, EAR_ROLL = 0.8, EAR_SLIDE = V(0.32, -0.3, 0), EAR_EASE = 7;
    const earAxis = SIDES.map((side) => V(side * Math.sin(EAR_TILT), Math.cos(EAR_TILT), 0));
    const fold = new THREE.Quaternion(), roll = new THREE.Quaternion();
    let earDown = 0;
    function poseEars(dt, down) {
      earDown += (down - earDown) * (1 - Math.exp(-dt * EAR_EASE));
      const e = earDown * earDown * (3 - 2 * earDown);
      if (flick > 0) flick -= dt;
      else if ((untilFlick -= dt) <= 0) {
        if (untilFlick > -1) flickEar = Math.random() < 0.5 ? 0 : 1;   // a second flick (see below) keeps the same ear
        flick = FLICK;
        untilFlick = Math.random() < 0.25 ? -1 : 3 + Math.random() * 5;
      }
      ears.forEach((ear, i) => {
        const t = i === flickEar && flick > 0 ? FLICK - flick : 0;
        const spring = Math.exp(-t * 9) * Math.sin(t * 38);          // a fading wobble, at its widest about 0.04 s in
        fold.setFromAxisAngle(FRONT, -SIDES[i] * (EAR_FOLD * e + 0.12 * spring));
        roll.setFromAxisAngle(earAxis[i], SIDES[i] * EAR_ROLL * e);
        ear.quaternion.setFromAxisAngle(ACROSS, -0.3 * spring).premultiply(roll).premultiply(fold);
        ear.position.copy(ear.userData.rest);
        ear.position.x += SIDES[i] * EAR_SLIDE.x * e;
        ear.position.y += EAR_SLIDE.y * e;
      });
    }
    const hipAt = V(), kneeAt = V(), reach = V(), forward = V(), FRONT = V(0, 0, 1);

    // --------------------------------------------------------------- walking
    // With walking on (the viewer's WALK toggle) he wanders the floor: stands a few
    // seconds, turns toward a new spot, walks there and stops again. Switched off, he
    // walks back to the middle and turns to face the front. Only the whole cat moves
    // and turns (the root group); the steps are laid over the idle.
    //
    // His legs are short and straight at rest, so he walks with small quick steps and
    // his hips let down a little (WALK_SQUAT), or a foot reaching forward would pull
    // the leg out of its hip. One gait cycle carries him STRIDE; each foot spends half
    // of it planted, sliding back under him at his own speed so that it stays put on
    // the floor, and half swinging forward through the air.
    const WALK_SPEED = 1.2;                      // units a second, about a body height every four
    const STRIDE = 0.9;
    const STEP = STRIDE / 4;                     // how far a foot reaches in front of or behind the ankle
    const LIFT = 0.22;
    const WALK_SQUAT = 0.12;
    const WANDER_R = 2.5;                        // keeps him in the opening frame
    const TURN_RATE = 2.6;                       // radians a second
    let walking = false, heading = 0, speed = 0, gait = 0, stepping = 0;
    const wander = { mode: 'pause', wait: 1, target: V() };
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    function setWalking(on) {
      walking = !!on;
      if (walking) { wander.mode = 'pause'; wander.wait = 0.5; }
      else { wander.target.set(0, 0, 0); wander.mode = 'turn'; }   // home
    }
    function turnToward(aim, dt) {               // returns how far there is still to turn
      const err = wrap(aim - heading);
      const step = Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, err));
      heading = wrap(heading + step);
      return { err: err - step, rate: dt > 0 ? Math.abs(step) / dt : 0 };
    }
    function roam(dt) {
      const at = cat.position;
      let want = 0, turning = 0;
      if (wander.mode === 'pause') {
        if (!walking) turning = turnToward(0, dt).rate;            // home: face the front
        else if ((wander.wait -= dt) <= 0) {
          // somewhere new, not too close to where he stands
          for (let i = 0; i < 12; i++) {
            const a = Math.random() * Math.PI * 2, r = WANDER_R * Math.sqrt(Math.random());
            wander.target.set(Math.sin(a) * r, 0, Math.cos(a) * r);
            if (wander.target.distanceTo(at) > 1.5) break;
          }
          wander.mode = 'turn';
        }
      } else {
        const dx = wander.target.x - at.x, dz = wander.target.z - at.z, dist = Math.hypot(dx, dz);
        if (dist < 0.08) {
          wander.mode = 'pause';
          wander.wait = 2 + Math.random() * 3;
        } else {
          const turn = turnToward(Math.atan2(dx, dz), dt);
          turning = turn.rate;
          if (wander.mode === 'turn' && Math.abs(turn.err) < 0.3) wander.mode = 'go';
          if (wander.mode === 'go') want = WALK_SPEED * Math.min(1, dist / 0.8);   // slows as he comes in
        }
      }
      speed += (want - speed) * (1 - Math.exp(-dt * 4));
      at.x += Math.sin(heading) * speed * dt;
      at.z += Math.cos(heading) * speed * dt;
      cat.rotation.y = heading;
      // turning on the spot also takes steps, so his feet don't twist on the floor.
      // Slower, the steps get shorter (`stepping` scales them) and come quicker to
      // match, so a planted foot still moves back exactly as fast as he goes forward.
      const effort = Math.min(1, (speed + 0.5 * turning) / WALK_SPEED);
      stepping += (effort - stepping) * (1 - Math.exp(-dt * 6));
      gait = (gait + dt * Math.max(speed, 0.5 * turning) / (STRIDE * Math.max(stepping, 0.3))) % 1;
    }
    // where a foot is along its cycle `p` (0 to 1): planted from 0 to a half, sliding
    // from in front to behind, then lifted and swung forward again
    const footOffset = V();
    function footAt(p) {
      if (p < 0.5) return { z: STEP * (1 - 4 * p), y: 0, swing: -1 };
      const s = (p - 0.5) * 2, e = s * s * (3 - 2 * s);
      return { z: STEP * (-1 + 2 * e), y: LIFT * Math.sin(Math.PI * s), swing: s };
    }

    function update(dt, time) {
      if (pose === 'sleep') return sleep(dt, time);
      now = time;
      roam(dt);
      const w = stepping, still = 1 - w;
      const phase = time * BOB;
      const beat = Math.sin(phase);
      const g = gait * Math.PI * 2;

      // torso: sinks and rises on the knees, shifting its weight from side to side;
      // walking, it lets down, dips at each footfall, leans over the planted foot and
      // twists a little against the stride
      torso.position.copy(torso.userData.rest);
      torso.position.y += (-0.055 + 0.03 * beat) * still + (-WALK_SQUAT - 0.03 * Math.cos(2 * g)) * w;
      torso.position.x += 0.035 * Math.sin(phase * 0.5) * still + SIDES[0] * 0.05 * Math.sin(g) * w;
      torso.rotation.set(0.04 * w, 0.07 * Math.cos(g) * w, -0.025 * Math.sin(phase * 0.5) * still + SIDES[0] * 0.03 * Math.sin(g) * w);

      // legs: put each foot where its step has it (planted at rest), then bend the knee
      // forward by whatever the leg has to spare
      legs.forEach((leg, i) => {
        const foot = footAt((gait + i / 2) % 1);
        footOffset.set(0, foot.y * w, foot.z * w);
        const ankleAt = footOffset.add(leg.ankle);
        leg.foot.position.copy(ankleAt);
        leg.foot.rotation.x = foot.swing < 0 ? 0 : 0.35 * Math.sin(Math.PI * 2 * foot.swing) * w;  // toes push off, then lift
        hipAt.copy(leg.hip).applyEuler(torso.rotation).add(torso.position);
        reach.subVectors(ankleAt, hipAt);
        const half = Math.min(reach.length() / 2, leg.bone);
        reach.normalize();
        forward.copy(FRONT).addScaledVector(reach, -FRONT.dot(reach)).normalize();
        kneeAt.copy(hipAt).addScaledVector(reach, half).addScaledVector(forward, Math.sqrt(leg.bone ** 2 - half ** 2));
        leg.thigh.position.copy(hipAt);
        leg.thigh.quaternion.setFromUnitVectors(leg.along, reach.subVectors(kneeAt, hipAt).normalize());
        leg.shin.position.copy(kneeAt);
        leg.shin.quaternion.setFromUnitVectors(leg.along, reach.subVectors(ankleAt, kneeAt).normalize());
      });

      // head: bobs a beat behind the body, nods a little and tips from side to side
      head.position.y = head.userData.rest.y + 0.045 * Math.sin(phase - 0.6) * still + 0.03 * Math.cos(2 * g - 0.8) * w;
      head.rotation.x = 0.03 * Math.sin(phase - 0.9) * still - 0.04 * w;
      head.rotation.y = -0.07 * Math.cos(g) * w;                  // keeps looking ahead as the body twists
      head.rotation.z = 0.035 * Math.sin(phase * 0.5) * still;
      if (pose === 'sulk') head.rotation.x += 0.3 * earDown;      // hangs his head as the ears come down

      // arms: swing from the shoulder in turn; the elbow and wrist follow a little late,
      // the elbow only ever bending forward. Walking, each arm swings against the leg
      // on its own side, wider and with the elbow more bent.
      arms.forEach((arm, i) => {
        const swing = (lag) => arm.side * Math.sin(phase - lag);
        const stride = (lag) => Math.cos(g + i * Math.PI - lag);   // 1 when this side's foot is furthest forward
        arm.upper.rotation.x = 0.2 * swing(0) * still + 0.45 * stride(0) * w;
        arm.upper.rotation.z = arm.side * 0.05 * beat * still;
        arm.fore.rotation.x = -0.24 + 0.2 * swing(0.7) * still + (-0.2 + 0.15 * stride(0.6)) * w;
        arm.paw.rotation.x = 0.25 * swing(1.4) * still + 0.2 * stride(1.2) * w;
      });

      if (pose === 'wave') {
        // one arm held out to the side, the forearm flapping up and down from the
        // elbow and the paw trailing after it; the head tips away to leave it room
        const arm = arms.find((a) => a.side === WAVE), flap = time * WAVE_SPEED;
        arm.upper.rotation.set(0, 0, WAVE * (0.8 + 0.04 * beat));
        arm.fore.rotation.set(0, 0, WAVE * (0.4 + 0.4 * Math.sin(flap)));
        arm.paw.rotation.set(0, 0, WAVE * 0.35 * Math.sin(flap - 0.8));
        head.rotation.z += WAVE * 0.16;
      }

      // tail: a slow wave travelling out to the tip
      // tail: a slow wave travelling out to the tip; walking, it swishes with the stride
      tail.forEach((link, i) => {
        link.rotation.y = 0.11 * Math.sin(phase * 0.5 - i * 0.6) * still + 0.14 * Math.sin(g - i * 0.6) * w;
        link.rotation.z = 0.05 * Math.sin(phase - i * 0.5);
      });

      poseEars(dt, pose === 'sulk' ? 1 : 0);

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
    return {
      object: cat, update, variants: POSES, variantLabel: 'Pose', setVariant, view: { back: 1.35, rise: 0.04 },
      setWalking, walking: () => walking,
    };
  },
});
