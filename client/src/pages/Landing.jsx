import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  FiArrowRight, FiBarChart2, FiCalendar, FiCheckCircle, FiEdit3, FiFileText,
  FiLock, FiShield, FiUserCheck, FiUsers, FiZap,
} from 'react-icons/fi';
import Logo from '../ui/Logo';
import TiltCard from '../ui/TiltCard';
import Scene from '../three/Scene';
import './landing.css';

const features = [
  { icon: FiFileText, title: 'One lifelong record', text: 'Every diagnosis, prescription and report in one timeline that follows you from Ziauddin to Aga Khan and beyond.' },
  { icon: FiUserCheck, title: 'Doctor-verified', text: 'Records you upload stay pending until your doctor reviews them, so your history is something clinicians can trust.' },
  { icon: FiCalendar, title: 'Instant booking', text: 'Pick a doctor from your care team, choose a slot, done. Doctors see it immediately in their queue.' },
  { icon: FiUsers, title: 'Your care team', text: 'Link the doctors you trust. Only they can open your records, and you can remove access at any time.' },
  { icon: FiEdit3, title: 'Private notes', text: 'Jot down symptoms, questions for your next visit or medication reminders. Visible only to you.' },
  { icon: FiBarChart2, title: 'Clinic insights', text: 'Doctors get live analytics on appointment load by weekday and time slot to plan their clinic.' },
];

const steps = [
  { n: '01', title: 'Create your account', text: 'Sign up with your CNIC. It becomes your universal health ID across every hospital.' },
  { n: '02', title: 'Build your care team', text: 'Find your doctors and link them. Access is granted per doctor, never to everyone.' },
  { n: '03', title: 'Carry your history', text: 'Records, appointments and approvals live in one place, ready for any doctor you visit.' },
];

const reveal = {
  hidden: { opacity: 0, y: 40, rotateX: -10 },
  show: (i = 0) => ({ opacity: 1, y: 0, rotateX: 0, transition: { delay: i * 0.08, type: 'spring', stiffness: 160, damping: 22 } }),
};

const FloatingCard = ({ className, delay, children }) => (
  <motion.div
    className={`float-pos ${className}`}
    initial={{ opacity: 0, scale: 0.7, y: 30 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    transition={{ delay, type: 'spring', stiffness: 120, damping: 18 }}
  >
    <div className="glass float-card">{children}</div>
  </motion.div>
);

const Landing = () => {
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, 120]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0.2]);

  return (
    <div className="landing">
      <motion.nav className="land-nav glass" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 20 }}>
        <Logo />
        <div className="land-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#security">Security</a>
        </div>
        <div className="row gap-8">
          <Link to="/doctor/signin" className="btn btn-ghost hide-sm">Doctor sign in</Link>
          <Link to="/patient/signin" className="btn btn-primary">Patient sign in</Link>
        </div>
      </motion.nav>

      {/* Hero */}
      <section className="hero">
        <motion.div className="hero-scene" style={{ y: heroY, opacity: heroOpacity }}>
          <Scene name="helix" className="scene-fill" />
          <FloatingCard className="fc-1" delay={0.9}>
            <div className="row gap-12">
              <span className="fc-icon"><FiCheckCircle /></span>
              <div>
                <div className="fc-title">Record approved</div>
                <div className="fc-sub">Dr. Ayesha Khan · Aga Khan</div>
              </div>
            </div>
          </FloatingCard>
          <FloatingCard className="fc-2" delay={1.1}>
            <div className="fc-sub">Next appointment</div>
            <div className="fc-big">Mon · 10:00 AM</div>
          </FloatingCard>
          <FloatingCard className="fc-3" delay={1.3}>
            <div className="row gap-8"><span className="badge badge-rose">Allergy</span><span className="fc-title">Penicillin</span></div>
          </FloatingCard>
        </motion.div>

        <div className="hero-copy">
          <motion.span className="eyebrow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            Pakistan&apos;s unified health record
          </motion.span>
          <motion.h1 initial={{ opacity: 0, y: 30, rotateX: -30 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 0.2, type: 'spring', stiffness: 100, damping: 18 }}>
            Your medical history.
            <br />
            <span className="grad-text">Every hospital.</span>
            <br />
            One record.
          </motion.h1>
          <motion.p className="hero-sub" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            Reports get lost. Files stay behind at the last hospital. PakMedRecord gives every patient a single,
            doctor-verified record that travels with them, wherever they&apos;re treated.
          </motion.p>
          <motion.div className="row gap-12 wrap" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
            <Link to="/patient/signup" className="btn btn-primary btn-lg">
              Create patient account <FiArrowRight />
            </Link>
            <Link to="/doctor/signup" className="btn btn-lg">I&apos;m a doctor</Link>
          </motion.div>
          <motion.div className="hero-trust" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
            <span><FiLock /> Encrypted passwords</span>
            <span><FiShield /> Doctor-gated access</span>
            <span><FiZap /> Instant approvals</span>
          </motion.div>
        </div>
      </section>

      {/* Problem */}
      <section className="land-section">
        <motion.div className="glass problem" variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }}>
          <span className="eyebrow">The problem</span>
          <h2>
            Every hospital keeps its own file. <span className="muted">Patients pay the price, re-explaining allergies, repeating tests,
            and losing reports between visits.</span>
          </h2>
        </motion.div>
      </section>

      {/* Features */}
      <section className="land-section" id="features">
        <motion.div className="section-head" variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true }}>
          <span className="eyebrow">Features</span>
          <h2>Built for patients. <span className="grad-text">Trusted by doctors.</span></h2>
        </motion.div>
        <div className="grid grid-3 feature-grid">
          {features.map((f, i) => (
            <motion.div key={f.title} custom={i} variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}>
              <TiltCard className="feature card-pad-lg" max={12}>
                <div className="feature-icon depth-2"><f.icon size={22} /></div>
                <h3 className="depth-1">{f.title}</h3>
                <p className="muted depth-1">{f.text}</p>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="land-section" id="how">
        <motion.div className="section-head" variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true }}>
          <span className="eyebrow">How it works</span>
          <h2>Three steps to a record that follows you.</h2>
        </motion.div>
        <div className="steps">
          {steps.map((s, i) => (
            <motion.div key={s.n} className="step" custom={i} variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.5 }}>
              <div className="step-n">{s.n}</div>
              <h3>{s.title}</h3>
              <p className="muted">{s.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Security */}
      <section className="land-section" id="security">
        <div className="security glass">
          <div className="security-scene">
            <Scene name="orb" className="scene-fill" />
          </div>
          <motion.div className="security-copy" variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <span className="eyebrow">Security</span>
            <h2>Your records. <span className="grad-text">Your control.</span></h2>
            <ul className="check-list">
              <li><FiCheckCircle /> Only doctors on your care team can open your records</li>
              <li><FiCheckCircle /> Remove a doctor and their access ends instantly</li>
              <li><FiCheckCircle /> Passwords are hashed and never leave the server</li>
              <li><FiCheckCircle /> Signed sessions that expire automatically</li>
            </ul>
            <div className="row gap-12 wrap" style={{ marginTop: 28 }}>
              <Link to="/patient/signup" className="btn btn-primary btn-lg">Get started <FiArrowRight /></Link>
              <Link to="/patient/signin" className="btn btn-lg">Sign in</Link>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="land-footer">
        <Logo />
        <span className="subtle">© {new Date().getFullYear()} PakMedRecord · A 6th-semester Software Engineering project</span>
        <a href="mailto:info@pakmedrecord.com" className="muted">info@pakmedrecord.com</a>
      </footer>
    </div>
  );
};

export default Landing;
