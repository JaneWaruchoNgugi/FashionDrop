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
  { id: 'mens-shoes', value: 'mens-shoes', label: "Men's Shoes", sizes: ['39', '40', '41', '42', '43', '44', '45'], order: 10 },
  { id: 'womens-shoes', value: 'womens-shoes', label: "Women's Shoes", sizes: ['36', '37', '38', '39', '40', '41', '42'], order: 20 },
  { id: 'womens-bags', value: 'womens-bags', label: "Women's Bags", sizes: ['One Size'], order: 30 },
];

// Maps category slugs from the old catalog onto the current three categories so
// existing products keep showing after the redesign. Bags are unambiguously
// women's; the old gender-neutral "shoes" slug maps to women's shoes as a
// default — re-categorise any men's shoes in the admin dashboard.
export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  bags: 'womens-bags',
  shoes: 'womens-shoes',
};

export function normalizeProductCategory(value: string): string {
  return LEGACY_CATEGORY_MAP[value] ?? value;
}

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
