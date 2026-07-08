// ---------- Product ----------

export type ProductCategory = string;

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
  | 'pending_payment'
  | 'paid'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus = 'unpaid' | 'paid';

export interface DeliveryDetails {
  fullName: string;
  phone: string;
  county: string;
  town: string;
  address: string;
  notes?: string;
}

export type DeliveryZone = 'nairobi' | 'outside';

export interface DeliveryEstimate {
  min: number;
  max: number;
}

export interface Order {
  id: string;
  buyerId: string;
  buyerEmail: string;
  orderNumber: string; // human-friendly, e.g. FD-2026-0001
  lines: CartLine[];
  subtotal: number;
  deliveryZone: DeliveryZone;
  deliveryEstimate: DeliveryEstimate; // shown to customer; not charged upfront
  deliveryFee: number; // actual fee the owner confirms/records; defaults to 0
  total: number; // amount to settle; starts at subtotal, owner may update
  delivery: DeliveryDetails;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: number }[];
  createdAt: number;
  updatedAt: number;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Pending Payment',
  paid: 'Paid',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'pending_payment',
  'paid',
  'out_for_delivery',
  'delivered',
];

// ---------- Delivery ----------

// All 47 Kenyan counties. Nairobi gets the low delivery band; everywhere else
// is quoted by distance and confirmed by the owner before dispatch.
export const KENYAN_COUNTIES: string[] = [
  'Mombasa', 'Kwale', 'Kilifi', 'Tana River', 'Lamu', 'Taita-Taveta',
  'Garissa', 'Wajir', 'Mandera', 'Marsabit', 'Isiolo', 'Meru',
  'Tharaka-Nithi', 'Embu', 'Kitui', 'Machakos', 'Makueni', 'Nyandarua',
  'Nyeri', 'Kirinyaga', "Murang'a", 'Kiambu', 'Turkana', 'West Pokot',
  'Samburu', 'Trans Nzoia', 'Uasin Gishu', 'Elgeyo-Marakwet', 'Nandi',
  'Baringo', 'Laikipia', 'Nakuru', 'Narok', 'Kajiado', 'Kericho', 'Bomet',
  'Kakamega', 'Vihiga', 'Bungoma', 'Busia', 'Siaya', 'Kisumu', 'Homa Bay',
  'Migori', 'Kisii', 'Nyamira', 'Nairobi',
];

export function deliveryBand(county: string): { zone: DeliveryZone } & DeliveryEstimate {
  if (county.trim().toLowerCase() === 'nairobi') {
    return { zone: 'nairobi', min: 100, max: 200 };
  }
  return { zone: 'outside', min: 200, max: 500 };
}
