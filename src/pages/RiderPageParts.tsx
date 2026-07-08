import { useEffect, useState } from 'react';
import { addDoc, collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { GoogleMap, useJsApiLoader, DirectionsRenderer, Marker } from '@react-google-maps/api';
import { db, storage } from '../lib/firebase';
import { ORDER_STATUS_LABELS, type Order, type OrderStatus } from '../types';
import { ShoppingBag, MapPin, Navigation, Clock, Camera, Upload, CheckCircle, AlertCircle, Shield } from 'lucide-react';
import './RiderPage.css';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
const PICKUP_ADDRESS = import.meta.env.VITE_PICKUP_ADDRESS ?? 'Eastleigh, Nairobi';
const RIDER_STATUSES: OrderStatus[] = ['rider_assigned', 'picked_up', 'in_transit', 'arrived', 'delivered'];
const LIBRARIES: ('places' | 'geometry')[] = ['places', 'geometry'];

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export type RiderProfile = {
  id: string;
  name: string;
  phone: string;
  area: string;
  profileImage?: string;
  verificationStatus: VerificationStatus;
  idFront?: string;
  idBack?: string;
};
export type Tab = 'home' | 'orders' | 'earnings' | 'profile';

export function formatKES(n: number) {
  return `KES ${n.toLocaleString('en-KE')}`;
}
export function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning,';
  if (h < 17) return 'Good afternoon,';
  return 'Good evening,';
}
export function getStored(): RiderProfile | null {
  try {
    const raw = localStorage.getItem('fashiondrop-rider');
    return raw ? (JSON.parse(raw) as RiderProfile) : null;
  } catch { return null; }
}

// ── Map Modal ────────────────────────────────────────────────────────────────
export function MapModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY, libraries: LIBRARIES });
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [eta, setEta] = useState<string | null>(null);
  const [distance, setDistance] = useState<string | null>(null);
  const destination = order.destinationLabel || `${order.delivery.address}, ${order.delivery.town}`;

  useEffect(() => {
    if (!isLoaded) return;
    new google.maps.DirectionsService().route(
      { origin: PICKUP_ADDRESS, destination, travelMode: google.maps.TravelMode.DRIVING },
      (result, status) => {
        if (status === 'OK' && result) {
          setDirections(result);
          const leg = result.routes[0]?.legs[0];
          setEta(leg?.duration?.text ?? null);
          setDistance(leg?.distance?.text ?? null);
        }
      }
    );
  }, [isLoaded, destination]);

  return (
    <div className="map-overlay" onClick={onClose}>
      <div className="map-modal" onClick={e => e.stopPropagation()}>
        <div className="map-modal__header">
          <div>
            <h3>Route to Destination</h3>
            <p>{destination}</p>
          </div>
          <button className="map-close" onClick={onClose}>✕</button>
        </div>
        {(eta || distance) && (
          <div className="map-info-row">
            {distance && <span className="map-info-chip"><Navigation size={14} /> {distance}</span>}
            {eta && <span className="map-info-chip"><Clock size={14} /> ETA: {eta}</span>}
          </div>
        )}
        <div className="map-container">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              zoom={13}
              center={{ lat: -1.286389, lng: 36.817223 }}
              options={{ zoomControl: true, streetViewControl: false, mapTypeControl: false }}
            >
              {directions ? <DirectionsRenderer directions={directions} /> : <Marker position={{ lat: -1.286389, lng: 36.817223 }} />}
            </GoogleMap>
          ) : (
            <div className="map-loading">Loading map…</div>
          )}
        </div>
        <div className="map-route-steps">
          <div className="map-route-point"><span className="route-dot route-dot--start" /><span>{PICKUP_ADDRESS}</span></div>
          <div className="map-route-point"><span className="route-dot route-dot--end" /><span>{destination}</span></div>
        </div>
      </div>
    </div>
  );
}

