import { useState } from 'react';
import { FiX } from 'react-icons/fi';

// Type and press Enter (or comma) to add a tag; backspace on empty input removes the last one
const TagInput = ({ label, value = [], onChange, placeholder, suggestions = [] }) => {
  const [draft, setDraft] = useState('');

  const add = (raw) => {
    const t = raw.trim().replace(/,$/, '').trim();
    if (t && !value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setDraft('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const unused = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));

  return (
    <div className="field">
      {label && <span className="field-label">{label}</span>}
      <div className="tag-input" onClick={(e) => e.currentTarget.querySelector('input')?.focus()}>
        {value.map((t) => (
          <span key={t} className="tag">
            {t}
            <button type="button" onClick={() => onChange(value.filter((v) => v !== t))} aria-label={`Remove ${t}`}><FiX size={12} /></button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={onKeyDown}
          onBlur={() => draft && add(draft)}
          placeholder={value.length ? '' : placeholder}
          aria-label={label}
        />
      </div>
      {unused.length > 0 && (
        <div className="chips" style={{ gap: 6 }}>
          {unused.slice(0, 6).map((s) => (
            <button key={s} type="button" className="chip chip-sm" onClick={() => onChange([...value, s])}>+ {s}</button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TagInput;
