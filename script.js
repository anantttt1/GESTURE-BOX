const video = document.getElementById("webcam");
const canvas = document.getElementById("output");
const ctx = canvas.getContext("2d");

const gestureValue = document.getElementById("gestureValue");
const statusValue = document.getElementById("statusValue");
const handValue = document.getElementById("handValue");

const boxCountChip = document.getElementById("boxCountChip");
const boxCountStat = document.getElementById("boxCountStat");
const fpsStat = document.getElementById("fpsStat");
const clock = document.getElementById("clock");

const btnClear = document.getElementById("btnClear");
const btnPause = document.getElementById("btnPause");
const btnReset = document.getElementById("btnReset");

const toast = document.getElementById("toast");
const stageMessage = document.getElementById("stageMessage");

const fistProgressWrap =
    document.getElementById("fistProgressWrap");

const fistProgressBar =
    document.getElementById("fistProgressBar");


/* =========================================================
   SETTINGS
========================================================= */

const PINCH_START = 0.62;
const PINCH_RELEASE = 0.76;

const STABLE_FRAMES = 3;

const FIST_HOLD_TIME = 1000;

const MIN_BOX_SIZE = 15;

const colors = [
    "#29f1ff",
    "#ff2f6e",
    "#ffb020",
    "#37ff8b",
    "#b26bff",
    "#ff7a29"
];


/* =========================================================
   GESTURES
========================================================= */

const GESTURE = {
    NONE: "NONE",
    OPEN: "OPEN",
    PINCH: "PINCH",
    TWO_FINGERS: "TWO_FINGERS",
    FIST: "FIST"
};


/* =========================================================
   STATE
========================================================= */

const state = {

    boxes: [],

    nextBoxId: 1,

    currentBox: null,

    selectedBox: null,

    handDetected: false,

    paused: false,

    processing: false,

    rawGesture: GESTURE.NONE,

    stableGesture: GESTURE.NONE,

    previousGesture: GESTURE.NONE,

    candidateGesture: GESTURE.NONE,

    candidateFrames: 0,

    fistStartTime: null,

    fistCleared: false,

    indexPoint: null,

    moveOffsetX: 0,

    moveOffsetY: 0,

    lastTime: performance.now(),

    fps: 0
};


/* =========================================================
   MEDIAPIPE
========================================================= */

const hands = new Hands({

    locateFile: function(file) {

        return (
            "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/" +
            file
        );
    }

});


hands.setOptions({

    maxNumHands: 1,

    modelComplexity: 1,

    minDetectionConfidence: 0.45,

    minTrackingConfidence: 0.45

});


hands.onResults(onResults);


/* =========================================================
   CAMERA
========================================================= */

function showStageError(title, sub) {

    if (!stageMessage) { return; }

    stageMessage.classList.remove("hidden");

    const t = stageMessage.querySelector(".msg-title");
    const u = stageMessage.querySelector(".msg-sub");

    if (t) { t.textContent = title; }
    if (u) { u.textContent = sub; }
}

async function startCamera() {

    if (typeof Hands === "undefined") {

        showStageError(
            "HAND MODEL NOT LOADED",
            "MediaPipe script blocked. Disable ad-blocker / check internet, then reload."
        );

        return;
    }

    showStageError(
        "LOADING HAND MODEL",
        "Downloading MediaPipe files (first load takes a few seconds)..."
    );

    try {

        await hands.initialize();

    } catch (error) {

        console.error("MediaPipe init failed:", error);

        showStageError(
            "HAND MODEL FAILED TO LOAD",
            "Could not download model files from CDN. Check internet / ad-blocker and reload."
        );

        return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {

        if (stageMessage) {

            stageMessage.classList.remove("hidden");

            const title = stageMessage.querySelector(".msg-title");
            const sub = stageMessage.querySelector(".msg-sub");

            if (title) {
                title.textContent = "BROWSER NOT SUPPORTED";
            }

            if (sub) {
                sub.textContent = "Use Chrome or Edge and allow webcam access.";
            }
        }

        return;
    }

    const cameraModes = [
        { facingMode: "user" },
        { facingMode: "environment" },
        { facingMode: "left" },
        { facingMode: "right" }
    ];

    let stream = null;

    for (const mode of cameraModes) {

        try {

            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    ...mode
                },
                audio: false
            });

            break;

        } catch (error) {

            console.warn("Camera mode failed:", mode, error);
        }
    }

    if (!stream) {

        console.error("Camera Error:", new Error("No usable camera stream available"));

        if (stageMessage) {

            stageMessage.classList.remove("hidden");

            const title = stageMessage.querySelector(".msg-title");
            const sub = stageMessage.querySelector(".msg-sub");

            if (title) {
                title.textContent = "CAMERA ERROR";
            }

            if (sub) {
                sub.textContent = "Please allow camera permission and reload the page.";
            }
        }

        return;
    }

    video.srcObject = stream;

    await video.play();

    canvas.width =
        video.videoWidth || 1280;

    canvas.height =
        video.videoHeight || 720;


    if (stageMessage) {
        stageMessage.classList.add("hidden");
    }


    requestAnimationFrame(mainLoop);
}


