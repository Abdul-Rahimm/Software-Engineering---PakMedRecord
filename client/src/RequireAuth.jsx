import { Navigate, useParams } from 'react-router-dom';
import { getSession } from './session';

// Only render the page for a signed-in user of the given role.
// If the URL names a CNIC (param), it must be the signed-in user's own.
const RequireAuth = ({ role, param, children }) => {
  const params = useParams();
  const session = getSession();

  if (!session || session.role !== role || (param && String(session.cnic) !== params[param])) {
    return <Navigate to={`/${role}/signin`} replace />;
  }
  return children;
};

export default RequireAuth;
