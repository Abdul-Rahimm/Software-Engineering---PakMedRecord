import { Link } from 'react-router-dom';
import { FiCheckCircle, FiClock, FiShield } from 'react-icons/fi';
import api from '../api';
import { useFetch } from '../lib/data';

// "Verify your identity" card: CNIC photo + live face check status, with a link to start it
const IdentityStatus = () => {
  const { data } = useFetch(async () => (await api.get('/identity/me')).data, []);
  const status = data?.identity?.status || 'none';
  return (
    <section className="glass card-pad-lg stack gap-12">
      <div className="row between wrap gap-8">
        <h2 className="section-title row gap-8"><FiShield /> Identity</h2>
        {status === 'verified' ? <span className="badge badge-green"><FiCheckCircle /> Verified</span>
          : status === 'pending' ? <span className="badge badge-cyan"><FiClock /> Under review</span>
            : <span className="badge badge-amber">Not verified</span>}
      </div>
      <p className="subtle" style={{ fontSize: 13.5 }}>{status === 'pending' ? 'The CNIC photo and live face check from your sign-up are with our team.' : status === 'rejected' ? 'Your identity check was not approved. Please do it again with a clear CNIC photo.' : status === 'verified' ? 'Your CNIC and live face check were confirmed.' : 'Confirm this account is yours with a photo of your CNIC and a short live face check on your camera.'}</p>
      {status !== 'verified' && <Link to="/verify-identity" className="btn btn-sm" style={{ alignSelf: 'flex-start' }}>{status === 'pending' ? 'View status' : status === 'rejected' ? 'Try again' : 'Verify my identity'}</Link>}
    </section>
  );
};

export default IdentityStatus;