/* =========================================================
   MAIN LOOP
========================================================= */

function mainLoop() {

    updateFPS();

    if (!state.paused) {

        sendFrame();

    } else {

        drawScene(null);

    }

    requestAnimationFrame(mainLoop);
}


/* =========================================================
   SEND FRAME
========================================================= */

async function sendFrame() {

    if (state.processing) {
        return;
    }

    if (video.readyState < 2) {
        return;
    }

    if (!video.videoWidth) {
        return;
    }

    state.processing = true;

    try {

        await hands.send({
            image: video
        });

    } catch (error) {

        console.error(
            "MediaPipe Error:",
            error
        );

        showStageError(
            "TRACKING ERROR",
            String(error && error.message ? error.message : error)
        );

    } finally {

        state.processing = false;
    }
}


/* =========================================================
   FPS
========================================================= */

function updateFPS() {

    const now =
        performance.now();

    const difference =
        now - state.lastTime;

    state.lastTime = now;

    if (difference > 0) {

        const currentFPS =
            1000 / difference;

        state.fps =
            state.fps * 0.9 +
            currentFPS * 0.1;

        if (fpsStat) {

            fpsStat.textContent =
                Math.round(state.fps);
        }
    }
}


/* =========================================================
   MEDIAPIPE RESULTS
========================================================= */

function onResults(results) {

    const landmarks =
        results.multiHandLandmarks &&
        results.multiHandLandmarks.length > 0
            ? results.multiHandLandmarks[0]
            : null;


    if (!landmarks) {

        state.handDetected = false;

        state.indexPoint = null;

        updateGesture(
            GESTURE.NONE
        );

        updateHUD();

        drawScene(null);

        return;
    }


    state.handDetected = true;


    state.indexPoint =
        getCanvasPoint(
            landmarks[8]
        );


    const gesture =
        detectGesture(
            landmarks
        );


    state.rawGesture =
        gesture;


    updateGesture(
        gesture
    );


    if (
        state.stableGesture ===
        GESTURE.PINCH
    ) {

        updateDrawing();
    }


    if (
        state.stableGesture ===
        GESTURE.TWO_FINGERS
    ) {

        updateMoving();
    }


    updateFistTimer();

    updateHUD();

    drawScene(landmarks);
}


/* =========================================================
   POINT CONVERSION
========================================================= */

function getCanvasPoint(landmark) {

    return {

        x:
            canvas.width -
            landmark.x * canvas.width,

        y:
            landmark.y * canvas.height

    };
}


/* =========================================================
   DISTANCE
========================================================= */

function distance(a, b) {

    return Math.sqrt(

        Math.pow(
            a.x - b.x,
            2
        )

        +

        Math.pow(
            a.y - b.y,
            2
        )

    );
}


/* =========================================================
   HAND SCALE
========================================================= */

function handScale(landmarks) {

    const wrist =
        landmarks[0];

    const middle =
        landmarks[9];


    const a = {

        x: wrist.x,
        y: wrist.y

    };


    const b = {

        x: middle.x,
        y: middle.y

    };


    return Math.max(
        distance(a, b),
        0.001
    );
}


/* =========================================================
   FINGER EXTENDED
========================================================= */

