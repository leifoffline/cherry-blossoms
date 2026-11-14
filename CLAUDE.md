# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A low-poly, PS2-style WebGL scene and model viewer, written as plain HTML and JavaScript on three.js (loaded from a CDN through an import map). There is no build step, package manager, linter or test suite: open the HTML files in a browser, straight from disk (`file://`) or from any static server.

- `index.html`: the standalone cherry blossom scene.
- `viewer.html`: a viewer for the models in `models/`, with a model picker, outdoor and white-room backdrops, and CRT, bloom and spin toggles.
- `pond.html`: a koi pond environment, a 3D remake of the ASCII pond in the sibling `ascii_pond` project (`../ascii_pond/index.html`, whose `CLAUDE.md` lists that pond's contents and design rules). It is being built up one feature at a time; the header comment in the file lists what is in and what is still to come.

## Checking changes

- Syntax-check a model file: `node --check models/<name>.js`.
- The only real test is to render the page and look at it. From WSL, use Windows Edge in headless mode to take a screenshot:

  ```
  "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new \
    --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist \
    --user-data-dir='C:\Users\<user>\AppData\Local\Temp\<dir>\profile' --window-size=800,500 \
    --virtual-time-budget=6000 --screenshot='C:\Users\<user>\AppData\Local\Temp\<dir>\shot.png' \
    'file:///C:/.../cherryblossom/viewer.html?model=koi&variant=showa&crt=off&env=room'
  ```

  - Virtual time does not advance the animation, so every screenshot shows the first frame. To see another moment or camera angle, render a `sed`-patched temporary copy of the page (for example `let time = 0;` changed to `let time = 1.3;`). Keep the copy in the project root so `models/` still resolves, and delete it afterwards.
  - Use a separate `--user-data-dir` for each run that happens in parallel. The profile also keeps `localStorage`, so remembered settings (CRT, backdrop, variant) carry over between runs that share one; pass them in the URL to be sure.
  - `crt=off&env=room` gives the clearest picture of a model.

## Architecture

### Three pages, one renderer, duplicated

`index.html`, `viewer.html` and `pond.html` each contain their own copy of the renderer; they share no code. A change to the look (the vertex-snapping shader, painted textures, palette, sky, grass, bloom, CRT filter) has to be made in all three. `models/cherry-tree.js` is likewise a repackaged copy of the tree that `index.html` grows inline.

The shared look comes from three things:

- **Low-resolution target**: the scene is drawn into a render target at the PS2's 512×448 pixel density (`RENDER_WIDTH` columns per 4:3 of window, `RENDER_HEIGHT` rows, so pixels are a sixth wider than tall; a wider window gets more columns), then a full-window shader pass stretches it over the window, either smoothly (bilinear, the soft PS2 picture) or through the CRT filter. The CRT scanlines fade out when a row is under about three screen pixels tall, to avoid moire.
- **Bloom**: after the scene is drawn, `renderBloom` copies whatever is brighter than `BLOOM_THRESHOLD` into a quarter-size target, blurs it across and then down, and the screen pass adds it back (`picture()` in the screen shader) at `BLOOM_STRENGTH`. It is on by default and toggled with the BLOOM button, the `G` key or `?bloom=off`, remembered in `localStorage` like the CRT setting.
- **`psx(material, windAmount)`**: wraps a three.js material, patching its vertex shader through `onBeforeCompile` to snap vertices to a sixteenth of a low-resolution pixel, as the PS2 did (`SUBPIXEL`; 1 gives the PS1 wobble) and, optionally, to apply wind. Every material in the scene should go through it.
- **`canvasTexture(w, h, paint, options)`**: makes a smoothly filtered texture (bilinear with mipmaps, as on the PS2; `pixelated: true` gives hard PS1 texels) from a small canvas painted in code. Textures cut out with `alphaTest` must pass `cutout: true`, which spreads edge colours under the transparent pixels so filtering does not outline the shapes darkly; those become data textures and cannot be repainted. All textures are generated this way; there are no image assets. Sizes follow PS2 practice: a main object (koi, tree) gets about one 128×128 sheet's worth in total, background and props 64×64 or smaller, and the sky, the largest, is 256×128. The tree's textures draw their layout from the seeded stream in a fixed number and order of draws (changing that regrows the tree) and take fine detail from a fixed `grain` pattern instead.

The target look is the PS2, not the PS1: smooth filtered textures, smooth (Gouraud) shading rather than `flatShading`, sub-pixel vertex placement, a soft 448-line picture. Avoid hard pixels and faceted shading.

**Palette**: colours sit halfway between the bright, saturated set the project started with and painted Japanese-summer backgrounds: a deep cobalt sky with white clouds shaded blue-grey underneath, greens running from a bluish forest shadow to a yellow-green highlight (never one bright lime), warm earth and wood, cool grey stone, dark blue-green water. Each page has a `PALETTE` object near the top (the pond's is the fullest) and `cherry-tree.js` has its own; the shared entries (lights, sky, grass, tree) are duplicated and must be kept in step. Koi and cat keep their own character colours.

Everything random is drawn from a seeded generator (`mulberry32`), so a given `?seed=` always produces the same scene.

### Model files

Models are plain scripts, not ES modules, so that the viewer works from `file://`. The viewer sets `window.THREE` and `window.registerModel`, then loads each file listed in `MODEL_FILES` with a `<script>` tag. To add a model, write `models/<name>.js` and add `<name>` to `MODEL_FILES` in `viewer.html`.

A model file calls `registerModel({ name, label, build })`. `build(ctx)` receives `{ THREE, psx, canvasTexture, mergeGeometries, rand, seed, sunDir, windDir }` and returns either an `Object3D` standing on the origin (y = 0 is the floor) or an object with:

| Field | Purpose |
| --- | --- |
| `object` | the `Object3D` to show |
| `update(dt, time)` | called every frame, for animation |
| `bounds` | a `Box3` used for framing the camera and sizing the shadow and room, instead of the measured one |
| `view` | opening camera: `back` (distance, 1 = snug), `rise` (height as a share of the model's height), `turn` (radians round the model) |
| `shadow` | `{ x, z }` half-widths for a non-round blob shadow |
| `variants`, `setVariant(name)`, `variantLabel` | versions of the model, shown in a second picker and cycled with `V` |

`showModel` in `viewer.html` is where these are read. When the model changes, the viewer disposes every geometry, material and texture reachable from `object`, so keep textures attached to a material.

### How the existing models are built

- **`cat.js`**: rigid pieces, each a group that turns about its own joint, built in whole-model coordinates and shifted to the joint by the `piece()` helper. The legs are placed each frame so the feet stay planted. Its poses (idle, waving, ears down, sleeping on his back) are exposed as variants: `setVariant` returns every piece to its rest position, then `update` poses the pieces for the current pose each frame.
- **`koi.js`**: a single lofted body mesh with a painted 128×64 skin texture. Varieties differ only in the function that paints the skin and fins, apart from the butterfly koi, which rebuilds the fins longer. Swimming is done on the CPU: each frame every vertex is shifted from its stored rest position by a wave that runs down the spine. Its materials chain a second `onBeforeCompile` on top of `psx()` (the `wet` helper) to add a highlight, edge sheen and drifting light ripples; this is the pattern to follow for any per-model shader effect.
- **`firefly.js`**: the one model with a real skeleton. `bone(parent, joint)` builds `THREE.Bone`s (body, head, chains down the antennae and abdomen, hinges for the wing cases and hind wings, hip, knee and ankle per leg), shapes are skinned with `rigid` (one bone) or `chain` (a run of bones, sharing vertices near each joint so it bends without parting), then merged into one `SkinnedMesh` per material on the shared skeleton; `psx()` works on skinned meshes unchanged. Poses (perched, flying) are variants that turn bones. It is modelled large and shrunk by `SCALE` to life size against the koi and cat (about 11 cm to the unit), so it is an eighth of a unit long; the viewer sets its near plane, zoom limit and shadow height from the model's size for this. The lantern (the last two abdomen segments, all the way round) glows in three ways at once: an emissive map pulsed each frame, an additive halo card turned to face the camera in `onBeforeRender`, and a `PointLight`, the last two carried by the tail bone.
- **`stone-lantern.js`**: a yukimi-doro (snow-viewing lantern). Each part is passed through `finish()`, which splits it into separate triangles, box-projects the granite texture so its grain is one size everywhere, and paints vertex colours for moss (on upward faces, in patches, and up the feet) and shade (under the roof). The firebox walls are `ExtrudeGeometry` slabs with the windows cut through; the triangles that face inward go to a darker `selfLit` inside material that glows when lit. `setLit(0..1)` (variants unlit and lit) drives a flame, a glow card seen through the windows and a faint aura.

White surfaces use a dimmed colour plus an emissive term (see the comments in both files): the scene lighting is strong enough that a plain white material burns out on the sunlit side and goes grey in the shade.

### The pond

`pond.html` loads the same model files as the viewer (it defines its own `registerModel`) and builds them several times over with its `build(name, at, seed)` helper: five koi, each set to a different variety and steered round the pond by `updateKoi`, the cherry tree on the bank, the cat asleep at its foot (`CAT_AT`, which the bank grass keeps clear of), the fireflies and the two stone lanterns. Everything else (water, bed, lily pads, reeds, bank grass) is built inline.

- The pond outline is the function `rim(angle, k)`; everything is placed with it, so changing the pond's size or shape there moves the banks, plants and koi with it.
- Its `psx(material, windAmount, flex)` differs from the other two pages: wind bends a plant about the point `windRoot` held when the material was made (so the tree can stand away from the origin), and `flex` sets the heights between which bending grows (so short plants such as reeds and grass can sway).
- Water is layered transparent sheets, not a shader, in the manner of PS2 games: two turquoise tints at different depths over a pale sandy bed, and one smooth (linear-filtered, the only such texture) caustic web laid three times as additive layers sliding in different directions, twice on the surface and once on the bed.
- Boulders and pebbles ring the rim (`rockGeometry`: a noise-lumped icosahedron, smooth-shaded, textured by box projection), merged into one mesh, with a heap on the far bank. They draw from their own random stream (`rockRand`) so changing them leaves the plants in place, and record footprints in `boulders` so the bank grass keeps clear.
- The camera keeps one angle. The default view (`resetView`, sized to the window by `frameView`) shows the whole pond and cannot be moved; zooming in lets a drag slide the view, and `holdView` limits how far by how close in the camera is.
- Time of day: `TIMES` holds one set of values per hour (so far `day` and `sunset`) for the lamps, the water colours and a colour grade; `updateTimeOfDay` eases from the current values to the chosen set. The grade is two colours, one multiplied into bright parts and one into dark, injected into every material's fragment shader by `graded` (called from `psx`), because much of the pond is unlit `MeshBasicMaterial` and ignores the lamps. Light on level ground is held constant across hours (`litAs`) so the lit ground and the unlit grass on it stay matched. To add an hour, add an entry to `TIMES` with the same keys. Hours so far: day, sunset, night. Changed with the TIME button, the `T` key or `?time=sunset`, and remembered.
- Landscaping (the `landscaping` section, its own `landRand` stream): a sand-and-gravel bed from the rim out to `gravelOut(angle)`, pebbles strewn on it, shrubs behind the far bank and along the gravel's edge and purple and blue flower cushions on the gravel, both built like the cherry tree's canopy (instanced bunches of three crossed cut-out cards carrying a painted spray, shading baked into each bunch's colour, over a dark core dome), and the spots for the two stone lanterns (`LANTERNS`). Everything placed there records a footprint in `boulders`, which the bank grass, the pebbles and the fireflies avoid; the grass tufts grow along the gravel's outer edge. The lanterns are lit from sunset (`TIMES[*].lanterns`) by `updateLanterns`, each with a warm pool of light on the ground.
- Fireflies come out at night (`TIMES[*].fireflies` is the share of the swarm out; a few at sunset). `updateFireflies` drives them: males cruise and give a single flash every six seconds or so while swooping in a J; females sit in the bank grass and answer a nearby flash two seconds later, and the male then flies down to her. The pond takes over the model's lantern with `setGlow`, enlarges its halo with `setHaloSize` so a flash shows from the default view, removes its tiny `PointLight`, and lays an additive spot of light on the ground or water below each one. Materials marked `userData.selfLit` skip the time-of-day tint, so glows stay bright at night.
- Rules carried over from the ASCII pond: motion stays calm, no water lilies (pads only), reeds and cattails stay short.

### Viewer URL options

`?model=<name>`, `?variant=<name>`, `?env=room|outdoors`, `?crt=off`, `?bloom=off`, `?spin=on`, `?seed=<n>`. The picker, backdrop, CRT, bloom, spin and variant choices are also remembered in `localStorage`.

## Conventions

- Comments explain why a shape or number is what it is, in plain prose; files are divided with `// ----- section` rules. Match this when editing.
- Geometry is merged per material within a piece (`mergeGeometries`) to keep the number of meshes low.
