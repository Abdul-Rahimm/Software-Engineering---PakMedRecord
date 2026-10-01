import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, BarElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip, Legend,
} from 'chart.js';
import { FiActivity, FiBarChart2, FiCalendar, FiCheckCircle, FiClock, FiTable } from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useTheme } from '../../ui/Theme';
import { SERIES as SERIES_COLORS, baseChartOptions, chartColors } from '../../lib/chartTheme';
import { useFetch } from '../../lib/data';
import { apptDay, formatTime } from '../../lib/format';
import { CountUp, EmptyState, PageHeader, Skeleton, rise, stagger } from '../../ui/Bits';
import TiltCard from '../../ui/TiltCard';
import '../dashboard.css';

ChartJS.register(BarElement, CategoryScale, LinearScale, LineElement, PointElement, Filler, Tooltip, Legend);

// Series colours validated for CVD separation, lightness band and contrast on both chart surfaces
const SERIES = { completed: SERIES_COLORS.a, upcoming: SERIES_COLORS.b };
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const Legend2 = () => (
  <div className="row gap-16" style={{ fontSize: 13, color: 'var(--text-2)' }}>
    <span className="row gap-8"><span style={{ width: 10, height: 10, borderRadius: 3, background: SERIES.completed }} /> Completed</span>
    <span className="row gap-8"><span style={{ width: 10, height: 10, borderRadius: 3, background: SERIES.upcoming }} /> Upcoming</span>
  </div>
);

