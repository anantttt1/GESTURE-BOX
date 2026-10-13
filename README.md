# HGX-01 — Hand Gesture Box Creator

Draw boxes in the air. No mouse, no backend — just your webcam, [MediaPipe
Hands](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker),
and the Canvas API, running entirely inside your browser.

---

## 1. Project structure

```
GESTURE-BOX/
├── index.html            # HUD layout: webcam/canvas stage + side panel
├── style.css             # Futuristic HUD styling (dark, cyan/magenta neon)
├── script.js             # Hand tracking, gesture state machine, box drawing
├── vercel.json           # Vercel headers (camera permission)
├── .vscode/launch.json   # VS Code Chrome debug config (localhost:8000)
└── README.md
```

## 2. Running it locally

Camera access requires a **secure context**, so you can't just double-click
`index.html` in most browsers (`file://` origins are blocked or restricted).
Serve the folder over `http://localhost` instead — pick whichever you have:

```bash
# Option A — Python (built in on most systems)
cd hand-gesture-box-creator
python3 -m http.server 8000

# Option B — Node
cd hand-gesture-box-creator
npx serve .

# Option C — VS Code
# Right-click index.html → "Open with Live Server"
```

Then open **http://localhost:8000** (or whatever port your tool prints) in
Chrome, Edge, or another browser with getUserMedia + WebAssembly support.
When prompted, **allow camera access**.

MediaPipe's model files are loaded from a CDN (`jsdelivr.net`) at runtime, so
you'll need an internet connection the first time you run it — no local
install or build step required.

## 3. Deploying to Vercel

This is a static site (no build step), so Vercel serves it as-is:

1. Push the project to GitHub (`index.html` must be at the repo root).
2. On [vercel.com](https://vercel.com) → **Add New → Project** → import this repo.
3. Framework Preset: **Other**. Leave Build Command, Output Directory and
   Install Command empty.
4. Click **Deploy**. Every later push to `main` redeploys automatically.

Vercel serves over HTTPS, which webcam access requires. `vercel.json` only
adds a `Permissions-Policy: camera=(self)` header so the camera is allowed.

## 4. How the gestures work

The app tracks 21 landmarks on one hand per frame and runs them through a
small **debounced state machine**: a gesture only "commits" after several
consecutive frames agree, so a flicker in tracking can't accidentally start
or duplicate a box. On a committed **state change** (not every frame), the
app fires exactly one action — this is what guarantees one pinch produces
exactly one box.

| Gesture | Landmarks checked | Effect |
|---|---|---|
| **Pinch** (thumb + index tip together) | distance(thumb tip, index tip), normalized by hand size | Starts a box at the index-finger position; while held, the box resizes live to follow your finger; releasing finalizes it and adds it to the permanent set. |
| **Open hand** | all four fingertips extended well past their middle joints | Idle / ready state — no action, just tells you tracking is healthy. |
| **Fist** | all four fingertips curled in past their middle joints | Holding for ~1 second clears every box on screen, with a progress bar and a toast confirming it. |
| **Two fingers** (index + middle extended, ring + pinky curled) | mixed extended/curled check per finger | If your fingertip is over an existing box when you make this gesture, that box is picked up and follows your finger until you change gesture. |

Box coordinates: for a pinch that starts at `(x1, y1)` and is currently at
`(x2, y2)`, the live preview is computed the standard way —
`x = min(x1,x2)`, `y = min(y1,y2)`, `width = |x2-x1|`, `height = |y2-y1|` —
so the box is correct regardless of which direction you drag.

**Mirroring:** the video is drawn onto the canvas flipped horizontally (like
a mirror), and every landmark coordinate is flipped the same way before it's
used for gestures or box math. Everything — skeleton, reticle, boxes — lives
in one consistent, mirrored coordinate space, so what you see lines up
exactly with where your hand is.

## 5. Side panel

- **Gesture / Status / Hand** — live readout of the debounced gesture state.
- **Boxes drawn / FPS** — session stats.
- **Gesture guide** — quick reference while you're learning the controls.
- **Clear Boxes** — same as holding a fist, but instant.
- **Pause Camera** — stops sending frames to MediaPipe (saves CPU) without
  losing your boxes.
- **Reset** — clears boxes and resets all gesture/timer state.

## 6. Troubleshooting

**"Camera access denied"**
Your browser blocked the permission prompt (or you dismissed it). Click the
camera icon in the address bar and allow access, then reload.

**"No camera found"**
No webcam was detected by the OS. Check it's plugged in / not disabled in
your system camera settings.

**"Camera in use"**
Another app (Zoom, Teams, another browser tab) has the camera locked. Close
it and reload.

**Page loads but nothing tracks / stuck on "Initializing optical input"**
- Confirm you're serving over `http://localhost`, not opening the file
  directly (`file://` blocks camera access in most browsers).
- Open devtools → Network tab and confirm the `@mediapipe/hands` files from
  `jsdelivr.net` are loading (an ad-blocker or offline network will block
  them).
- Try a Chromium-based browser first — it has the broadest WebAssembly/SIMD
  support for MediaPipe.

**Gestures feel unreliable**
- Keep your hand fully inside the frame and reasonably well lit — MediaPipe
  loses accuracy in low light or at the frame edges.
- The pinch/fist/open-hand thresholds are tuned constants in `script.js`
  (`PINCH_RATIO_THRESHOLD`, `CURL_RATIO_MARGIN`, `EXTEND_RATIO_MARGIN`) —
  nudge them if your hand proportions or camera angle need it.

**Boxes appear tiny/instant on a light tap**
Boxes smaller than `MIN_BOX_SIZE` (10px) are discarded as accidental
pinches — this is intentional, to avoid clutter from a quick tap.

## 7. Notes on code structure

`script.js` is organized around the functions the spec calls for:

```
detectHands()        pumps the current video frame into MediaPipe
detectGesture()       classifies one frame's landmarks into a gesture label
getFingerPosition()   mirrored canvas-space position of a given landmark
isPinching() / isFist() / isOpenHand() / isTwoFingers()   gesture primitives
startBox() / updateBox() / finishBox()   box lifecycle during a pinch
clearBoxes()          wipes all boxes (fist-hold or button)
drawCanvas()          repaints video + skeleton + boxes + reticle each frame
```

Enjoy drawing in the air.
