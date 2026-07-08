import { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { deleteApp, initializeApp } from 'firebase/app';
import { auth, db, firebaseConfig, storage } from '../lib/firebase';
import { DEFAULT_CATEGORIES, normalizeProductCategory, useCategoryStore } from '../store/categoryStore';
import {
  ORDER_STATUS_LABELS,
  type Order,
  type OrderStatus,
  type Product,
  type ProductCategory,
  type ProductVariant,
} from '../types';
import './AdminPage.css';

const ORDER_STATUSES: OrderStatus[] = ['pending_payment', 'paid', 'out_for_delivery', 'delivered', 'cancelled'];

const FALLBACK_SIZE_PRESETS = DEFAULT_CATEGORIES.reduce((acc, category) => ({ ...acc, [category.value]: category.sizes }), {} as Record<string, string[]>);

type AdminView =
  | 'dashboard'
  | 'products'
  | 'categories'
  | 'orders'
  | 'customers'
  | 'reviews'
  | 'coupons'
  | 'analytics'
  | 'reports'
  | 'deliveries'
  | 'store-settings'
  | 'payment-settings'
  | 'users';

type AdminUser = {
  id: string;
  email: string;
  name?: string;
  role?: string;
  createdAt?: number;
  createdBy?: string;
};

type ProductForm = {
  name: string;
  category: ProductCategory;
  price: string;
  compareAtPrice: string;
  description: string;
  images: string;
  variants: string;
  isNewDrop: boolean;
  isFeatured: boolean;
};

const blankForm: ProductForm = {
  name: '',
  category: 'mens-shoes',
  price: '',
  compareAtPrice: '',
  description: '',
  images: '',
  variants: 'S,Rust,#B5502E,5',
  isNewDrop: true,
  isFeatured: false,
};

const navGroups: { title: string; items: { view: AdminView; label: string; icon: string }[] }[] = [
  { title: 'Store', items: [
    { view: 'dashboard', label: 'Dashboard', icon: '⌂' },
    { view: 'products', label: 'Products', icon: '▣' },
    { view: 'categories', label: 'Categories', icon: '▤' },
    { view: 'orders', label: 'Orders', icon: '▢' },
    { view: 'customers', label: 'Customers', icon: '◎' },
    { view: 'reviews', label: 'Reviews', icon: '☆' },
    { view: 'coupons', label: 'Coupons', icon: '%' },
  ] },
  { title: 'Sales & Reports', items: [
    { view: 'analytics', label: 'Analytics', icon: '▥' },
    { view: 'reports', label: 'Reports', icon: '▧' },
  ] },
  { title: 'Delivery', items: [
    { view: 'deliveries', label: 'Deliveries', icon: '▱' },
  ] },
  { title: 'Settings', items: [
    { view: 'store-settings', label: 'Store Settings', icon: '⚙' },
    { view: 'payment-settings', label: 'Payment Settings', icon: '▭' },
    { view: 'users', label: 'Users', icon: '◉' },
  ] },
];

function formatKES(amount: number) {
  return `KSh ${amount.toLocaleString('en-KE')}`;
}

function formatDate(value: unknown) {
  if (!value) return 'Today';
  if (typeof value === 'number') return new Date(value).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' });
  if (typeof value === 'object' && value && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return 'Today';
}

function parseAmount(value: string) {
  const amount = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(amount) ? amount : 0;
}

function parseProductImage(entry: string) {
  const separator = entry.indexOf('|');
  if (separator === -1) return { color: 'Default', colorHex: '#c9a58f', url: entry };
  const rawMeta = entry.slice(0, separator) || 'Default';
  const [rawColor, rawHex] = rawMeta.split('::');
  return {
    color: rawColor || 'Default',
    colorHex: rawHex || '#c9a58f',
    url: entry.slice(separator + 1),
  };
}

function imageEntries(raw: string) {
  return raw
    .split('\n')
    .map((image) => image.trim())
    .filter(Boolean)
    .filter((entry) => Boolean(parseProductImage(entry).url))
    .slice(0, 4);
}

function parseVariants(raw: string): ProductVariant[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [size, color, colorHex, stock] = line.split(',').map((part) => part.trim());
      return { size, color, colorHex: colorHex || '#111111', stock: Number(stock || 0) };
    })
    .filter((variant) => variant.size && variant.color && Number.isFinite(variant.stock));
}

function uniqueVariantColors(variants: ProductVariant[], fallbackColor: string, fallbackHex: string) {
  const colors = new Map<string, string>();
  variants.forEach((variant) => {
    if (variant.color) colors.set(variant.color, variant.colorHex || '#111111');
  });
  if (colors.size === 0) colors.set(fallbackColor || 'Default', fallbackHex || '#111111');
  return Array.from(colors.entries());
}

function selectedVariantSizes(raw: string) {
  return Array.from(new Set(parseVariants(raw).map((variant) => variant.size)));
}

function buildVariantsForSizes(raw: string, sizes: string[], fallbackColor: string, fallbackHex: string) {
  const current = parseVariants(raw);
  const colors = uniqueVariantColors(current, fallbackColor, fallbackHex);
  const rows: ProductVariant[] = [];
  sizes.forEach((size) => {
    colors.forEach(([color, colorHex]) => {
      const existing = current.find((variant) => variant.size === size && variant.color === color);
      rows.push(existing ?? { size, color, colorHex, stock: 5 });
    });
  });
  return rows.map((variant) => variant.size + ',' + variant.color + ',' + variant.colorHex + ',' + variant.stock).join('\n');
}

