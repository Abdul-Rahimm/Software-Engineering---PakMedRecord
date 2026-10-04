// On-device face analysis for identity checks (Human library, models self-hosted under /models/human).
// Everything runs in the browser; only the final photos and scores are uploaded for review.

let humanPromise;

export const loadHuman = () => {
  humanPromise ||= (async () => {
    const { default: Human } = await import('@vladmandic/human');
    const human = new Human({
      modelBasePath: `${window.location.origin}/models/human/`,
      backend: 'webgl',
      cacheSensitivity: 0,
      debug: false,
      face: {
        enabled: true,
        detector: { rotation: true, maxDetected: 2, minConfidence: 0.4, return: false },
        mesh: { enabled: true },
        iris: { enabled: true },
        description: { enabled: true }, // face embedding for matching
        antispoof: { enabled: true }, // printed photo / screen detection
        liveness: { enabled: true },
        emotion: { enabled: false },
      },
      body: { enabled: false },
      hand: { enabled: false },
      object: { enabled: false },
      segmentation: { enabled: false },
      gesture: { enabled: true },
      filter: { enabled: true, equalization: false },
    });
    await human.load();
    await human.warmup();
    return human;
  })().catch((err) => {
    humanPromise = undefined;
    throw err;
  });
  return humanPromise;
};

// Largest face in an image / video / canvas: { face, gestures } or null
export const detectFace = async (input) => {
  const human = await loadHuman();
  const res = await human.detect(input);
  if (!res.face?.length) return null;
  const face = [...res.face].sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3])[0];
  return { face, faces: res.face.length, gestures: (res.gesture || []).filter((g) => 'face' in g).map((g) => g.gesture) };
};

// 0..1 similarity of two face embeddings (about 0.5+ usually means the same person)
export const similarity = async (a, b) => {
  if (!a?.length || !b?.length) return 0;
  const human = await loadHuman();
  return human.match.similarity(a, b);
};

// Head pose in degrees: yaw > 0 = turned to the person's left (mirrored preview: screen right)
export const yawDegrees = (face) => ((face?.rotation?.angle?.yaw || 0) * 180) / Math.PI;

// How open the eyes are: eyelid gap / eye width, averaged over both eyes (about 0.25-0.35 open, <0.12 closed).
// A blink is this value dropping well below the person's own open-eye level and coming back,
// which a printed photo or a still image on a screen can't do.
export const eyeOpenness = (face) => {
  const a = face?.annotations;
  if (!a?.leftEyeUpper0 || !a?.leftEyeLower0 || !a?.rightEyeUpper0 || !a?.rightEyeLower0) return null;
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const eye = (up, low) => {
    const mid = (pts) => pts[Math.floor(pts.length / 2)];
    const width = dist(low[0], low[low.length - 1]);
    return width ? dist(mid(up), mid(low)) / width : null;
  };
  const l = eye(a.leftEyeUpper0, a.leftEyeLower0);
  const r = eye(a.rightEyeUpper0, a.rightEyeLower0);
  return l != null && r != null ? (l + r) / 2 : null;
};

// Draw a video frame / image to a JPEG data URL, at most `max` px on the long side
export const snapshot = (source, max = 960, quality = 0.82) => {
  const w = source.videoWidth || source.naturalWidth || source.width;
  const h = source.videoHeight || source.naturalHeight || source.height;
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
};

export const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

// Read the 13-digit CNIC number off a card photo (Tesseract OCR, digits only). Returns '' if not found.
export const readCnicNumber = async (dataUrl) => {
  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    await worker.setParameters({ tessedit_char_whitelist: '0123456789-' });
    const { data } = await worker.recognize(dataUrl);
    await worker.terminate();
    const m = /(\d{5})\s*-?\s*(\d{7})\s*-?\s*(\d)/.exec(data.text.replace(/[^\d\-\s]/g, ' '));
    return m ? `${m[1]}${m[2]}${m[3]}` : '';
  } catch {
    return '';
  }
};
