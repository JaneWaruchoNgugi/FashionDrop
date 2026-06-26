import { Link } from 'react-router-dom';
import type { Product } from '../types';
import { ImageLoader } from './ImageLoader';
import './ProductCard.css';

function formatKES(amount: number) {
  return `KES ${amount.toLocaleString('en-KE')}`;
}

function parseProductImage(entry: string | undefined) {
  if (!entry) return { color: 'Default', colorHex: '#c9a58f', url: '' };
  const separator = entry.indexOf('|');
  if (separator === -1) return { color: 'Default', colorHex: '#c9a58f', url: entry };
  const rawMeta = entry.slice(0, separator) || 'Default';
  const [rawColor, rawHex] = rawMeta.split('::');
  return { color: rawColor || 'Default', colorHex: rawHex || '#c9a58f', url: entry.slice(separator + 1) };
}

function imageUrl(entry: string | undefined) {
  return parseProductImage(entry).url;
}

export function ProductCard({ product }: { product: Product }) {
  const imageSwatches = product.images.map(parseProductImage).filter((image) => image.url && image.color !== 'Default');
  const colorSwatches = imageSwatches.length > 0
    ? imageSwatches.map((image) => [image.color, image.colorHex] as [string, string])
    : Array.from(new Map(product.variants.map((v) => [v.color, v.colorHex])).entries());
  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);

  return (
    <Link to={`/product/${product.id}`} className="product-card">
      <div className="product-card__image-wrap">
        <ImageLoader src={imageUrl(product.images[0])} alt={product.name} />
        {product.isNewDrop && <span className="badge badge-flame product-card__tag">New</span>}
        <button className="product-card__heart" type="button" aria-label="Save product">♡</button>
        {totalStock === 0 && <span className="product-card__sold-out">Sold Out</span>}
      </div>
      <div className="product-card__info">
        <h3 className="product-card__name">{product.name}</h3>
        <div className="product-card__price-row">
          <span className="product-card__price">{formatKES(product.price)}</span>
          {product.compareAtPrice && <span className="product-card__compare">{formatKES(product.compareAtPrice)}</span>}
        </div>
        {colorSwatches.length > 0 && (
          <div className="product-card__meta-row">
            <div className="product-card__swatches" aria-hidden="true">
              {colorSwatches.map(([color, hex]) => <span key={color} className="product-card__swatch" style={{ background: hex }} title={color} />)}
            </div>
            <span>{Array.from(new Set(product.variants.map((v) => v.size))).join('  ')}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
