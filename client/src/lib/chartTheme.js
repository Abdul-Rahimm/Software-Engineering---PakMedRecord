// Chart ink, grid and tooltip colours for each theme.
// Series colours (#12a877 / #8a78ff) are validated on both the light and dark chart surfaces.

export const SERIES = { a: '#12a877', b: '#8a78ff' };

export const chartColors = (theme) =>
  theme === 'dark'
    ? { surface: '#0d1526', primary: '#e8eef9', secondary: '#a3b1c6', muted: '#6b7a92', grid: 'rgba(148,197,255,0.07)', tooltipBg: 'rgba(12,20,36,0.95)', tooltipBorder: 'rgba(148,197,255,0.2)' }
    : { surface: '#ffffff', primary: '#0f172a', secondary: '#475569', muted: '#64748b', grid: 'rgba(15,23,42,0.07)', tooltipBg: 'rgba(255,255,255,0.97)', tooltipBorder: 'rgba(15,23,42,0.12)' };

export const baseChartOptions = (c) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 900, easing: 'easeOutQuart' },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: c.tooltipBg,
      borderColor: c.tooltipBorder,
      borderWidth: 1,
      titleColor: c.primary,
      bodyColor: c.secondary,
      titleFont: { family: 'Inter', weight: '600', size: 13 },
      bodyFont: { family: 'Inter', size: 12.5 },
      padding: 12,
      cornerRadius: 10,
      boxPadding: 6,
      usePointStyle: true,
    },
  },
  scales: {
    x: { grid: { display: false }, border: { display: false }, ticks: { color: c.muted, font: { family: 'JetBrains Mono', size: 11 } } },
    y: { beginAtZero: true, grid: { color: c.grid }, border: { display: false }, ticks: { color: c.muted, precision: 0, font: { family: 'JetBrains Mono', size: 11 } } },
  },
});
