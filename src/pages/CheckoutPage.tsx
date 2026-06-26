import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useCartStore } from '../store/cartStore';
import { db } from '../lib/firebase';
import { DELIVERY_AREAS, type DeliveryDetails, type Order, type PaymentMethod } from '../types';
import './CheckoutPage.css';

function formatKES(amount: number) {
  return `KES ${amount.toLocaleString('en-KE')}`;
}

const MPESA_PAYMENT_LABEL = import.meta.env.VITE_MPESA_PAYMENT_LABEL ?? 'PAYBILL: 000000';

export function CheckoutPage() {
  const { lines, subtotal, clearCart } = useCartStore();
  const navigate = useNavigate();

  const [form, setForm] = useState<DeliveryDetails>({
    fullName: '',
    phone: '',
    county: '',
    town: '',
    address: '',
    notes: '',
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pay_on_delivery');
  const [mpesaCode, setMpesaCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDeliveryArea = DELIVERY_AREAS.find((area) => area.value === form.county);
  const deliveryFee = selectedDeliveryArea?.feeMin ?? 0;
  const deliveryFeeLabel = selectedDeliveryArea
    ? formatKES(selectedDeliveryArea.feeMin) + ' - ' + formatKES(selectedDeliveryArea.feeMax)
    : 'Select area';
  const total = subtotal() + deliveryFee;

  function update<K extends keyof DeliveryDetails>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): string | null {
    if (!form.fullName.trim()) return 'Enter your full name.';
    if (!/^(07|01)\d{8}$/.test(form.phone.trim())) return 'Enter a valid Kenyan phone number, e.g. 0712345678.';
    if (!form.county) return 'Select Nairobi CBD or Kiambu for delivery.';
    if (!form.town.trim()) return 'Enter your town.';
    if (!form.address.trim()) return 'Enter your delivery address.';
    if (paymentMethod === 'mpesa_manual' && !mpesaCode.trim()) {
      return 'Enter your M-Pesa confirmation code.';
    }
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

      const orderPayload: Omit<Order, 'id'> = {
        orderNumber,
        lines,
        subtotal: subtotal(),
        deliveryFee,
        total,
        delivery: form,
        paymentMethod,
        mpesaCode: paymentMethod === 'mpesa_manual' ? mpesaCode.trim() : undefined,
        status: 'pending',
        statusHistory: [{ status: 'pending', at: now }],
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
                <span>Delivery Area</span>
                <select value={form.county} onChange={(e) => update('county', e.target.value)}>
                  <option value="">Select delivery area</option>
                  {DELIVERY_AREAS.map((area) => (
                    <option key={area.value} value={area.value}>{area.label} ({formatKES(area.feeMin)} - {formatKES(area.feeMax)})</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Town</span>
                <input value={form.town} onChange={(e) => update('town', e.target.value)} placeholder="e.g. Kimathi Street, Two Rivers, Thindigua" />
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

            <div className="payment-options">
              <button
                type="button"
                className={`payment-option ${paymentMethod === 'pay_on_delivery' ? 'is-active' : ''}`}
                onClick={() => setPaymentMethod('pay_on_delivery')}
              >
                <span className="payment-option__title">Pay on Delivery</span>
                <span className="payment-option__desc">Pay cash or M-Pesa when your order arrives</span>
              </button>

              <button
                type="button"
                className={`payment-option ${paymentMethod === 'mpesa_manual' ? 'is-active' : ''}`}
                onClick={() => setPaymentMethod('mpesa_manual')}
              >
                <span className="payment-option__title">M-Pesa Till/Paybill</span>
                <span className="payment-option__desc">Pay now and enter your confirmation code</span>
              </button>
            </div>

            {paymentMethod === 'mpesa_manual' && (
              <div className="mpesa-instructions">
                <p className="mono">
                  {MPESA_PAYMENT_LABEL} &nbsp;·&nbsp; ACCOUNT: YOUR ORDER PHONE NUMBER
                </p>
                <p className="mpesa-instructions__hint">
                  Send {formatKES(total)} via M-Pesa, then enter the confirmation code below.
                </p>
                <label className="field">
                  <span>M-Pesa Confirmation Code</span>
                  <input
                    value={mpesaCode}
                    onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                    placeholder="e.g. QGH7XJ2KLM"
                  />
                </label>
              </div>
            )}
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
            <span>Subtotal</span>
            <span className="mono">{formatKES(subtotal())}</span>
          </div>
          <div className="cart-summary__row">
            <span>Delivery</span>
            <span className="mono">{deliveryFeeLabel}</span>
          </div>
          <div className="cart-summary__divider" />
          <div className="cart-summary__row cart-summary__row--total">
            <span>Total</span>
            <span className="mono">{formatKES(total)}</span>
          </div>

          <button type="submit" className="btn btn-primary checkout-submit" disabled={submitting}>
            {submitting ? 'Placing Order…' : 'Place Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
