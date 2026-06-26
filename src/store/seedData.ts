import type { Product } from '../types';

// Used for local dev preview before Firestore is connected, and as a
// reference for the shape Admin should write when adding products.
export const SEED_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Amara Wrap Dress',
    category: 'dresses',
    price: 3200,
    compareAtPrice: 4000,
    description:
      'Soft crepe wrap dress with adjustable waist tie. Flattering V-neck, midi length, fully lined.',
    images: [
      'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800',
    ],
    variants: [
      { size: 'S', color: 'Rust', colorHex: '#B5502E', stock: 4 },
      { size: 'M', color: 'Rust', colorHex: '#B5502E', stock: 6 },
      { size: 'L', color: 'Rust', colorHex: '#B5502E', stock: 2 },
      { size: 'M', color: 'Black', colorHex: '#161616', stock: 5 },
    ],
    isNewDrop: true,
    isFeatured: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 2,
  },
  {
    id: 'p2',
    name: 'Zuri Co-ord Set',
    category: 'two-pieces',
    price: 2800,
    description:
      'Cropped top and high-waisted trouser two-piece in ribbed fabric. Stretch fit, true to size.',
    images: [
      'https://images.unsplash.com/photo-1551803091-e20673f15770?w=800',
    ],
    variants: [
      { size: 'S', color: 'Sage', colorHex: '#8A9A78', stock: 3 },
      { size: 'M', color: 'Sage', colorHex: '#8A9A78', stock: 7 },
      { size: 'L', color: 'Sage', colorHex: '#8A9A78', stock: 0 },
    ],
    isNewDrop: true,
    isFeatured: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 5,
  },
  {
    id: 'p3',
    name: 'Nia Structured Tote',
    category: 'bags',
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
    id: 'p4',
    name: 'Imani Block Heels',
    category: 'shoes',
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
    id: 'p5',
    name: 'Asha Gold Hoops',
    category: 'accessories',
    price: 900,
    description: 'Lightweight gold-plated hoop earrings, hypoallergenic posts.',
    images: [
      'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800',
    ],
    variants: [
      { size: 'One Size', color: 'Gold', colorHex: '#D4AF37', stock: 15 },
    ],
    isNewDrop: true,
    isFeatured: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 1,
  },
  {
    id: 'p6',
    name: 'Folake Maxi Dress',
    category: 'dresses',
    price: 3800,
    description:
      'Flowy maxi dress with puff sleeves and tie waist. Breathable cotton-blend, ankle length.',
    images: [
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800',
    ],
    variants: [
      { size: 'S', color: 'Emerald', colorHex: '#2E6B4F', stock: 3 },
      { size: 'M', color: 'Emerald', colorHex: '#2E6B4F', stock: 4 },
      { size: 'L', color: 'Emerald', colorHex: '#2E6B4F', stock: 1 },
    ],
    isNewDrop: true,
    isFeatured: true,
    createdAt: Date.now() - 1000 * 60 * 30,
  },
];
