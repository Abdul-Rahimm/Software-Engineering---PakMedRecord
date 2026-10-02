import { useEffect, useState } from 'react';
import { FiCalendar, FiMinus, FiPlus, FiSave, FiVideo, FiX } from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { apiError, formatDate } from '../../lib/format';
import { Button, PageHeader } from '../../ui/Bits';
import { useFeedback } from '../../ui/Feedback';
import '../dashboard.css';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const DEFAULT_DAYS = [1, 2, 3, 4, 5, 6].map((day) => ({ day, start: '09:00', end: '17:00' }));

const countSlots = (blocks, len) => blocks.reduce((n, b) => {
  const [sh, sm] = b.start.split(':').map(Number);
  const [eh, em] = b.end.split(':').map(Number);
  return n + Math.max(0, Math.floor((eh * 60 + em - (sh * 60 + sm)) / len));
}, 0);

// Weekly hours (several blocks per day, e.g. morning and evening clinic), slot length, days off, video
const ClinicHours = () => {
  const { cnic, profile, reloadProfile } = useShell();
  const { toast } = useFeedback();
  const [slotMinutes, setSlot] = useState(30);
  const [blocks, setBlocks] = useState(DEFAULT_DAYS);
  const [holidays, setHolidays] = useState([]);
  const [video, setVideo] = useState(false);
  const [newHoliday, setNewHoliday] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const a = profile?.availability;
    if (!a) return;
    if (a.slotMinutes) setSlot(a.slotMinutes);
    if (a.days?.length) setBlocks(a.days.map(({ day, start, end }) => ({ day, start, end })));
    setHolidays(a.holidays || []);
    setVideo(Boolean(a.videoConsults));
  }, [profile]);

  const update = (i, patch) => setBlocks((b) => b.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const toggleDay = (day) => setBlocks((b) => (b.some((x) => x.day === day) ? b.filter((x) => x.day !== day) : [...b, { day, start: '09:00', end: '17:00' }]));

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/doctor/${cnic}/availability`, { slotMinutes, days: blocks, holidays, videoConsults: video });
      await reloadProfile();
      toast('Clinic hours saved. Patients now see these slots.');
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <PageHeader
        eyebrow="Schedule"
        title="Clinic hours"
        subtitle="Patients can only book the slots you open here. Add a second block for an evening clinic."
        actions={<Button className="btn btn-primary" loading={saving} onClick={save} disabled={!blocks.length}><FiSave /> Save hours</Button>}
      />
      <div className="grid dash-grid" style={{ alignItems: 'start' }}>
        <section className="glass card-pad-lg stack gap-12">
          {ORDER.map((day) => {
            const dayBlocks = blocks.map((b, i) => ({ ...b, i })).filter((b) => b.day === day);
            const on = dayBlocks.length > 0;
            return (
              <div key={day} className={`hours-row ${on ? '' : 'off'}`}>
                <label className="row gap-8 hours-day">
                  <input type="checkbox" className="switch" checked={on} onChange={() => toggleDay(day)} aria-label={`${DAYS[day]} open`} />
                  <strong>{DAYS[day]}</strong>
                </label>
                <div className="stack gap-8 grow">
                  {on ? dayBlocks.map((b) => (
                    <div key={b.i} className="row gap-8 wrap">
                      <input type="time" className="input" style={{ width: 130 }} value={b.start} onChange={(e) => update(b.i, { start: e.target.value })} aria-label={`${DAYS[day]} start`} />
                      <span className="subtle">to</span>
                      <input type="time" className="input" style={{ width: 130 }} value={b.end} onChange={(e) => update(b.i, { end: e.target.value })} aria-label={`${DAYS[day]} end`} />
                      {dayBlocks.length > 1 && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setBlocks((l) => l.filter((_, j) => j !== b.i))} aria-label="Remove block"><FiMinus /></button>}
                    </div>
                  )) : <span className="subtle">Closed</span>}
                  {on && dayBlocks.length < 3 && <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setBlocks((l) => [...l, { day, start: '18:00', end: '21:00' }])}><FiPlus /> Add evening block</button>}
                </div>
                {on && <span className="subtle mono" style={{ fontSize: 12 }}>{countSlots(dayBlocks, slotMinutes)} slots</span>}
              </div>
            );
          })}
        </section>
        <aside className="stack gap-20">
          <section className="glass card-pad stack gap-12">
            <h2 className="section-title">Appointment length</h2>
            <div className="chips">{[10, 15, 20, 30, 45, 60].map((m) => <button key={m} className="chip" aria-pressed={slotMinutes === m} onClick={() => setSlot(m)}>{m} min</button>)}</div>
          </section>
          <section className="glass card-pad stack gap-12">
            <label className="row between gap-12">
              <span className="row gap-8"><FiVideo /> <strong>Video consultations</strong></span>
              <input type="checkbox" className="switch" checked={video} onChange={(e) => setVideo(e.target.checked)} />
            </label>
            <p className="subtle" style={{ fontSize: 13 }}>Patients can choose a video visit for any open slot. You join from your Appointments page.</p>
          </section>
          <section className="glass card-pad stack gap-12">
            <h2 className="section-title row gap-8"><FiCalendar /> Days off</h2>
            <div className="row gap-8">
              <input type="date" className="input" min={today} value={newHoliday} onChange={(e) => setNewHoliday(e.target.value)} aria-label="Day off" />
              <button className="btn" disabled={!newHoliday} onClick={() => { setHolidays((h) => [...new Set([...h, newHoliday])].sort()); setNewHoliday(''); }}><FiPlus /> Add</button>
            </div>
            <div className="chips">
              {holidays.filter((h) => h >= today).map((h) => (
                <span key={h} className="chip" style={{ cursor: 'default' }}>{formatDate(h)} <button className="btn btn-ghost btn-icon btn-sm" style={{ width: 22, height: 22 }} onClick={() => setHolidays((l) => l.filter((x) => x !== h))} aria-label="Remove day off"><FiX size={12} /></button></span>
              ))}
              {!holidays.some((h) => h >= today) && <span className="subtle" style={{ fontSize: 13 }}>No upcoming days off.</span>}
            </div>
            <p className="subtle" style={{ fontSize: 12.5 }}>Existing bookings on a day off are not cancelled automatically.</p>
          </section>
        </aside>
      </div>
    </>
  );
};

export default ClinicHours;
