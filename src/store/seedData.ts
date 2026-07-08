import type { Product } from '../types';

// Used for local dev preview before Firestore is connected, and as a
// reference for the shape Admin should write when adding products.
export const SEED_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Jabari Leather Derby',
    category: 'mens-shoes',
    price: 4500,
    compareAtPrice: 5500,
    description:
      'Classic lace-up derby in genuine leather with a cushioned insole and durable rubber sole. Smart-casual, true to size.',
    images: [
      'https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=800',
    ],
    variants: [
      { size: '41', color: 'Brown', colorHex: '#5A3A22', stock: 4 },
      { size: '42', color: 'Brown', colorHex: '#5A3A22', stock: 6 },
      { size: '43', color: 'Black', colorHex: '#161616', stock: 5 },
      { size: '44', color: 'Black', colorHex: '#161616', stock: 3 },
    ],
    isNewDrop: true,
    isFeatured: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 2,
  },
  {
    id: 'p2',
    name: 'Simba Street Sneaker',
    category: 'mens-shoes',
    price: 3800,
    description:
      'Lightweight low-top sneaker with breathable knit upper and foam midsole. Everyday comfort, true to size.',
    images: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800',
    ],
    variants: [
      { size: '40', color: 'White', colorHex: '#F2F2F2', stock: 5 },
      { size: '41', color: 'White', colorHex: '#F2F2F2', stock: 7 },
      { size: '42', color: 'Grey', colorHex: '#8A8A8A', stock: 4 },
    ],
    isNewDrop: true,
    isFeatured: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 5,
  },
  {
    id: 'p3',
    name: 'Imani Block Heels',
    category: 'womens-shoes',
    price: 3500,
    description:
      'Comfort block heel with ankle strap. 7cm heel height, cushioned insole, true to size.',
    images: [
      'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800',
    ],
    variants: [
      { size: '37', color: 'Nude', colorHex: '#D8B49C', stock: 2 },
      { size: '38', color: 'Nude', colorHex: '#D8B49C', stock: 5 },
      { size: '39', color: 'Nude', colorHex: '#D8B49C', stock: 4 },
      { size: '38', color: 'Black', colorHex: '#161616', stock: 6 },
    ],
    isNewDrop: false,
    isFeatured: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 30,
  },
  {
    id: 'p4',
    name: 'Zawadi Strappy Sandal',
    category: 'womens-shoes',
    price: 2900,
    compareAtPrice: 3400,
    description:
      'Elegant strappy flat sandal with a soft padded footbed. Perfect for all-day wear, true to size.',
    images: [
      'https://images.unsplash.com/photo-1603487742131-4160ec999306?w=800',
    ],
    variants: [
      { size: '37', color: 'Tan', colorHex: '#C19A6B', stock: 6 },
      { size: '38', color: 'Tan', colorHex: '#C19A6B', stock: 4 },
      { size: '39', color: 'Gold', colorHex: '#D4AF37', stock: 3 },
    ],
    isNewDrop: true,
    isFeatured: false,
    createdAt: Date.now() - 1000 * 60 * 30,
  },
  {
    id: 'p5',
    name: 'Nia Structured Tote',
    category: 'womens-bags',
    price: 2200,
    description:
      'Vegan leather structured tote with gold-tone hardware. Interior zip pocket, magnetic close.',
    images: [
      'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=800',
    ],
    variants: [
      { size: 'One Size', color: 'Tan', colorHex: '#C19A6B', stock: 10 },
      { size: 'One Size', color: 'Black', colorHex: '#161616', stock: 8 },
    ],
    isNewDrop: false,
    isFeatured: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    id: 'p6',
    name: 'Amani Crossbody Bag',
    category: 'womens-bags',
    price: 1800,
    compareAtPrice: 2300,
    description:
      'Compact crossbody with adjustable strap and gold chain detail. Fits phone, cards, and essentials.',
    images: [
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800',
    ],
    variants: [
      { size: 'One Size', color: 'Cream', colorHex: '#E8DCC8', stock: 9 },
      { size: 'One Size', color: 'Maroon', colorHex: '#7B2D3A', stock: 6 },
    ],
    isNewDrop: true,
    isFeatured: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 1,
  },
];
