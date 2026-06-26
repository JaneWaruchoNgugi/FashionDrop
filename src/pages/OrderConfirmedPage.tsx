import { useParams, useLocation, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
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
        We've got your order. You'll get an SMS update as it moves through each stage.
      </p>

      {order && <OrderStatusTracker status={order.status} />}

      {order && (
        <div className="order-confirmed__details">
          <div>
            <span className="order-confirmed__label">Delivering to</span>
            <p>{order.delivery.fullName} · {order.delivery.phone}</p>
            <p>{order.delivery.address}, {order.delivery.town}, {order.delivery.county}</p>
          </div>
          <div>
            <span className="order-confirmed__label">Payment</span>
            <p>{order.paymentMethod === 'mpesa_manual' ? 'M-Pesa' : 'Pay on Delivery'}</p>
          </div>
          <div>
            <span className="order-confirmed__label">Total</span>
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
