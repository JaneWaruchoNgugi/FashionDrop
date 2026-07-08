import { create } from 'zustand';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export type StoreCategory = {
  id: string;
  value: string;
  label: string;
  sizes: string[];
  order: number;
  disabled?: boolean;
};

export const DEFAULT_CATEGORIES: StoreCategory[] = [
  { id: 'dresses', value: 'dresses', label: 'Dresses', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], order: 10 },
  { id: 'two-pieces', value: 'two-pieces', label: 'Two-Pieces', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], order: 20 },
  { id: 'three-pieces', value: 'three-pieces', label: '3 Piece', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], order: 30 },
  { id: 'trousers', value: 'trousers', label: 'Trousers', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '28', '30', '32', '34', '36', '38', '40'], order: 40 },
  { id: 'bags', value: 'bags', label: 'Bags', sizes: ['One Size'], order: 50 },
  { id: 'shoes', value: 'shoes', label: 'Shoes', sizes: ['36', '37', '38', '39', '40', '41', '42'], order: 60 },
  { id: 'accessories', value: 'accessories', label: 'Accessories', sizes: ['One Size'], order: 70 },
];

type CategoryState = {
  categories: StoreCategory[];
  loading: boolean;
  initialized: boolean;
  subscribe: () => () => void;
  getByValue: (value: string) => StoreCategory | undefined;
};

function normalizeCategory(id: string, data: Record<string, unknown>): StoreCategory {
  const value = String(data.value || id).trim();
  const label = String(data.label || value).trim();
  const sizes = Array.isArray(data.sizes)
    ? data.sizes.map((size) => String(size).trim()).filter(Boolean)
    : ['One Size'];
  return {
    id,
    value,
    label,
    sizes: sizes.length > 0 ? sizes : ['One Size'],
    order: Number(data.order || 999),
    disabled: data.disabled === true,
  };
}

function mergeCategories(remoteCategories: StoreCategory[]) {
  const byValue = new Map(DEFAULT_CATEGORIES.map((category) => [category.value, category]));
  remoteCategories.forEach((category) => byValue.set(category.value, category));
  return Array.from(byValue.values())
    .filter((category) => !category.disabled)
    .sort((a, b) => a.order - b.order);
}

export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: DEFAULT_CATEGORIES,
  loading: true,
  initialized: false,

  subscribe: () => {
    const q = query(collection(db, 'categories'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const categories = snapshot.docs.map((doc) => normalizeCategory(doc.id, doc.data()));
        set({
          categories: mergeCategories(categories),
          loading: false,
          initialized: true,
        });
      },
      (error) => {
        console.error('Failed to subscribe to categories:', error);
        set({ categories: DEFAULT_CATEGORIES, loading: false, initialized: true });
      }
    );
    return unsubscribe;
  },

  getByValue: (value) => get().categories.find((category) => category.value === value),
}));
