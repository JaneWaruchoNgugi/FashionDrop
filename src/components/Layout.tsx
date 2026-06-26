import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useCartStore } from '../store/cartStore';
import './Layout.css';

const CATEGORIES = [
  { label: 'Dresses', value: 'dresses' },
  { label: 'Two-Pieces', value: 'two-pieces' },
  { label: 'Bags', value: 'bags' },
  { label: 'Shoes', value: 'shoes' },
  { label: 'Accessories', value: 'accessories' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const itemCount = useCartStore((s) => s.itemCount());
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  if (location.pathname.startsWith('/admin')) return <>{children}</>;

  return (
    <>
      <div className="promo-bar"><span>▱ Nairobi CBD & Kiambu Delivery</span><i /> <span>Pay on Delivery or M-Pesa</span></div>
      <header className="site-header">
        <div className="container site-header__inner">
          <button className="site-header__burger" aria-label="Open menu" onClick={() => setMenuOpen((value) => !value)}><span /><span /><span /></button>
          <Link to="/" className="site-header__logo">FashionDrop<span>.</span></Link>
          <nav className="site-header__nav">{CATEGORIES.map((cat) => <Link key={cat.value} to={`/category/${cat.value}`}>{cat.label}</Link>)}</nav>
          <div className="site-header__actions">
            <Link to="/track">Track Order</Link>
            <Link to="/rider">Riders</Link>
            <Link to="/admin">Account</Link>
            <Link to="/cart" className="site-header__cart" aria-label="View cart">⌁{itemCount > 0 && <span>{itemCount}</span>}</Link>
          </div>
        </div>
        {menuOpen && <nav className="site-header__mobile-nav">{CATEGORIES.map((cat) => <Link key={cat.value} to={`/category/${cat.value}`}>{cat.label}</Link>)}<Link to="/track">Track Order</Link><Link to="/rider">Riders</Link><Link to="/admin">Account</Link></nav>}
      </header>
      <main className="site-main">{children}</main>
      <footer className="site-footer">
        <div className="container site-footer__grid">
          <div><h3>FashionDrop Kenya</h3><p>Dresses, bags, two-pieces, shoes & accessories — delivered in Nairobi CBD and Kiambu.</p><div className="social-row"><span>◎</span><span>f</span><span>♪</span><span>☏</span></div></div>
          <div><h4>Quick Links</h4><a>About Us</a><Link to="/track">Track Order</Link><a>Shipping & Delivery</a><a>Returns & Refunds</a></div>
          <div><h4>Customer Care</h4><a>FAQs</a><a>Size Guide</a><a>Terms & Conditions</a><a>Privacy Policy</a></div>
          <div><h4>Stay Updated</h4><p>Subscribe to get special offers, giveaways, and new arrivals.</p><label className="footer-subscribe"><input placeholder="Enter your email" /><button>Subscribe</button></label></div>
        </div>
        <div className="container site-footer__bottom"><span>© 2026 FashionDrop Kenya. All rights reserved.</span><span>Pay on Delivery or M-Pesa</span></div>
      </footer>
    </>
  );
}