function fingerExtended(
    landmarks,
    tip,
    pip
) {

    const wrist =
        landmarks[0];

    const tipPoint =
        landmarks[tip];

    const pipPoint =
        landmarks[pip];


    const wristPoint = {

        x: wrist.x,
        y: wrist.y

    };


    const tipPosition = {

        x: tipPoint.x,
        y: tipPoint.y

    };


    const pipPosition = {

        x: pipPoint.x,
        y: pipPoint.y

    };


    const tipDistance =
        distance(
            wristPoint,
            tipPosition
        );


    const pipDistance =
        distance(
            wristPoint,
            pipPosition
        );


    return (
        tipDistance >
        pipDistance * 1.08
    );
}


/* =========================================================
   FINGER CURLED
========================================================= */

function fingerCurled(
    landmarks,
    tip,
    pip
) {

    const wrist =
        landmarks[0];

    const tipPoint =
        landmarks[tip];

    const pipPoint =
        landmarks[pip];


    const wristPoint = {

        x: wrist.x,
        y: wrist.y

    };


    const tipPosition = {

        x: tipPoint.x,
        y: tipPoint.y

    };


    const pipPosition = {

        x: pipPoint.x,
        y: pipPoint.y

    };


    const tipDistance =
        distance(
            wristPoint,
            tipPosition
        );


    const pipDistance =
        distance(
            wristPoint,
            pipPosition
        );


    return (
        tipDistance <
        pipDistance * 1.05
    );
}


/* =========================================================
   PINCH
========================================================= */

function isPinching(landmarks) {

    const thumb =
        landmarks[4];

    const index =
        landmarks[8];


    const thumbPoint = {

        x: thumb.x,
        y: thumb.y

    };


    const indexPoint = {

        x: index.x,
        y: index.y

    };


    const pinchDistance =
        distance(
            thumbPoint,
            indexPoint
        );


    const scale =
        handScale(
            landmarks
        );


    const ratio =
        pinchDistance / scale;


    return ratio < PINCH_START;
}


/* =========================================================
   OPEN HAND
========================================================= */

function isOpenHand(landmarks) {

    const index =
        fingerExtended(
            landmarks,
            8,
            6
        );

    const middle =
        fingerExtended(
            landmarks,
            12,
            10
        );

    const ring =
        fingerExtended(
            landmarks,
            16,
            14
        );

    const pinky =
        fingerExtended(
            landmarks,
            20,
            18
        );


    return (
        index &&
        middle &&
        ring &&
        pinky
    );
}


/* =========================================================
   TWO FINGERS
========================================================= */

function isTwoFingers(landmarks) {

    const index =
        fingerExtended(
            landmarks,
            8,
            6
        );

    const middle =
        fingerExtended(
            landmarks,
            12,
            10
        );

    const ring =
        fingerCurled(
            landmarks,
            16,
            14
        );

    const pinky =
        fingerCurled(
            landmarks,
            20,
            18
        );


    return (
        index &&
        middle &&
        ring &&
        pinky
    );
}


/* =========================================================
   FIST
========================================================= */

function isFist(landmarks) {

    const index =
        fingerCurled(
            landmarks,
            8,
            6
        );

    const middle =
        fingerCurled(
            landmarks,
            12,
            10
        );

    const ring =
        fingerCurled(
            landmarks,
            16,
            14
        );

    const pinky =
        fingerCurled(
            landmarks,
            20,
            18
        );


    return (
        index &&
        middle &&
        ring &&
        pinky
    );
}


/* =========================================================
   GESTURE DETECTION
========================================================= */

function detectGesture(landmarks) {

    /*
       FIST
    */

    if (isFist(landmarks)) {

        return GESTURE.FIST;
    }


    /*
       PINCH
    */

    if (isPinching(landmarks)) {

        return GESTURE.PINCH;
    }


    /*
       TWO FINGERS
    */

    if (isTwoFingers(landmarks)) {

        return GESTURE.TWO_FINGERS;
    }


    /*
       OPEN HAND
    */

    if (isOpenHand(landmarks)) {

        return GESTURE.OPEN;
    }


    return GESTURE.NONE;
}


/* =========================================================
   GESTURE STABILITY
========================================================= */

