import { useId } from 'react';

// Labelled form control. `as` = 'input' | 'select' | 'textarea'
const Field = ({ label, hint, error, icon: Icon, as = 'input', children, className = '', ...props }) => {
  const id = useId();
  const Control = as;
  const controlClass = as === 'select' ? 'select' : as === 'textarea' ? 'textarea' : 'input';
  return (
    <div className={`field ${className}`}>
      {label && <label className="field-label" htmlFor={id}>{label}</label>}
      <div className="input-wrap">
        {Icon && as !== 'textarea' && <Icon size={16} />}
        <Control id={id} className={controlClass} aria-invalid={error ? 'true' : undefined} {...props}>
          {children}
        </Control>
      </div>
      {error ? <span className="field-error">{error}</span> : hint && <span className="field-hint">{hint}</span>}
    </div>
  );
};

export default Field;
