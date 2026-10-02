import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FiExternalLink, FiMic, FiMicOff, FiPhoneOff, FiSave, FiVideo, FiVideoOff } from 'react-icons/fi';
import api from '../../api';
import { getSession } from '../../session';
import Logo from '../../ui/Logo';
import { Button, EmptyState, Spinner } from '../../ui/Bits';
import { useFeedback } from '../../ui/Feedback';
import { apiError, formatTime } from '../../lib/format';
import './visit.css';

const POLL_MS = 1000;

// One-to-one video visit. Media flows directly between the two browsers (WebRTC);
// the server only relays connection set-up messages. The doctor places the call.
const VideoVisit = () => {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { toast } = useFeedback();
  const session = getSession();
  const role = session?.role;
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('starting'); // starting | waiting | connecting | connected | left | ended
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const stream = useRef(null);
  const pc = useRef(null);
  const pendingIce = useRef([]);
  const lastId = useRef(null);
  const stopped = useRef(false);

  const signal = useCallback((kind, data) => api.post(`/calls/${appointmentId}/signal`, { kind, data }).catch(() => {}), [appointmentId]);

  // Each offer starts a new "generation"; answers and network candidates from older ones are ignored
  const gen = useRef(null);

  const newPeer = useCallback((iceServers, generation) => {
    pc.current?.close();
    pendingIce.current = [];
    gen.current = generation;
    const peer = new RTCPeerConnection({ iceServers });
    stream.current?.getTracks().forEach((t) => peer.addTrack(t, stream.current));
    peer.ontrack = (e) => { if (remoteRef.current) remoteRef.current.srcObject = e.streams[0]; };
    peer.onicecandidate = (e) => e.candidate && signal('ice', { gen: generation, candidate: e.candidate.toJSON() });
    peer.onconnectionstatechange = () => {
      if (pc.current !== peer) return;
      if (peer.connectionState === 'connected') setStatus('connected');
      if (['failed', 'disconnected'].includes(peer.connectionState)) setStatus('connecting');
    };
    pc.current = peer;
    setStatus('connecting');
    return peer;
  }, [signal]);

  const flushIce = async () => {
    for (const c of pendingIce.current.splice(0)) await pc.current?.addIceCandidate(c).catch(() => {});
  };

  // One poll's worth of messages. Only the newest hello / offer matters; older ones are stale.
  const handleBatch = useCallback(async (messages, iceServers) => {
    const lastIndex = (kind) => messages.map((m) => m.kind).lastIndexOf(kind);
    const lastHello = lastIndex('hello');
    const lastOffer = lastIndex('offer');
    for (const [i, m] of messages.entries()) {
      if (m.kind === 'hello' && i === lastHello) {
        if (role === 'doctor') {
          if (pc.current && ['connected', 'connecting'].includes(pc.current.connectionState) && i < messages.length - 1) continue;
          const generation = Math.random().toString(36).slice(2);
          const peer = newPeer(iceServers, generation);
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          signal('offer', { gen: generation, type: offer.type, sdp: offer.sdp });
        } else if (!pc.current || pc.current.connectionState !== 'connected') {
          signal('hello'); // the doctor (re)joined: let them call us
        }
      } else if (m.kind === 'offer' && role === 'patient' && i === lastOffer && m.data?.gen !== gen.current) {
        const peer = newPeer(iceServers, m.data.gen);
        await peer.setRemoteDescription({ type: m.data.type, sdp: m.data.sdp });
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        signal('answer', { gen: m.data.gen, type: answer.type, sdp: answer.sdp });
        await flushIce();
      } else if (m.kind === 'answer' && role === 'doctor' && m.data?.gen === gen.current && pc.current && !pc.current.currentRemoteDescription) {
        await pc.current.setRemoteDescription({ type: m.data.type, sdp: m.data.sdp });
        await flushIce();
      } else if (m.kind === 'ice' && m.data?.gen === gen.current) {
        if (pc.current?.remoteDescription) await pc.current.addIceCandidate(m.data.candidate).catch(() => {});
        else pendingIce.current.push(m.data.candidate);
      } else if (m.kind === 'bye') {
        pc.current?.close();
        pc.current = null;
        gen.current = null;
        if (remoteRef.current) remoteRef.current.srcObject = null;
        setStatus('left');
      }
    }
  }, [role, newPeer, signal]);

  useEffect(() => {
    if (!['doctor', 'patient'].includes(role)) return undefined;
    let timer;
    let alive = true; // per mount, so a remount (React StrictMode) starts cleanly
    stopped.current = false;
    lastId.current = null;
    (async () => {
      try {
        const { data } = await api.get(`/calls/${appointmentId}`);
        if (!alive) return;
        setInfo(data);
        let media;
        try {
          media = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true });
        } catch {
          media = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
          setCam(false);
          if (!media) toast('Camera and microphone are blocked. Allow them in your browser settings.', 'error');
        }
        if (!alive) {
          media?.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = media;
        if (localRef.current && stream.current) localRef.current.srcObject = stream.current;
        setStatus('waiting');
        await signal('hello');
        const poll = async () => {
          if (!alive || stopped.current) return;
          try {
            const res = await api.get(`/calls/${appointmentId}/signal`, { params: lastId.current ? { after: lastId.current } : {} });
            const { messages } = res.data;
            if (messages.length) {
              lastId.current = messages[messages.length - 1].id;
              await handleBatch(messages, data.iceServers);
            }
          } catch { /* keep polling */ }
          if (alive) timer = setTimeout(poll, POLL_MS);
        };
        poll();
      } catch (err) {
        setError(apiError(err, 'This visit is not available'));
      }
    })();
    const leave = () => signal('bye');
    window.addEventListener('beforeunload', leave);
    return () => {
      alive = false;
      clearTimeout(timer);
      window.removeEventListener('beforeunload', leave);
      pc.current?.close();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, [appointmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (kind) => {
    const tracks = kind === 'audio' ? stream.current?.getAudioTracks() : stream.current?.getVideoTracks();
    tracks?.forEach((t) => { t.enabled = !t.enabled; });
    if (kind === 'audio') setMic((m) => !m);
    else setCam((c) => !c);
  };

  const hangUp = async () => {
    await signal('bye');
    stopped.current = true;
    pc.current?.close();
    stream.current?.getTracks().forEach((t) => t.stop());
    setStatus('ended');
  };

  const saveNotes = async (complete) => {
    setSaving(true);
    try {
      if (notes.trim()) {
        await api.post('/record/create', { patientCNIC: info.patient.patientCNIC, title: 'Video consultation', category: 'General', recordData: notes.trim() });
      }
      if (complete) await api.patch(`/appointments/update/${appointmentId}`);
      toast(complete ? 'Notes saved and visit completed' : 'Notes saved to the patient record');
      if (complete) navigate(`/appointments/fetch/${session.cnic}`);
      else setNotes('');
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!['doctor', 'patient'].includes(role)) return <div className="visit"><EmptyState title="Please sign in" action={<Link to="/" className="btn">Home</Link>} /></div>;
  if (error) return <div className="visit"><div className="glass card-pad-lg"><EmptyState icon={FiVideoOff} title="Can't open this visit" action={<button className="btn" onClick={() => navigate(-1)}>Go back</button>}>{error}</EmptyState></div></div>;

  const other = role === 'doctor' ? (info?.patient ? `${info.patient.firstName} ${info.patient.lastName}` : 'the patient') : (info?.doctor ? `Dr. ${info.doctor.firstName} ${info.doctor.lastName}` : 'your doctor');
  const STATUS_TEXT = {
    starting: 'Starting camera…',
    waiting: `Waiting for ${other} to join…`,
    connecting: 'Connecting…',
    connected: '',
    left: `${other} left the call. They can rejoin from their appointments.`,
    ended: 'You left the call.',
  };

  return (
    <div className={`visit ${role === 'doctor' ? 'with-notes' : ''}`}>
      <header className="visit-head">
        <Logo size={26} />
        <div className="stack" style={{ textAlign: 'center' }}>
          <strong>Video visit with {other}</strong>
          {info && <span className="subtle" style={{ fontSize: 12.5 }}>{new Date(info.appointment.date).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })} · {formatTime(info.appointment.time)}</span>}
        </div>
        {info && <a className="btn btn-ghost btn-sm" href={info.fallbackUrl} target="_blank" rel="noreferrer" title="Use if the call won't connect on your network"><FiExternalLink /> Backup link</a>}
      </header>
      <div className="visit-body">
        <div className="visit-stage">
          <video ref={remoteRef} className="visit-remote" autoPlay playsInline />
          {status !== 'connected' && <div className="visit-status">{['starting', 'connecting', 'waiting'].includes(status) && <Spinner size={22} />}<span>{STATUS_TEXT[status]}</span></div>}
          <video ref={localRef} className={`visit-local ${cam ? '' : 'off'}`} autoPlay playsInline muted />
          {status !== 'ended' && (
            <div className="visit-controls">
              <button className={`round ${mic ? '' : 'off'}`} onClick={() => toggle('audio')} aria-label={mic ? 'Mute' : 'Unmute'}>{mic ? <FiMic /> : <FiMicOff />}</button>
              <button className={`round ${cam ? '' : 'off'}`} onClick={() => toggle('video')} aria-label={cam ? 'Turn camera off' : 'Turn camera on'}>{cam ? <FiVideo /> : <FiVideoOff />}</button>
              <button className="round hang" onClick={hangUp} aria-label="Leave call"><FiPhoneOff /></button>
            </div>
          )}
          {status === 'ended' && role === 'patient' && <div className="visit-controls"><Link className="btn btn-primary" to={`/appointments/mine/${session.cnic}`}>Back to appointments</Link></div>}
        </div>
        {role === 'doctor' && (
          <aside className="visit-notes glass">
            <strong>Consultation notes</strong>
            <span className="subtle" style={{ fontSize: 12.5 }}>Saved to the patient&apos;s record as &ldquo;Video consultation&rdquo;.</span>
            <textarea className="textarea grow" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="History, findings, advice, follow-up…" />
            <div className="row gap-8 wrap">
              <Button className="btn" loading={saving} disabled={!notes.trim()} onClick={() => saveNotes(false)}><FiSave /> Save notes</Button>
              <Button className="btn btn-primary" loading={saving} onClick={() => saveNotes(true)}>Save & complete visit</Button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default VideoVisit;
