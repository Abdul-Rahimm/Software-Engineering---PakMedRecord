import { PublicPage } from '../../ui/Layouts';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3009';

const Code = ({ children }) => <pre className="code-block" data-no-translate><code>{children}</code></pre>;

// Partner API documentation for laboratories and pharmacies
const Developers = () => (
  <PublicPage>
    <article className="glass card-pad-lg legal">
      <span className="eyebrow">Partner API</span>
      <h1>Connect your lab or pharmacy</h1>
      <p>Laboratories can send results straight into a patient&apos;s PakMedRecord, and pharmacies can verify and dispense e-prescriptions. Contact us to get an API key; keys are issued per organisation by a PakMedRecord administrator and shown once.</p>

      <h2>Authentication</h2>
      <p>Send your key in the <code>X-API-Key</code> header over HTTPS. Base URL:</p>
      <Code>{API}</Code>

      <h2>Labs: send results</h2>
      <p><code>POST /partners/lab/results</code>. The patient is identified by their CNIC; they get a notification and the values appear in their lab trend charts.</p>
      <Code>{`curl -X POST ${API}/partners/lab/results \\
  -H "X-API-Key: pmr_lab_..." -H "Content-Type: application/json" \\
  -d '{
    "patientCNIC": "4210112345671",
    "title": "Lipid profile",
    "testDate": "2026-10-01",
    "summary": "Fasting lipid profile",
    "results": [
      { "test": "Total cholesterol", "value": 212, "unit": "mg/dL", "range": "<200", "flag": "H" },
      { "test": "HDL", "value": 41, "unit": "mg/dL", "range": ">40" }
    ],
    "file": { "name": "lipid.pdf", "base64": "<PDF, JPG or PNG, max 3 MB>" }
  }'`}</Code>
      <p>Response <code>201</code>: <code>{'{ "recordId": "...", "values": 2 }'}</code>. <code>404</code> if no patient has that CNIC.</p>

      <h2>Pharmacies: verify a prescription</h2>
      <p>Scan the QR on the prescription (or type its 10-character code), then fetch it:</p>
      <Code>{`curl ${API}/partners/pharmacy/prescriptions/ABCD234567 -H "X-API-Key: pmr_pharmacy_..."`}</Code>
      <p>Returns the medicines, prescribing doctor (with PMDC number), the patient&apos;s name and allergies, and the status (<code>active</code>, <code>dispensed</code> or <code>cancelled</code>).</p>

      <h2>Pharmacies: mark as dispensed</h2>
      <Code>{`curl -X POST ${API}/partners/pharmacy/prescriptions/ABCD234567/dispense -H "X-API-Key: pmr_pharmacy_..."`}</Code>
      <p>A prescription can be dispensed once; a second call returns <code>409</code>. The patient is notified.</p>

      <h2>Public verification</h2>
      <p>Anyone can check that a prescription is genuine at <code>/rx/&lt;code&gt;</code> on the PakMedRecord website (the QR code links there). It shows the doctor and medicines but only the patient&apos;s initials.</p>

      <h2>Errors and limits</h2>
      <p>Errors return JSON <code>{'{ "error": "..." }'}</code> with a 4xx status. Keep requests under 5 MB. Contact us before sending more than a few thousand results a day.</p>
    </article>
  </PublicPage>
);

export default Developers;
