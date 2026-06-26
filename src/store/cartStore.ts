import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartLine } from '../types';

interface CartState {
  lines: CartLine[];
  addLine: (line: CartLine) => void;
  removeLine: (productId: string, size: string, color: string) => void;
  updateQuantity: (productId: string, size: string, color: string, quantity: number) => void;
  clearCart: () => void;
  subtotal: () => number;
  itemCount: () => number;
}

function sameLine(a: CartLine, productId: string, size: string, color: string) {
  return a.productId === productId && a.size === size && a.color === color;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],

      addLine: (line) => {
        set((state) => {
          const existing = state.lines.find((l) =>
            sameLine(l, line.productId, line.size, line.color)
          );
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                sameLine(l, line.productId, line.size, line.color)
                  ? { ...l, quantity: l.quantity + line.quantity }
                  : l
              ),
            };
          }
          return { lines: [...state.lines, line] };
        });
      },

      removeLine: (productId, size, color) => {
        set((state) => ({
          lines: state.lines.filter((l) => !sameLine(l, productId, size, color)),
        }));
      },

      updateQuantity: (productId, size, color, quantity) => {
        if (quantity <= 0) {
          get().removeLine(productId, size, color);
          return;
        }
        set((state) => ({
          lines: state.lines.map((l) =>
            sameLine(l, productId, size, color) ? { ...l, quantity } : l
          ),
        }));
      },

      clearCart: () => set({ lines: [] }),

      subtotal: () =>
        get().lines.reduce((sum, l) => sum + l.price * l.quantity, 0),

      itemCount: () =>
        get().lines.reduce((sum, l) => sum + l.quantity, 0),
    }),
    { name: 'fashiondrop-cart' }
  )
);
