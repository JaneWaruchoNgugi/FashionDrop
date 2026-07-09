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

// All 47 Kenyan counties. Nairobi gets a flat KES 200 delivery fee; everywhere
// else is a flat KES 350, confirmed with the buyer before dispatch.
export const KENYAN_COUNTIES: string[] = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu',
  'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho',
  'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale',
  'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru',
  'Migori', 'Mombasa', "Murang'a", 'Nairobi', 'Nakuru', 'Nandi', 'Narok',
  'Nyamira', 'Nyandarua', 'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta',
  'Tana River', 'Tharaka-Nithi', 'Trans Nzoia', 'Turkana', 'Uasin Gishu',
  'Vihiga', 'Wajir', 'West Pokot',
];

export function deliveryBand(county: string): { zone: DeliveryZone } & DeliveryEstimate {
  if (county.trim().toLowerCase() === 'nairobi') {
    return { zone: 'nairobi', min: 200, max: 200 };
  }
  return { zone: 'outside', min: 350, max: 350 };
}
