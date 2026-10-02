// Verifies "Sign in with Google" ID tokens issued by Firebase Auth.
// Only the Firebase project ID is needed: token signatures are checked against Google's public keys.

const { initializeApp, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const googleEnabled = () => Boolean(process.env.FIREBASE_PROJECT_ID);

const auth = () => {
  const app = getApps()[0] || initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
  return getAuth(app);
};

// Returns { uid, email, name } for a valid Google sign-in, or throws
const verifyGoogleIdToken = async (idToken) => {
  const decoded = await auth().verifyIdToken(idToken);
  if (decoded.firebase?.sign_in_provider !== 'google.com') throw new Error('Not a Google sign-in');
  if (!decoded.email || !decoded.email_verified) throw new Error('Google account email is not verified');
  return { uid: decoded.uid, email: decoded.email.toLowerCase(), name: decoded.name || '' };
};

module.exports = { googleEnabled, verifyGoogleIdToken };