function updateGesture(gesture) {

    if (
        gesture ===
        state.candidateGesture
    ) {

        state.candidateFrames++;

    } else {

        state.candidateGesture =
            gesture;

        state.candidateFrames = 1;
    }


    if (
        state.candidateFrames >=
        STABLE_FRAMES
        &&
        state.stableGesture !==
        gesture
    ) {

        const oldGesture =
            state.stableGesture;


        state.previousGesture =
            oldGesture;

        state.stableGesture =
            gesture;


        handleGestureChange(
            oldGesture,
            gesture
        );


        state.candidateFrames = 0;
    }
}


/* =========================================================
   GESTURE CHANGE
========================================================= */

function handleGestureChange(
    oldGesture,
    newGesture
) {

    /*
       PINCH RELEASE
    */

    if (
        oldGesture ===
        GESTURE.PINCH
        &&
        newGesture !==
        GESTURE.PINCH
    ) {

        finishDrawing();
    }


    /*
       START PINCH
    */

    if (
        newGesture ===
        GESTURE.PINCH
        &&
        oldGesture !==
        GESTURE.PINCH
    ) {

        startDrawing();
    }


    /*
       START TWO FINGER MOVE
    */

    if (
        newGesture ===
        GESTURE.TWO_FINGERS
        &&
        oldGesture !==
        GESTURE.TWO_FINGERS
    ) {

        selectBox();
    }


    /*
       STOP MOVING
    */

    if (
        oldGesture ===
        GESTURE.TWO_FINGERS
        &&
        newGesture !==
        GESTURE.TWO_FINGERS
    ) {

        state.selectedBox =
            null;
    }


    /*
       START FIST TIMER
    */

    if (
        newGesture ===
        GESTURE.FIST
    ) {

        state.fistStartTime =
            performance.now();

        state.fistCleared =
            false;
    }


    /*
       STOP FIST TIMER
    */

    if (
        oldGesture ===
        GESTURE.FIST
        &&
        newGesture !==
        GESTURE.FIST
    ) {

        state.fistStartTime =
            null;

        state.fistCleared =
            false;

        if (fistProgressWrap) {

            fistProgressWrap.hidden =
                true;
        }
    }
}


/* =========================================================
   START DRAWING
========================================================= */

function startDrawing() {

    if (!state.indexPoint) {
        return;
    }


    state.currentBox = {

        x1:
            state.indexPoint.x,

        y1:
            state.indexPoint.y,

        x2:
            state.indexPoint.x,

        y2:
            state.indexPoint.y
    };
}


/* =========================================================
   UPDATE DRAWING
========================================================= */

function updateDrawing() {

    if (
        !state.currentBox ||
        !state.indexPoint
    ) {

        return;
    }


    state.currentBox.x2 =
        state.indexPoint.x;

    state.currentBox.y2 =
        state.indexPoint.y;
}


/* =========================================================
   FINISH DRAWING
========================================================= */

function finishDrawing() {

    if (!state.currentBox) {
        return;
    }


    const x1 =
        state.currentBox.x1;

    const y1 =
        state.currentBox.y1;

    const x2 =
        state.currentBox.x2;

    const y2 =
        state.currentBox.y2;


    const x =
        Math.min(
            x1,
            x2
        );

    const y =
        Math.min(
            y1,
            y2
        );

    const width =
        Math.abs(
            x2 - x1
        );

    const height =
        Math.abs(
            y2 - y1
        );


    if (
        width >= MIN_BOX_SIZE &&
        height >= MIN_BOX_SIZE
    ) {

        const box = {

            id:
                state.nextBoxId,

            x,

            y,

            width,

            height,

            color:
                colors[
                    (
                        state.nextBoxId - 1
                    ) %
                    colors.length
                ]
        };


        state.boxes.push(
            box
        );


        state.nextBoxId++;


        updateBoxCount();


        showToast(
            "BOX " +
            box.id +
            " CREATED"
        );
    }


    state.currentBox =
        null;
}


/* =========================================================
   SELECT BOX
========================================================= */

function selectBox() {

    state.selectedBox =
        null;


    if (!state.indexPoint) {
        return;
    }


    /*
       Start from the last box
       because it is visually on top.
    */

    for (
        let i =
            state.boxes.length - 1;

        i >= 0;

        i--
    ) {

        const box =
            state.boxes[i];


        const inside =

            state.indexPoint.x >=
            box.x &&

            state.indexPoint.x <=
            box.x + box.width &&

            state.indexPoint.y >=
            box.y &&

            state.indexPoint.y <=
            box.y + box.height;


        if (inside) {

            state.selectedBox =
                box;


            state.moveOffsetX =
                state.indexPoint.x -
                box.x;

            state.moveOffsetY =
                state.indexPoint.y -
                box.y;


            break;
        }
    }
}


