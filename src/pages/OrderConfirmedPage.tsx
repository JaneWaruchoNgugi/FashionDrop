import { useParams, useLocation, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { POCHI_NAME, POCHI_NUMBER } from '../lib/payment';
import { OrderStatusTracker } from '../components/OrderStatusTracker';
import type { Order } from '../types';
import './OrderConfirmedPage.css';

function formatKES(amount: number) {
  return `KES ${amount.toLocaleString('en-KE')}`;
}

export function OrderConfirmedPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const stateOrderNumber = (location.state as { orderNumber?: string } | null)?.orderNumber;
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!orderId) return;
    const unsub = onSnapshot(doc(db, 'orders', orderId), (snap) => {
      if (snap.exists()) {
        setOrder({ id: snap.id, ...snap.data() } as Order);
      }
    });
    return unsub;
  }, [orderId]);

  return (
    <div className="container order-confirmed">
      <span className="badge badge-flame">Order Placed</span>
      <h1 className="hero__title" style={{ fontSize: 'clamp(32px, 6vw, 52px)', margin: '14px 0' }}>
        Thanks{order ? `, ${order.delivery.fullName.split(' ')[0]}` : ''}!
      </h1>
      <p className="order-confirmed__order-number mono">
        Order {order?.orderNumber ?? stateOrderNumber ?? '—'}
      </p>
      <p className="order-confirmed__sub">
        We've got your order. Send your payment via M-Pesa {POCHI_NAME} so we can confirm it and arrange delivery.
      </p>

      {order && <OrderStatusTracker status={order.status} />}

      {order && order.status === 'pending_payment' && (
        <div className="mpesa-instructions" style={{ margin: '24px auto', maxWidth: 680 }}>
          <p className="mpesa-instructions__lead">Pay via M-Pesa — {POCHI_NAME}</p>
          <p className="mono mpesa-instructions__number">{POCHI_NUMBER}</p>
          <p className="mono">Send {formatKES(order.total)}{order.deliveryFee > 0 ? ` (${formatKES(order.subtotal)} items + ${formatKES(order.deliveryFee)} delivery)` : ' (item total)'}</p>
          <p className="mpesa-instructions__hint">
            Use your order number <strong>{order.orderNumber}</strong> as the M-Pesa reference if asked.
            {order.deliveryFee > 0 ? ' The delivery fee is included in this total.' : ''} Once we receive your
            payment we'll confirm this order and arrange dispatch.
          </p>
        </div>
      )}

      {order && order.status !== 'pending_payment' && order.status !== 'cancelled' && (
        <div className="mpesa-instructions" style={{ margin: '24px auto', maxWidth: 680 }}>
          <p className="mpesa-instructions__lead">Payment confirmed ✓</p>
          <p className="mpesa-instructions__hint">Thanks! We've confirmed your payment and your order is being prepared for delivery.</p>
        </div>
      )}

      {order && (
        <div className="order-confirmed__details">
          <div>
            <span className="order-confirmed__label">Delivering to</span>
            <p>{order.delivery.fullName} · {order.delivery.phone}</p>
            <p>{order.delivery.address}, {order.delivery.town}, {order.delivery.county}</p>
          </div>
          <div>
            <span className="order-confirmed__label">Payment</span>
            <p>{order.paymentStatus === 'paid' ? 'Paid via M-Pesa' : `M-Pesa ${POCHI_NAME}`}</p>
          </div>
          <div>
            <span className="order-confirmed__label">Item Total</span>
            <p className="mono">{formatKES(order.total)}</p>
          </div>
        </div>
      )}

      <div className="order-confirmed__actions">
        <Link to="/track" className="btn btn-outline">Track This Order</Link>
        <Link to="/" className="btn btn-primary">Continue Shopping</Link>
      </div>
    </div>
  );
}
