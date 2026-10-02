import { Link } from 'react-router-dom';

// "I agree to the Terms and Privacy Policy" checkbox used at sign-up
const Consent = ({ checked, onChange, error }) => (
  <div className="field">
    <label className="consent">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-invalid={error ? 'true' : undefined} />
      <span>
        I agree to the <Link to="/terms" target="_blank">Terms of Service</Link> and <Link to="/privacy" target="_blank">Privacy Policy</Link>, and understand PakMedRecord is not a substitute for medical advice.
      </span>
    </label>
    {error && <span className="field-error">{error}</span>}
  </div>
);

export default Consent;
