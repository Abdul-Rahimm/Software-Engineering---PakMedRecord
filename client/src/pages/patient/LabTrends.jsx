import { useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js';
import { FiActivity, FiTrendingDown, FiTrendingUp } from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch } from '../../lib/data';
import { formatDate } from '../../lib/format';
import { SERIES, baseChartOptions, chartColors } from '../../lib/chartTheme';
import { useTheme } from '../../ui/Theme';
import { EmptyState, PageHeader, Skeleton } from '../../ui/Bits';
import '../dashboard.css';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip);

// "4.0-5.6", "<200", ">40" -> { low, high } for the reference band
const parseRange = (r) => {
  const s = String(r || '').replace(/,/g, '.');
  let m = s.match(/(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)/);
  if (m) return { low: Number(m[1]), high: Number(m[2]) };
  m = s.match(/^\s*[<≤]\s*=?\s*(-?\d+(?:\.\d+)?)/);
  if (m) return { high: Number(m[1]) };
  m = s.match(/^\s*[>≥]\s*=?\s*(-?\d+(?:\.\d+)?)/);
  if (m) return { low: Number(m[1]) };
  return null;
};

const TestChart = ({ test }) => {
  const { theme } = useTheme();
  const ink = useMemo(() => chartColors(theme), [theme]);
  const range = parseRange(test.range);
  const options = useMemo(() => {
    const o = baseChartOptions(ink);
    o.scales.y.beginAtZero = false;
    o.scales.y.ticks.precision = undefined;
    o.plugins.tooltip.filter = (item) => item.datasetIndex === 0;
    o.plugins.tooltip.callbacks = { label: (ctx) => ` ${ctx.parsed.y} ${test.unit}${test.points[ctx.dataIndex].flag ? ` (${test.points[ctx.dataIndex].flag})` : ''}` };
    return o;
  }, [ink, test]);
  const data = {
    labels: test.points.map((p) => formatDate(p.date, { day: 'numeric', month: 'short', year: '2-digit' })),
    datasets: [
      { data: test.points.map((p) => p.value), borderColor: SERIES.a, backgroundColor: SERIES.a, borderWidth: 2, pointRadius: 5, pointHoverRadius: 7, pointBorderColor: ink.surface, pointBorderWidth: 2, tension: 0.25 },
      ...(range?.high != null ? [{ data: test.points.map(() => range.high), borderColor: ink.muted, borderDash: [4, 4], borderWidth: 1, pointRadius: 0, label: 'Upper limit' }] : []),
      ...(range?.low != null ? [{ data: test.points.map(() => range.low), borderColor: ink.muted, borderDash: [4, 4], borderWidth: 1, pointRadius: 0, label: 'Lower limit' }] : []),
    ],
  };
  return <div className="chart-box" style={{ height: 200 }}><Line data={data} options={options} aria-label={`${test.test} over time`} /></div>;
};

const TestCard = ({ test }) => {
  const last = test.points[test.points.length - 1];
  const prev = test.points[test.points.length - 2];
  const delta = prev ? last.value - prev.value : null;
  return (
    <section className="glass card-pad stack gap-12">
      <div className="row between wrap gap-8">
        <div>
          <h3 style={{ fontSize: 17 }}>{test.test}</h3>
          <span className="subtle" style={{ fontSize: 12.5 }}>Reference {test.range || 'not given'} · {test.points.length} result{test.points.length > 1 ? 's' : ''}</span>
        </div>
        <div className="stack" style={{ alignItems: 'flex-end' }}>
          <strong style={{ fontSize: 22 }}>{last.value} <span className="subtle" style={{ fontSize: 13, fontWeight: 500 }}>{test.unit}</span></strong>
          <span className="subtle row gap-4" style={{ fontSize: 12.5 }}>
            {last.flag && <span className={`badge ${last.flag === 'H' ? 'badge-rose' : 'badge-amber'} badge-plain`}>{last.flag === 'H' ? 'Marked high' : 'Marked low'}</span>}
            {delta != null && delta !== 0 && <>{delta > 0 ? <FiTrendingUp /> : <FiTrendingDown />} {delta > 0 ? '+' : ''}{Math.round(delta * 100) / 100} since {formatDate(prev.date)}</>}
          </span>
        </div>
      </div>
      {test.points.length > 1 ? <TestChart test={test} /> : <p className="subtle" style={{ fontSize: 13 }}>One result so far ({formatDate(last.date)}). A trend appears after the next test.</p>}
    </section>
  );
};

// Lab values pulled from uploaded reports and partner labs, charted over time
export const LabTrendsView = ({ cnic }) => {
  const { data, loading } = useFetch(async () => (await api.get(`/labs/${cnic}`)).data, [cnic]);
  const [q, setQ] = useState('');
  if (loading) return <div className="grid grid-2"><Skeleton height={260} /><Skeleton height={260} /></div>;
  if (!data.tests.length) {
    return <div className="glass"><EmptyState icon={FiActivity} title="No lab values yet">Upload lab reports (PDF or photo) when submitting a record. The AI reads the values and they appear here as trends.</EmptyState></div>;
  }
  const tests = data.tests.filter((t) => !q || t.test.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="stack gap-16">
      <input className="input" style={{ maxWidth: 320 }} placeholder="Find a test, e.g. HbA1c" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a test" />
      <div className="grid grid-2">{tests.map((t) => <TestCard key={t.test} test={t} />)}</div>
      <p className="subtle" style={{ fontSize: 12.5 }}>Values were read automatically from {data.documents} document{data.documents === 1 ? '' : 's'}. Check them against the original reports, and talk to your doctor about what they mean for you.</p>
    </div>
  );
};

const LabTrends = () => {
  const { cnic } = useShell();
  return (
    <>
      <PageHeader eyebrow="Lab results" title="Lab trends" subtitle="Every test result from your uploaded reports, side by side over time." />
      <LabTrendsView cnic={cnic} />
    </>
  );
};

export default LabTrends;
