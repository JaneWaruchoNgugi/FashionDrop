// ---------- Product ----------

export type ProductCategory =
  | 'dresses'
  | 'two-pieces'
  | 'bags'
  | 'shoes'
  | 'accessories';

export interface ProductVariant {
  size: string;
  color: string;
  colorHex: string;
  stock: number;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  price: number; // KES
  compareAtPrice?: number; // for "was/now" styling
  description: string;
  images: string[];
  variants: ProductVariant[];
  isNewDrop: boolean;
  isFeatured: boolean;
  createdAt: number;
}

// ---------- Cart ----------

export interface CartLine {
  productId: string;
  productName: string;
  image: string;
  price: number;
  size: string;
  color: string;
  colorHex: string;
  quantity: number;
}

// ---------- Order ----------

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'packed'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'mpesa_manual' | 'pay_on_delivery';

export interface DeliveryDetails {
  fullName: string;
  phone: string;
  county: string;
  town: string;
  address: string;
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber: string; // human-friendly, e.g. FD-2026-0001
  lines: CartLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  delivery: DeliveryDetails;
  paymentMethod: PaymentMethod;
  mpesaCode?: string; // customer-entered confirmation code, for manual verification
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: number }[];
  riderId?: string;
  riderName?: string;
  proofOfDeliveryImage?: string;
  createdAt: number;
  updatedAt: number;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  packed: 'Packed',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'pending',
  'confirmed',
  'packed',
  'out_for_delivery',
  'delivered',
];

export const DELIVERY_AREAS = [
  { label: 'Nairobi CBD', value: 'Nairobi CBD', feeMin: 250, feeMax: 350 },
  { label: 'Kiambu', value: 'Kiambu', feeMin: 400, feeMax: 500 },
];

export const KENYAN_COUNTIES = DELIVERY_AREAS.map((area) => area.value);
