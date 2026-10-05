import { Link } from 'react-router-dom';
import { FiArrowRight, FiBriefcase, FiHeart, FiHome, FiShield, FiUser } from 'react-icons/fi';
import { PublicPage } from '../../ui/Layouts';
import '../dashboard.css';

const SIGNIN = [
  { to: '/patient/signin', icon: FiUser, title: 'Patient', text: 'Your records, appointments, medicines and family.' },
  { to: '/doctor/signin', icon: FiHeart, title: 'Doctor', text: 'Your patients, appointments, prescriptions and hospitals.' },
  { to: '/desk/signin', icon: FiHome, title: 'Hospital or clinic staff', text: 'Administrators, front desk, branch managers and billing.' },
];
const SIGNUP = [
  { to: '/patient/signup', icon: FiUser, title: 'I’m a patient', text: 'Keep one record that follows you to every hospital. Free.' },
  { to: '/doctor/signup', icon: FiHeart, title: 'I’m a doctor', text: 'Get PMDC-verified, see patients at one or many hospitals, or run your own clinic.' },
  { to: '/hospitals/register', icon: FiBriefcase, title: 'I run a hospital or clinic', text: 'Register your organization, add branches, enrol doctors and give your front desk logins.' },
];

// "Who are you?" for sign in (mode="signin") and sign up (mode="signup")
const RoleChooser = ({ mode }) => {
  const list = mode === 'signin' ? SIGNIN : SIGNUP;
  return (
    <PublicPage>
      <section className="stack gap-20" style={{ maxWidth: 760, margin: '0 auto' }}>
        <div className="stack gap-8" style={{ textAlign: 'center' }}>
          <span className="eyebrow" style={{ alignSelf: 'center' }}>{mode === 'signin' ? 'Welcome back' : 'Get started'}</span>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 40px)' }}>{mode === 'signin' ? 'Sign in as' : 'Create an account'}</h1>
        </div>
        <div className="stack gap-12">
          {list.map(({ to, icon: Icon, title, text }) => (
            <Link key={to} to={to} className="glass card-pad role-card">
              <span className="empty-orb" style={{ width: 48, height: 48, flexShrink: 0 }}><Icon size={22} /></span>
              <div className="grow" style={{ minWidth: 0 }}>
                <strong style={{ fontSize: 17 }}>{title}</strong>
                <div className="subtle" style={{ fontSize: 13.5 }}>{text}</div>
              </div>
              <FiArrowRight className="subtle" />
            </Link>
          ))}
        </div>
        <p className="subtle" style={{ textAlign: 'center', fontSize: 13.5 }}>
          {mode === 'signin' ? <>New here? <Link to="/get-started">Create an account</Link></> : <>Already have an account? <Link to="/signin">Sign in</Link></>}
        </p>
        {mode === 'signin' && (
          <p className="subtle" style={{ textAlign: 'center', fontSize: 12.5 }}>
            <Link to="/admin/signin" className="row gap-4" style={{ display: 'inline-flex' }}><FiShield size={12} /> PakMedRecord team sign-in</Link>
          </p>
        )}
      </section>
    </PublicPage>
  );
};

export default RoleChooser;
