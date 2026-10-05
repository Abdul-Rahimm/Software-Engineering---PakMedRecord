import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiActivity, FiAlertTriangle, FiBarChart2, FiCalendar, FiClipboard, FiClock, FiCommand, FiEdit3, FiFileText, FiGrid, FiHeart,
  FiHome, FiLock, FiLogOut, FiMenu, FiPackage, FiSearch, FiSettings, FiShare2, FiShield, FiTrendingUp, FiUploadCloud, FiUserPlus, FiUsers, FiX,
} from 'react-icons/fi';
import { LangToggle } from '../lib/i18n';
import { switchProfile } from '../lib/family';
import api from '../api';
import { getSession, clearSession } from '../session';
import Logo from '../ui/Logo';
import { Avatar } from '../ui/Bits';
import { useFeedback } from '../ui/Feedback';
import { formatCNIC } from '../lib/format';
import CommandPalette from './CommandPalette';
import NotificationBell from './NotificationBell';
import Assistant, { AssistantGlyph } from './Assistant';
import { ThemeToggle } from '../ui/Theme';
import { ShellContext } from './ShellContext';
import './shell.css';

// `group` starts a new labelled section in the sidebar
export const navFor = (role, cnic) =>
  role === 'doctor'
    ? [
        { to: `/doctor/home/${cnic}`, label: 'Overview', icon: FiGrid, group: 'Clinic' },
        { to: `/affiliation/getmypatients/${cnic}`, label: 'Patients', icon: FiUsers },
        { to: `/appointments/fetch/${cnic}`, label: 'Appointments', icon: FiCalendar },
        { to: `/tempRecords/pending/${cnic}`, label: 'Review queue', icon: FiClipboard, badge: 'pending' },
        { to: `/appointments/fetchByTime/${cnic}`, label: 'Insights', icon: FiBarChart2 },
        { to: `/doctor/hours/${cnic}`, label: 'Clinic hours', icon: FiClock, group: 'Practice' },
        { to: `/clinic/${cnic}`, label: 'My hospitals', icon: FiHome },
        { to: `/doctor/profile/${cnic}`, label: 'Profile', icon: FiSettings, group: 'Account' },
        { to: `/doctor/security/${cnic}`, label: 'Security & privacy', icon: FiLock },
      ]
    : [
        { to: `/patient/home/${cnic}`, label: 'Overview', icon: FiGrid, group: 'Your health' },
        { to: `/record/getrecords/${cnic}`, label: 'Health records', icon: FiFileText },
        { to: `/patient/${cnic}/health`, label: 'Health profile', icon: FiHeart },
        { to: `/meds/${cnic}`, label: 'Medicines', icon: FiPackage },
        { to: `/vitals/${cnic}`, label: 'Vitals', icon: FiTrendingUp },
        { to: `/labs/${cnic}`, label: 'Lab trends', icon: FiBarChart2 },
        { to: `/vaccines/${cnic}`, label: 'Vaccines', icon: FiShield },
        { to: `/appointments/mine/${cnic}`, label: 'Appointments', icon: FiCalendar, group: 'Care' },
        { to: `/tempRecords/submit/${cnic}`, label: 'Submit a record', icon: FiUploadCloud },
        { to: `/affiliation/getmydoctors/${cnic}`, label: 'My care team', icon: FiActivity },
        { to: '/doctor/doctors', label: 'Find doctors', icon: FiUserPlus },
        { to: `/sharing/${cnic}`, label: 'Sharing & emergency', icon: FiShare2 },
        { to: `/patient/${cnic}/getnote`, label: 'Notes', icon: FiEdit3 },
        { to: `/family/${cnic}`, label: 'Family', icon: FiUsers, group: 'Account' },
        { to: `/patient/update/${cnic}`, label: 'Profile', icon: FiSettings },
        { to: `/patient/${cnic}/security`, label: 'Security & privacy', icon: FiLock },
      ];

const PageSkeleton = () => (
  <div className="stack gap-20">
    <div className="skeleton" style={{ height: 48, width: '40%' }} />
    <div className="skeleton" style={{ height: 220 }} />
  </div>
);

// Keeps the outgoing page rendered while it animates out
const FrozenOutlet = () => {
  const outlet = useOutlet();
  const [frozen] = useState(outlet);
  return frozen;
};

