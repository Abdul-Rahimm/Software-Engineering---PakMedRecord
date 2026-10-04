import { useCallback, useEffect, useRef, useState } from 'react';
import { FiAlertTriangle, FiCamera, FiCheckCircle, FiCreditCard, FiEye, FiRefreshCw, FiUpload, FiUser } from 'react-icons/fi';
import { Button, Spinner } from './Bits';
import { detectFace, eyeOpenness, loadHuman, loadImage, readCnicNumber, similarity, snapshot, yawDegrees } from '../lib/faceKit';
import { formatCNIC } from '../lib/format';

const STEP_TIMEOUT_MS = 25000;
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

// Camera hook: starts the requested camera into a <video>, stops it on unmount
const useCamera = (facingMode, active) => {
  const videoRef = useRef(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!active) return undefined;
    let stream;
    let stopped = false;
    setReady(false);
    setError('');
    navigator.mediaDevices?.getUserMedia({ video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then((s) => {
        if (stopped) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        const v = videoRef.current;
        v.srcObject = s;
        v.onloadedmetadata = () => v.play().then(() => setReady(true)).catch(() => setReady(true));
      })
      .catch((err) => setError(err?.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in your browser settings, or upload a photo instead.' : 'No camera found. Upload a photo instead.'));
    if (!navigator.mediaDevices) setError('This browser cannot open the camera. Upload a photo instead, or open PakMedRecord in Chrome or Safari.');
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode, active]);
  return { videoRef, error, ready };
};

// Photo of a CNIC side: from the back camera, or an uploaded image
const CardShot = ({ label, onDone, optional, onSkip }) => {
  const [mode, setMode] = useState('camera');
  const { videoRef, error, ready } = useCamera('environment', mode === 'camera');
  const take = () => onDone(snapshot(videoRef.current, 1280, 0.85));
  const upload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const img = await loadImage(reader.result);
      onDone(snapshot(img, 1280, 0.85));
    };
    reader.readAsDataURL(file);
  };
  return (
    <div className="stack gap-12">
      <p className="muted" style={{ fontSize: 14 }}><span>{label}</span> <span>Lay the card flat in good light, fill the frame, and avoid glare.</span></p>
      {mode === 'camera' && !error ? (
        <div className="idc-camera card">
          <video ref={videoRef} playsInline muted />
          <div className="idc-card-guide" aria-hidden />
          {!ready && <div className="idc-overlay"><Spinner size={22} /></div>}
        </div>
      ) : error ? <p className="auth-notice"><FiAlertTriangle /> <span>{error}</span></p> : null}
      <div className="row gap-8 wrap">
        {mode === 'camera' && !error && <Button className="btn btn-primary" disabled={!ready} onClick={take}><FiCamera /> Take photo</Button>}
        <label className="btn">
          <FiUpload /> Upload photo
          <input type="file" accept="image/*" hidden onChange={(e) => { setMode('upload'); upload(e.target.files?.[0]); }} />
        </label>
        {optional && <button type="button" className="btn btn-ghost" onClick={onSkip}>Skip</button>}
      </div>
    </div>
  );
};

