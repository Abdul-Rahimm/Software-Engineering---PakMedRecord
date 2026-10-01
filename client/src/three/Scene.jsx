import { Component, Suspense, lazy } from 'react';
import { useTheme } from '../ui/Theme';

const HelixScene = lazy(() => import('./HelixScene'));
const OrbScene = lazy(() => import('./OrbScene'));

const hasWebGL = (() => {
  try {
    const c = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
})();

// Soft glowing blob shown while three.js loads, or instead of it without WebGL
const Fallback = ({ className, style }) => (
  <div className={className} style={style} aria-hidden>
    <div
      style={{
        position: 'absolute',
        inset: '20%',
        borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%, rgba(61,255,176,.55), rgba(34,211,238,.25) 45%, transparent 70%)',
        filter: 'blur(30px)',
        animation: 'float 6s ease-in-out infinite',
      }}
    />
  </div>
);

class SceneBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const SCENES = { helix: HelixScene, orb: OrbScene };

const Scene = ({ name, className, style, ...props }) => {
  const { theme } = useTheme();
  const fallback = <Fallback className={className} style={style} />;
  if (!hasWebGL) return fallback;
  const Comp = SCENES[name];
  return (
    <SceneBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Comp className={className} style={style} theme={theme} {...props} />
      </Suspense>
    </SceneBoundary>
  );
};

export default Scene;
