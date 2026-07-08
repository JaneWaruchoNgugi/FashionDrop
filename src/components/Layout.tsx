import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCartStore } from '../store/cartStore';
import { useAuth } from '../context/AuthContext';
import { useCategoryStore } from '../store/categoryStore';
import './Layout.css';

export function Layout({ children }: { children: React.ReactNode }) {
  const itemCount = useCartStore((s) => s.itemCount());
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const { categories, subscribe: subscribeCategories } = useCategoryStore();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    const unsubscribe = subscribeCategories();
    return unsubscribe;
  }, [subscribeCategories]);

  if (location.pathname.startsWith('/admin')) return <>{children}</>;

  return (
    <>
      <div className="promo-bar"><span>▱ Nationwide Delivery Across Kenya</span><i /> <span>Pay via M-Pesa Pochi La Biashara</span></div>
      <header className="site-header">
        <div className="container site-header__inner">
          <button className="site-header__burger" aria-label="Open menu" onClick={() => setMenuOpen((value) => !value)}><span /><span /><span /></button>
          <Link to="/" className="site-header__logo">FashionDrop<span>.</span></Link>
          <nav className="site-header__nav">{categories.map((category) => <Link key={category.value} to={`/category/${category.value}`}>{category.label}</Link>)}</nav>
          <div className="site-header__actions">
            <Link to="/track">Track Order</Link>
            <Link to="/account">{user ? 'My Account' : 'Login / Sign Up'}</Link>
            <Link to="/cart" className="site-header__cart" aria-label={`View cart with  items`}><ShoppingBag size={22} strokeWidth={2.4} />{itemCount > 0 && <span>{itemCount}</span>}</Link>
          </div>
        </div>
        {menuOpen && <nav className="site-header__mobile-nav">{categories.map((category) => <Link key={category.value} to={`/category/${category.value}`}>{category.label}</Link>)}<Link to="/track">Track Order</Link><Link to="/account">{user ? 'My Account' : 'Login / Sign Up'}</Link></nav>}
      </header>
      <main className="site-main">{children}</main>
      <footer className="site-footer">
        <div className="container site-footer__grid">
          <div><h3>FashionDrop Kenya</h3><p>Men's & women's shoes and women's bags — delivered anywhere in Kenya.</p><div className="social-row"><span>◎</span><span>f</span><span>♪</span><span>☏</span></div></div>
          <div><h4>Quick Links</h4><a>About Us</a><Link to="/track">Track Order</Link><a>Shipping & Delivery</a><a>Returns & Refunds</a></div>
          <div><h4>Customer Care</h4><a>FAQs</a><a>Size Guide</a><a>Terms & Conditions</a><a>Privacy Policy</a></div>
          <div><h4>Stay Updated</h4><p>Subscribe to get special offers, giveaways, and new arrivals.</p><label className="footer-subscribe"><input placeholder="Enter your email" /><button>Subscribe</button></label></div>
        </div>
        <div className="container site-footer__bottom"><span>© 2026 FashionDrop Kenya. All rights reserved.</span><span>Pay via M-Pesa Pochi La Biashara</span></div>
      </footer>
    </>
  );
}
