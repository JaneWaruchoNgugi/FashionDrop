import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { Shirt, Handbag, Footprints, Gem, Sparkles, type LucideIcon } from 'lucide-react';
import { useProductStore } from '../store/productStore';
import { useCategoryStore } from '../store/categoryStore';
import { ProductCard } from '../components/ProductCard';
import { ImageLoader } from '../components/ImageLoader';
import './HomePage.css';
import heroIMG from "../Assets/hero-image.png"
function categoryIcon(value: string): LucideIcon {
  if (value.includes('shoe')) return Footprints;
  if (value.includes('bag')) return Handbag;
  if (value.includes('accessor') || value.includes('jewel')) return Gem;
  if (value.includes('piece')) return Sparkles;
  return Shirt;
}

export function HomePage() {
  const { products, initialized, subscribe } = useProductStore();
  const { categories, subscribe: subscribeCategories } = useCategoryStore();

  useEffect(() => {
    const unsubProducts = subscribe();
    const unsubCategories = subscribeCategories();
    return () => {
      unsubProducts();
      unsubCategories();
    };
  }, [subscribe, subscribeCategories]);

  const featured = products.filter((p) => p.isFeatured).slice(0, 5);

  return (
    <>
      <section className="store-hero">
        <div className="container store-hero__inner">
          <div className="store-hero__copy">
            <p>New Arrivals Just For You</p>
            <h1>New Drop<br />Just Landed</h1>
            <span>Step into the latest styles and elevate your wardrobe with our newest collection.</span>
            <div className="store-hero__actions"><Link to="/category/womens-shoes">Shop Now</Link><Link to="/category/womens-bags"><b>▶</b> Browse Collection</Link></div>
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
        <div className="store-section__head"><h2>Shop by Category</h2><Link to="/category/mens-shoes">View All</Link></div>
        <div className="category-grid">
          {categories.map((category) => {
            const Icon = categoryIcon(category.value);
            return (
              <Link to={`/category/${category.value}`} key={category.value} className="category-tile category-tile--icon">
                <span className="category-tile__icon-wrap">
                  <Icon size={34} strokeWidth={1.8} />
                </span>
                <strong>{category.label}</strong>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="container store-section">
        <div className="store-section__head"><h2>Featured Picks</h2><Link to="/category/womens-shoes">View All</Link></div>
        {!initialized ? (
          <p style={{ color: 'var(--color-stone)' }}>Loading products…</p>
        ) : featured.length === 0 ? (
          <p style={{ color: 'var(--color-stone)' }}>New featured picks land soon.</p>
        ) : (
          <div className="product-grid">{featured.map((product) => <ProductCard product={product} key={product.id} />)}</div>
        )}
      </section>

      <section className="container why-strip">
        <h2>Why Shop With Us?</h2>
        <div><article><span>▱</span><strong>Stylish & Trendy</strong><p>Stay ahead with handpicked collections</p></article><article><span>▭</span><strong>Secure Payments</strong><p>Your payments are safe with M-Pesa</p></article><article><span>☏</span><strong>Easy Returns</strong><p>Hassle-free returns within 7 days</p></article><article><span>♡</span><strong>Loved by Customers</strong><p>Thousands of happy customers across Kenya</p></article></div>
      </section>
    </>
  );
}
