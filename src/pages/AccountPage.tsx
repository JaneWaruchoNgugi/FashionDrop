import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AccountPage.css';

type AuthMode = 'signin' | 'signup';

function isKenyanPhone(phone: string) {
  return /^(07|01)\d{8}$/.test(phone.trim());
}

export function AccountPage() {
  const { user, profile, loading, signIn, signUp, signInWithGoogle, logOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = new URLSearchParams(location.search).get('redirect') || '/';
  const [mode, setMode] = useState<AuthMode>('signin');
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleGoogleSignIn() {
    setError(null);
    setSaving(true);
    try {
      await signInWithGoogle();
      navigate(redirectTo);
    } catch (err) {
      console.error('Google sign-in failed:', err);
      setError('Could not sign in with Google. Check Firebase Auth provider settings.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.email.trim() || !form.password.trim()) {
      setError('Enter your email and password.');
      return;
    }

    if (mode === 'signup') {
      if (!form.fullName.trim()) {
        setError('Enter your full name.');
        return;
      }
      if (!isKenyanPhone(form.phone)) {
        setError('Enter a valid Kenyan phone number, e.g. 0712345678.');
        return;
      }
      if (form.password.length < 6) {
        setError('Use at least 6 characters for your password.');
        return;
      }
    }

    setSaving(true);
    try {
      if (mode === 'signup') {
        await signUp({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
        });
      } else {
        await signIn(form.email.trim(), form.password);
      }
      navigate(redirectTo);
    } catch (err) {
      console.error('Account action failed:', err);
      setError(mode === 'signup' ? 'Could not create your account. Try another email.' : 'Could not sign in. Check your details.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="container account-page"><p className="account-muted">Loading your account...</p></div>;
  }

  if (user) {
    return (
      <div className="container account-page">
        <section className="account-panel">
          <span className="badge badge-flame">My Account</span>
          <h1 className="hero__title account-title">Welcome{profile?.fullName ? `, ${profile.fullName.split(' ')[0]}` : ''}</h1>
          <div className="account-details">
            <div>
              <span>Name</span>
              <strong>{profile?.fullName || user.displayName || 'FashionDrop Buyer'}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{profile?.email || user.email}</strong>
            </div>
            <div>
              <span>Phone</span>
              <strong>{profile?.phone || 'Add phone at checkout'}</strong>
            </div>
          </div>
          <div className="account-actions">
            <Link to="/track" className="btn btn-outline">Track Orders</Link>
            <button className="btn btn-primary" onClick={logOut}>Sign Out</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="container account-page">
      <section className="account-panel">
        <span className="badge badge-flame">FashionDrop Account</span>
        <h1 className="hero__title account-title">{mode === 'signup' ? 'Create Account' : 'Sign In'}</h1>
        <p className="account-muted">
          Sign in to place orders, pay delivery fees, and track your rider once dispatch starts.
        </p>

        <div className="account-switch">
          <button className={mode === 'signin' ? 'is-active' : ''} onClick={() => setMode('signin')}>Sign In</button>
          <button className={mode === 'signup' ? 'is-active' : ''} onClick={() => setMode('signup')}>Create Account</button>
        </div>

        <button className="btn btn-outline account-submit" onClick={handleGoogleSignIn} disabled={saving}>
          Continue with Google
        </button>

        <form className="account-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <label className="field">
                <span>Full Name</span>
                <input value={form.fullName} onChange={(e) => update('fullName', e.target.value)} placeholder="Jane Wanjiru" />
              </label>
              <label className="field">
                <span>Phone</span>
                <input value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="07XXXXXXXX" inputMode="tel" />
              </label>
            </>
          )}
          <label className="field">
            <span>Email</span>
            <input value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="you@example.com" type="email" />
          </label>
          <label className="field">
            <span>Password</span>
            <input value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="Minimum 6 characters" type="password" />
          </label>
          {error && <p className="checkout-error">{error}</p>}
          <button className="btn btn-primary account-submit" disabled={saving}>
            {saving ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
          </button>
        </form>
      </section>
    </div>
  );
}