// ── Auth View (Login + Register tabs) ────────────────────────────────────────
export function AuthView({ onAuth }: { onAuth: (p: RiderProfile) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  return (
    <div className="rp-auth-screen">
      <div className="rp-auth-card">
        <div className="rp-register-brand">
          <span className="rp-logo">FASHIONDROP<span>.</span></span>
          <p className="rp-register-sub">Rider Portal</p>
        </div>
        <div className="rp-auth-tabs">
          <button className={`rp-auth-tab${mode === 'login' ? ' rp-auth-tab--active' : ''}`} onClick={() => setMode('login')}>Login</button>
          <button className={`rp-auth-tab${mode === 'register' ? ' rp-auth-tab--active' : ''}`} onClick={() => setMode('register')}>Sign Up</button>
        </div>
        {mode === 'login' ? <LoginForm onAuth={onAuth} onSwitch={() => setMode('register')} /> : <RegisterForm onAuth={onAuth} onSwitch={() => setMode('login')} />}
      </div>
    </div>
  );
}

function LoginForm({ onAuth, onSwitch }: { onAuth: (p: RiderProfile) => void; onSwitch: () => void }) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^(07|01)\d{8}$/.test(phone.trim())) {
      setError('Enter a valid Kenyan phone number.');
      return;
    }
    setLoading(true);
    try {
      const q = query(collection(db, 'riders'), where('phone', '==', phone.trim()));
      const snap = await getDocs(q);
      if (snap.empty) { setError('No rider account found with this number. Please sign up.'); return; }
      const d = snap.docs[0];
      const data = d.data();
      const profile: RiderProfile = {
        id: d.id, name: data.name, phone: data.phone, area: data.area,
        profileImage: data.profileImage, verificationStatus: data.verificationStatus ?? 'unverified',
        idFront: data.idFront, idBack: data.idBack,
      };
      localStorage.setItem('fashiondrop-rider', JSON.stringify(profile));
      onAuth(profile);
    } catch { setError('Login failed. Please try again.'); }
    finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="rp-auth-desc">Enter your registered phone number to continue.</p>
      <label><span>Phone Number</span><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="07XXXXXXXX" /></label>
      {error && <p className="rp-form-error">{error}</p>}
      <button type="submit" disabled={loading} className="rp-btn-primary">{loading ? 'Logging in…' : 'Login'}</button>
      <p className="rp-auth-switch">No account? <button type="button" onClick={onSwitch} className="rp-link-btn">Sign Up</button></p>
    </form>
  );
}

function RegisterForm({ onAuth, onSwitch }: { onAuth: (p: RiderProfile) => void; onSwitch: () => void }) {
  const [form, setForm] = useState({ name: '', phone: '', area: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !/^(07|01)\d{8}$/.test(form.phone.trim()) || !form.area.trim()) {
      setError('Enter your full name, a valid Kenyan phone number, and your delivery area.');
      return;
    }
    setSaving(true);
    try {
      // Check for existing account
      const existing = await getDocs(query(collection(db, 'riders'), where('phone', '==', form.phone.trim())));
      if (!existing.empty) { setError('An account with this phone number already exists. Please login.'); setSaving(false); return; }
      const payload = { name: form.name.trim(), phone: form.phone.trim(), area: form.area.trim(), status: 'available', verificationStatus: 'unverified', createdAt: Date.now() };
      const docRef = await addDoc(collection(db, 'riders'), payload);
      const profile: RiderProfile = { id: docRef.id, name: payload.name, phone: payload.phone, area: payload.area, verificationStatus: 'unverified' };
      localStorage.setItem('fashiondrop-rider', JSON.stringify(profile));
      onAuth(profile);
    } catch { setError('Registration failed. Check your connection and try again.'); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="rp-auth-desc">Register to start accepting orders and earning.</p>
      <label><span>Full Name</span><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="James Mwangi" /></label>
      <label><span>Phone Number</span><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="07XXXXXXXX" /></label>
      <label><span>Delivery Area</span><input value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} placeholder="Nairobi CBD, Kiambu…" /></label>
      {error && <p className="rp-form-error">{error}</p>}
      <button type="submit" disabled={saving} className="rp-btn-primary">{saving ? 'Creating account…' : 'Create Account'}</button>
      <p className="rp-auth-switch">Already have an account? <button type="button" onClick={onSwitch} className="rp-link-btn">Login</button></p>
    </form>
  );
}

