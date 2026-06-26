import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ORDER_STATUS_LABELS, type Order, type OrderStatus } from '../types';
import './RiderPage.css';

const RIDER_STATUSES: OrderStatus[] = ['confirmed', 'packed', 'out_for_delivery', 'delivered'];

type RiderProfile = {
  id: string;
  name: string;
  phone: string;
  area: string;
};

function formatKES(amount: number) {
  return `KSh ${amount.toLocaleString('en-KE')}`;
}

function getStoredRider(): RiderProfile | null {
  const raw = window.localStorage.getItem('fashiondrop-rider');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RiderProfile;
  } catch {
    return null;
  }
}

export function RiderPage() {
  const [rider, setRider] = useState<RiderProfile | null>(getStoredRider);
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState({ name: '', phone: '', area: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    return onSnapshot(ordersQuery, (snapshot) => {
      setOrders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Order)));
    });
  }, []);

  const openOrders = useMemo(
    () => orders.filter((order) => !order.riderId && ['confirmed', 'packed'].includes(order.status)),
    [orders]
  );

  const myOrders = useMemo(
    () => orders.filter((order) => rider && order.riderId === rider.id),
    [orders, rider]
  );

  async function registerRider(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!form.name.trim() || !/^(07|01)\d{8}$/.test(form.phone.trim()) || !form.area.trim()) {
      setMessage('Enter your name, Kenyan phone number, and delivery area.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        area: form.area.trim(),
        status: 'available',
        createdAt: Date.now(),
      };
      const ref = await addDoc(collection(db, 'riders'), payload);
      const profile = { id: ref.id, name: payload.name, phone: payload.phone, area: payload.area };
      window.localStorage.setItem('fashiondrop-rider', JSON.stringify(profile));
      setRider(profile);
    } catch (error) {
      console.error('Rider registration failed:', error);
      setMessage('Could not register rider. Check Firestore rules and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function acceptOrder(order: Order) {
    if (!rider) return;
    await updateDoc(doc(db, 'orders', order.id), {
      riderId: rider.id,
      riderName: rider.name,
      status: order.status === 'confirmed' ? 'packed' : order.status,
      updatedAt: Date.now(),
      statusHistory: [...(order.statusHistory || []), { status: order.status === 'confirmed' ? 'packed' : order.status, at: Date.now() }],
    });
  }

  async function updateStatus(order: Order, status: OrderStatus) {
    await updateDoc(doc(db, 'orders', order.id), {
      status,
      updatedAt: Date.now(),
      statusHistory: [...(order.statusHistory || []), { status, at: Date.now() }],
    });
  }

  if (!rider) {
    return (
      <section className="rider-auth">
        <form className="rider-card rider-register" onSubmit={registerRider}>
          <span className="rider-badge">FashionDrop Riders</span>
          <h1>Register for Deliveries</h1>
          <p>Join the delivery view to accept ready orders and update delivery progress.</p>
          <label><span>Full Name</span><input value={form.name} onChange={(e) => setForm((value) => ({ ...value, name: e.target.value }))} /></label>
          <label><span>Phone</span><input value={form.phone} onChange={(e) => setForm((value) => ({ ...value, phone: e.target.value }))} placeholder="07XXXXXXXX" /></label>
          <label><span>Delivery Area</span><input value={form.area} onChange={(e) => setForm((value) => ({ ...value, area: e.target.value }))} placeholder="Nairobi West, CBD, Kiambu..." /></label>
          {message && <p className="rider-error">{message}</p>}
          <button disabled={saving}>{saving ? 'Registering...' : 'Register Rider'}</button>
        </form>
      </section>
    );
  }

  return (
    <section className="rider-page">
      <header className="rider-hero">
        <div>
          <span className="rider-badge">Rider Portal</span>
          <h1>Accept and Deliver Orders</h1>
          <p>{rider.name} · {rider.phone} · {rider.area}</p>
        </div>
        <button onClick={() => { window.localStorage.removeItem('fashiondrop-rider'); setRider(null); }}>Switch Rider</button>
      </header>

      <div className="rider-grid">
        <section className="rider-card">
          <div className="rider-card__head">
            <h2>Available Orders</h2>
            <span>{openOrders.length}</span>
          </div>
          <div className="rider-list">
            {openOrders.length === 0 && <p className="rider-empty">No available orders right now.</p>}
            {openOrders.map((order) => (
              <article className="rider-order" key={order.id}>
                <div>
                  <strong>{order.orderNumber}</strong>
                  <span>{order.delivery.fullName} · {order.delivery.phone}</span>
                  <small>{order.delivery.address}, {order.delivery.town}, {order.delivery.county}</small>
                </div>
                <b>{formatKES(order.total)}</b>
                <em>{ORDER_STATUS_LABELS[order.status]}</em>
                <button onClick={() => acceptOrder(order)}>Accept</button>
              </article>
            ))}
          </div>
        </section>

        <section className="rider-card">
          <div className="rider-card__head">
            <h2>My Deliveries</h2>
            <span>{myOrders.length}</span>
          </div>
          <div className="rider-list">
            {myOrders.length === 0 && <p className="rider-empty">Accepted orders will appear here.</p>}
            {myOrders.map((order) => (
              <article className="rider-order rider-order--mine" key={order.id}>
                <div>
                  <strong>{order.orderNumber}</strong>
                  <span>{order.delivery.fullName} · {order.delivery.phone}</span>
                  <small>{order.delivery.address}, {order.delivery.town}, {order.delivery.county}</small>
                </div>
                <select value={order.status} onChange={(e) => updateStatus(order, e.target.value as OrderStatus)}>
                  {RIDER_STATUSES.map((status) => <option key={status} value={status}>{ORDER_STATUS_LABELS[status]}</option>)}
                </select>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
