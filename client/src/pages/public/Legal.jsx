import { PublicPage } from '../../ui/Layouts';

const UPDATED = '2 October 2026';

const Doc = ({ title, children }) => (
  <PublicPage>
    <article className="glass card-pad-lg legal">
      <span className="eyebrow">Last updated {UPDATED}</span>
      <h1>{title}</h1>
      {children}
    </article>
  </PublicPage>
);

export const Terms = () => (
  <Doc title="Terms of Service">
    <p>These terms govern your use of PakMedRecord, a service that keeps a person&apos;s medical records in one place and lets them share those records with doctors they choose. By creating an account you agree to them.</p>
    <h2>1. Not a medical service</h2>
    <p>PakMedRecord stores and organises health information. It does not provide medical advice, diagnosis or treatment. AI features (the assistant, record explanations, document reading, follow-up suggestions and interaction checks) can be wrong and must be checked against the original documents and with a qualified doctor. In an emergency call Rescue 1122 or go to the nearest emergency department.</p>
    <h2>2. Your account</h2>
    <ul>
      <li>Register with your own CNIC (or a child&apos;s B-Form when you add them as a family member you are the legal guardian of) and accurate details.</li>
      <li>Keep your password private. Turn on two-step sign-in for extra protection. You are responsible for activity under your account.</li>
      <li>Doctors must hold a valid PMDC registration. Doctor accounts can see patient information only after we verify that registration, and only for patients who add them to their care team.</li>
      <li>Clinic front-desk accounts manage schedules only and cannot see medical records.</li>
    </ul>
    <h2>3. Your records and sharing</h2>
    <p>Patients own their records. A doctor can see a patient&apos;s history only while the patient keeps that doctor in their care team, or through a time-limited link the patient creates. Patients can see who viewed their record, download all of their data and delete their account at any time.</p>
    <h2>4. Acceptable use</h2>
    <p>Do not upload information about other people without their permission, impersonate anyone (including claiming to be a doctor), try to access records you are not entitled to, or disrupt the service. We may suspend accounts that break these rules.</p>
    <h2>5. Payments</h2>
    <p>Consultation fees are set by doctors and paid to them. Online payments are processed by the payment provider shown at checkout. Refunds and cancellations are between the patient and the doctor or clinic.</p>
    <h2>6. Availability and liability</h2>
    <p>We work to keep the service available and your data safe, but we provide it &ldquo;as is&rdquo;. To the extent the law allows, we are not liable for indirect losses or for decisions made based on information in the app. Always keep important original documents.</p>
    <h2>7. Changes</h2>
    <p>We will tell you in the app before material changes to these terms take effect. If you do not agree, you can export your data and close your account.</p>
    <h2>8. Contact</h2>
    <p>Questions or complaints: <a href="mailto:siddiquiabdullah746@gmail.com">siddiquiabdullah746@gmail.com</a>.</p>
  </Doc>
);

export const Privacy = () => (
  <Doc title="Privacy Policy">
    <p>Health information is sensitive. This policy explains what PakMedRecord collects, why, who can see it and the choices you have. It is written with Pakistan&apos;s draft Personal Data Protection Bill in mind.</p>
    <h2>What we collect</h2>
    <ul>
      <li><strong>Account details:</strong> CNIC, name, email, phone, hospital, gender and (for doctors) PMDC registration and certificate.</li>
      <li><strong>Health information you or your doctors add:</strong> records, uploaded documents and the text read from them, health profile, vitals, medicines and dose logs, vaccinations, prescriptions, appointments and notes.</li>
      <li><strong>Activity needed to protect you:</strong> sign-ins, who viewed your record and when, and basic technical logs.</li>
    </ul>
    <h2>How we use it</h2>
    <ul>
      <li>To show your records to you and to the doctors you choose, and to run features you use (booking, reminders, prescriptions, sharing).</li>
      <li>To send verification emails, password resets and the reminders you opted into (email, WhatsApp or SMS).</li>
      <li>To keep the service secure: verifying doctors, investigating reports and abuse.</li>
    </ul>
    <p>We do not sell your data and do not use it for advertising.</p>
    <h2>AI processing</h2>
    <p>When you use AI features, the relevant part of your record is sent to our AI provider (Mistral AI, or Anthropic if configured) to generate the answer. The provider processes it under its API terms to return the result. Only the information needed for the request is sent, and you can use PakMedRecord without the AI features.</p>
    <h2>Who can see your information</h2>
    <ul>
      <li>You, and family members you manage.</li>
      <li>Verified doctors in your care team (every view is logged for you to see).</li>
      <li>Anyone holding a share link you create, until it expires or you revoke it.</li>
      <li>Anyone who scans your emergency QR, only if you switch it on, and only emergency details.</li>
      <li>Partner labs that send results to your record, and pharmacies that check a prescription code.</li>
      <li>Service providers that host or process data for us (MongoDB Atlas, Vercel, Google for email and sign-in, payment providers), under contract.</li>
    </ul>
    <h2>Your choices and rights</h2>
    <ul>
      <li>See who viewed your record, and remove doctors from your care team at any time.</li>
      <li>Download all your data as a file from Security &amp; privacy.</li>
      <li>Delete your account and its data permanently from Security &amp; privacy.</li>
      <li>Change which reminders you receive and on which channel.</li>
    </ul>
    <h2>Security</h2>
    <p>Data is encrypted in transit, files are private and served only after access checks, passwords are hashed, and two-step sign-in is available. Doctors are verified before they can view records.</p>
    <h2>Retention</h2>
    <p>We keep your information while your account is open. Deleting your account removes your records, files and logs; records a doctor wrote for you are deleted with your account. Backups are overwritten within 30 days.</p>
    <h2>Contact</h2>
    <p>Privacy questions or requests: <a href="mailto:siddiquiabdullah746@gmail.com">siddiquiabdullah746@gmail.com</a>.</p>
  </Doc>
);
