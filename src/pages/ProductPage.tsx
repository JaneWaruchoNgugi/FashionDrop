import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { Truck, ShieldCheck, RotateCcw, Star, Minus, Plus, ChevronRight } from 'lucide-react';
import { useProductStore } from '../store/productStore';
import { useCategoryStore } from '../store/categoryStore';
import { SEED_PRODUCTS } from '../store/seedData';
import { useCartStore } from '../store/cartStore';
import { ImageLoader } from '../components/ImageLoader';
import { ProductCard } from '../components/ProductCard';
import { POCHI_NAME, POCHI_NUMBER } from '../lib/payment';
import './ProductPage.css';

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

function imageOptions(images: string[]) {
  return images.map(parseProductImage).filter((image) => image.url);
}

type InfoTab = 'description' | 'delivery' | 'returns';

export function ProductPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { products, initialized, subscribe, getById } = useProductStore();
  const { getByValue, subscribe: subscribeCategories } = useCategoryStore();
  const addLine = useCartStore((s) => s.addLine);

  useEffect(() => {
    const unsub = subscribe();
    const unsubCategories = subscribeCategories();
    return () => {
      unsub();
      unsubCategories();
    };
  }, [subscribe, subscribeCategories]);

  const product = useMemo(() => {
    const fromStore = getById(productId ?? '');
    if (fromStore) return fromStore;
    if (!initialized || products.length === 0) return SEED_PRODUCTS.find((p) => p.id === productId);
    return undefined;
  }, [productId, products, initialized, getById]);

  const galleryImages = useMemo(() => imageOptions(product?.images ?? []), [product]);
  const sizes = useMemo(() => Array.from(new Set(product?.variants.map((v) => v.size) ?? [])), [product]);
  const colors = useMemo(() => {
    if (galleryImages.length > 0) return galleryImages.map((image) => [image.color, image.colorHex] as [string, string]);
    return Array.from(new Map(product?.variants.map((v) => [v.color, v.colorHex]) ?? []).entries());
  }, [product, galleryImages]);

  const relatedProducts = useMemo(() => {
    const list = initialized && products.length > 0 ? products : SEED_PRODUCTS;
    return list.filter((p) => p.category === product?.category && p.id !== product?.id).slice(0, 4);
  }, [products, initialized, product]);

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<InfoTab>('description');

  useEffect(() => {
    setSelectedSize(sizes[0] ?? null);
    setSelectedColor(colors[0]?.[0] ?? null);
    setActiveImageIndex(0);
    setQuantity(1);
  }, [sizes, colors]);

  useEffect(() => {
    const index = galleryImages.findIndex((image) => image.color.toLowerCase() === (selectedColor ?? '').toLowerCase());
    if (index >= 0) setActiveImageIndex(index);
  }, [selectedColor, galleryImages]);

  if (!product) {
    return <div className="container" style={{ padding: '60px 0', textAlign: 'center' }}><p style={{ color: 'var(--color-stone)' }}>This piece isn't available — it may have sold out.</p></div>;
  }

  const categoryLabel = getByValue(product.category)?.label ?? 'Shop';
  const activeImage = galleryImages[activeImageIndex] ?? galleryImages[0] ?? { color: selectedColor ?? 'Default', colorHex: '#c9a58f', url: product.images[0] ?? '' };
  const activeVariant = product.variants.find((v) => v.size === selectedSize && v.color === selectedColor) ?? product.variants.find((v) => v.size === selectedSize) ?? product.variants[0];
  const selectedColorHex = colors.find(([color]) => color === selectedColor)?.[1] ?? activeVariant?.colorHex ?? activeImage.colorHex;
  const stock = activeVariant?.stock ?? 0;
  const inStock = stock > 0;
  const lowStock = inStock && stock <= 3;
  const savings = product.compareAtPrice && product.compareAtPrice > product.price ? product.compareAtPrice - product.price : 0;
  const discountPct = savings ? Math.round((savings / (product.compareAtPrice as number)) * 100) : 0;
  const maxQty = Math.max(stock, 1);

  function selectImage(index: number) {
    const image = galleryImages[index];
    if (!image) return;
    setActiveImageIndex(index);
    setSelectedColor(image.color);
  }

  function stepImage(direction: -1 | 1) {
    if (galleryImages.length === 0) return;
    const next = (activeImageIndex + direction + galleryImages.length) % galleryImages.length;
    selectImage(next);
  }

  function changeQty(delta: number) {
    setQuantity((q) => Math.min(Math.max(q + delta, 1), maxQty));
  }

  function handleAddToCart() {
    if (!selectedSize || !selectedColor || !activeVariant) return;
    addLine({
      productId: product!.id,
      productName: product!.name,
      image: activeImage.url,
      price: product!.price,
      size: selectedSize,
      color: selectedColor,
      colorHex: selectedColorHex,
      quantity,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  return (
    <div className="container product-page">
      <nav className="product-crumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={14} />
        <Link to={`/category/${product.category}`}>{categoryLabel}</Link>
        <ChevronRight size={14} />
        <span>{product.name}</span>
      </nav>

      <div className="product-detail">
        <div className="product-detail__gallery-shell">
          <div className="product-detail__gallery">
            <ImageLoader src={activeImage.url} alt={product.name} imgClassName="product-detail__gallery-image" objectFit="contain" />
            <div className="product-detail__watermark">FashionDrop</div>
            {discountPct > 0 && <span className="product-detail__discount-tag">-{discountPct}%</span>}
            {galleryImages.length > 1 && <><button className="product-detail__arrow product-detail__arrow--prev" onClick={() => stepImage(-1)} aria-label="Previous image">‹</button><button className="product-detail__arrow product-detail__arrow--next" onClick={() => stepImage(1)} aria-label="Next image">›</button><span className="product-detail__counter">{activeImageIndex + 1} / {galleryImages.length}</span></>}
          </div>
          {galleryImages.length > 1 && <div className="product-detail__thumbs">{galleryImages.map((image, index) => <button key={`${image.url}-${index}`} className={index === activeImageIndex ? 'is-active' : ''} onClick={() => selectImage(index)} aria-label={`View ${image.color}`}><ImageLoader src={image.url} alt="" imgClassName="product-detail__thumb-image" objectFit="cover" /><span style={{ background: image.colorHex }} /></button>)}</div>}
        </div>

        <div className="product-detail__info">
          <div className="product-detail__badges">
            {product.isNewDrop && <span className="badge badge-flame">New Drop</span>}
            <span className="product-detail__category-tag">{categoryLabel}</span>
          </div>
          <h1 className="product-detail__name">{product.name}</h1>

          <div className="product-detail__rating">
            <span className="product-detail__stars">{[0, 1, 2, 3, 4].map((i) => <Star key={i} size={16} fill={i < 4 ? 'currentColor' : 'none'} strokeWidth={1.6} />)}</span>
            <span className="product-detail__rating-num">4.8</span>
            <span className="product-detail__rating-sep">·</span>
            <span className="product-detail__rating-count">Loved by customers across Kenya</span>
          </div>

          <div className="product-detail__price-row">
            <span className="product-detail__price mono">{formatKES(product.price)}</span>
            {product.compareAtPrice && <span className="product-detail__compare mono">{formatKES(product.compareAtPrice)}</span>}
            {savings > 0 && <span className="product-detail__save">Save {formatKES(savings)}</span>}
          </div>

          <div className={`product-detail__stock ${inStock ? (lowStock ? 'is-low' : 'is-in') : 'is-out'}`}>
            <i />
            {inStock ? (lowStock ? `Only ${stock} left in stock` : 'In stock — ready to ship') : 'Out of stock'}
          </div>

          <p className="product-detail__desc">{product.description}</p>

          {colors.length > 0 && <div className="product-detail__option-group"><span className="product-detail__option-label">Color: {selectedColor}</span><div className="product-detail__swatch-row">{colors.map(([color, hex]) => <button key={color} className={`product-detail__swatch ${selectedColor === color ? 'is-active' : ''}`} style={{ background: hex }} onClick={() => setSelectedColor(color)} aria-label={color} aria-pressed={selectedColor === color} />)}</div></div>}

          {sizes.length > 0 && <div className="product-detail__option-group"><span className="product-detail__option-label">Size</span><div className="product-detail__size-row">{sizes.map((size) => { const sizeVariant = product.variants.find((v) => v.size === size && v.color === selectedColor) ?? product.variants.find((v) => v.size === size); const variantStock = sizeVariant?.stock ?? 0; return <button key={size} className={`product-detail__size ${selectedSize === size ? 'is-active' : ''} ${variantStock === 0 ? 'is-disabled' : ''}`} onClick={() => setSelectedSize(size)} disabled={variantStock === 0} aria-pressed={selectedSize === size}>{size}</button>; })}</div></div>}

          <div className="product-detail__buy-row">
            <div className="product-detail__qty" aria-label="Quantity">
              <button type="button" onClick={() => changeQty(-1)} disabled={quantity <= 1} aria-label="Decrease quantity"><Minus size={16} /></button>
              <span>{quantity}</span>
              <button type="button" onClick={() => changeQty(1)} disabled={quantity >= maxQty || !inStock} aria-label="Increase quantity"><Plus size={16} /></button>
            </div>
            <button className="btn btn-primary product-detail__cta" onClick={handleAddToCart} disabled={!inStock}>{!inStock ? 'Out of Stock' : added ? 'Added ✓' : 'Add to Cart'}</button>
          </div>
          {added && <button className="btn btn-outline product-detail__view-cart" onClick={() => navigate('/cart')}>View Cart</button>}

          <ul className="product-detail__trust">
            <li><Truck size={18} strokeWidth={1.8} /><div><strong>Nationwide delivery</strong><span>Anywhere in Kenya</span></div></li>
            <li><ShieldCheck size={18} strokeWidth={1.8} /><div><strong>Pay via M-Pesa</strong><span>{POCHI_NAME} {POCHI_NUMBER}</span></div></li>
            <li><RotateCcw size={18} strokeWidth={1.8} /><div><strong>Easy returns</strong><span>Within 7 days</span></div></li>
          </ul>
        </div>
      </div>

      <section className="product-tabs">
        <div className="product-tabs__head">
          <button className={activeTab === 'description' ? 'is-active' : ''} onClick={() => setActiveTab('description')}>Description</button>
          <button className={activeTab === 'delivery' ? 'is-active' : ''} onClick={() => setActiveTab('delivery')}>Delivery &amp; Payment</button>
          <button className={activeTab === 'returns' ? 'is-active' : ''} onClick={() => setActiveTab('returns')}>Returns</button>
        </div>
        <div className="product-tabs__body">
          {activeTab === 'description' && (
            <div>
              <p>{product.description}</p>
              <ul className="product-tabs__facts">
                <li><span>Category</span><b>{categoryLabel}</b></li>
                <li><span>Available colours</span><b>{colors.map(([c]) => c).join(', ') || '—'}</b></li>
                <li><span>Available sizes</span><b>{sizes.join(', ') || 'One Size'}</b></li>
              </ul>
            </div>
          )}
          {activeTab === 'delivery' && (
            <div>
              <p>Pay for your items via <strong>M-Pesa {POCHI_NAME}: {POCHI_NUMBER}</strong>. Once we confirm your payment we prepare your order and arrange delivery.</p>
              <ul className="product-tabs__facts">
                <li><span>Nairobi</span><b>KES 100 – 200</b></li>
                <li><span>Rest of Kenya</span><b>KES 200 – 500</b></li>
                <li><span>Delivery fee</span><b>Confirmed before dispatch</b></li>
              </ul>
            </div>
          )}
          {activeTab === 'returns' && (
            <div>
              <p>Not the right fit? You can return unused items in their original condition within <strong>7 days</strong> of delivery. Contact us and we'll help arrange a return or exchange.</p>
            </div>
          )}
        </div>
      </section>

      {relatedProducts.length > 0 && (
        <section className="product-related">
          <div className="product-related__head">
            <h2>You may also like</h2>
            <Link to={`/category/${product.category}`}>View all {categoryLabel}</Link>
          </div>
          <div className="product-grid">
            {relatedProducts.map((related) => <ProductCard product={related} key={related.id} />)}
          </div>
        </section>
      )}
    </div>
  );
}
