# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A low-poly, PS1/PS2-style WebGL scene and model viewer, written as plain HTML and JavaScript on three.js (loaded from a CDN through an import map). There is no build step, package manager, linter or test suite: open the HTML files in a browser, straight from disk (`file://`) or from any static server.

- `index.html`: the standalone cherry blossom scene.
- `viewer.html`: a viewer for the models in `models/`, with a model picker, outdoor and white-room backdrops, and CRT and spin toggles.
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

`index.html`, `viewer.html` and `pond.html` each contain their own copy of the renderer; they share no code. A change to the look (the vertex-snapping shader, pixel textures, sky, grass, CRT filter) has to be made in all three. `models/cherry-tree.js` is likewise a repackaged copy of the tree that `index.html` grows inline.

The shared look comes from three things:

- **Low-resolution target**: the scene is drawn into a render target `RENDER_HEIGHT` (300) pixels tall, then a full-window shader pass puts it on screen, either as hard pixels or through the CRT filter.
- **`psx(material, windAmount)`**: wraps a three.js material, patching its vertex shader through `onBeforeCompile` to snap vertices to the low-resolution grid (the PS1 wobble) and, optionally, to apply wind. Every material in the scene should go through it.
- **`canvasTexture(w, h, paint, options)`**: makes a nearest-filtered texture from a small canvas painted in code. All textures are generated this way; there are no image assets.

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

- **`cat.js`**: rigid pieces, each a group that turns about its own joint, built in whole-model coordinates and shifted to the joint by the `piece()` helper. The legs are placed each frame so the feet stay planted. Its poses (idle, waving, sleeping) are exposed as variants: `setVariant` returns every piece to its rest position, then `update` poses the pieces for the current pose each frame.
- **`koi.js`**: a single lofted body mesh with a painted 128×64 skin texture. Varieties differ only in the function that paints the skin and fins, apart from the butterfly koi, which rebuilds the fins longer. Swimming is done on the CPU: each frame every vertex is shifted from its stored rest position by a wave that runs down the spine. Its materials chain a second `onBeforeCompile` on top of `psx()` (the `wet` helper) to add a highlight, edge sheen and drifting light ripples; this is the pattern to follow for any per-model shader effect.

White surfaces use a dimmed colour plus an emissive term (see the comments in both files): the scene lighting is strong enough that a plain white material burns out on the sunlit side and goes grey in the shade.

### The pond

`pond.html` loads the same model files as the viewer (it defines its own `registerModel`) and builds them several times over with its `build(name, at, seed)` helper: five koi, each set to a different variety and steered round the pond by `updateKoi`, and the cherry tree on the bank. Everything else (water, bed, lily pads, reeds, bank grass) is built inline.

- The pond outline is the function `rim(angle, k)`; everything is placed with it, so changing the pond's size or shape there moves the banks, plants and koi with it.
- Its `psx(material, windAmount, flex)` differs from the other two pages: wind bends a plant about the point `windRoot` held when the material was made (so the tree can stand away from the origin), and `flex` sets the heights between which bending grows (so short plants such as reeds and grass can sway).
- Water is layered transparent sheets, not a shader: two blue tints at different depths and two additive ripple textures sliding across each other.
- Rules carried over from the ASCII pond: motion stays calm, no water lilies (pads only), reeds and cattails stay short.

### Viewer URL options

`?model=<name>`, `?variant=<name>`, `?env=room|outdoors`, `?crt=off`, `?spin=on`, `?seed=<n>`. The picker, backdrop, CRT, spin and variant choices are also remembered in `localStorage`.

## Conventions

- Comments explain why a shape or number is what it is, in plain prose; files are divided with `// ----- section` rules. Match this when editing.
- Geometry is merged per material within a piece (`mergeGeometries`) to keep the number of meshes low.