/* =========================================================
   UPDATE MOVING
========================================================= */

function updateMoving() {

    if (
        !state.selectedBox ||
        !state.indexPoint
    ) {

        return;
    }


    const box =
        state.selectedBox;


    box.x =
        state.indexPoint.x -
        state.moveOffsetX;


    box.y =
        state.indexPoint.y -
        state.moveOffsetY;


    /*
       Keep box inside canvas.
    */

    if (box.x < 0) {

        box.x = 0;
    }


    if (box.y < 0) {

        box.y = 0;
    }


    if (
        box.x + box.width >
        canvas.width
    ) {

        box.x =
            canvas.width -
            box.width;
    }


    if (
        box.y + box.height >
        canvas.height
    ) {

        box.y =
            canvas.height -
            box.height;
    }
}


/* =========================================================
   FIST TIMER
========================================================= */

function updateFistTimer() {

    if (
        state.stableGesture !==
        GESTURE.FIST
    ) {

        return;
    }


    if (
        state.fistStartTime ===
        null
    ) {

        state.fistStartTime =
            performance.now();
    }


    const elapsed =
        performance.now() -
        state.fistStartTime;


    const progress =
        Math.min(
            100,
            (
                elapsed /
                FIST_HOLD_TIME
            ) * 100
        );


    if (fistProgressWrap) {

        fistProgressWrap.hidden =
            false;
    }


    if (fistProgressBar) {

        fistProgressBar.style.width =
            progress + "%";
    }


    if (
        elapsed >=
        FIST_HOLD_TIME
        &&
        !state.fistCleared
    ) {

        clearAllBoxes();

        state.fistCleared =
            true;


        showToast(
            "ALL BOXES CLEARED"
        );
    }
}


/* =========================================================
   CLEAR ALL BOXES
========================================================= */

function clearAllBoxes() {

    state.boxes = [];

    state.currentBox = null;

    state.selectedBox = null;

    updateBoxCount();
}


/* =========================================================
   BOX COUNT
========================================================= */

function updateBoxCount() {

    const count =
        state.boxes.length;


    if (boxCountChip) {

        boxCountChip.textContent =
            count;
    }


    if (boxCountStat) {

        boxCountStat.textContent =
            count;
    }
}


/* =========================================================
   DRAW COMPLETE SCENE
========================================================= */

function drawScene(landmarks) {

    if (
        canvas.width === 0 ||
        canvas.height === 0
    ) {

        return;
    }


    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    /*
       Mirror webcam.
    */

    if (
        video.readyState >= 2
    ) {

        ctx.save();

        ctx.scale(
            -1,
            1
        );

        ctx.drawImage(
            video,
            -canvas.width,
            0,
            canvas.width,
            canvas.height
        );

        ctx.restore();
    }


    /*
       Slight dark overlay.
    */

    ctx.fillStyle =
        "rgba(0,0,0,0.12)";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    /*
       Draw hand.
    */

    if (landmarks) {

        drawHand(
            landmarks
        );
    }


    /*
       Draw saved boxes.
    */

    for (
        const box of state.boxes
    ) {

        drawBox(
            box,
            box ===
            state.selectedBox
        );
    }


    /*
       Draw current box.
    */

    if (state.currentBox) {

        drawPreviewBox(
            state.currentBox
        );
    }


    /*
       Index finger cursor.
    */

    if (state.indexPoint) {

        drawCursor(
            state.indexPoint
        );
    }
}


/* =========================================================
   DRAW HAND
========================================================= */