const AppShell = ({ role }) => {
  const session = getSession();
  const cnic = session?.cnic;
  const navigate = useNavigate();
  const location = useLocation();
  const { confirm } = useFeedback();

  const [profile, setProfile] = useState(null);
  const [pending, setPending] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [assistant, setAssistant] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const { data } = await api.get(role === 'doctor' ? `/doctor/home/${cnic}` : `/patient/home/${cnic}`);
      setProfile(data);
    } catch {
      /* 401s are handled globally */
    }
  }, [role, cnic]);

  const refreshCounts = useCallback(async () => {
    if (role !== 'doctor') return;
    try {
      const { data } = await api.get(`/tempRecords/pending/${cnic}`);
      setPending(data.pendingRecords.length);
    } catch {
      /* ignore */
    }
  }, [role, cnic]);

  // refresh on every page change and when the app comes back to the foreground, so approvals
  // (PMDC verification, identity) show up without signing out
  useEffect(() => { loadProfile(); }, [loadProfile, location.pathname]);
  useEffect(() => {
    const onFocus = () => document.visibilityState === 'visible' && loadProfile();
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [loadProfile]);
  useEffect(() => { refreshCounts(); setDrawer(false); }, [refreshCounts, location.pathname]);

  // ⌘K / Ctrl+K opens the command palette
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      }
      // ⌘J / Ctrl+J toggles the AI assistant
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setAssistant((a) => !a);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const nav = useMemo(() => navFor(role, cnic), [role, cnic]);

  const logout = async () => {
    const ok = await confirm({ title: 'Sign out?', message: 'You will need your CNIC and password to sign back in.', confirmLabel: 'Sign out' });
    if (ok) {
      clearSession();
      // offline copies of records must not outlive the session on a shared device
      if ('caches' in window) caches.delete('pmr-api').catch(() => {});
      navigate('/');
    }
  };

  const displayName = profile ? `${role === 'doctor' ? 'Dr. ' : ''}${profile.firstName} ${profile.lastName}` : '…';

  const sidebar = (
    <aside className="sidebar glass">
      <div className="row between" style={{ padding: '6px 8px 0' }}>
        <Logo to={nav[0].to} />
        <button className="btn btn-ghost btn-sm btn-icon only-mobile" onClick={() => setDrawer(false)} aria-label="Close menu">
          <FiX size={18} />
        </button>
      </div>

      <button className="palette-trigger" onClick={() => setPalette(true)}>
        <FiSearch size={15} />
        <span className="grow" style={{ textAlign: 'left' }}>Jump to…</span>
        <kbd><FiCommand size={11} />K</kbd>
      </button>

      <nav className="stack gap-4 nav-scroll" aria-label="Main">
        {nav.map(({ to, label, icon: Icon, badge, group }) => [
          group && <span key={`g-${group}`} className="nav-heading">{group}</span>,
          <NavLink key={to} to={to} end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="nav-active" className="nav-active" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                <Icon size={18} className="nav-icon" />
                <span className="grow">{label}</span>
                {badge === 'pending' && pending > 0 && <span className="nav-count">{pending}</span>}
              </>
            )}
          </NavLink>,
        ])}
      </nav>

      <div className="drawer-prefs">
        <span className="subtle" style={{ fontSize: 13 }}>Language &amp; theme</span>
        <div className="row gap-4"><LangToggle /><ThemeToggle /></div>
      </div>

      <div className="user-card">
        <Avatar photo={profile} first={profile?.firstName} last={profile?.lastName} seed={cnic} size={40} />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="truncate" style={{ fontWeight: 600, fontSize: 14 }}>{displayName}</div>
          <div className="mono subtle truncate" style={{ fontSize: 11.5 }}>{formatCNIC(cnic)}</div>
        </div>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={logout} aria-label="Sign out" title="Sign out">
          <FiLogOut size={16} />
        </button>
      </div>
    </aside>
  );

  const shellValue = useMemo(
    () => ({ role, cnic, profile, reloadProfile: loadProfile, refreshCounts }),
    [role, cnic, profile, loadProfile, refreshCounts]
  );

  return (
    <ShellContext.Provider value={shellValue}>
    <div className="shell">
      <div className="sidebar-dock">{sidebar}</div>

      <AnimatePresence>
        {drawer && (
          <motion.div className="drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)}>
            <motion.div
              className="drawer"
              initial={{ x: '-100%', rotateY: 25 }}
              animate={{ x: 0, rotateY: 0 }}
              exit={{ x: '-100%', rotateY: 25 }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              {sidebar}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="main">
        <header className="topbar only-mobile">
          <button className="btn btn-ghost btn-icon" onClick={() => setDrawer(true)} aria-label="Open menu">
            <FiMenu size={20} />
          </button>
          <Logo to={nav[0].to} size={28} />
          <div className="row gap-4">
            <button className="btn btn-ghost btn-icon" onClick={() => setPalette(true)} aria-label="Search">
              <FiSearch size={18} />
            </button>
            <span className="topbar-extra row gap-4"><LangToggle /><ThemeToggle /></span>
            <NotificationBell />
          </div>
        </header>

        <div className="deskbar">
          <span className="mono subtle" style={{ fontSize: 12.5 }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          <div className="row gap-8">
            <LangToggle />
            <ThemeToggle className="btn btn-icon bell-btn" />
            <button className="btn btn-ai btn-sm" onClick={() => setAssistant(true)}>
              <AssistantGlyph size={15} /> Ask AI <kbd style={{ marginLeft: 2 }}>⌘J</kbd>
            </button>
            <NotificationBell />
          </div>
        </div>

        {session?.guardian && (
          <div className="shell-banner family">
            <FiUsers /> <span>You&apos;re managing <strong>{displayName}</strong>&apos;s profile.</span>
            <button className="btn btn-sm" onClick={() => switchProfile(session.guardian)}>Switch back to me</button>
          </div>
        )}
        {role === 'doctor' && profile && !profile.isVerified && !location.pathname.startsWith('/doctor/profile') && (
          <div className="shell-banner">
            <FiAlertTriangle />
            <span>{profile.verification?.status === 'pending' ? 'Your PMDC verification is in review. Patients can add you once it’s approved.' : 'Verify your PMDC registration so patients can add you and you can see their records.'}</span>
            <NavLink to={`/doctor/profile/${cnic}`} className="btn btn-sm">{profile.verification?.status === 'pending' ? 'View status' : 'Verify now'}</NavLink>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            className="content"
            initial={{ opacity: 0, y: 18, rotateX: 4, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, rotateX: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
            transition={{ duration: 0.38, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <Suspense fallback={<PageSkeleton />}>
              <FrozenOutlet />
            </Suspense>
          </motion.main>
        </AnimatePresence>
      </div>

      <CommandPalette open={palette} onClose={() => setPalette(false)} items={nav} onLogout={logout} onAssistant={() => setAssistant(true)} />
      <Assistant role={role} open={assistant} onOpen={() => setAssistant(true)} onClose={() => setAssistant(false)} />
    </div>
    </ShellContext.Provider>
  );
};

export default AppShell;
