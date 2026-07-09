// Manual M-Pesa Pochi La Biashara payment details. The customer sends the item
// subtotal to this number, and the owner confirms receipt in the admin
// dashboard before dispatch. Override via env vars for production if needed.

export const POCHI_NUMBER = import.meta.env.VITE_POCHI_NUMBER ?? '0791847766';
export const POCHI_NAME = import.meta.env.VITE_POCHI_NAME ?? 'Pochi La Biashara';
