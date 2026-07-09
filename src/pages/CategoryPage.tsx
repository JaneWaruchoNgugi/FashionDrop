import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useProductStore } from '../store/productStore';
import { useCategoryStore } from '../store/categoryStore';
import { ProductCard } from '../components/ProductCard';
import '../pages/HomePage.css';

export function CategoryPage() {
  const { category } = useParams<{ category: string }>();
  const { products, initialized, subscribe } = useProductStore();
  const { getByValue, subscribe: subscribeCategories } = useCategoryStore();

  useEffect(() => {
    const unsubProducts = subscribe();
    const unsubCategories = subscribeCategories();
    return () => {
      unsubProducts();
      unsubCategories();
    };
  }, [subscribe, subscribeCategories]);

  const filtered = products.filter((p) => p.category === category);
  const label = getByValue(category ?? '')?.label ?? 'Shop';

  return (
    <section className="container featured-section">
      <h1 className="hero__title" style={{ fontSize: 'clamp(32px, 6vw, 52px)', marginBottom: 24 }}>
        {label}
      </h1>
      {!initialized ? (
        <p style={{ color: 'var(--color-stone)' }}>Loading products…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--color-stone)' }}>
          No pieces in this category right now — new drops land soon.
        </p>
      ) : (
        <div className="product-grid">
          {filtered.map((product) => (
            <ProductCard product={product} key={product.id} />
          ))}
        </div>
      )}
    </section>
  );
}