// The live face check: random order of "look straight / turn one way / turn the other / blink"
const LiveCheck = ({ onDone }) => {
  const { videoRef, error, ready } = useCamera('user', true);
  const [steps] = useState(() => ['center', ...shuffle(['side', 'blink']), 'other-side']);
  const [i, setI] = useState(0);
  const [hint, setHint] = useState('Loading face check…');
  const [failed, setFailed] = useState('');
  const fresh = () => ({ frames: [], real: [], live: [], first: null, sideSign: 0, held: 0, started: Date.now(), done: [], open: [], closed: false });
  const state = useRef(fresh());

  const text = {
    center: 'Look straight at the camera',
    side: 'Slowly turn your head to one side',
    'other-side': 'Now turn your head to the other side',
    blink: 'Blink your eyes',
  };

  const run = useCallback(async () => {
    const st = state.current;
    let alive = true;
    try {
      await loadHuman();
    } catch {
      setFailed('The face check could not load. Check your connection and try again.');
      return () => {};
    }
    const loop = async () => {
      if (!alive) return;
      const v = videoRef.current;
      if (v && v.readyState >= 2) {
        const r = await detectFace(v);
        const step = steps[st.done.length];
        if (!step) return;
        if (Date.now() - st.started > STEP_TIMEOUT_MS) {
          setFailed('That took too long. Make sure your face is well lit and fully in view, then try again.');
          return;
        }
        if (!r) setHint('Move your face into the oval');
        else if (r.faces > 1) setHint('Only one person should be in view');
        else if (r.face.box[2] < v.videoWidth * 0.22) setHint('Come a little closer');
        else {
          const yaw = yawDegrees(r.face);
          st.real.push(r.face.real ?? 0);
          st.live.push(r.face.live ?? 0);
          // the same person throughout
          if (st.first && r.face.embedding && (await similarity(st.first, r.face.embedding)) < 0.35) {
            setFailed('The face changed during the check. Start again, alone in front of the camera.');
            return;
          }
          let passed = false;
          const eyes = eyeOpenness(r.face);
          if (step === 'center') {
            st.held = Math.abs(yaw) < 10 ? st.held + 1 : 0;
            if (eyes != null && Math.abs(yaw) < 15) st.open.push(eyes); // this person's open-eye level
            passed = st.held >= 4;
          } else if (step === 'side') {
            if (Math.abs(yaw) > 22) { st.sideSign = Math.sign(yaw); passed = true; }
          } else if (step === 'other-side') {
            passed = Math.sign(yaw) === -st.sideSign && Math.abs(yaw) > 22;
          } else if (step === 'blink') {
            // eyes must close (well below their open level) and then open again
            const base = st.open.length ? [...st.open].sort((x, y) => x - y)[Math.floor(st.open.length / 2)] : 0.28;
            if (eyes != null && Math.abs(yaw) < 20) {
              if (eyes < base * 0.55) {
                if (!st.closed) st.closedShot = snapshot(v, 720, 0.8);
                st.closed = true;
              } else if (st.closed && eyes > base * 0.8) passed = true;
            }
          }
          setHint(text[step]);
          if (passed) {
            const shot = snapshot(v, 720, 0.8);
            if (step === 'center') {
              st.first = r.face.embedding;
              st.selfie = shot;
            }
            st.frames.push(step === 'blink' && st.closedShot ? st.closedShot : shot);
            st.done.push(step);
            st.held = 0;
            st.started = Date.now();
            setI(st.done.length);
            if (st.done.length === steps.length) {
              const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
              onDone({ selfie: st.selfie, frames: st.frames.slice(0, 4), embedding: st.first, realness: avg(st.real), liveness: avg(st.live), challenges: st.done });
              return;
            }
          }
        }
      }
      setTimeout(loop, 120);
    };
    loop();
    return () => { alive = false; };
  }, [videoRef, steps, onDone]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready || failed) return undefined;
    let cleanup = () => {};
    run().then((c) => { cleanup = c || (() => {}); });
    return () => cleanup();
  }, [ready, failed, run]);

  if (error) return <p className="auth-notice"><FiAlertTriangle /> <span>{error}</span> <span>A live camera is needed for this step.</span></p>;
  return (
    <div className="stack gap-12">
      <div className="idc-camera face">
        <video ref={videoRef} playsInline muted className="mirror" />
        <div className="idc-oval" aria-hidden />
        {!ready && <div className="idc-overlay"><Spinner size={22} /></div>}
      </div>
      <div className="idc-steps" aria-live="polite">
        {steps.map((s, n) => (
          <span key={s} className={`idc-step ${n < i ? 'done' : n === i ? 'now' : ''}`}>{n < i ? <FiCheckCircle /> : n + 1}</span>
        ))}
        <strong>{failed ? '' : hint}</strong>
      </div>
      {failed && (
        <div className="stack gap-8">
          <p className="auth-notice"><FiAlertTriangle /> {failed}</p>
          <button type="button" className="btn" onClick={() => { state.current = fresh(); setI(0); setFailed(''); }}><FiRefreshCw /> Try again</button>
        </div>
      )}
      <p className="subtle" style={{ fontSize: 12.5 }}>The check runs on your device. Only the photos you see are sent, for a person on our team to review.</p>
    </div>
  );
};

