import '../styles/auth.css';
import '../styles/setup.css';

export default function Setup() {
  return (
    <div className="auth-page">
      <div className="auth-card setup-card">
        <h1 className="auth-logo">MVS</h1>
        <p className="auth-tagline">Milestone → Vision → Steps</p>

        <div className="setup-steps">
          <p className="setup-intro">
            Almost there — add your API keys to <code>.env</code> to get started.
          </p>

          <div className="setup-step">
            <span className="step-num">1</span>
            <div>
              <strong>Firebase</strong>
              <p>
                Create a project at{' '}
                <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer">
                  console.firebase.google.com
                </a>
                , enable <em>Email/Password auth</em> and <em>Firestore</em>, then copy your config.
              </p>
            </div>
          </div>

          <div className="setup-step">
            <span className="step-num">2</span>
            <div>
              <strong>Groq API key</strong>
              <p>
                Get a free key at{' '}
                <a href="https://console.groq.com" target="_blank" rel="noreferrer">
                  console.groq.com
                </a>{' '}
                → API Keys → Create API Key.
              </p>
            </div>
          </div>

          <div className="setup-step">
            <span className="step-num">3</span>
            <div>
              <strong>Fill in <code>c:\mvs-app\.env</code></strong>
              <pre className="setup-env">{`VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_GROQ_API_KEY=your_groq_key`}</pre>
            </div>
          </div>

          <div className="setup-step">
            <span className="step-num">4</span>
            <div>
              <strong>Restart dev server</strong>
              <p>Stop and re-run <code>npm run dev</code> after saving <code>.env</code>.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
