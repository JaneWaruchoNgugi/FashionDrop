import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useProductStore } from '../store/productStore';
import { SEED_PRODUCTS } from '../store/seedData';
import { ProductCard } from '../components/ProductCard';
import './HomePage.css';

const CATEGORY_TILES = [
  { label: 'Dresses', value: 'dresses', image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=900' },
  { label: 'Two-Pieces', value: 'two-pieces', image: 'https://images.unsplash.com/photo-1551803091-e20673f15770?w=900' },
  { label: 'Bags', value: 'bags', image: 'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=900' },
  { label: 'Shoes', value: 'shoes', image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=900' },
  { label: 'Accessories', value: 'accessories', image: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=900' },
];

export function HomePage() {
  const { products, initialized, subscribe } = useProductStore();

  useEffect(() => {
    const unsub = subscribe();
    return unsub;
  }, [subscribe]);

  const list = initialized && products.length > 0 ? products : SEED_PRODUCTS;
  const featured = list.filter((p) => p.isFeatured).slice(0, 5);

  return (
    <>
      <section className="store-hero">
        <div className="container store-hero__inner">
          <div className="store-hero__copy">
            <p>New Arrivals Just For You</p>
            <h1>New Drop<br />Just Landed</h1>
            <span>Step into the latest styles and elevate your wardrobe with our newest collection.</span>
            <div className="store-hero__actions"><Link to="/category/dresses">Shop Now</Link><Link to="/category/accessories"><b>▶</b> Browse Collection</Link></div>
          </div>
          <img src="https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=1000" alt="FashionDrop new dress collection" />
        </div>
      </section>

      <section className="container service-strip">
        <article><span>▱</span><div><strong>Nairobi CBD & Kiambu Delivery</strong><p>CBD KES 250-350 · Kiambu KES 400-500</p></div></article>
        <article><span>▭</span><div><strong>Pay on Delivery</strong><p>Or pay securely via M-Pesa</p></div></article>
        <article><span>◇</span><div><strong>Quality Guaranteed</strong><p>Premium quality you can trust</p></div></article>
        <article><span>☏</span><div><strong>Customer Support</strong><p>We're here to help</p></div></article>
      </section>

      <section className="container store-section">
        <div className="store-section__head"><h2>Shop by Category</h2><Link to="/category/dresses">View All</Link></div>
        <div className="category-grid">{CATEGORY_TILES.map((tile) => <Link to={`/category/${tile.value}`} key={tile.value} className="category-tile"><img src={tile.image} alt={tile.label} loading="lazy" /><span>▱</span><strong>{tile.label}</strong></Link>)}</div>
      </section>

      <section className="container store-section">
        <div className="store-section__head"><h2>Featured Picks</h2><Link to="/category/dresses">View All</Link></div>
        <div className="product-grid">{featured.map((product) => <ProductCard product={product} key={product.id} />)}</div>
      </section>

      <section className="container why-strip">
        <h2>Why Shop With Us?</h2>
        <div><article><span>▱</span><strong>Stylish & Trendy</strong><p>Stay ahead with handpicked collections</p></article><article><span>▭</span><strong>Secure Payments</strong><p>Your payments are safe with M-Pesa</p></article><article><span>☏</span><strong>Easy Returns</strong><p>Hassle-free returns within 7 days</p></article><article><span>♡</span><strong>Loved by Customers</strong><p>Thousands of happy customers across Kenya</p></article></div>
      </section>
    </>
  );
}
