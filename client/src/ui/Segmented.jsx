import { motion } from 'framer-motion';

// Pill toggle with a sliding highlight
const Segmented = ({ options, value, onChange, id = 'seg' }) => (
  <div className="segmented" role="group">
    {options.map((opt) => (
      <button key={opt.value} type="button" aria-pressed={value === opt.value} onClick={() => onChange(opt.value)}>
        {value === opt.value && (
          <motion.span layoutId={`${id}-pill`} className="seg-pill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
        )}
        <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {opt.icon}
          {opt.label}
        </span>
      </button>
    ))}
  </div>
);

export default Segmented;
