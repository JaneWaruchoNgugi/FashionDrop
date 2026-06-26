import { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { OrderStatusTracker } from '../components/OrderStatusTracker';
import type { Order } from '../types';
import './TrackOrderPage.css';

function formatKES(amount: number) {
  return `KES ${amount.toLocaleString('en-KE')}`;
}

export function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<Order | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!orderNumber.trim() || !phone.trim()) {
      setError('Enter both your order number and phone number.');
      return;
    }

    setSearching(true);
    try {
      const q = query(
        collection(db, 'orders'),
        where('orderNumber', '==', orderNumber.trim().toUpperCase()),
        where('delivery.phone', '==', phone.trim())
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setError("No order found — check your order number and phone number.");
      } else {
        const docSnap = snap.docs[0];
        setResult({ id: docSnap.id, ...docSnap.data() } as Order);
      }
    } catch (err) {
      console.error('Order lookup failed:', err);
      setError('Could not look up your order — try again in a moment.');
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="container track-page">
      <h1 className="hero__title" style={{ fontSize: 'clamp(28px, 5vw, 44px)', marginBottom: 12 }}>
        Track Your Order
      </h1>
      <p className="track-page__sub">Enter your order number and the phone number you used at checkout.</p>

      <form className="track-form" onSubmit={handleSearch}>
        <label className="field">
          <span>Order Number</span>
          <input
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="e.g. FD-2026-1234"
          />
        </label>
        <label className="field">
          <span>Phone Number</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX" />
        </label>
        <button type="submit" className="btn btn-primary" disabled={searching}>
          {searching ? 'Searching…' : 'Track Order'}
        </button>
      </form>

      {error && <p className="checkout-error">{error}</p>}

      {result && (
        <div className="track-result">
          <p className="mono track-result__number">{result.orderNumber}</p>
          <OrderStatusTracker status={result.status} />
          <div className="order-confirmed__details">
            <div>
              <span className="order-confirmed__label">Delivering to</span>
              <p>{result.delivery.address}, {result.delivery.town}, {result.delivery.county}</p>
            </div>
            {result.riderName && (
              <div>
                <span className="order-confirmed__label">Rider</span>
                <p>{result.riderName}</p>
              </div>
            )}
            <div>
              <span className="order-confirmed__label">Total</span>
              <p className="mono">{formatKES(result.total)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
