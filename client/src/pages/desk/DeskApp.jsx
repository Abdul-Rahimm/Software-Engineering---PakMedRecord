import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLogOut } from 'react-icons/fi';
import api from '../../api';
import { clearSession, getSession } from '../../session';
import Logo from '../../ui/Logo';
import { Skeleton } from '../../ui/Bits';
import { ThemeToggle } from '../../ui/Theme';
import { LangToggle } from '../../lib/i18n';
import { useFetch } from '../../lib/data';
import OrgManager from '../org/OrgManager';
import '../dashboard.css';

// Hospital / clinic staff console: front desk for receptionists, the full console for administrators
const DeskApp = () => {
  const navigate = useNavigate();
  const session = getSession();
  const { data, loading } = useFetch(async () => (session?.role === 'staff' ? (await api.get('/orgs/mine')).data : null), []);

  useEffect(() => { if (session?.role !== 'staff') navigate('/desk/signin', { replace: true }); }, [session, navigate]);
  if (session?.role !== 'staff') return null;

  const roleName = { org_admin: 'Administrator', facility_admin: 'Branch manager', reception: 'Front desk', billing: 'Billing' }[data?.me?.role] || '';
  return (
    <div className="admin">
      <header className="public-head">
        <div className="row gap-12 head-brand"><Logo to="/desk" /><span className="badge badge-cyan truncate" style={{ maxWidth: 220 }}>{data?.org?.name || 'Hospital'}</span></div>
        <div className="row gap-8">
          <span className="subtle hide-sm" style={{ fontSize: 13 }}>{data?.me?.name}{roleName ? ` · ${roleName}` : ''}</span>
          <LangToggle />
          <ThemeToggle />
          <button className="btn btn-ghost btn-sm" onClick={() => { clearSession(); navigate('/desk/signin'); }}><FiLogOut /> <span className="hide-sm">Sign out</span></button>
        </div>
      </header>
      <main className="public-main wide stack gap-20">
        {loading || !data ? <Skeleton height={320} /> : <OrgManager orgId={data.org._id} initialTab={data.me.role === 'org_admin' ? 'doctors' : 'desk'} />}
        <p className="subtle" style={{ fontSize: 12.5 }}>Hospital accounts manage schedules, staff and payments. Medical records stay private to each patient and the doctors they choose.</p>
      </main>
    </div>
  );
};

export default DeskApp;
