import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useCartStore } from '../store/cartStore';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { POCHI_NAME, POCHI_NUMBER } from '../lib/payment';
import { KENYAN_COUNTIES, deliveryBand, type DeliveryDetails, type Order } from '../types';
import './CheckoutPage.css';

function formatKES(amount: number) {
  return `KES ${amount.toLocaleString('en-KE')}`;
}

export function CheckoutPage() {
  const { lines, subtotal, clearCart } = useCartStore();
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<DeliveryDetails>({
    fullName: '',
    phone: '',
    county: '',
    town: '',
    address: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = subtotal();
  const band = form.county ? deliveryBand(form.county) : null;
  const deliveryEstimateLabel = band
    ? band.min === band.max
      ? formatKES(band.min)
      : `${formatKES(band.min)} - ${formatKES(band.max)}`
    : 'Select your county';

  function update<K extends keyof DeliveryDetails>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): string | null {
    if (!form.fullName.trim()) return 'Enter your full name.';
    if (!/^(07|01)\d{8}$/.test(form.phone.trim())) return 'Enter a valid Kenyan phone number, e.g. 0712345678.';
    if (!form.county) return 'Select your county for delivery.';
    if (!form.town.trim()) return 'Enter your town.';
    if (!form.address.trim()) return 'Enter your delivery address.';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const orderNumber = `FD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const now = Date.now();

      if (!user) throw new Error('Checkout requires a signed-in buyer.');

      const deliveryBandValue = deliveryBand(form.county);

      const orderPayload: Omit<Order, 'id'> = {
        buyerId: user.uid,
        buyerEmail: user.email || profile?.email || '',
        orderNumber,
        lines,
        subtotal: items,
        deliveryZone: deliveryBandValue.zone,
        deliveryEstimate: { min: deliveryBandValue.min, max: deliveryBandValue.max },
        deliveryFee: 0,
        total: items, // customer pays the item subtotal now; delivery fee confirmed separately
        delivery: form,
        paymentStatus: 'unpaid',
        status: 'pending_payment',
        statusHistory: [{ status: 'pending_payment', at: now }],
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await addDoc(collection(db, 'orders'), {
        ...orderPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      clearCart();
      navigate(`/order-confirmed/${docRef.id}`, { state: { orderNumber } });
    } catch (err) {
      console.error('Failed to place order:', err);
      setError('Could not place your order — check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="container cart-empty"><p>Loading checkout...</p></div>;
  }

  if (!user) {
    return (
      <div className="container cart-empty">
        <h1 className="hero__title" style={{ fontSize: 'clamp(28px, 5vw, 44px)' }}>Sign In to Check Out</h1>
        <p>Create an account so we can save your order and delivery details.</p>
        <Link to="/account?redirect=/checkout" className="btn btn-primary">Sign In or Create Account</Link>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="container cart-empty">
        <h1 className="hero__title" style={{ fontSize: 'clamp(28px, 5vw, 44px)' }}>Nothing to Check Out</h1>
        <p>Your cart is empty.</p>
      </div>
    );
  }

  return (
    <div className="container checkout-page">
      <h1 className="hero__title" style={{ fontSize: 'clamp(28px, 5vw, 44px)', marginBottom: 28 }}>
        Checkout
      </h1>

      <form className="checkout-layout" onSubmit={handleSubmit}>
        <div className="checkout-form">
          <section className="checkout-section">
            <h2 className="checkout-section__title">Delivery Details</h2>

            <label className="field">
              <span>Full Name</span>
              <input value={form.fullName} onChange={(e) => update('fullName', e.target.value)} placeholder="e.g. Jane Wanjiru" />
            </label>

            <label className="field">
              <span>Phone Number</span>
              <input
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="07XXXXXXXX"
                inputMode="tel"
              />
            </label>

            <div className="field-row">
              <label className="field">
                <span>County</span>
                <select value={form.county} onChange={(e) => update('county', e.target.value)}>
                  <option value="">Select your county</option>
                  {KENYAN_COUNTIES.map((county) => (
                    <option key={county} value={county}>{county}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Town</span>
                <input value={form.town} onChange={(e) => update('town', e.target.value)} placeholder="e.g. Westlands, Nakuru CBD, Kisumu" />
              </label>
            </div>

            <label className="field">
              <span>Delivery Address</span>
              <input
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
                placeholder="Estate, street, building, house/door no."
              />
            </label>

            <label className="field">
              <span>Delivery Notes (optional)</span>
              <input
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                placeholder="Landmark, gate code, preferred time..."
              />
            </label>
          </section>

          <section className="checkout-section">
            <h2 className="checkout-section__title">Payment</h2>

            <div className="mpesa-instructions">
              <p className="mpesa-instructions__lead">Pay via M-Pesa — {POCHI_NAME}</p>
              <p className="mono mpesa-instructions__number">{POCHI_NUMBER}</p>
              <p className="mono">Send {formatKES(items)} (item total)</p>
              <p className="mpesa-instructions__hint">
                After you place the order, send the item total to the number above via M-Pesa {POCHI_NAME}.
                We confirm your payment, then arrange delivery. Your delivery fee ({deliveryEstimateLabel})
                is confirmed with you separately and paid before dispatch.
              </p>
            </div>
          </section>

          {error && <p className="checkout-error">{error}</p>}
        </div>

        <div className="checkout-summary">
          <h2 className="checkout-section__title">Order Summary</h2>
          {lines.map((line) => (
            <div className="checkout-summary__line" key={`${line.productId}-${line.size}-${line.color}`}>
              <span>{line.productName} <span className="mono">×{line.quantity}</span></span>
              <span className="mono">{formatKES(line.price * line.quantity)}</span>
            </div>
          ))}
          <div className="cart-summary__divider" />
          <div className="cart-summary__row">
            <span>Item Total</span>
            <span className="mono">{formatKES(items)}</span>
          </div>
          <div className="cart-summary__row">
            <span>Delivery</span>
            <span className="mono">{deliveryEstimateLabel}</span>
          </div>
          <div className="cart-summary__divider" />
          <div className="cart-summary__row cart-summary__row--total">
            <span>Pay Now via M-Pesa</span>
            <span className="mono">{formatKES(items)}</span>
          </div>
          <p className="mpesa-instructions__hint" style={{ marginTop: 6 }}>
            Delivery fee is confirmed separately and paid before dispatch.
          </p>

          <button type="submit" className="btn btn-primary checkout-submit" disabled={submitting}>
            {submitting ? 'Placing Order…' : 'Place Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
