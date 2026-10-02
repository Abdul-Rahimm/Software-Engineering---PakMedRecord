import { useState } from 'react';
import api from '../api';
import { useFetch } from '../lib/data';
import { Skeleton } from './Bits';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const rs = (n) => `Rs ${Number(n || 0).toLocaleString('en-PK')}`;
const pct = (n) => (n == null ? '—' : `${n}%`);

// Business numbers from /analytics: no-shows, revenue, returning patients, busiest hours
const PracticeStats = ({ path, title = 'Practice performance', extra }) => {
  const [days, setDays] = useState(90);
  const { data, loading } = useFetch(async () => (await api.get(path, { params: { days } })).data, [path, days]);
  const hours = data?.hours.map((n, h) => ({ h, n })).filter((x) => x.n) || [];
  const maxH = Math.max(1, ...hours.map((x) => x.n));
  const maxW = Math.max(1, ...(data?.weekdays || [0]));
  return (
    <section className="glass card-pad-lg stack gap-20">
      <div className="row between wrap gap-12">
        <h2 className="section-title">{title}</h2>
        <div className="chips">{[30, 90, 365].map((d) => <button key={d} className="chip" aria-pressed={days === d} onClick={() => setDays(d)}>{d === 365 ? '12 months' : `${d} days`}</button>)}</div>
      </div>
      {loading || !data ? <Skeleton height={200} /> : (
        <>
          <div className="kpi-grid">
            <div className="kpi"><span>Completed visits</span><strong>{data.completed}</strong></div>
            <div className="kpi"><span>No-show rate</span><strong>{pct(data.noShowRate)}</strong><em>{data.noShows} missed</em></div>
            <div className="kpi"><span>Cancellation rate</span><strong>{pct(data.cancellationRate)}</strong></div>
            <div className="kpi"><span>Patients seen</span><strong>{data.patients}</strong></div>
            <div className="kpi"><span>Returning patients</span><strong>{pct(data.returnRate)}</strong><em>{data.returningPatients} came back</em></div>
            <div className="kpi"><span>Fees collected</span><strong>{rs(data.revenue)}</strong>{data.outstanding > 0 && <em>{rs(data.outstanding)} unpaid</em>}</div>
            <div className="kpi"><span>Video visits</span><strong>{data.videoVisits}</strong></div>
            <div className="kpi"><span>Upcoming</span><strong>{data.upcoming}</strong></div>
          </div>
          <div className="grid grid-2">
            <div className="stack gap-8">
              <span className="field-label">Busiest hours</span>
              {hours.length ? hours.map(({ h, n }) => (
                <div key={h} className="hbar"><span className="mono">{String(h).padStart(2, '0')}:00</span><div><i style={{ width: `${(n / maxH) * 100}%` }} /></div><b>{n}</b></div>
              )) : <span className="subtle">No visits yet.</span>}
            </div>
            <div className="stack gap-8">
              <span className="field-label">Busiest days</span>
              {data.weekdays.map((n, d) => (
                <div key={d} className="hbar"><span>{WEEKDAYS[d]}</span><div><i style={{ width: `${(n / maxW) * 100}%` }} /></div><b>{n}</b></div>
              ))}
            </div>
          </div>
          {extra?.(data)}
        </>
      )}
    </section>
  );
};

export default PracticeStats;