function drawHand(landmarks) {

    const points =
        landmarks.map(
            point =>
                getCanvasPoint(
                    point
                )
        );


    ctx.save();


    /*
       Connections
    */

    ctx.strokeStyle =
        "#29f1ff";

    ctx.lineWidth = 2;


    const connections = [

        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],

        [0, 5],
        [5, 6],
        [6, 7],
        [7, 8],

        [5, 9],
        [9, 10],
        [10, 11],
        [11, 12],

        [9, 13],
        [13, 14],
        [14, 15],
        [15, 16],

        [13, 17],
        [17, 18],
        [18, 19],
        [19, 20],

        [0, 17]

    ];


    for (
        const connection
        of connections
    ) {

        const a =
            points[
                connection[0]
            ];

        const b =
            points[
                connection[1]
            ];


        ctx.beginPath();

        ctx.moveTo(
            a.x,
            a.y
        );

        ctx.lineTo(
            b.x,
            b.y
        );

        ctx.stroke();
    }


    /*
       Landmarks
    */

    for (
        let i = 0;
        i < points.length;
        i++
    ) {

        const point =
            points[i];


        ctx.beginPath();

        ctx.arc(
            point.x,
            point.y,
            i === 8 || i === 4
                ? 6
                : 3,
            0,
            Math.PI * 2
        );


        ctx.fillStyle =
            i === 8 || i === 4
                ? "#ff2f6e"
                : "#ffffff";


        ctx.fill();
    }


    /*
       Pinch line
    */

    if (
        state.stableGesture ===
        GESTURE.PINCH
    ) {

        const thumb =
            points[4];

        const index =
            points[8];


        ctx.beginPath();

        ctx.moveTo(
            thumb.x,
            thumb.y
        );

        ctx.lineTo(
            index.x,
            index.y
        );


        ctx.strokeStyle =
            "#ff2f6e";

        ctx.lineWidth = 3;

        ctx.stroke();
    }


    ctx.restore();
}


/* =========================================================
   DRAW BOX
========================================================= */

function drawBox(
    box,
    selected
) {

    ctx.save();


    /*
       Transparent inside.
    */

    ctx.fillStyle =
        hexToRGBA(
            box.color,
            0.15
        );


    ctx.fillRect(
        box.x,
        box.y,
        box.width,
        box.height
    );


    /*
       Glow if selected.
    */

    if (selected) {

        ctx.shadowColor =
            box.color;

        ctx.shadowBlur = 20;

        ctx.lineWidth = 4;

    } else {

        ctx.shadowBlur = 0;

        ctx.lineWidth = 2;
    }


    ctx.strokeStyle =
        box.color;


    ctx.strokeRect(
        box.x,
        box.y,
        box.width,
        box.height
    );


    ctx.shadowBlur = 0;


    /*
       Label
    */

    ctx.font =
        "bold 12px monospace";

    ctx.fillStyle =
        box.color;


    ctx.fillText(
        "BOX " + box.id,
        box.x + 5,
        box.y > 20
            ? box.y - 6
            : box.y + 15
    );


    ctx.restore();
}


/* =========================================================
   DRAW PREVIEW BOX
========================================================= */

function drawPreviewBox(box) {

    const x =
        Math.min(
            box.x1,
            box.x2
        );

    const y =
        Math.min(
            box.y1,
            box.y2
        );

    const width =
        Math.abs(
            box.x2 -
            box.x1
        );

    const height =
        Math.abs(
            box.y2 -
            box.y1
        );


    ctx.save();


    ctx.fillStyle =
        "rgba(41,241,255,0.10)";


    ctx.fillRect(
        x,
        y,
        width,
        height
    );


    ctx.strokeStyle =
        "#29f1ff";

    ctx.lineWidth = 3;

    ctx.setLineDash([
        8,
        6
    ]);


    ctx.strokeRect(
        x,
        y,
        width,
        height
    );


    ctx.setLineDash([]);


    ctx.restore();
}


/* =========================================================
   CURSOR
========================================================= */

function drawCursor(point) {

    ctx.save();


    ctx.beginPath();

    ctx.arc(
        point.x,
        point.y,
        12,
        0,
        Math.PI * 2
    );


    ctx.strokeStyle =
        "#29f1ff";

    ctx.lineWidth = 2;

    ctx.stroke();


    ctx.beginPath();

    ctx.arc(
        point.x,
        point.y,
        3,
        0,
        Math.PI * 2
    );


    ctx.fillStyle =
        "#ffffff";

    ctx.fill();


    ctx.restore();
}


/* =========================================================
   HEX TO RGBA
========================================================= */