function productToForm(product: Product): ProductForm {
  return {
    name: product.name,
    category: product.category,
    price: String(product.price),
    compareAtPrice: product.compareAtPrice ? String(product.compareAtPrice) : '',
    description: product.description,
    images: product.images.join('\n'),
    variants: product.variants.map((variant) => `${variant.size},${variant.color},${variant.colorHex},${variant.stock}`).join('\n'),
    isNewDrop: product.isNewDrop,
    isFeatured: product.isFeatured,
  };
}

function isAdminProfile(data: Record<string, unknown> | undefined, email: string | null) {
  if (!data) return false;
  const role = String(data.role ?? data.Role ?? '').trim().toLowerCase();
  const profileEmail = String(data.email ?? '').trim().toLowerCase();
  return role === 'admin' || (!!email && profileEmail === email.toLowerCase());
}

async function safeGetDoc(ref: Parameters<typeof getDoc>[0]) {
  try {
    return await getDoc(ref);
  } catch (error) {
    console.warn('Optional admin profile lookup failed:', error);
    return null;
  }
}

function statusClass(status: OrderStatus) {
  return `admin-status admin-status--${status.replace(/_/g, '-')}`;
}

export function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [login, setLogin] = useState({ email: '', password: '' });
  const [authError, setAuthError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState<ProductForm>(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadColor, setUploadColor] = useState("Default");
  const [uploadHex, setUploadHex] = useState("#c9a58f");
  const [uploadingImages, setUploadingImages] = useState(false);
  const [activeView, setActiveView] = useState<AdminView>('dashboard');
  const [categoryForm, setCategoryForm] = useState({ label: '', sizes: 'XS,S,M,L,XL' });
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '' });
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const { categories, subscribe: subscribeCategories } = useCategoryStore();

  useEffect(() => {
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthError(null);
      setIsAdmin(false);
      if (currentUser) {
        const [adminSnap, userSnap, lowerUserSnap] = await Promise.all([
          safeGetDoc(doc(db, 'admins', currentUser.uid)),
          safeGetDoc(doc(db, 'Users', currentUser.uid)),
          safeGetDoc(doc(db, 'users', currentUser.uid)),
        ]);
        setIsAdmin(
          !!adminSnap?.exists() ||
            isAdminProfile(userSnap?.exists() ? (userSnap.data() as Record<string, unknown>) : undefined, currentUser.email) ||
            isAdminProfile(lowerUserSnap?.exists() ? (lowerUserSnap.data() as Record<string, unknown>) : undefined, currentUser.email)
        );
      }
      setCheckingAuth(false);
    });
  }, []);

  useEffect(() => {
    if (!user || !isAdmin) return;
    const unsubscribeCategories = subscribeCategories();
    const productsQuery = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      setProducts(snapshot.docs.map((item) => {
        const data = item.data() as Omit<Product, 'id'>;
        return { id: item.id, ...data, category: normalizeProductCategory(data.category) } as Product;
      }));
    });
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      setOrders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Order)));
    });
    const unsubscribeAdmins = onSnapshot(collection(db, 'admins'), (snapshot) => {
      setAdminUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as AdminUser)));
    }, (error) => console.warn('Could not read admin users:', error));
    return () => {
      unsubscribeProducts();
      unsubscribeOrders();
      unsubscribeAdmins();
      unsubscribeCategories();
    };
  }, [user, isAdmin, subscribeCategories]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(term));
  }, [products, search]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((order) => `${order.orderNumber} ${order.delivery.fullName} ${order.delivery.phone} ${order.status}`.toLowerCase().includes(term));
  }, [orders, search]);

  const customers = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; county: string; orders: number; spent: number; orderIds: string[] }>();
    orders.forEach((order) => {
      const key = order.delivery.phone;
      const existing = map.get(key) ?? { name: order.delivery.fullName, phone: key, county: order.delivery.county, orders: 0, spent: 0, orderIds: [] };
      existing.orders += 1;
      existing.spent += order.total || 0;
      existing.orderIds.push(order.id);
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.spent - a.spent);
  }, [orders]);

  type CustomerRow = (typeof customers)[number];

  const dashboard = useMemo(() => {
    const revenue = orders.reduce((total, order) => total + (order.total || 0), 0);
    const statusCounts = ORDER_STATUSES.reduce((acc, status) => ({ ...acc, [status]: orders.filter((order) => order.status === status).length }), {} as Record<OrderStatus, number>);
    const productSales = new Map<string, { name: string; image: string; sold: number }>();
    orders.forEach((order) => {
      order.lines.forEach((line) => {
        const existing = productSales.get(line.productId) ?? { name: line.productName, image: line.image, sold: 0 };
        existing.sold += line.quantity;
        productSales.set(line.productId, existing);
      });
    });
    const topProducts = Array.from(productSales.values()).sort((a, b) => b.sold - a.sold).slice(0, 5);
    const lowStock = products.filter((product) => product.variants.some((variant) => variant.stock <= 2)).length;
    return { revenue, statusCounts, topProducts, lowStock };
  }, [orders, products]);

  const selectedSizes = useMemo(() => selectedVariantSizes(form.variants), [form.variants]);
  const sizeOptions = categories.find((category) => category.value === form.category)?.sizes ?? FALLBACK_SIZE_PRESETS[form.category] ?? ['One Size'];

  function applySizes(sizes: string[]) {
    setForm((value) => ({
      ...value,
      variants: buildVariantsForSizes(value.variants, sizes, uploadColor, uploadHex),
    }));
  }

  function handleCategoryChange(category: ProductCategory) {
    const nextSizes = categories.find((item) => item.value === category)?.sizes ?? FALLBACK_SIZE_PRESETS[category] ?? ['One Size'];
    setForm((value) => ({
      ...value,
      category,
      variants: buildVariantsForSizes(value.variants, nextSizes.slice(0, 1), uploadColor, uploadHex),
    }));
  }

  const variantColorOptions = useMemo(() => {
    const variants = parseVariants(form.variants);
    const seen = new Map<string, string>();
    variants.forEach((variant) => {
      if (variant.color && !seen.has(variant.color)) seen.set(variant.color, variant.colorHex);
    });
    return Array.from(seen.entries()).map(([color, colorHex]) => ({ color, colorHex }));
  }, [form.variants]);

  const productColor = variantColorOptions[0] ?? { color: uploadColor || 'Default', colorHex: uploadHex };

  function variantsToText(rows: ProductVariant[]) {
    return rows.map((v) => `${v.size},${v.color},${v.colorHex},${v.stock}`).join('\n');
  }

  function toggleSize(size: string) {
    const next = selectedSizes.includes(size)
      ? selectedSizes.filter((s) => s !== size)
      : [...selectedSizes, size];
    applySizes(next);
  }

  function sizeStockValue(size: string) {
    const row = parseVariants(form.variants).find((v) => v.size === size);
    return row ? row.stock : 5;
  }

  function setSizeStock(size: string, stock: number) {
    const value = Number.isFinite(stock) ? Math.max(stock, 0) : 0;
    const rows = parseVariants(form.variants).map((v) => (v.size === size ? { ...v, stock: value } : v));
    setForm((current) => ({ ...current, variants: variantsToText(rows) }));
  }

  function setProductColor(color: string, colorHex: string) {
    const name = color.trim() || 'Default';
    const bySize = new Map<string, ProductVariant>();
    parseVariants(form.variants).forEach((v) => bySize.set(v.size, { ...v, color: name, colorHex }));
    setForm((current) => ({ ...current, variants: variantsToText(Array.from(bySize.values())) }));
    setUploadColor(name);
    setUploadHex(colorHex);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, login.email.trim(), login.password);
    } catch (error) {
      console.error('Admin login failed:', error);
      setAuthError('Login failed. Check the admin email and password.');
    }
  }

  function categorySlug(label: string) {
    return label
      .trim()
      .toLowerCase()
      .split("")
      .map((char) => ((char >= "a" && char <= "z") || (char >= "0" && char <= "9") ? char : "-"))
      .join("")
      .split("-")
      .filter(Boolean)
      .join("-");
  }
  async function saveCategory(e: React.FormEvent) {
    e.preventDefault();
    const label = categoryForm.label.trim();
    const value = categorySlug(label);
    const sizes = categoryForm.sizes.split(',').map((size) => size.trim()).filter(Boolean);
    if (!label || !value) { setMessage('Enter a category name.'); return; }
    await setDoc(doc(db, 'categories', value), { value, label, sizes: sizes.length > 0 ? sizes : ['One Size'], order: categories.length > 0 ? Math.max(...categories.map((category) => category.order || 0)) + 10 : 10, updatedAt: Date.now() }, { merge: true });
    setCategoryForm({ label: '', sizes: 'XS,S,M,L,XL' });
    setMessage('Category saved.');
  }

  async function removeCategory(value: string) {
    const productCount = products.filter((product) => product.category === value).length;
    if (productCount > 0) { setMessage('Move or delete products in this category before removing it.'); return; }
    await setDoc(doc(db, 'categories', value), { value, disabled: true, updatedAt: Date.now() }, { merge: true });
    setMessage('Category removed.');
  }

  async function handleImageFiles(files: FileList | File[]) {
    const fileList = Array.from(files).filter((file) => file.type.startsWith("image/"));
    const existing = imageEntries(form.images);
    const availableSlots = 4 - existing.length;
    const selected = fileList.slice(0, Math.max(availableSlots, 0));
    if (selected.length === 0) {
      setMessage("Each product can have a maximum of 4 images.");
      return;
    }
    setUploadingImages(true);
    setMessage(null);
    try {
      const uploaded = await Promise.all(selected.map(async (file) => {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = `products/${Date.now()}-${safeName}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        return `${uploadColor.trim() || "Default"}::${uploadHex}|${url}`;
      }));
      setForm((value) => ({ ...value, images: [...existing, ...uploaded].join("\n") }));
    } catch (error) {
      console.error("Image upload failed:", error);
      setMessage("Image upload failed. Check Firebase Storage rules and try again.");
    } finally {
      setUploadingImages(false);
    }
  }

  function removeImage(index: number) {
    const next = imageEntries(form.images).filter((_, itemIndex) => itemIndex !== index);
    setForm((value) => ({ ...value, images: next.join("\n") }));
  }

  function updateImageColor(index: number, color: string) {
    const next = imageEntries(form.images).map((entry, itemIndex) => {
      if (itemIndex !== index) return entry;
      const parsed = parseProductImage(entry);
      return `${color.trim() || "Default"}::${parsed.colorHex}|${parsed.url}`;
    });
    setForm((value) => ({ ...value, images: next.join("\n") }));
  }

  async function handleProductSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const variants = parseVariants(form.variants);
    const images = imageEntries(form.images);
    const price = parseAmount(form.price);
    const compareAtPrice = form.compareAtPrice ? parseAmount(form.compareAtPrice) : undefined;

    const fail = (reason: string) => { setMessage(reason); setSaving(false); };
    if (!form.name.trim()) return fail('Enter a product name.');
    if (!price) return fail('Enter a valid price, e.g. 1299.');
    if (!form.description.trim()) return fail('Add a short description.');
    if (variants.length === 0) return fail('Tap at least one size in "Sizes & stock".');
    if (images.length < 1 || images.length > 4) return fail('Add between 1 and 4 photos.');

    const productPayload = {
      name: form.name.trim(),
      category: form.category,
      price,
      compareAtPrice: compareAtPrice || undefined,
      description: form.description.trim(),
      images,
      variants,
      isNewDrop: form.isNewDrop,
      isFeatured: form.isFeatured,
      createdAt: editingId ? products.find((product) => product.id === editingId)?.createdAt ?? Date.now() : Date.now(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'products', editingId), productPayload);
        setMessage('Product updated.');
      } else {
        await addDoc(collection(db, 'products'), productPayload);
        setMessage('Product added.');
      }
      setForm(blankForm);
      setEditingId(null);
      setActiveView('products');
    } catch (error) {
      console.error('Product save failed:', error);
      setMessage('Could not save the product. Check Firestore permissions.');
    } finally {
      setSaving(false);
    }
  }

  async function updateOrderStatus(order: Order, status: OrderStatus) {
    const now = Date.now();
    // Confirming payment (or any post-payment stage) marks the order paid;
    // reverting to pending marks it unpaid; cancelling keeps the prior state.
    const paymentStatus =
      status === 'pending_payment' ? 'unpaid'
        : status === 'cancelled' ? order.paymentStatus
          : 'paid';
    await updateDoc(doc(db, 'orders', order.id), {
      status,
      paymentStatus,
      updatedAt: now,
      statusHistory: [...(order.statusHistory || []), { status, at: now }],
    });
  }

  async function deleteOrder(order: Order) {
    if (!window.confirm(`Delete order ${order.orderNumber}? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'orders', order.id));
    } catch (error) {
      console.error('Delete order failed:', error);
      setMessage('Could not delete the order. Check Firestore permissions.');
    }
  }

  async function deleteCustomer(customer: CustomerRow) {
    if (!window.confirm(`Delete ${customer.name} and their ${customer.orders} order(s)? This cannot be undone.`)) return;
    try {
      await Promise.all(customer.orderIds.map((id) => deleteDoc(doc(db, 'orders', id))));
    } catch (error) {
      console.error('Delete customer failed:', error);
      setMessage('Could not delete the customer. Check Firestore permissions.');
    }
  }

  async function addAdminUser(e: React.FormEvent) {
    e.preventDefault();
    const email = adminForm.email.trim().toLowerCase();
    const name = adminForm.name.trim();
    const password = adminForm.password;
    setAdminMessage(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setAdminMessage('Enter a valid email address.'); return; }
    if (password.length < 6) { setAdminMessage('Password must be at least 6 characters.'); return; }

    setCreatingAdmin(true);
    // Create the auth account on a SECONDARY app so the current admin stays signed in.
    const secondaryApp = initializeApp(firebaseConfig, `admin-creator-${Date.now()}`);
    try {
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      await setDoc(doc(db, 'admins', cred.user.uid), {
        email,
        name: name || email,
        role: 'admin',
        createdAt: Date.now(),
        createdBy: user?.email ?? '',
      });
      await signOut(secondaryAuth);
      setAdminForm({ name: '', email: '', password: '' });
      setAdminMessage(`Admin ${email} added. They can sign in at /admin with this password.`);
    } catch (error) {
      console.error('Add admin failed:', error);
      const code = (error as { code?: string }).code ?? '';
      if (code === 'auth/email-already-in-use') setAdminMessage('That email already has an account.');
      else if (code === 'auth/weak-password') setAdminMessage('Password is too weak — use at least 6 characters.');
      else setAdminMessage('Could not add the admin. Check the details and try again.');
    } finally {
      await deleteApp(secondaryApp).catch(() => undefined);
      setCreatingAdmin(false);
    }
  }

  async function removeAdmin(admin: AdminUser) {
    if (admin.id === user?.uid) { setAdminMessage("You can't remove your own admin access."); return; }
    if (!window.confirm(`Remove admin access for ${admin.email}? Their login stays but they lose the dashboard.`)) return;
    try {
      await deleteDoc(doc(db, 'admins', admin.id));
      setAdminMessage(`Removed admin access for ${admin.email}.`);
    } catch (error) {
      console.error('Remove admin failed:', error);
      setAdminMessage('Could not remove this admin. Check Firestore permissions.');
    }
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setForm(productToForm(product));
    setActiveView('products');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function changeView(view: AdminView) {
    setActiveView(view);
    setSidebarOpen(false);
  }

  if (checkingAuth) {
    return <div className="admin-auth-screen"><div className="admin-auth-card">Checking admin access...</div></div>;
  }

  if (!user) {
    return (
      <div className="admin-auth-screen">
        <form className="admin-auth-card" onSubmit={handleLogin}>
          <div className="admin-auth-logo"><span>▾</span><strong>FashionDrop</strong><small>Kenya</small></div>
          <h1>Admin Sign In</h1>
          <label className="admin-field"><span>Email</span><input value={login.email} onChange={(e) => setLogin((value) => ({ ...value, email: e.target.value }))} type="email" /></label>
          <label className="admin-field"><span>Password</span><input value={login.password} onChange={(e) => setLogin((value) => ({ ...value, password: e.target.value }))} type="password" /></label>
          {authError && <p className="admin-error">{authError}</p>}
          <button className="admin-primary" type="submit">Sign In</button>
        </form>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="admin-auth-screen">
        <section className="admin-auth-card admin-auth-card--wide">
          <h1>Admin Access Needed</h1>
          <p>
            Signed in as {user.email}. Add this account under Users/{user.uid} with role admin,
            or create admins/{user.uid}, then sign in again.
          </p>
          <button className="admin-secondary" onClick={() => signOut(auth)}>Sign Out</button>
        </section>
      </div>
    );
  }

  return (
    <div className="admin-console">
      <aside className={`admin-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="admin-brand"><span className="admin-brand__icon">▾</span><div><strong>Fashion<span>Drop</span></strong><small>Kenya</small></div></div>
        <nav className="admin-nav">
          {navGroups.map((group) => (
            <div className="admin-nav__group" key={group.title}>
              <p>{group.title}</p>
              {group.items.map((item) => (
                <button key={item.view} className={activeView === item.view ? 'is-active' : ''} onClick={() => changeView(item.view)}>
                  <span>{item.icon}</span>{item.label}
                  {item.view === 'orders' && orders.length > 0 && <em>{orders.length}</em>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="admin-help"><span>☏</span><div><strong>Need Help?</strong><small>Contact Support</small></div></div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <button className="admin-menu" onClick={() => setSidebarOpen((value) => !value)} aria-label="Toggle admin menu">☰</button>
          <label className="admin-search"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search for products, orders, customers..." /><span>⌕</span></label>
          <div className="admin-topbar__spacer" />
          <button className="admin-bell" aria-label="Notifications">♢<em>5</em></button>
          <div className="admin-profile"><div className="admin-avatar">{(user.email?.[0] ?? 'A').toUpperCase()}</div><div><strong>Admin</strong><small>Super Admin</small></div><button onClick={() => signOut(auth)}>⌄</button></div>
        </header>

        <main className="admin-content">
          {activeView === 'dashboard' && renderDashboard()}
          {activeView === 'products' && renderProducts()}
          {activeView === 'categories' && renderCategories()}
          {activeView === 'orders' && renderOrders()}
          {activeView === 'customers' && renderCustomers()}
          {activeView === 'reviews' && renderReviews()}
          {activeView === 'coupons' && renderCoupons()}
          {activeView === 'analytics' && renderAnalytics()}
          {activeView === 'reports' && renderReports()}
          {activeView === 'deliveries' && renderDeliveries()}
          {activeView === 'store-settings' && renderStoreSettings()}
          {activeView === 'payment-settings' && renderPaymentSettings()}
          {activeView === 'users' && renderUsers()}
        </main>
      </div>
    </div>
  );

  function renderPageHeader(title: string, subtitle: string, action?: React.ReactNode) {
    return <div className="admin-page-head"><div><h1>{title}</h1><p>{subtitle}</p></div><div className="admin-page-actions">{action}</div></div>;
  }

  function renderDashboard() {
    return (
      <>
        {renderPageHeader('Dashboard', 'Welcome back, Admin', <><button className="admin-date">▣ May 19, 2024 - May 26, 2024</button><button className="admin-primary" onClick={() => setActiveView('products')}>+ Add Product</button></>)}
        <section className="admin-stat-grid">
          <article className="admin-stat-card"><span className="pink">▢</span><div><p>Total Orders</p><strong>{orders.length || 0}</strong><small>↑ 18.5% from last week</small></div></article>
          <article className="admin-stat-card"><span className="purple">$</span><div><p>Total Sales</p><strong>{formatKES(dashboard.revenue)}</strong><small>↑ 22.7% from last week</small></div></article>
          <article className="admin-stat-card"><span className="green">◎</span><div><p>Total Customers</p><strong>{customers.length}</strong><small>↑ 16.3% from last week</small></div></article>
          <article className="admin-stat-card"><span className="orange">▣</span><div><p>Products</p><strong>{products.length}</strong><small>↑ 8.2% from last week</small></div></article>
        </section>
        <section className="admin-dashboard-grid">
          <article className="admin-card admin-card--chart"><div className="admin-card-head"><h2>Sales Overview</h2><button>This Week ▾</button></div><SalesChart /></article>
          <article className="admin-card"><div className="admin-card-head"><h2>Recent Orders</h2><button onClick={() => setActiveView('orders')}>View All</button></div><OrdersTable compact /></article>
          <article className="admin-card"><div className="admin-card-head"><h2>Top Selling Products</h2><button onClick={() => setActiveView('products')}>View All</button></div><TopProducts /></article>
          <article className="admin-card"><div className="admin-card-head"><h2>Orders by Status</h2></div><StatusDonut /></article>
        </section>
      </>
    );
  }

  function renderProducts() {
    return (
      <>
        {renderPageHeader('Products', 'Manage product catalog, stock, images, and product flags.', <button className="admin-primary" onClick={() => { setEditingId(null); setForm(blankForm); }}>+ Add Product</button>)}
        <section className="admin-two-col">
          <form className="admin-card admin-form admin-product-form" onSubmit={handleProductSave}>
            <h2>{editingId ? 'Edit Product' : 'Add Product'}</h2>

            <div className="admin-step">
              <p className="admin-step__title"><span>1</span> Product details</p>
              <label className="admin-field"><span>Name</span><input value={form.name} onChange={(e) => setForm((value) => ({ ...value, name: e.target.value }))} placeholder="e.g. Jabari Leather Derby" /></label>
              <div className="admin-field-row">
                <label className="admin-field"><span>Category</span><select value={form.category} onChange={(e) => handleCategoryChange(e.target.value as ProductCategory)}>{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
                <label className="admin-field"><span>Price (KES)</span><input value={form.price} onChange={(e) => setForm((value) => ({ ...value, price: e.target.value }))} inputMode="numeric" placeholder="0" /></label>
              </div>
              <label className="admin-field"><span>Old price — optional, shows a discount</span><input value={form.compareAtPrice} onChange={(e) => setForm((value) => ({ ...value, compareAtPrice: e.target.value }))} inputMode="numeric" placeholder="Leave blank if no discount" /></label>
              <label className="admin-field"><span>Description</span><textarea value={form.description} onChange={(e) => setForm((value) => ({ ...value, description: e.target.value }))} placeholder="Materials, fit, what's included…" /></label>
            </div>

            <div className="admin-step">
              <p className="admin-step__title"><span>2</span> Colour</p>
              <div className="admin-field-row">
                <label className="admin-field"><span>Colour name</span><input value={productColor.color} onChange={(e) => setProductColor(e.target.value, productColor.colorHex)} placeholder="Black, Tan, Beige…" /></label>
                <label className="admin-field admin-color-picker"><span>Swatch</span><input type="color" value={productColor.colorHex} onChange={(e) => setProductColor(productColor.color, e.target.value)} /></label>
              </div>
            </div>

            <div className="admin-step">
              <p className="admin-step__title"><span>3</span> Sizes &amp; stock</p>
              <div className="admin-field">
                <span>Tap the sizes you have</span>
                <div className="admin-size-chips">
                  {sizeOptions.map((size) => (
                    <button type="button" key={size} className={`admin-chip ${selectedSizes.includes(size) ? 'is-active' : ''}`} onClick={() => toggleSize(size)}>{size}</button>
                  ))}
                </div>
              </div>
              {selectedSizes.length > 0 && (
                <div className="admin-field">
                  <span>How many in stock?</span>
                  <div className="admin-stock-grid">
                    {selectedSizes.map((size) => (
                      <label className="admin-stock-cell" key={size}>
                        <b>{size}</b>
                        <input type="number" min={0} value={sizeStockValue(size)} onChange={(e) => setSizeStock(size, Number(e.target.value))} />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="admin-step">
              <p className="admin-step__title"><span>4</span> Photos <em>1–4</em></p>
              <div
                className="admin-dropzone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleImageFiles(e.dataTransfer.files); }}
              >
                <strong>{uploadingImages ? 'Uploading photos…' : 'Drag photos here'}</strong>
                <span>Or use the button below. New photos use the colour above.</span>
                <label className="admin-upload-btn">
                  Choose photos
                  <input type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && handleImageFiles(e.target.files)} />
                </label>
              </div>
              {imageEntries(form.images).length > 0 && (
                <div className="admin-photo-grid">
                  {imageEntries(form.images).map((entry, index) => {
                    const image = parseProductImage(entry);
                    return (
                      <div className="admin-photo" key={`${image.url}-${index}`}>
                        <button className="admin-image-remove" type="button" onClick={() => removeImage(index)} aria-label="Remove photo">×</button>
                        <img src={image.url} alt="" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="admin-checks"><label><input type="checkbox" checked={form.isNewDrop} onChange={(e) => setForm((value) => ({ ...value, isNewDrop: e.target.checked }))} /> New drop</label><label><input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm((value) => ({ ...value, isFeatured: e.target.checked }))} /> Featured</label></div>

            <details className="admin-advanced">
              <summary>Advanced (colours per photo &amp; manual entry)</summary>
              <div className="admin-photo-grid admin-photo-grid--colors">
                {imageEntries(form.images).map((entry, index) => {
                  const image = parseProductImage(entry);
                  return (
                    <div className="admin-photo" key={`c-${image.url}-${index}`}>
                      <img src={image.url} alt="" />
                      <div className="admin-image-color-chip" style={{ background: image.colorHex }} />
                      <input value={image.color} onChange={(e) => updateImageColor(index, e.target.value)} aria-label="Photo colour" />
                    </div>
                  );
                })}
              </div>
              <label className="admin-field"><span>Image URLs — Color|URL, one per line</span><textarea value={form.images} onChange={(e) => setForm((value) => ({ ...value, images: e.target.value }))} /></label>
              <label className="admin-field"><span>Variants — size,color,#hex,stock</span><textarea value={form.variants} onChange={(e) => setForm((value) => ({ ...value, variants: e.target.value }))} /></label>
            </details>

            {message && <p className="admin-message">{message}</p>}
            <div className="admin-actions-row"><button className="admin-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Product'}</button>{editingId && <button className="admin-secondary" type="button" onClick={() => { setEditingId(null); setForm(blankForm); }}>Cancel</button>}</div>
          </form>
          <section className="admin-card"><h2>Product Inventory</h2><ProductsTable /></section>
        </section>
      </>
    );
  }

  function renderCategories() {
    return (
      <>
        {renderPageHeader('Categories', 'Add, remove, and manage storefront categories without editing code.')}
        <section className="admin-card admin-form">
          <h2>Add Category</h2>
          <form onSubmit={saveCategory}>
            <div className="admin-field-row">
              <label className="admin-field"><span>Category Name</span><input value={categoryForm.label} onChange={(e) => setCategoryForm((value) => ({ ...value, label: e.target.value }))} placeholder="e.g. Denim, Blazers, Swimwear" /></label>
              <label className="admin-field"><span>Sizes</span><input value={categoryForm.sizes} onChange={(e) => setCategoryForm((value) => ({ ...value, sizes: e.target.value }))} placeholder="S,M,L,XL or One Size" /></label>
            </div>
            <button className="admin-primary" type="submit">Save Category</button>
          </form>
        </section>
        <section className="admin-metric-list">
          {categories.map((category) => {
            const productCount = products.filter((product) => product.category === category.value).length;
            return (
              <article className="admin-card admin-category-card" key={category.value}>
                <strong>{category.label}</strong>
                <span>{productCount} products · {category.sizes.join(', ')}</span>
                <button onClick={() => setActiveView('products')}>Manage</button>
                <button className="danger" onClick={() => removeCategory(category.value)} disabled={productCount > 0}>Remove</button>
              </article>
            );
          })}
        </section>
      </>
    );
  }

  function renderOrders() {
    return <>{renderPageHeader('Orders', 'Review orders, delivery details, payments, and fulfillment status.')}<section className="admin-card"><OrdersTable /></section></>;
  }

  function renderCustomers() {
    return <>{renderPageHeader('Customers', 'Customer records generated from completed checkouts.')}<section className="admin-card"><CustomersTable /></section></>;
  }

  function renderReviews() {
    return <>{renderPageHeader('Reviews', 'Monitor product feedback and customer experience signals.')}<section className="admin-metric-list"><InfoCard title="Average Rating" value="4.8" note="From customer follow-ups" /><InfoCard title="Pending Reviews" value="0" note="No pending review queue" /><InfoCard title="Flagged Reviews" value="0" note="No flagged content" /></section></>;
  }

  function renderCoupons() {
    return <>{renderPageHeader('Coupons', 'Plan promotions and discount campaigns.')}<section className="admin-metric-list"><InfoCard title="Active Coupons" value="0" note="Ready for campaign setup" /><InfoCard title="Redeemed" value="0" note="No coupon redemptions yet" /><InfoCard title="Discount Budget" value={formatKES(0)} note="Tracked when coupons launch" /></section></>;
  }

  function renderAnalytics() {
    return <>{renderPageHeader('Analytics', 'Sales, customers, and inventory performance.')}<section className="admin-dashboard-grid"><article className="admin-card admin-card--chart"><div className="admin-card-head"><h2>Sales Overview</h2></div><SalesChart /></article><article className="admin-card"><div className="admin-card-head"><h2>Orders by Status</h2></div><StatusDonut /></article></section></>;
  }

  function renderReports() {
    return <>{renderPageHeader('Reports', 'Operational summaries for store decisions.')}<section className="admin-metric-list"><InfoCard title="Gross Sales" value={formatKES(dashboard.revenue)} note="All recorded orders" /><InfoCard title="Low Stock" value={String(dashboard.lowStock)} note="Products with variants at 2 or fewer" /><InfoCard title="Customer Count" value={String(customers.length)} note="Unique phone numbers" /></section></>;
  }

  function renderDeliveries() {
    const deliveryOrders = orders.filter((order) => ['out_for_delivery', 'delivered'].includes(order.status));
    return <>{renderPageHeader('Deliveries', 'Track parcels moving from packing to doorstep.')}<section className="admin-card"><OrdersTable source={deliveryOrders} /></section></>;
  }

  function renderStoreSettings() {
    return <>{renderPageHeader('Store Settings', 'Brand, storefront, and fulfillment defaults.')}<section className="admin-card admin-settings-grid"><InfoCard title="Store Name" value="FashionDrop Kenya" note="Visible across admin and storefront" /><InfoCard title="Theme" value="Pink Admin" note="Dashboard design system active" /><InfoCard title="Delivery" value="Nationwide" note="Nairobi KES 100-200, rest of Kenya KES 200-500" /></section></>;
  }

  function renderPaymentSettings() {
    return <>{renderPageHeader('Payment Settings', 'Manual M-Pesa Pochi La Biashara payment.')}<section className="admin-card admin-settings-grid"><InfoCard title="M-Pesa" value="Pochi La Biashara" note="Customer pays item total, owner confirms here" /><InfoCard title="Pochi Number" value="0791847766" note="Set VITE_POCHI_NUMBER to override" /><InfoCard title="Delivery Fee" value="Nairobi 100-200 / Rest 200-500" note="Confirmed with customer per order" /></section></>;
  }

  function renderUsers() {
    const currentUser = user!;
    const otherAdmins = adminUsers.filter((admin) => admin.id !== currentUser.uid);
    return (
      <>
        {renderPageHeader('Users', 'Admins who can manage the store on your behalf.')}
        <section className="admin-two-col">
          <div className="admin-card">
            <h2>Admin Users</h2>
            <div className="admin-user-row">
              <div className="admin-avatar">{(currentUser.email?.[0] ?? 'A').toUpperCase()}</div>
              <div><strong>{currentUser.email}</strong><span>You · Super Admin</span><small>{currentUser.uid}</small></div>
              <button className="admin-secondary" type="button" onClick={() => signOut(auth)}>Sign Out</button>
            </div>
            {otherAdmins.map((admin) => (
              <div className="admin-user-row" key={admin.id}>
                <div className="admin-avatar">{(admin.name?.[0] ?? admin.email?.[0] ?? 'A').toUpperCase()}</div>
                <div><strong>{admin.name || admin.email}</strong><span>{admin.email}</span><small>{admin.createdAt ? `Added ${formatDate(admin.createdAt)}` : 'Admin'}</small></div>
                <button className="admin-delete-btn" type="button" onClick={() => removeAdmin(admin)}>Remove</button>
              </div>
            ))}
            {otherAdmins.length === 0 && <p className="admin-help" style={{ marginTop: 12 }}>No other admins yet. Add one using the form.</p>}
          </div>

          <form className="admin-card admin-form" onSubmit={addAdminUser}>
            <h2>Add Admin</h2>
            <p className="admin-help">They can sign in at <b>/admin</b> and update orders on your behalf. Share the email and password with them.</p>
            <label className="admin-field"><span>Name</span><input value={adminForm.name} onChange={(e) => setAdminForm((v) => ({ ...v, name: e.target.value }))} placeholder="e.g. Jane" /></label>
            <label className="admin-field"><span>Email</span><input type="email" value={adminForm.email} onChange={(e) => setAdminForm((v) => ({ ...v, email: e.target.value }))} placeholder="admin@email.com" /></label>
            <label className="admin-field"><span>Temporary password</span><input value={adminForm.password} onChange={(e) => setAdminForm((v) => ({ ...v, password: e.target.value }))} placeholder="At least 6 characters" /></label>
            {adminMessage && <p className="admin-note">{adminMessage}</p>}
            <div className="admin-actions-row"><button className="admin-primary" type="submit" disabled={creatingAdmin}>{creatingAdmin ? 'Adding…' : 'Add Admin'}</button></div>
          </form>
        </section>
      </>
    );
  }

  function ProductsTable() {
    return <div className="admin-table admin-table--products">{filteredProducts.map((product) => <article key={product.id}><img src={parseProductImage(product.images[0] ?? "").url} alt="" /><div><strong>{product.name}</strong><span>{product.category} · {product.variants.reduce((sum, variant) => sum + variant.stock, 0)} in stock</span></div><b>{formatKES(product.price)}</b><button onClick={() => startEdit(product)}>Edit</button><button className="danger" onClick={() => deleteDoc(doc(db, 'products', product.id))}>Delete</button></article>)}</div>;
  }

  function OrdersTable({ compact = false, source = filteredOrders }: { compact?: boolean; source?: Order[] }) {
    const rows = compact ? source.slice(0, 5) : source;
    return <div className={`admin-order-list ${compact ? '' : 'admin-order-list--actions'}`}><div className="admin-order-list__head"><span>Order</span><span>Customer</span><span>Amount</span><span>Status</span><span>Date</span>{!compact && <span>Action</span>}</div>{rows.map((order) => <article key={order.id}><strong className="mono">#{order.orderNumber.replace('FD-', '')}</strong><span>{order.delivery.fullName}</span><span>{formatKES(order.total)}</span>{compact ? <em className={statusClass(order.status)}>{ORDER_STATUS_LABELS[order.status]}</em> : <select value={order.status} onChange={(e) => updateOrderStatus(order, e.target.value as OrderStatus)}>{ORDER_STATUSES.map((status) => <option key={status} value={status}>{ORDER_STATUS_LABELS[status]}</option>)}</select>}<span>{formatDate(order.createdAt)}</span>{!compact && <button className="admin-delete-btn" type="button" onClick={() => deleteOrder(order)}>Delete</button>}</article>)}</div>;
  }

  function CustomersTable() {
    return <div className="admin-order-list admin-order-list--actions"><div className="admin-order-list__head"><span>Customer</span><span>Phone</span><span>County</span><span>Orders</span><span>Spent</span><span>Action</span></div>{customers.map((customer) => <article key={customer.phone}><strong>{customer.name}</strong><span>{customer.phone}</span><span>{customer.county}</span><span>{customer.orders}</span><span>{formatKES(customer.spent)}</span><button className="admin-delete-btn" type="button" onClick={() => deleteCustomer(customer)}>Delete</button></article>)}</div>;
  }

  function TopProducts() {
    const rows = dashboard.topProducts.length ? dashboard.topProducts : products.slice(0, 5).map((product) => ({ name: product.name, image: parseProductImage(product.images[0] ?? "").url, sold: 0 }));
    return <div className="admin-top-products"><div><span></span><span></span><span>Sold</span></div>{rows.map((product) => <article key={product.name}><img src={product.image} alt="" /><strong>{product.name}</strong><span>{product.sold}</span></article>)}</div>;
  }

  function SalesChart() {
    return <div className="admin-chart"><div className="admin-chart__axis"><span>80K</span><span>60K</span><span>40K</span><span>20K</span><span>0</span></div><svg viewBox="0 0 700 220" preserveAspectRatio="none"><defs><linearGradient id="salesFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#ff3f82" stopOpacity="0.3"/><stop offset="100%" stopColor="#ff3f82" stopOpacity="0"/></linearGradient></defs><path d="M40 170 L150 125 L260 95 L370 42 L480 140 L590 85 L680 105 L680 220 L40 220 Z" fill="url(#salesFill)"/><polyline points="40,170 150,125 260,95 370,42 480,140 590,85 680,105" fill="none" stroke="#ff3f82" strokeWidth="3"/><g fill="#ff3f82"><circle cx="40" cy="170" r="5"/><circle cx="150" cy="125" r="5"/><circle cx="260" cy="95" r="5"/><circle cx="370" cy="42" r="5"/><circle cx="480" cy="140" r="5"/><circle cx="590" cy="85" r="5"/><circle cx="680" cy="105" r="5"/></g></svg><div className="admin-chart__days"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></div>;
  }

  function StatusDonut() {
    const total = Math.max(orders.length, 1);
    const statusData = ORDER_STATUSES.filter((status) => status !== 'cancelled').map((status) => ({ status, count: dashboard.statusCounts[status] || 0 }));
    let cursor = 0;
    const colors = ['#ffc64d', '#5bd75b', '#4ca3ff', '#9148e8', '#14bfa6'];
    const gradient = statusData.map((item, index) => { const start = cursor; const size = (item.count / total) * 100; cursor += size; return `${colors[index]} ${start}% ${cursor}%`; }).join(', ');
    return <div className="admin-donut-wrap"><div className="admin-donut" style={{ background: `conic-gradient(${gradient || '#e8edf5 0% 100%'})` }}><div><strong>{orders.length}</strong><span>Total Orders</span></div></div><div className="admin-donut-legend">{statusData.map((item, index) => <p key={item.status}><i style={{ background: colors[index] }} />{ORDER_STATUS_LABELS[item.status]}<span>{item.count} ({orders.length ? Math.round((item.count / orders.length) * 100) : 0}%)</span></p>)}</div></div>;
  }

  function InfoCard({ title, value, note }: { title: string; value: string; note: string }) {
    return <article className="admin-card admin-info-card"><span>{title}</span><strong>{value}</strong><p>{note}</p></article>;
  }
}