const Insights = () => {
  const { cnic } = useShell();
  const { theme } = useTheme();
  const ink = useMemo(() => chartColors(theme), [theme]);
  const baseOptions = useMemo(() => baseChartOptions(ink), [ink]);
  const SURFACE = ink.surface;
  const [tableView, setTableView] = useState(false);
  const { data: appts, loading } = useFetch(
    // cancelled visits don't count towards clinic load
    async () => (await api.get(`/appointments/fetch/${cnic}`)).data.appointments.filter((a) => a.status !== 'cancelled'),
    [cnic]
  );

  const stats = useMemo(() => {
    if (!appts) return null;
    const byDay = DAYS.map(() => ({ completed: 0, upcoming: 0 }));
    const byHour = {};
    const trend = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const trendDays = [];
    for (let i = -15; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      trendDays.push(d);
      trend[d.toDateString()] = 0;
    }

    appts.forEach((a) => {
      const d = apptDay(a.date);
      const dow = (d.getDay() + 6) % 7; // Monday first
      byDay[dow][a.status === 'completed' ? 'completed' : 'upcoming'] += 1;
      const hour = String(a.time).split(':')[0].padStart(2, '0');
      byHour[hour] = (byHour[hour] || 0) + 1;
      if (d.toDateString() in trend) trend[d.toDateString()] += 1;
    });

    const total = appts.length;
    const completed = appts.filter((a) => a.status === 'completed').length;
    const dayTotals = byDay.map((d) => d.completed + d.upcoming);
    const busiest = total ? DAYS[dayTotals.indexOf(Math.max(...dayTotals))] : '—';
    const hours = Object.keys(byHour).sort();
    const peakHour = hours.length ? hours.reduce((a, b) => (byHour[b] > byHour[a] ? b : a)) : null;

    return { total, completed, byDay, byHour, hours, busiest, peakHour, trend, trendDays, rate: total ? Math.round((completed / total) * 100) : 0 };
  }, [appts]);

  const tiles = stats && [
    { label: 'Total appointments', value: <CountUp value={stats.total} />, icon: FiCalendar },
    { label: 'Completion rate', value: <><CountUp value={stats.rate} />%</>, icon: FiCheckCircle },
    { label: 'Busiest day', value: stats.busiest, icon: FiActivity },
    { label: 'Peak hour', value: stats.peakHour ? formatTime(`${stats.peakHour}:00`) : '—', icon: FiClock },
  ];

  const weekdayData = stats && {
    labels: DAYS,
    datasets: [
      { label: 'Completed', data: stats.byDay.map((d) => d.completed), backgroundColor: SERIES.completed, borderColor: SURFACE, borderWidth: { top: 2 }, borderRadius: 4, borderSkipped: 'bottom', maxBarThickness: 34, stack: 's' },
      { label: 'Upcoming', data: stats.byDay.map((d) => d.upcoming), backgroundColor: SERIES.upcoming, borderColor: SURFACE, borderWidth: { top: 2 }, borderRadius: 4, borderSkipped: 'bottom', maxBarThickness: 34, stack: 's' },
    ],
  };

  const hourLabels = stats?.hours.map((h) => formatTime(`${h}:00`).replace(':00', '')) ?? [];
  const hourData = stats && {
    labels: hourLabels,
    datasets: [{ label: 'Appointments', data: stats.hours.map((h) => stats.byHour[h]), backgroundColor: SERIES.completed, borderRadius: 4, borderSkipped: 'bottom', maxBarThickness: 34 }],
  };

  const trendData = stats && {
    labels: stats.trendDays.map((d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })),
    datasets: [{
      label: 'Appointments',
      data: stats.trendDays.map((d) => stats.trend[d.toDateString()]),
      borderColor: SERIES.completed,
      borderWidth: 2,
      tension: 0.35,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: SERIES.completed,
      pointHoverBorderColor: SURFACE,
      pointHoverBorderWidth: 2,
      fill: true,
      backgroundColor: (ctx) => {
        const { chart } = ctx;
        if (!chart.chartArea) return 'transparent';
        const g = chart.ctx.createLinearGradient(0, chart.chartArea.top, 0, chart.chartArea.bottom);
        g.addColorStop(0, 'rgba(18,168,119,0.28)');
        g.addColorStop(1, 'rgba(18,168,119,0)');
        return g;
      },
    }],
  };

  const stackedOptions = {
    ...baseOptions,
    plugins: { ...baseOptions.plugins, tooltip: { ...baseOptions.plugins.tooltip, mode: 'index', intersect: false } },
    scales: { ...baseOptions.scales, x: { ...baseOptions.scales.x, stacked: true }, y: { ...baseOptions.scales.y, stacked: true } },
  };
  const lineOptions = {
    ...baseOptions,
    interaction: { mode: 'index', intersect: false },
    plugins: { ...baseOptions.plugins, tooltip: { ...baseOptions.plugins.tooltip, mode: 'index', intersect: false } },
    scales: { ...baseOptions.scales, x: { ...baseOptions.scales.x, ticks: { ...baseOptions.scales.x.ticks, maxTicksLimit: 8 } } },
  };

  return (
    <>
      <PageHeader
        eyebrow="Analytics"
        title="Clinic insights"
        subtitle="When your patients book, and how your schedule is trending."
        actions={stats?.total ? (
          <button className="btn" onClick={() => setTableView((t) => !t)} aria-pressed={tableView}>
            {tableView ? <><FiBarChart2 /> Charts</> : <><FiTable /> Table view</>}
          </button>
        ) : null}
      />

      {loading ? (
        <div className="stack gap-20"><div className="grid grid-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={130} />)}</div><Skeleton height={340} /></div>
      ) : stats.total === 0 ? (
        <div className="glass"><EmptyState icon={FiBarChart2} title="No data yet">Insights appear once patients start booking appointments with you.</EmptyState></div>
      ) : (
        <div className="stack gap-24">
          <motion.div className="grid grid-4" variants={stagger} initial="hidden" animate="show">
            {tiles.map((t) => (
              <motion.div key={t.label} variants={rise}>
                <TiltCard className="stat card-pad">
                  <span className="stat-icon depth-1"><t.icon size={20} /></span>
                  <div className="stat-value depth-2" style={{ fontSize: 36 }}>{t.value}</div>
                  <div className="stat-label">{t.label}</div>
                </TiltCard>
              </motion.div>
            ))}
          </motion.div>

          {tableView ? (
            <div className="glass card-pad">
              <h2 className="section-title" style={{ marginBottom: 12 }}>Appointments by weekday</h2>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Day</th><th>Completed</th><th>Upcoming</th><th>Total</th></tr></thead>
                  <tbody>
                    {DAYS.map((d, i) => (
                      <tr key={d}><td>{d}</td><td className="mono">{stats.byDay[i].completed}</td><td className="mono">{stats.byDay[i].upcoming}</td><td className="mono">{stats.byDay[i].completed + stats.byDay[i].upcoming}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h2 className="section-title" style={{ margin: '28px 0 12px' }}>Appointments by hour</h2>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Hour</th><th>Appointments</th></tr></thead>
                  <tbody>{stats.hours.map((h, i) => <tr key={h}><td>{hourLabels[i]}</td><td className="mono">{stats.byHour[h]}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          ) : (
            <>
              <div className="grid dash-grid">
                <section className="glass card-pad chart-card">
                  <div className="row between wrap gap-12">
                    <h2 className="section-title">Appointments by weekday</h2>
                    <Legend2 />
                  </div>
                  <div className="chart-box"><Bar data={weekdayData} options={stackedOptions} aria-label="Stacked bar chart of completed and upcoming appointments per weekday" /></div>
                </section>
                <section className="glass card-pad chart-card">
                  <h2 className="section-title">By time of day</h2>
                  <div className="chart-box"><Bar data={hourData} options={baseOptions} aria-label="Bar chart of appointments per hour" /></div>
                </section>
              </div>
              <section className="glass card-pad chart-card">
                <div className="row between wrap gap-12">
                  <h2 className="section-title">Appointments per day</h2>
                  <span className="subtle" style={{ fontSize: 13 }}>Last 15 days and next 14</span>
                </div>
                <div className="chart-box"><Line data={trendData} options={lineOptions} aria-label="Line chart of appointments per day" /></div>
              </section>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default Insights;
