// "Sign in with Google" through Firebase Auth. The SDK is loaded on demand.

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const googleConfigured = () => Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

// Opens the Google account picker and returns a Firebase ID token for the backend to verify
export const signInWithGoogle = async () => {
  const [{ initializeApp, getApps }, { getAuth, GoogleAuthProvider, signInWithPopup, signOut }] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
  ]);
  const app = getApps()[0] || initializeApp(config);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken();
  // our backend issues its own session; the Firebase session isn't needed after this
  signOut(auth).catch(() => {});
  return idToken;
};
