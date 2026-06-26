import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { Shirt, Handbag, Footprints, Gem, Sparkles } from 'lucide-react';
import { useProductStore } from '../store/productStore';
import { SEED_PRODUCTS } from '../store/seedData';
import { ProductCard } from '../components/ProductCard';
import { ImageLoader } from '../components/ImageLoader';
import './HomePage.css';
import heroIMG from "../Assets/hero-image.png"
const CATEGORY_TILES = [
  { label: 'Dresses', value: 'dresses', Icon: Shirt },
  { label: 'Two-Pieces', value: 'two-pieces', Icon: Sparkles },
  { label: 'Bags', value: 'bags', Icon: Handbag },
  { label: 'Shoes', value: 'shoes', Icon: Footprints },
  { label: 'Accessories', value: 'accessories', Icon: Gem },
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
          <ImageLoader src={heroIMG} alt="FashionDrop hero" wrapperClassName="store-hero__image-wrap" imgClassName="store-hero__image" objectFit="cover" loading="eager" />
        </div>
      </section>

      {/*<section className="container service-strip">*/}
      {/*  <article><span>▱</span><div><strong>Nairobi CBD & Kiambu Delivery</strong><p>CBD KES 250-350 · Kiambu KES 400-500</p></div></article>*/}
      {/*  <article><span>▭</span><div><strong>Pay on Delivery</strong><p>Or pay securely via M-Pesa</p></div></article>*/}
      {/*  <article><span>◇</span><div><strong>Quality Guaranteed</strong><p>Premium quality you can trust</p></div></article>*/}
      {/*  <article><span>☏</span><div><strong>Customer Support</strong><p>We're here to help</p></div></article>*/}
      {/*</section>*/}

      <section className="container store-section">
        <div className="store-section__head"><h2>Shop by Category</h2><Link to="/category/dresses">View All</Link></div>
        <div className="category-grid">
          {CATEGORY_TILES.map(({ label, value, Icon }) => (
            <Link to={`/category/${value}`} key={value} className="category-tile category-tile--icon">
              <span className="category-tile__icon-wrap">
                <Icon size={34} strokeWidth={1.8} />
              </span>
              <strong>{label}</strong>
            </Link>
          ))}
        </div>
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