function hexToRGBA(
    hex,
    alpha
) {

    const value =
        parseInt(
            hex.substring(1),
            16
        );


    const r =
        (value >> 16) & 255;

    const g =
        (value >> 8) & 255;

    const b =
        value & 255;


    return (
        "rgba(" +
        r +
        "," +
        g +
        "," +
        b +
        "," +
        alpha +
        ")"
    );
}


/* =========================================================
   HUD
========================================================= */

function updateHUD() {

    if (handValue) {

        handValue.textContent =
            state.handDetected
                ? "DETECTED"
                : "NOT FOUND";
    }


    if (gestureValue) {

        if (
            state.stableGesture ===
            GESTURE.TWO_FINGERS
        ) {

            gestureValue.textContent =
                "TWO FINGERS";

        } else {

            gestureValue.textContent =
                state.stableGesture;
        }
    }


    if (statusValue) {

        switch (
            state.stableGesture
        ) {

            case GESTURE.PINCH:

                statusValue.textContent =
                    "DRAWING";

                break;


            case GESTURE.TWO_FINGERS:

                statusValue.textContent =
                    state.selectedBox
                        ? "MOVING"
                        : "MOVE MODE";

                break;


            case GESTURE.FIST:

                statusValue.textContent =
                    "HOLD TO CLEAR";

                break;


            case GESTURE.OPEN:

                statusValue.textContent =
                    "READY";

                break;


            default:

                statusValue.textContent =
                    state.handDetected
                        ? "WAITING"
                        : "NO HAND";
        }
    }


    if (
        stageMessage &&
        state.handDetected
    ) {

        stageMessage.classList.add(
            "hidden"
        );
    }
}


/* =========================================================
   TOAST
========================================================= */

let toastTimeout = null;


function showToast(message) {

    if (!toast) {
        return;
    }


    toast.textContent =
        message;


    toast.classList.remove(
        "show"
    );


    void toast.offsetWidth;


    toast.classList.add(
        "show"
    );


    clearTimeout(
        toastTimeout
    );


    toastTimeout =
        setTimeout(
            function() {

                toast.classList.remove(
                    "show"
                );

            },
            1800
        );
}


function togglePauseState() {

    state.paused =
        !state.paused;


    if (state.paused) {

        state.currentBox = null;
        state.selectedBox = null;
        state.rawGesture = GESTURE.NONE;
        state.stableGesture = GESTURE.NONE;
        state.previousGesture = GESTURE.NONE;
        state.candidateGesture = GESTURE.NONE;
        state.candidateFrames = 0;
        state.fistStartTime = null;
        state.fistCleared = false;

        if (fistProgressWrap) {
            fistProgressWrap.hidden = true;
        }

        if (fistProgressBar) {
            fistProgressBar.style.width = "0%";
        }

        updateHUD();
        drawScene(null);

    }


    if (btnPause) {
        btnPause.textContent =
            state.paused
                ? "RESUME CAMERA"
                : "PAUSE CAMERA";
    }
}


/* =========================================================
   CLEAR BUTTON
========================================================= */

if (btnClear) {

    btnClear.addEventListener(
        "click",
        function() {

            clearAllBoxes();

            showToast(
                "ALL BOXES CLEARED"
            );
        }
    );
}


/* =========================================================
   PAUSE BUTTON
========================================================= */

if (btnPause) {

    btnPause.addEventListener(
        "click",
        function() {

            togglePauseState();
        }
    );
}


/* =========================================================
   RESET BUTTON
========================================================= */

if (btnReset) {

    btnReset.addEventListener(
        "click",
        function() {

            clearAllBoxes();


            state.currentBox =
                null;

            state.selectedBox =
                null;

            state.stableGesture =
                GESTURE.NONE;

            state.candidateGesture =
                GESTURE.NONE;

            state.candidateFrames =
                0;

            state.fistStartTime =
                null;

            state.fistCleared =
                false;


            showToast(
                "RESET COMPLETE"
            );
        }
    );
}


/* =========================================================
   CLOCK
========================================================= */

function updateClock() {

    if (!clock) {
        return;
    }


    const now =
        new Date();


    clock.textContent =
        now.toLocaleTimeString(
            [],
            {
                hour12: false
            }
        );
}


setInterval(
    updateClock,
    1000
);

updateClock();


/* =========================================================
   INITIALIZATION
========================================================= */

updateBoxCount();

startCamera();