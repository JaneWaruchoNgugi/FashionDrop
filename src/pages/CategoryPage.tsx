import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useProductStore } from '../store/productStore';
import { SEED_PRODUCTS } from '../store/seedData';
import { ProductCard } from '../components/ProductCard';
import type { ProductCategory } from '../types';
import '../pages/HomePage.css';

const CATEGORY_LABELS: Record<string, string> = {
  dresses: 'Dresses',
  'two-pieces': 'Two-Pieces',
  bags: 'Bags',
  shoes: 'Shoes',
  accessories: 'Accessories',
};

export function CategoryPage() {
  const { category } = useParams<{ category: string }>();
  const { products, initialized, subscribe } = useProductStore();

  useEffect(() => {
    const unsub = subscribe();
    return unsub;
  }, [subscribe]);

  const list = initialized && products.length > 0 ? products : SEED_PRODUCTS;
  const filtered = list.filter((p) => p.category === (category as ProductCategory));
  const label = CATEGORY_LABELS[category ?? ''] ?? 'Shop';

  return (
    <section className="container featured-section">
      <h1 className="hero__title" style={{ fontSize: 'clamp(32px, 6vw, 52px)', marginBottom: 24 }}>
        {label}
      </h1>
      {filtered.length === 0 ? (
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
