import { useRef } from 'react';

// Card that tilts in 3D toward the cursor, with a moving glare highlight
const TiltCard = ({ as: Tag = 'div', max = 8, className = '', children, style, ...rest }) => {
  const ref = useRef(null);
  const frame = useRef(0);

  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.transform = `perspective(1000px) rotateX(${(0.5 - py) * max}deg) rotateY(${(px - 0.5) * max}deg) translateZ(0)`;
      el.style.setProperty('--gx', `${px * 100}%`);
      el.style.setProperty('--gy', `${py * 100}%`);
    });
  };

  const onLeave = () => {
    cancelAnimationFrame(frame.current);
    if (ref.current) ref.current.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
  };

  return (
    <Tag ref={ref} className={`glass tilt ${className}`} onMouseMove={onMove} onMouseLeave={onLeave} style={style} {...rest}>
      <span className="tilt-glare" aria-hidden />
      {children}
    </Tag>
  );
};

export default TiltCard;
