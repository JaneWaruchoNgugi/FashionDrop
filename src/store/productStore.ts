import { create } from 'zustand';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Product, ProductCategory } from '../types';

interface ProductState {
  products: Product[];
  loading: boolean;
  initialized: boolean;
  subscribe: () => () => void;
  getById: (id: string) => Product | undefined;
  getByCategory: (category: ProductCategory) => Product[];
  newDrops: () => Product[];
  featured: () => Product[];
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  loading: true,
  initialized: false,

  subscribe: () => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const products = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Product[];
        set({ products, loading: false, initialized: true });
      },
      (error) => {
        console.error('Failed to subscribe to products:', error);
        set({ loading: false, initialized: true });
      }
    );
    return unsubscribe;
  },

  getById: (id) => get().products.find((p) => p.id === id),

  getByCategory: (category) =>
    get().products.filter((p) => p.category === category),

  newDrops: () => get().products.filter((p) => p.isNewDrop),

  featured: () => get().products.filter((p) => p.isFeatured),
}));
