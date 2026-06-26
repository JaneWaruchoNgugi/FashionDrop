import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useProductStore } from '../store/productStore';
import { SEED_PRODUCTS } from '../store/seedData';
import { useCartStore } from '../store/cartStore';
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

export function ProductPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { products, initialized, subscribe, getById } = useProductStore();
  const addLine = useCartStore((s) => s.addLine);

  useEffect(() => {
    const unsub = subscribe();
    return unsub;
  }, [subscribe]);

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

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setSelectedSize(sizes[0] ?? null);
    setSelectedColor(colors[0]?.[0] ?? null);
    setActiveImageIndex(0);
  }, [sizes, colors]);

  useEffect(() => {
    const index = galleryImages.findIndex((image) => image.color.toLowerCase() === (selectedColor ?? '').toLowerCase());
    if (index >= 0) setActiveImageIndex(index);
  }, [selectedColor, galleryImages]);

  if (!product) {
    return <div className="container" style={{ padding: '60px 0', textAlign: 'center' }}><p style={{ color: 'var(--color-stone)' }}>This piece isn't available — it may have sold out.</p></div>;
  }

  const activeImage = galleryImages[activeImageIndex] ?? galleryImages[0] ?? { color: selectedColor ?? 'Default', colorHex: '#c9a58f', url: product.images[0] ?? '' };
  const activeVariant = product.variants.find((v) => v.size === selectedSize && v.color === selectedColor) ?? product.variants.find((v) => v.size === selectedSize) ?? product.variants[0];
  const selectedColorHex = colors.find(([color]) => color === selectedColor)?.[1] ?? activeVariant?.colorHex ?? activeImage.colorHex;
  const inStock = (activeVariant?.stock ?? 0) > 0;

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
      quantity: 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  return (
    <div className="container product-detail">
      <div className="product-detail__gallery-shell">
        <div className="product-detail__gallery">
          <img src={activeImage.url} alt={`${product.name} ${activeImage.color}`} />
          <div className="product-detail__watermark">FashionDrop</div>
          {galleryImages.length > 1 && <><button className="product-detail__arrow product-detail__arrow--prev" onClick={() => stepImage(-1)} aria-label="Previous image">‹</button><button className="product-detail__arrow product-detail__arrow--next" onClick={() => stepImage(1)} aria-label="Next image">›</button><span className="product-detail__counter">{activeImageIndex + 1} / {galleryImages.length}</span></>}
        </div>
        {galleryImages.length > 1 && <div className="product-detail__thumbs">{galleryImages.map((image, index) => <button key={`${image.url}-${index}`} className={index === activeImageIndex ? 'is-active' : ''} onClick={() => selectImage(index)} aria-label={`View ${image.color}`}><img src={image.url} alt="" /><span style={{ background: image.colorHex }} /></button>)}</div>}
      </div>
      <div className="product-detail__info">
        {product.isNewDrop && <span className="badge badge-flame">New Drop</span>}
        <h1 className="product-detail__name">{product.name}</h1>
        <div className="product-detail__price-row"><span className="product-detail__price mono">{formatKES(product.price)}</span>{product.compareAtPrice && <span className="product-detail__compare mono">{formatKES(product.compareAtPrice)}</span>}</div>
        <p className="product-detail__desc">{product.description}</p>
        {colors.length > 0 && <div className="product-detail__option-group"><span className="product-detail__option-label">Color: {selectedColor}</span><div className="product-detail__swatch-row">{colors.map(([color, hex]) => <button key={color} className={`product-detail__swatch ${selectedColor === color ? 'is-active' : ''}`} style={{ background: hex }} onClick={() => setSelectedColor(color)} aria-label={color} aria-pressed={selectedColor === color} />)}</div></div>}
        {sizes.length > 0 && <div className="product-detail__option-group"><span className="product-detail__option-label">Size</span><div className="product-detail__size-row">{sizes.map((size) => { const sizeVariant = product.variants.find((v) => v.size === size && v.color === selectedColor) ?? product.variants.find((v) => v.size === size); const variantStock = sizeVariant?.stock ?? 0; return <button key={size} className={`product-detail__size ${selectedSize === size ? 'is-active' : ''} ${variantStock === 0 ? 'is-disabled' : ''}`} onClick={() => setSelectedSize(size)} disabled={variantStock === 0} aria-pressed={selectedSize === size}>{size}</button>; })}</div></div>}
        <button className="btn btn-primary product-detail__cta" onClick={handleAddToCart} disabled={!inStock}>{!inStock ? 'Out of Stock' : added ? 'Added ✓' : 'Add to Cart'}</button>
        {added && <button className="btn btn-outline product-detail__view-cart" onClick={() => navigate('/cart')}>View Cart</button>}
        <div className="product-detail__meta"><span className="mono">PAY ON DELIVERY OR M-PESA</span><span className="mono">NAIROBI CBD & KIAMBU DELIVERY</span></div>
      </div>
    </div>
  );
}
