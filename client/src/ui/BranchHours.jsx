import { useEffect, useState } from 'react';
import { FiMinus, FiPlus, FiVideo } from 'react-icons/fi';
import { Button } from './Bits';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

// A doctor's weekly hours at a hospital, per branch: [{ facilityId, day, start, end }], slot length, video.
// facilities: the branches this doctor works at. onSave(availability) returns a promise.
const BranchHours = ({ facilities, value, onSave, saving }) => {
  const [slotMinutes, setSlot] = useState(30);
  const [blocks, setBlocks] = useState([]);
  const [video, setVideo] = useState(false);
  const [holidays, setHolidays] = useState([]);

  useEffect(() => {
    setSlot(value?.slotMinutes || 30);
    setBlocks((value?.blocks || []).map(({ facilityId, day, start, end }) => ({ facilityId: String(facilityId), day, start, end })));
    setVideo(Boolean(value?.videoConsults));
    setHolidays(value?.holidays || []);
  }, [value]);

  const update = (i, patch) => setBlocks((b) => b.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addWeekdays = (fid) => setBlocks((b) => [...b.filter((x) => x.facilityId !== fid), ...[1, 2, 3, 4, 5, 6].map((day) => ({ facilityId: fid, day, start: '09:00', end: '17:00' }))]);

  return (
    <div className="stack gap-16">
      {facilities.map((f) => {
        const mine = blocks.map((b, i) => ({ ...b, i })).filter((b) => b.facilityId === String(f._id)).sort((a, b) => ORDER.indexOf(a.day) - ORDER.indexOf(b.day) || a.start.localeCompare(b.start));
        return (
          <div key={f._id} className="stack gap-8 branch-hours">
            <div className="row between wrap gap-8">
              <strong data-no-translate>{f.name}{f.city ? <span className="subtle" style={{ fontWeight: 400 }}> · {f.city}</span> : null}</strong>
              <div className="row gap-4">
                {!mine.length && <button type="button" className="btn btn-ghost btn-sm" onClick={() => addWeekdays(String(f._id))}>Mon–Sat 9–5</button>}
                <button type="button" className="btn btn-sm" onClick={() => setBlocks((b) => [...b, { facilityId: String(f._id), day: 1, start: '09:00', end: '13:00' }])}><FiPlus /> Add hours</button>
              </div>
            </div>
            {!mine.length ? <span className="subtle" style={{ fontSize: 13 }}>No hours here, so patients can&apos;t book at this branch.</span> : mine.map((b) => (
              <div key={b.i} className="row gap-8 wrap">
                <select className="select" style={{ width: 90 }} value={b.day} onChange={(e) => update(b.i, { day: Number(e.target.value) })} aria-label="Day">
                  {ORDER.map((d) => <option key={d} value={d}>{DAYS[d]}</option>)}
                </select>
                <input type="time" className="input" style={{ width: 120 }} value={b.start} onChange={(e) => update(b.i, { start: e.target.value })} aria-label="Start" />
                <span className="subtle">to</span>
                <input type="time" className="input" style={{ width: 120 }} value={b.end} onChange={(e) => update(b.i, { end: e.target.value })} aria-label="End" />
                <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setBlocks((l) => l.filter((_, j) => j !== b.i))} aria-label="Remove hours"><FiMinus /></button>
              </div>
            ))}
          </div>
        );
      })}
      <div className="field">
        <span className="field-label">Appointment length</span>
        <div className="chips">{[10, 15, 20, 30, 45, 60].map((m) => <button type="button" key={m} className="chip" aria-pressed={slotMinutes === m} onClick={() => setSlot(m)}>{m} min</button>)}</div>
      </div>
      <label className="row between gap-12">
        <span className="row gap-8"><FiVideo /> Video consultations here</span>
        <input type="checkbox" className="switch" checked={video} onChange={(e) => setVideo(e.target.checked)} />
      </label>
      <Button className="btn btn-primary" loading={saving} onClick={() => onSave({ slotMinutes, blocks, videoConsults: video, holidays })}>Save hours</Button>
    </div>
  );
};

export default BranchHours;