// ── Profile Image Upload ──────────────────────────────────────────────────────
export function ProfileImageUpload({ rider, onUpdate }: { rider: RiderProfile; onUpdate: (updated: RiderProfile) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return; }
    setError(null);
    setUploading(true);
    try {
      const storageRef = ref(storage, `riders/${rider.id}/profile.${file.name.split('.').pop()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'riders', rider.id), { profileImage: url });
      const updated = { ...rider, profileImage: url };
      localStorage.setItem('fashiondrop-rider', JSON.stringify(updated));
      onUpdate(updated);
    } catch { setError('Upload failed. Please try again.'); }
    finally { setUploading(false); }
  }

  return (
    <div className="rp-profile-img-wrap">
      <div className="rp-profile-avatar rp-profile-avatar--lg">
        {rider.profileImage
          ? <img src={rider.profileImage} alt={rider.name} className="rp-profile-img" />
          : <span className="rp-avatar-initial">{rider.name[0]?.toUpperCase()}</span>}
        <label className="rp-avatar-upload-btn" title="Change photo">
          {uploading ? '…' : <Camera size={14} />}
          <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} hidden />
        </label>
      </div>
      {error && <p className="rp-form-error" style={{ marginTop: 8, fontSize: 12 }}>{error}</p>}
    </div>
  );
}

// ── ID Verification Upload ────────────────────────────────────────────────────
export function IDVerification({ rider, onUpdate }: { rider: RiderProfile; onUpdate: (updated: RiderProfile) => void }) {
  const [uploading, setUploading] = useState<'front' | 'back' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch latest from Firestore on mount to get up-to-date idFront/idBack
  const [localRider, setLocalRider] = useState(rider);
  useEffect(() => {
    getDoc(doc(db, 'riders', rider.id)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        const refreshed = { ...rider, idFront: data.idFront, idBack: data.idBack, verificationStatus: data.verificationStatus ?? rider.verificationStatus };
        setLocalRider(refreshed);
      }
    });
  }, [rider.id]);

  async function uploadSide(side: 'front' | 'back', file: File) {
    setUploading(side);
    setError(null);
    try {
      const storageRef = ref(storage, `riders/${rider.id}/id_${side}.${file.name.split('.').pop()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      const field = side === 'front' ? 'idFront' : 'idBack';
      await updateDoc(doc(db, 'riders', rider.id), { [field]: url });
      setLocalRider(prev => ({ ...prev, [field]: url }));
    } catch { setError(`Failed to upload ID ${side}. Please try again.`); }
    finally { setUploading(null); }
  }

  async function submitForVerification() {
    if (!localRider.idFront || !localRider.idBack) {
      setError('Please upload both front and back of your ID card.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'riders', rider.id), { verificationStatus: 'pending', verificationSubmittedAt: Date.now() });
      const updated = { ...rider, ...localRider, verificationStatus: 'pending' as VerificationStatus };
      localStorage.setItem('fashiondrop-rider', JSON.stringify(updated));
      onUpdate(updated);
      setSuccess(true);
    } catch { setError('Submission failed. Please try again.'); }
    finally { setSubmitting(false); }
  }

  const statusConfig: Record<VerificationStatus, { label: string; color: string; icon: React.ReactNode }> = {
    unverified: { label: 'Not Verified', color: '#9e7a5e', icon: <AlertCircle size={16} /> },
    pending: { label: 'Verification Pending', color: '#b07000', icon: <Clock size={16} /> },
    verified: { label: 'Verified', color: '#1f7a35', icon: <CheckCircle size={16} /> },
    rejected: { label: 'Verification Rejected', color: '#c0392b', icon: <AlertCircle size={16} /> },
  };

  const isVerified = (localRider.verificationStatus ?? 'unverified') === 'verified';
  const isPending = (localRider.verificationStatus ?? 'unverified') === 'pending';
  const st = statusConfig[localRider.verificationStatus ?? 'unverified'];

  return (
    <div className="rp-id-verify-section">
      <div className="rp-id-verify-header">
        <Shield size={20} />
        <span>ID Verification</span>
        <span className="rp-verify-badge" style={{ color: st.color }}>
          {st.icon} {st.label}
        </span>
      </div>

      {isVerified ? (
        <p className="rp-id-verify-done">Your ID has been verified. You can now deliver orders. ✅</p>
      ) : isPending ? (
        <p className="rp-id-verify-info">Your documents are under review. We'll notify you once verified.</p>
      ) : (
        <>
          <p className="rp-id-verify-info">
            Upload a screenshot of your <strong>National ID or Passport</strong> — front and back — to get verified and start delivering.
          </p>

          <div className="rp-id-upload-grid">
            {/* Front */}
            <div className="rp-id-upload-card">
              {localRider.idFront
                ? <img src={localRider.idFront} alt="ID Front" className="rp-id-preview" />
                : <div className="rp-id-placeholder"><Upload size={28} /><span>Front of ID</span></div>}
              <label className={`rp-id-upload-btn${uploading === 'front' ? ' rp-id-upload-btn--loading' : ''}`}>
                {uploading === 'front' ? 'Uploading…' : localRider.idFront ? '↺ Re-upload Front' : 'Upload Front'}
                <input type="file" accept="image/*" hidden
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadSide('front', f); }}
                  disabled={!!uploading} />
              </label>
            </div>

            {/* Back */}
            <div className="rp-id-upload-card">
              {localRider.idBack
                ? <img src={localRider.idBack} alt="ID Back" className="rp-id-preview" />
                : <div className="rp-id-placeholder"><Upload size={28} /><span>Back of ID</span></div>}
              <label className={`rp-id-upload-btn${uploading === 'back' ? ' rp-id-upload-btn--loading' : ''}`}>
                {uploading === 'back' ? 'Uploading…' : localRider.idBack ? '↺ Re-upload Back' : 'Upload Back'}
                <input type="file" accept="image/*" hidden
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadSide('back', f); }}
                  disabled={!!uploading} />
              </label>
            </div>
          </div>

          {error && <p className="rp-form-error">{error}</p>}
          {success && <p className="rp-id-verify-done">Submitted! Your ID is under review. ✅</p>}

          {!success && (
            <button
              className="rp-btn-primary rp-btn-verify"
              onClick={submitForVerification}
              disabled={submitting || !localRider.idFront || !localRider.idBack}
            >
              {submitting ? 'Submitting…' : 'Submit for Verification'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Verification Banner ───────────────────────────────────────────────────────
export function VerificationBanner({ rider, onGoToProfile }: { rider: RiderProfile; onGoToProfile: () => void }) {
  const status = rider.verificationStatus ?? 'unverified';
  if (status === 'verified') return null;
  const messages = {
    unverified: { text: 'Verify your ID to unlock deliveries.', cta: 'Verify Now', color: '#b07000' },
    pending: { text: 'ID verification is in progress.', cta: 'View Status', color: '#3a7bcf' },
    rejected: { text: 'ID verification was rejected. Please re-submit.', cta: 'Re-submit', color: '#c0392b' },
  } as const;
  const msg = messages[status as keyof typeof messages] ?? messages.unverified;
  return (
    <div className="rp-verify-banner" style={{ borderColor: msg.color, color: msg.color }}>
      <Shield size={16} />
      <span>{msg.text}</span>
      <button onClick={onGoToProfile} className="rp-verify-banner-cta" style={{ color: msg.color }}>{msg.cta} →</button>
    </div>
  );
}

// ── Order Card ────────────────────────────────────────────────────────────────
export function OrderCard({ order, onAccept, onUpdateStatus, onViewMap, countdown, isMine }: {
  order: Order; onAccept?: () => void; onUpdateStatus?: (s: OrderStatus) => void;
  onViewMap: () => void; countdown?: number; isMine?: boolean;
}) {
  const destination = order.destinationLabel || `${order.delivery.address}, ${order.delivery.town}`;
  return (
    <div className={`rp-order-card${isMine ? ' rp-order-card--mine' : ''}`}>
      <div className="rp-order-card__img">
        {order.lines?.[0]?.image
          ? <img src={order.lines[0].image} alt={order.lines[0].productName} />
          : <ShoppingBag size={28} color="#b07850" />}
      </div>
      <div className="rp-order-card__body">
        <div className="rp-order-card__top">
          <span className="rp-tag rp-tag--pickup">PICK UP</span>
          <span className="rp-order-payout">{formatKES(order.riderPayout || order.deliveryFee)}</span>
        </div>
        <strong className="rp-order-number">Order #{order.orderNumber}</strong>
        <div className="rp-order-address"><MapPin size={12} /><span>{PICKUP_ADDRESS}</span></div>
        <span className="rp-tag rp-tag--delivery">DELIVERY TO</span>
        <div className="rp-order-address rp-order-address--dest"><MapPin size={12} /><span>{destination}</span></div>
        {order.estimatedDistanceKm && <span className="rp-order-dist">{order.estimatedDistanceKm.toFixed(1)} km</span>}
      </div>
      <div className="rp-order-card__actions">
        <button className="rp-map-btn" onClick={onViewMap} title="View route"><Navigation size={16} /></button>
        {!isMine && onAccept && (
          <button className="rp-btn-accept" onClick={onAccept}>
            Accept Order
            {countdown !== undefined && <span className="rp-countdown">{countdown}s</span>}
          </button>
        )}
        {isMine && onUpdateStatus && (
          <select className="rp-status-select" value={order.status} onChange={e => onUpdateStatus(e.target.value as OrderStatus)}>
            {RIDER_STATUSES.map(s => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

export { RIDER_STATUSES, LIBRARIES, PICKUP_ADDRESS, GOOGLE_MAPS_API_KEY };
// Legacy export for backward compat
export { AuthView as RegisterView };
