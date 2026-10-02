// "14:30" -> "2:30 PM"
const formatTime = (time) => {
  const [h, m] = String(time ?? '').split(':').map(Number);
  if (Number.isNaN(h)) return time ?? '';
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

module.exports = { formatTime };