// Full capture: CNIC front (required), back (optional), live face check, then a summary.
// onSubmit({ cnicFront, cnicBack, selfie, frames, device }) -> promise
const IdentityCapture = ({ expectedCnic, onSubmit, submitLabel = 'Submit for review' }) => {
  const [step, setStep] = useState('front');
  const [front, setFront] = useState(null);
  const [back, setBack] = useState(null);
  const [cardFace, setCardFace] = useState(undefined); // undefined = checking, null = none found
  const [ocr, setOcr] = useState(null);
  const [live, setLive] = useState(null);
  const [match, setMatch] = useState(null);
  const [busy, setBusy] = useState(false);

  const gotFront = async (url) => {
    setFront(url);
    setCardFace(undefined);
    setOcr(null);
    setStep('back');
    readCnicNumber(url).then(setOcr);
    try {
      const img = await loadImage(url);
      const r = await detectFace(img);
      setCardFace(r?.face?.embedding || null);
    } catch {
      setCardFace(null);
    }
  };
  const gotLive = useCallback((result) => {
    setLive(result);
    setStep('review');
  }, []);
  useEffect(() => {
    if (live && cardFace) similarity(cardFace, live.embedding).then(setMatch);
    else if (live && cardFace === null) setMatch(null);
  }, [live, cardFace]);

  const submit = async () => {
    setBusy(true);
    try {
      await onSubmit({
        cnicFront: front, cnicBack: back || undefined, selfie: live.selfie, frames: live.frames,
        device: { faceMatch: match ?? undefined, liveness: live.liveness, realness: live.realness, challenges: live.challenges, ocrCnic: ocr || undefined },
      });
    } finally {
      setBusy(false);
    }
  };
  const restart = () => { setFront(null); setBack(null); setLive(null); setMatch(null); setStep('front'); };

  const Stage = ({ icon: Icon, title, n, on, done }) => (
    <div className={`idc-stage ${on ? 'on' : ''} ${done ? 'done' : ''}`}><span>{done ? <FiCheckCircle /> : <Icon />}</span> {n}. {title}</div>
  );
  const ocrOk = ocr && expectedCnic && ocr === String(expectedCnic);
  const matchLabel = match == null ? (cardFace === null ? 'No face found on the card photo' : 'Checking…') : match >= 0.55 ? 'Strong match' : match >= 0.42 ? 'Possible match' : 'Weak match';

  return (
    <div className="stack gap-16">
      <div className="idc-stages">
        <Stage icon={FiCreditCard} n={1} title="CNIC front" on={step === 'front'} done={Boolean(front)} />
        <Stage icon={FiCreditCard} n={2} title="CNIC back" on={step === 'back'} done={['live', 'review'].includes(step)} />
        <Stage icon={FiEye} n={3} title="Live face check" on={step === 'live'} done={Boolean(live)} />
        <Stage icon={FiUser} n={4} title="Review" on={step === 'review'} done={false} />
      </div>
      {step === 'front' && <CardShot label="Take a photo of the front of your CNIC (the side with your picture)." onDone={gotFront} />}
      {step === 'back' && <CardShot label="Now the back of your CNIC." optional onSkip={() => setStep('live')} onDone={(u) => { setBack(u); setStep('live'); }} />}
      {step === 'live' && <LiveCheck onDone={gotLive} />}
      {step === 'review' && live && (
        <div className="stack gap-16">
          <div className="idc-review">
            <figure><img src={front} alt="CNIC front" /><figcaption>CNIC</figcaption></figure>
            <figure><img src={live.selfie} alt="Live photo" /><figcaption>Live photo</figcaption></figure>
          </div>
          <div className="stack gap-8">
            <div className="summary-row"><span className="k">Live check</span><span className="row gap-8"><FiCheckCircle style={{ color: 'var(--emerald)' }} /> {live.challenges.length} steps passed</span></div>
            <div className="summary-row"><span className="k">Face vs CNIC</span><span>{matchLabel}</span></div>
            <div className="summary-row"><span className="k">CNIC number</span><span className="mono" data-no-translate>{ocr == null ? 'Reading…' : ocr ? `${formatCNIC(ocr)}${expectedCnic ? (ocrOk ? ' ✓' : ' (differs)') : ''}` : 'Could not read'}</span></div>
          </div>
          {(match != null && match < 0.42) || (ocr && expectedCnic && !ocrOk) ? (
            <p className="auth-notice"><FiAlertTriangle /> Something didn&apos;t line up. You can still submit (a person will review it), or retake the photos in better light.</p>
          ) : null}
          <div className="row gap-8 wrap">
            <Button className="btn btn-primary" loading={busy} onClick={submit}>{submitLabel}</Button>
            <button type="button" className="btn btn-ghost" onClick={restart}><FiRefreshCw /> Start again</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default IdentityCapture;
