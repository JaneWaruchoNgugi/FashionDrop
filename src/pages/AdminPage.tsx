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
  updateDoc,
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '../lib/firebase';
import {
  ORDER_STATUS_LABELS,
  type Order,
  type OrderStatus,
  type Product,
  type ProductCategory,
  type ProductVariant,
} from '../types';
import './AdminPage.css';

const CATEGORIES: ProductCategory[] = ['dresses', 'two-pieces', 'bags', 'shoes', 'accessories'];
const ORDER_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'packed', 'out_for_delivery', 'delivered', 'cancelled'];

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
  | 'riders'
  | 'store-settings'
  | 'payment-settings'
  | 'users';

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
  category: 'dresses',
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
    { view: 'riders', label: 'Riders', icon: '◇' },
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
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    const productsQuery = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      setProducts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Product)));
    });
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      setOrders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Order)));
    });
    return () => {
      unsubscribeProducts();
      unsubscribeOrders();
    };
  }, [user, isAdmin]);

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
    const map = new Map<string, { name: string; phone: string; county: string; orders: number; spent: number }>();
    orders.forEach((order) => {
      const key = order.delivery.phone;
      const existing = map.get(key) ?? { name: order.delivery.fullName, phone: key, county: order.delivery.county, orders: 0, spent: 0 };
      existing.orders += 1;
      existing.spent += order.total || 0;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.spent - a.spent);
  }, [orders]);

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

  const variantColorOptions = useMemo(() => {
    const variants = parseVariants(form.variants);
    const seen = new Map<string, string>();
    variants.forEach((variant) => {
      if (variant.color && !seen.has(variant.color)) seen.set(variant.color, variant.colorHex);
    });
    return Array.from(seen.entries()).map(([color, colorHex]) => ({ color, colorHex }));
  }, [form.variants]);

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
    if (!form.name.trim() || !form.description.trim() || (images.length < 1 || images.length > 4) || variants.length === 0 || !Number(form.price)) {
      setMessage('Add name, price, description, 1 to 4 images, and at least one valid variant.');
      setSaving(false);
      return;
    }

    const productPayload = {
      name: form.name.trim(),
      category: form.category,
      price: Number(form.price),
      compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : undefined,
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
    await updateDoc(doc(db, 'orders', order.id), {
      status,
      updatedAt: now,
      statusHistory: [...(order.statusHistory || []), { status, at: now }],
    });
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
          {activeView === 'riders' && renderRiders()}
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
          <form className="admin-card admin-form" onSubmit={handleProductSave}>
            <h2>{editingId ? 'Edit Product' : 'Add Product'}</h2>
            <label className="admin-field"><span>Name</span><input value={form.name} onChange={(e) => setForm((value) => ({ ...value, name: e.target.value }))} /></label>
            <div className="admin-field-row"><label className="admin-field"><span>Category</span><select value={form.category} onChange={(e) => setForm((value) => ({ ...value, category: e.target.value as ProductCategory }))}>{CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></label><label className="admin-field"><span>Price</span><input value={form.price} onChange={(e) => setForm((value) => ({ ...value, price: e.target.value }))} inputMode="numeric" /></label></div>
            <label className="admin-field"><span>Compare At Price</span><input value={form.compareAtPrice} onChange={(e) => setForm((value) => ({ ...value, compareAtPrice: e.target.value }))} inputMode="numeric" /></label>
            <label className="admin-field"><span>Description</span><textarea value={form.description} onChange={(e) => setForm((value) => ({ ...value, description: e.target.value }))} /></label>
            <div className="admin-image-manager">
              <div className="admin-color-upload-row">
                <label className="admin-field"><span>Upload Color Name</span><input value={uploadColor} onChange={(e) => setUploadColor(e.target.value)} placeholder="Blue, Red, Beige..." /></label>
                <label className="admin-field admin-color-picker"><span>Pick Color</span><input type="color" value={uploadHex} onChange={(e) => setUploadHex(e.target.value)} /></label>
                <label className="admin-field"><span>Image Files</span><input type="file" accept="image/*" multiple onChange={(e) => e.target.files && handleImageFiles(e.target.files)} /></label>
              </div>
              <div className="admin-color-wheel">
                {variantColorOptions.map((option) => (
                  <button
                    type="button"
                    key={option.color}
                    style={{ background: option.colorHex }}
                    title={option.color}
                    onClick={() => { setUploadColor(option.color); setUploadHex(option.colorHex); }}
                  >
                    <span>{option.color}</span>
                  </button>
                ))}
              </div>
              <div
                className="admin-dropzone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleImageFiles(e.dataTransfer.files); }}
              >
                <strong>{uploadingImages ? "Uploading images..." : "Drag product images here"}</strong>
                <span>Minimum 1 image, maximum 4. Set the color before upload to link that image to a color.</span>
              </div>
              <div className="admin-current-photos-head">Current Photos <span>Tap x to delete, edit color below each image</span></div>
              <div className="admin-image-preview-grid">
                {imageEntries(form.images).map((entry, index) => {
                  const image = parseProductImage(entry);
                  return (
                    <article key={`${image.url}-${index}`}>
                      <button className="admin-image-remove" type="button" onClick={() => removeImage(index)} aria-label="Remove image">×</button>
                      <img src={image.url} alt="" />
                      <div className="admin-image-color-chip" style={{ background: image.colorHex }} />
                      <input value={image.color} onChange={(e) => updateImageColor(index, e.target.value)} aria-label="Image color" />
                    </article>
                  );
                })}
              </div>
              <label className="admin-field"><span>Image URL fallback: Color|URL, one per line</span><textarea value={form.images} onChange={(e) => setForm((value) => ({ ...value, images: e.target.value }))} /></label>
            </div>
            <label className="admin-field"><span>Variants: size,color,#hex,stock</span><textarea value={form.variants} onChange={(e) => setForm((value) => ({ ...value, variants: e.target.value }))} /></label>
            <div className="admin-checks"><label><input type="checkbox" checked={form.isNewDrop} onChange={(e) => setForm((value) => ({ ...value, isNewDrop: e.target.checked }))} /> New drop</label><label><input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm((value) => ({ ...value, isFeatured: e.target.checked }))} /> Featured</label></div>
            {message && <p className="admin-message">{message}</p>}
            <div className="admin-actions-row"><button className="admin-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Product'}</button>{editingId && <button className="admin-secondary" type="button" onClick={() => { setEditingId(null); setForm(blankForm); }}>Cancel</button>}</div>
          </form>
          <section className="admin-card"><h2>Product Inventory</h2><ProductsTable /></section>
        </section>
      </>
    );
  }

  function renderCategories() {
    return <>{renderPageHeader('Categories', 'Organize products by storefront category.')}<section className="admin-metric-list">{CATEGORIES.map((category) => <article className="admin-card admin-category-card" key={category}><strong>{category}</strong><span>{products.filter((product) => product.category === category).length} products</span><button onClick={() => setActiveView('products')}>Manage</button></article>)}</section></>;
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
    const deliveryOrders = orders.filter((order) => ['packed', 'out_for_delivery', 'delivered'].includes(order.status));
    return <>{renderPageHeader('Deliveries', 'Track parcels moving from packing to doorstep.')}<section className="admin-card"><OrdersTable source={deliveryOrders} /></section></>;
  }

  function renderRiders() {
    const riderNames = Array.from(new Set(orders.map((order) => order.riderName).filter(Boolean)));
    return <>{renderPageHeader('Riders', 'Delivery partners assigned to orders.')}<section className="admin-metric-list">{riderNames.length ? riderNames.map((name) => <InfoCard key={name} title={String(name)} value={String(orders.filter((order) => order.riderName === name).length)} note="Assigned deliveries" />) : <InfoCard title="No Riders Yet" value="0" note="Assign riders when delivery workflow starts" />}</section></>;
  }

  function renderStoreSettings() {
    return <>{renderPageHeader('Store Settings', 'Brand, storefront, and fulfillment defaults.')}<section className="admin-card admin-settings-grid"><InfoCard title="Store Name" value="FashionDrop Kenya" note="Visible across admin and storefront" /><InfoCard title="Theme" value="Pink Admin" note="Dashboard design system active" /><InfoCard title="Delivery" value="CBD + Kiambu" note="CBD KES 250-350, Kiambu KES 400-500" /></section></>;
  }

  function renderPaymentSettings() {
    return <>{renderPageHeader('Payment Settings', 'M-Pesa manual payment and pay-on-delivery controls.')}<section className="admin-card admin-settings-grid"><InfoCard title="M-Pesa" value="Manual" note="Confirmation code captured at checkout" /><InfoCard title="Pay on Delivery" value="Enabled" note="Cash or M-Pesa on arrival" /><InfoCard title="Delivery Fee" value="CBD 250-350 / Kiambu 400-500" note="Configured by delivery area" /></section></>;
  }

  function renderUsers() {
    const currentUser = user!;
    return <>{renderPageHeader('Users', 'Admin account and role access.')}<section className="admin-card"><div className="admin-user-row"><div className="admin-avatar">{(currentUser.email?.[0] ?? 'A').toUpperCase()}</div><div><strong>{currentUser.email}</strong><span>Super Admin</span><small>{currentUser.uid}</small></div><button className="admin-secondary" onClick={() => signOut(auth)}>Sign Out</button></div></section></>;
  }

  function ProductsTable() {
    return <div className="admin-table admin-table--products">{filteredProducts.map((product) => <article key={product.id}><img src={parseProductImage(product.images[0] ?? "").url} alt="" /><div><strong>{product.name}</strong><span>{product.category} · {product.variants.reduce((sum, variant) => sum + variant.stock, 0)} in stock</span></div><b>{formatKES(product.price)}</b><button onClick={() => startEdit(product)}>Edit</button><button className="danger" onClick={() => deleteDoc(doc(db, 'products', product.id))}>Delete</button></article>)}</div>;
  }

  function OrdersTable({ compact = false, source = filteredOrders }: { compact?: boolean; source?: Order[] }) {
    const rows = compact ? source.slice(0, 5) : source;
    return <div className="admin-order-list"><div className="admin-order-list__head"><span>Order</span><span>Customer</span><span>Amount</span><span>Status</span><span>Date</span></div>{rows.map((order) => <article key={order.id}><strong className="mono">#{order.orderNumber.replace('FD-', '')}</strong><span>{order.delivery.fullName}</span><span>{formatKES(order.total)}</span>{compact ? <em className={statusClass(order.status)}>{ORDER_STATUS_LABELS[order.status]}</em> : <select value={order.status} onChange={(e) => updateOrderStatus(order, e.target.value as OrderStatus)}>{ORDER_STATUSES.map((status) => <option key={status} value={status}>{ORDER_STATUS_LABELS[status]}</option>)}</select>}<span>{formatDate(order.createdAt)}</span></article>)}</div>;
  }

  function CustomersTable() {
    return <div className="admin-order-list"><div className="admin-order-list__head"><span>Customer</span><span>Phone</span><span>County</span><span>Orders</span><span>Spent</span></div>{customers.map((customer) => <article key={customer.phone}><strong>{customer.name}</strong><span>{customer.phone}</span><span>{customer.county}</span><span>{customer.orders}</span><span>{formatKES(customer.spent)}</span></article>)}</div>;
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
