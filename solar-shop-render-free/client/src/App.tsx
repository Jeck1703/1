import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { 
  Sun, ShoppingCart, User, LogOut, Menu, Search, Plus, Minus, Trash2, Settings, CheckCircle 
} from 'lucide-react';
import { AuthAPI, ProductsAPI, OrdersAPI, ContactAPI } from './api';

// Types
interface User {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  address?: string;
  is_admin: boolean;
}

interface Product {
  id: number;
  name: string;
  category: string;
  description: string;
  price: number;
  power_w: number | null;
  specs: Record<string, string>;
  stock: number;
  image_url: string;
}

interface CartItem {
  product_id: number;
  name: string;
  price: number;
  qty: number;
}

interface Order {
  id: number;
  total: number;
  status: string;
  customer_name: string;
  phone: string;
  address: string;
  comment?: string;
  created_at: string;
  items: Array<{ id: number; product_id: number; name: string; price: number; qty: number }>;
}

// Contexts
const AuthContext = createContext<{
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  loading: boolean;
}>({ user: null, token: null, login: () => {}, logout: () => {}, loading: true });

const CartContext = createContext<{
  cart: CartItem[];
  addToCart: (p: Product, qty?: number) => void;
  updateQty: (id: number, qty: number) => void;
  removeFromCart: (id: number) => void;
  clearCart: () => void;
  total: number;
  count: number;
}>({ cart: [], addToCart: () => {}, updateQty: () => {}, removeFromCart: () => {}, clearCart: () => {}, total: 0, count: 0 });

// Toast
function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: number; msg: string }>>([]);
  const show = (msg: string) => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  };
  return { toasts, show };
}

// Auth Provider
function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      AuthAPI.me().then(({ user }) => setUser(user)).catch(() => {
        localStorage.removeItem('token');
        setToken(null);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(newUser);
  };
  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() { return useContext(AuthContext); }

// Cart Provider
function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (p: Product, qty = 1) => {
    setCart(prev => {
      const found = prev.findIndex(i => i.product_id === p.id);
      if (found >= 0) {
        const copy = [...prev];
        copy[found] = { ...copy[found], qty: Math.min(copy[found].qty + qty, p.stock) };
        return copy;
      }
      return [...prev, { product_id: p.id, name: p.name, price: p.price, qty }];
    });
  };

  const updateQty = (id: number, qty: number) => {
    if (qty < 1) return;
    setCart(prev => prev.map(i => i.product_id === id ? { ...i, qty } : i));
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(i => i.product_id !== id));
  };

  const clearCart = () => setCart([]);

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const count = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, updateQty, removeFromCart, clearCart, total, count }}>
      {children}
    </CartContext.Provider>
  );
}
function useCart() { return useContext(CartContext); }

// Navbar
function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const loc = useLocation();

  const isActive = (path: string) => loc.pathname === path || (path === '/catalog' && loc.pathname.startsWith('/product'));

  return (
    <nav className="bg-white border-b sticky top-0 z-50">
      <div className="container flex items-center justify-between gap-2 h-16 min-w-0">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl sm:text-2xl text-solar-green min-w-0">
          <Sun className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" /> <span className="truncate">СонцеЕнерго</span>
        </Link>

        <div className="hidden md:flex items-center gap-1 text-sm">
          <Link to="/" className={`nav-link ${loc.pathname === '/' ? 'active' : ''}`}>Головна</Link>
          <Link to="/catalog" className={`nav-link ${isActive('/catalog') ? 'active' : ''}`}>Каталог</Link>
          <Link to="/calculator" className={`nav-link ${loc.pathname === '/calculator' ? 'active' : ''}`}>Калькулятор</Link>
          <Link to="/contacts" className={`nav-link ${loc.pathname === '/contacts' ? 'active' : ''}`}>Контакти</Link>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Link to="/cart" className="btn btn-outline relative px-3 py-2 text-sm flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" /> <span className="hidden sm:inline">Кошик</span>
            {count > 0 && <span className="absolute -top-1 -right-1 bg-solar-yellow text-solar-dark text-[10px] font-bold px-1.5 rounded-full">{count}</span>}
          </Link>

          {user ? (
            <div className="relative">
              <button onClick={() => { setUserMenuOpen(!userMenuOpen); setMobileMenuOpen(false); }} className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-100">
                <User className="w-4 h-4" /> <span className="hidden sm:inline max-w-[120px] truncate">{user.full_name}</span>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white border rounded-2xl shadow-lg py-1 text-sm z-50">
                  <Link to="/profile" onClick={() => setUserMenuOpen(false)} className="flex px-4 py-2 hover:bg-slate-50 items-center gap-2"><User className="w-4 h-4" /> Особистий кабінет</Link>
                  {user.is_admin && <Link to="/admin" onClick={() => setUserMenuOpen(false)} className="flex px-4 py-2 hover:bg-slate-50 items-center gap-2"><Settings className="w-4 h-4" /> Адмін-панель</Link>}
                  <button onClick={() => { logout(); setUserMenuOpen(false); }} className="flex w-full px-4 py-2 hover:bg-slate-50 items-center gap-2 text-red-600"><LogOut className="w-4 h-4" /> Вийти</button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden sm:flex gap-2 text-sm">
              <Link to="/login" className="btn btn-outline px-4 py-1.5 text-sm">Вхід</Link>
              <Link to="/register" className="btn btn-primary px-4 py-1.5 text-sm">Реєстрація</Link>
            </div>
          )}

          {/* Mobile menu */}
          <button className="md:hidden p-2" onClick={() => { setMobileMenuOpen(!mobileMenuOpen); setUserMenuOpen(false); }}><Menu className="w-5 h-5" /></button>
        </div>
      </div>
      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-white px-4 py-3 flex flex-col gap-1 text-sm">
          <Link to="/" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Головна</Link>
          <Link to="/catalog" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Каталог</Link>
          <Link to="/profile" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Кабінет</Link>
          <Link to="/cart" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Кошик</Link>
          {!user && <Link to="/login" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Вхід</Link>}
          {!user && <Link to="/register" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Реєстрація</Link>}
        </div>
      )}
    </nav>
  );
}

// Footer
function Footer() {
  return (
    <footer id="contacts" className="bg-solar-dark text-slate-300 mt-16">
      <div className="container py-10 grid md:grid-cols-3 gap-8 text-sm">
        <div>
          <div className="flex items-center gap-2 text-white font-semibold text-xl mb-3"><Sun /> СонцеЕнерго</div>
          <p>Якісні рішення для енергонезалежності вашого дому та бізнесу з 2018 року.</p>
        </div>
        <div>
          <div className="font-semibold text-white mb-2">Контакти</div>
          <div>м. Боярка, Київська обл.</div>
          <div>+380 50 123 45 67</div>
          <div>shop@solenergy.ua</div>
          <div className="mt-1">Пн–Пт: 9:00–18:00</div>
        </div>
        <div>
          <div className="font-semibold text-white mb-2">Гарантії та сервіс</div>
          <div>• 25 років на панелі</div>
          <div>• 5–10 років на інвертори та АКБ</div>
          <div>• Доставка по всій Україні</div>
          <div>• Монтаж «під ключ»</div>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs">© 2026 СонцеЕнерго.</div>
    </footer>
  );
}

// Home Page
function Home() {
  const [contact, setContact] = useState({ name: '', email: '', phone: '', message: '' });
  const [sending, setSending] = useState(false);
  const { show } = useToast();

  const categories = [
    { key: 'panels', label: 'Сонячні панелі', icon: '☀️' },
    { key: 'inverters', label: 'Інвертори', icon: '⚡' },
    { key: 'batteries', label: 'Акумулятори', icon: '🔋' },
    { key: 'kits', label: 'Готові комплекти', icon: '🏠' },
  ];

  async function sendContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contact.name || !contact.email || !contact.message) return show('Заповніть обов’язкові поля');
    setSending(true);
    try {
      const res = await ContactAPI.send(contact);
      show(res.message);
      setContact({ name: '', email: '', phone: '', message: '' });
    } catch (err: any) {
      show(err.message || 'Помилка надсилання');
    } finally { setSending(false); }
  }

  return (
    <div>
      {/* Hero */}
      <div className="bg-gradient-to-br from-solar-green to-green-900 text-white">
        <div className="container py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/20 text-sm px-4 py-1 rounded-full mb-4">Енергонезалежність вже сьогодні</div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-tight md:leading-none mb-4">Сонячні електросистеми<br />для вашого майбутнього</h1>
            <p className="text-lg sm:text-xl text-green-100 max-w-md mb-8">Якісне обладнання з гарантією. Доставка по Україні. Професійний підбір та підтримка.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/catalog" className="btn btn-yellow text-base sm:text-lg px-5 sm:px-8 py-3">Перейти до каталогу</Link>
              <a href="#calculator" className="btn border border-white/70 hover:bg-white/10 px-5 sm:px-6 py-3">Розрахувати потужність</a>
            </div>
            <div className="mt-6 text-sm text-green-200 flex flex-col sm:flex-row gap-2 sm:gap-6">
              <div>12 400+ кВт встановлено</div><div>870+ задоволених клієнтів</div>
            </div>
          </div>
          <div className="hidden md:block relative">
            <div className="aspect-[4/3] bg-white/10 rounded-3xl overflow-hidden flex items-center justify-center text-[160px] opacity-75">☀️</div>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="container py-12">
        <div className="flex justify-between items-end mb-6">
          <div className="section-title mb-0">Популярні категорії</div>
          <Link to="/catalog" className="text-solar-green hover:underline">Весь каталог →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map(c => (
            <Link key={c.key} to={`/catalog?category=${c.key}`} className="card p-6 hover:shadow-md transition flex flex-col items-center text-center gap-3">
              <div className="text-5xl">{c.icon}</div>
              <div className="font-semibold text-lg">{c.label}</div>
              <div className="text-xs text-solar-gray">Перейти до товарів →</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Why us */}
      <div className="bg-white py-12">
        <div className="container">
          <div className="section-title text-center">Чому обирають нас</div>
          <div className="grid md:grid-cols-3 gap-6 mt-8">
            {[
              ['Прямі поставки', 'Працюємо з виробниками напряму. Найкращі ціни та оригінальна якість.'],
              ['Гарантія та сервіс', 'Офіційна гарантія до 25 років. Сервісні центри по Україні.'],
              ['Комплексне рішення', 'Підбір, проєкт, доставка, монтаж та підключення «під ключ».'],
            ].map((t, i) => (
              <div key={i} className="card p-6">
                <div className="font-semibold text-xl mb-2">{t[0]}</div>
                <p className="text-slate-600">{t[1]}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Calculator teaser */}
      <div id="calculator" className="container py-12">
        <div className="flex items-end justify-between mb-6">
          <div className="section-title mb-0">Калькулятор сонячної станції</div>
          <Link to="/calculator" className="text-solar-green hover:underline hidden sm:block">Відкрити повну версію калькулятора →</Link>
        </div>
        <Calculator />
        <div className="mt-3 sm:hidden">
          <Link to="/calculator" className="text-solar-green hover:underline">Відкрити повну версію калькулятора →</Link>
        </div>
      </div>

      {/* Contact teaser */}
      <div id="contacts" className="bg-slate-50 py-12">
        <div className="container max-w-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="section-title mb-0">Зв’яжіться з нами</div>
            <Link to="/contacts" className="text-sm text-solar-green hover:underline hidden sm:block">Повна сторінка контактів →</Link>
          </div>
          <form onSubmit={sendContact} className="card p-8 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="label">Ваше ім’я *</label><input className="input" value={contact.name} onChange={e => setContact({ ...contact, name: e.target.value })} required /></div>
              <div><label className="label">Телефон</label><input className="input" value={contact.phone} onChange={e => setContact({ ...contact, phone: e.target.value })} /></div>
            </div>
            <div><label className="label">Email *</label><input type="email" className="input" value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })} required /></div>
            <div><label className="label">Повідомлення *</label><textarea className="input h-28" value={contact.message} onChange={e => setContact({ ...contact, message: e.target.value })} required /></div>
            <button disabled={sending} className="btn btn-primary w-full py-3">{sending ? 'Надсилаємо...' : 'Надіслати повідомлення'}</button>
          </form>
        </div>
      </div>
    </div>
  );
}

// Simple solar calculator
function Calculator() {
  const [monthly, setMonthly] = useState(350);
  const [roof, setRoof] = useState(25);
  const kwhPerMonth = Math.round(monthly);
  const neededKw = Math.max(3, Math.round((kwhPerMonth / 110) * 10) / 10); // rough Ukraine average
  const panels = Math.ceil(neededKw * 1000 / 500);
  const estPrice = Math.round(panels * 6800 + neededKw * 5200);

  return (
    <div className="card p-8 grid md:grid-cols-2 gap-8">
      <div>
        <div className="space-y-6">
          <div>
            <label className="label">Середнє споживання на місяць (кВт·год)</label>
            <input type="range" min={100} max={1500} step={10} value={monthly} onChange={e => setMonthly(+e.target.value)} className="w-full accent-solar-green" />
            <div className="flex justify-between text-xs text-slate-500 mt-1"><div>100</div><div className="font-medium text-solar-green">{monthly} кВт·год</div><div>1500</div></div>
          </div>
          <div>
            <label className="label">Доступна площа даху (м²)</label>
            <input type="range" min={8} max={80} value={roof} onChange={e => setRoof(+e.target.value)} className="w-full accent-solar-yellow" />
            <div className="font-medium mt-1">{roof} м²</div>
          </div>
        </div>
        <p className="text-xs mt-6 text-solar-gray">Розрахунок орієнтовний для Київської області. Фактична генерація залежить від орієнтації, нахилу та затінення.</p>
      </div>
      <div className="bg-green-50 border border-green-100 rounded-2xl p-6">
        <div className="uppercase tracking-[1px] text-xs font-medium text-green-700 mb-1">РЕКОМЕНДОВАНА СТАНЦІЯ</div>
        <div className="text-5xl font-semibold text-solar-green tabular-nums">{neededKw} <span className="text-3xl">кВт</span></div>
        <div className="mt-4 text-sm">≈ {panels} панелей по 500 Вт<br />Орієнтовна вартість обладнання: <span className="font-semibold text-solar-dark">{estPrice.toLocaleString('uk-UA')} грн</span></div>
        <Link to={`/catalog?minPower=${Math.round(neededKw * 800)}`} className="mt-6 inline-block btn btn-primary">Підібрати обладнання →</Link>
      </div>
    </div>
  );
}

// Catalog Page
function Catalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [minPower, setMinPower] = useState<number | ''>('');
  const [sort, setSort] = useState('price-asc');

  const { addToCart } = useCart();
  const { show } = useToast();
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (q) params.q = q;
      if (category) params.category = category;
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;
      if (minPower) params.minPower = minPower;
      let list = await ProductsAPI.list(params);
      if (sort === 'price-asc') list = [...list].sort((a,b) => a.price - b.price);
      if (sort === 'price-desc') list = [...list].sort((a,b) => b.price - a.price);
      if (sort === 'power') list = [...list].sort((a,b) => (b.power_w || 0) - (a.power_w || 0));
      setProducts(list);
    } catch (e: any) { show(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [q, category, minPrice, maxPrice, minPower, sort]);

  const cats = [
    {v:'', l:'Усі категорії'}, {v:'panels', l:'Панелі'}, {v:'inverters', l:'Інвертори'},
    {v:'batteries', l:'Акумулятори'}, {v:'kits', l:'Комплекти'}, {v:'controllers', l:'Контролери'}, {v:'accessories', l:'Аксесуари'}
  ];

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="section-title mb-0">Каталог обладнання</h1>
        <div className="text-sm text-solar-gray">{products.length} товарів</div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-3.5 text-slate-400 w-4 h-4" />
          <input className="input pl-11" placeholder="Пошук по назві чи опису..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={category} onChange={e => setCategory(e.target.value)}>
          {cats.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
        </select>
        <select className="input w-auto" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="price-asc">Спочатку дешевше</option>
          <option value="price-desc">Спочатку дорожче</option>
          <option value="power">За потужністю</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div><label className="label text-xs">Мін. ціна, грн</label><input type="number" className="input" placeholder="0" value={minPrice} onChange={e => setMinPrice(e.target.value ? +e.target.value : '')} /></div>
        <div><label className="label text-xs">Макс. ціна, грн</label><input type="number" className="input" placeholder="100000" value={maxPrice} onChange={e => setMaxPrice(e.target.value ? +e.target.value : '')} /></div>
        <div><label className="label text-xs">Мін. потужність, Вт</label><input type="number" className="input" placeholder="0" value={minPower} onChange={e => setMinPower(e.target.value ? +e.target.value : '')} /></div>
        <div className="flex items-end"><button onClick={() => { setQ(''); setCategory(''); setMinPrice(''); setMaxPrice(''); setMinPower(''); }} className="btn btn-outline w-full">Скинути фільтри</button></div>
      </div>

      {loading ? <div className="py-12 text-center text-solar-gray">Завантаження...</div> : (
        products.length === 0 ? <div className="py-12 text-center">Нічого не знайдено. Спробуйте змінити фільтри.</div> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {products.map(p => (
              <div key={p.id} className="product-card group">
                <div onClick={() => navigate(`/product/${p.id}`)} className="cursor-pointer">
                  <img src={p.image_url} alt={p.name} className="h-48 object-contain object-center bg-slate-100 mx-auto" />
                  <div className="p-4">
                    <div className="uppercase text-[10px] tracking-widest text-solar-gray mb-1">{p.category}</div>
                    <div className="font-semibold leading-tight line-clamp-2 min-h-[42px]">{p.name}</div>
                    {p.power_w && <div className="text-xs mt-1 text-solar-green font-medium">{p.power_w} Вт</div>}
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-2xl font-semibold tabular-nums">{p.price.toLocaleString('uk-UA')}</span>
                      <span className="text-xs text-solar-gray">грн</span>
                    </div>
                    <div className="text-xs text-emerald-700 mt-0.5">В наявності: {p.stock} шт.</div>
                  </div>
                </div>
                <div className="px-4 pb-4 flex gap-2 mt-auto">
                  <button onClick={() => navigate(`/product/${p.id}`)} className="btn btn-outline flex-1 text-sm">Детальніше</button>
                  <button onClick={() => { addToCart(p); show('Товар додано до кошика'); }} className="btn btn-primary flex-1 text-sm">У кошик</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

// Product Detail
function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const { addToCart } = useCart();
  const { show } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) ProductsAPI.get(id).then(setProduct).catch(() => navigate('/catalog'));
  }, [id]);

  if (!product) return <div className="container py-12">Завантаження...</div>;

  const add = () => {
    addToCart(product, qty);
    show(`Додано ${qty} шт. до кошика`);
  };

  return (
    <div className="container py-8">
      <button onClick={() => navigate(-1)} className="text-sm text-solar-green mb-4">← Назад до каталогу</button>
      <div className="grid md:grid-cols-2 gap-10">
        <img src={product.image_url} alt="" className="w-full max-h-[520px] object-contain object-center rounded-3xl border bg-white p-4 mx-auto" />
        <div>
          <div className="badge bg-green-100 text-green-800 mb-2">{product.category}</div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">{product.name}</h1>
          {product.power_w && <div className="text-solar-green text-xl">{product.power_w} Вт</div>}

          <div className="mt-4 text-4xl font-semibold tabular-nums">{product.price.toLocaleString('uk-UA')} <span className="text-base align-super text-solar-gray">грн</span></div>
          <div className="text-emerald-700 text-sm mt-1">В наявності: {product.stock} шт. • Доставка 1–3 дні</div>

          <div className="mt-6">
            <div className="label">Кількість</div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setQty(Math.max(1, qty-1))} className="btn border border-slate-300 text-solar-dark hover:bg-slate-100 w-10 h-10 p-0">
                <Minus size={18} strokeWidth={2.5} className="shrink-0" />
              </button>
              <div className="font-mono w-8 text-center text-xl">{qty}</div>
              <button type="button" onClick={() => setQty(Math.min(product.stock, qty+1))} className="btn border border-slate-300 text-solar-dark hover:bg-slate-100 w-10 h-10 p-0">
                <Plus size={18} strokeWidth={2.5} className="shrink-0" />
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-5">
            <button onClick={add} className="btn btn-primary flex-1 text-lg py-3">Додати до кошика</button>
            <Link to="/cart" className="btn btn-outline px-5 sm:px-8">Кошик</Link>
          </div>

          <div className="mt-8">
            <div className="font-semibold mb-2">Опис</div>
            <p className="text-slate-600 leading-relaxed">{product.description}</p>
          </div>

          {product.specs && Object.keys(product.specs).length > 0 && (
            <div className="mt-8">
              <div className="font-semibold mb-2">Характеристики</div>
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(product.specs).map(([k, v]) => (
                    <tr key={k} className="border-t last:border-b">
                      <td className="py-2 pr-4 text-solar-gray w-1/3">{k}</td>
                      <td className="py-2 font-medium">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Cart
function Cart() {
  const { cart, updateQty, removeFromCart, total, clearCart } = useCart();
  const navigate = useNavigate();

  if (cart.length === 0) {
    return <div className="container py-12 text-center"><div className="text-6xl mb-4">🛒</div><div className="text-xl mb-2">Ваш кошик порожній</div><Link to="/catalog" className="btn btn-primary mt-3">Перейти до каталогу</Link></div>;
  }

  return (
    <div className="container py-8 max-w-3xl">
      <h1 className="section-title">Кошик</h1>
      <div className="space-y-3">
        {cart.map(item => (
          <div key={item.product_id} className="card p-4 flex flex-col sm:flex-row gap-4 sm:items-center">
            <div className="flex-1 min-w-0">
              <div className="font-medium">{item.name}</div>
              <div className="text-sm text-solar-gray">{item.price.toLocaleString('uk-UA')} грн × {item.qty}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => updateQty(item.product_id, item.qty - 1)} className="btn border px-2 py-1"><Minus className="w-3.5 h-3.5" /></button>
              <div className="w-6 text-center font-medium">{item.qty}</div>
              <button onClick={() => updateQty(item.product_id, item.qty + 1)} className="btn border px-2 py-1"><Plus className="w-3.5 h-3.5" /></button>
            </div>
            <div className="sm:w-28 sm:text-right font-semibold tabular-nums">{(item.price * item.qty).toLocaleString('uk-UA')} грн</div>
            <button onClick={() => removeFromCart(item.product_id)} className="text-red-500 p-2 self-start sm:self-auto"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center border-t pt-4">
        <button onClick={clearCart} className="text-sm text-red-600">Очистити кошик</button>
        <div className="sm:text-right">
          <div className="text-sm text-solar-gray">Разом до сплати</div>
          <div className="text-3xl font-semibold tabular-nums">{total.toLocaleString('uk-UA')} грн</div>
        </div>
      </div>

      <div className="mt-4">
        <button onClick={() => navigate('/checkout')} className="btn btn-primary w-full py-3 text-lg">Оформити замовлення</button>
        <Link to="/catalog" className="block text-center mt-3 text-sm text-solar-green">Продовжити покупки</Link>
      </div>
    </div>
  );
}

// Checkout
function Checkout() {
  const { cart, total, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { show } = useToast();

  const [form, setForm] = useState({ customer_name: user?.full_name || '', phone: user?.phone || '', address: user?.address || '', comment: '' });
  const [loading, setLoading] = useState(false);

  if (cart.length === 0) { navigate('/cart'); return null; }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { show('Для оформлення замовлення увійдіть в акаунт'); navigate('/login'); return; }
    setLoading(true);
    try {
      const items = cart.map(c => ({ product_id: c.product_id, qty: c.qty }));
      const order = await OrdersAPI.create({ items, ...form });
      clearCart();
      show(`Замовлення #${order.id} оформлено! Дякуємо.`);
      navigate('/profile');
    } catch (err: any) {
      show(err.message);
    } finally { setLoading(false); }
  }

  return (
    <div className="container py-8 max-w-xl">
      <h1 className="section-title">Оформлення замовлення</h1>
      <div className="card p-6 mb-6">
        <div className="text-sm text-solar-gray mb-1">Ваше замовлення ({cart.length} позицій)</div>
        <div className="font-semibold text-2xl">{total.toLocaleString('uk-UA')} грн</div>
      </div>

      <form onSubmit={submit} className="space-y-4 card p-6">
        <div><label className="label">ПІБ отримувача *</label><input className="input" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} required /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="label">Телефон *</label><input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required /></div>
          <div><label className="label">Адреса доставки *</label><input className="input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} required /></div>
        </div>
        <div><label className="label">Коментар до замовлення</label><textarea className="input h-20" value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} /></div>

        <button disabled={loading} className="btn btn-primary w-full py-3 text-lg mt-2">{loading ? 'Оформлюємо...' : 'Підтвердити замовлення'}</button>
        <p className="text-xs text-center text-solar-gray">Оплата при отриманні або за реквізитами після підтвердження. Статус замовлення у вашому кабінеті.</p>
      </form>
    </div>
  );
}

// Login / Register
function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const [form, setForm] = useState<any>({ email: '', password: '', full_name: '', phone: '', address: '' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      if (mode === 'login') {
        const { token, user } = await AuthAPI.login({ email: form.email, password: form.password });
        login(token, user);
        navigate(user.is_admin ? '/admin' : '/profile');
      } else {
        const { token, user } = await AuthAPI.register(form);
        login(token, user);
        navigate('/profile');
      }
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="container py-12 max-w-md">
      <div className="card p-8">
        <div className="text-2xl font-semibold mb-1">{mode === 'login' ? 'Вхід в кабінет' : 'Реєстрація'}</div>
        <p className="text-sm text-solar-gray mb-6">Введіть дані для {mode === 'login' ? 'входу' : 'створення акаунту'}</p>

        {err && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-xl mb-4 text-sm">{err}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>
          {mode === 'register' && (
            <>
              <div><label className="label">ПІБ</label><input className="input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required /></div>
              <div><label className="label">Телефон</label><input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><label className="label">Адреса</label><input className="input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            </>
          )}
          <div><label className="label">Пароль</label><input type="password" className="input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={4} /></div>
          <button disabled={loading} className="btn btn-primary w-full py-2.5">{loading ? 'Зачекайте...' : (mode === 'login' ? 'Увійти' : 'Зареєструватися')}</button>
        </form>

        <div className="text-center mt-5 text-sm">
          {mode === 'login' ? <>Немає акаунту? <Link to="/register" className="text-solar-green">Зареєструйтесь</Link></> : <>Вже є акаунт? <Link to="/login" className="text-solar-green">Увійти</Link></>}
        </div>
        <div className="mt-4 text-[11px] text-center text-solar-gray">Демо: admin@solar.ua / admin123 або user@example.com / 123456</div>
      </div>
    </div>
  );
}

// Profile + My Orders
function Profile() {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) OrdersAPI.my().then(setOrders).finally(() => setLoading(false));
  }, [user]);

  if (!user) return <div className="container py-12">Завантаження...</div>;

  const statusLabel: any = { new: 'Новий', processing: 'В обробці', shipped: 'Відправлено', completed: 'Виконано', cancelled: 'Скасовано' };

  return (
    <div className="container py-8 max-w-4xl">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-sm text-solar-gray">Особистий кабінет</div>
          <div className="text-3xl font-semibold">{user.full_name}</div>
          <div className="text-solar-gray">{user.email}</div>
        </div>
        <button onClick={logout} className="btn btn-outline text-sm">Вийти</button>
      </div>

      <div className="mt-6 grid md:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="text-xs text-solar-gray">Телефон</div>
          <div>{user.phone || '—'}</div>
        </div>
        <div className="card p-5 md:col-span-2">
          <div className="text-xs text-solar-gray">Адреса доставки</div>
          <div>{user.address || '—'}</div>
        </div>
      </div>

      <div className="mt-8">
        <div className="section-title">Мої замовлення</div>
        {loading ? <div>Завантаження...</div> : orders.length === 0 ? <div className="text-solar-gray">Замовлень поки немає. <Link to="/catalog" className="text-solar-green">Почніть покупки →</Link></div> : (
          <div className="space-y-4">
            {orders.map(o => (
              <div key={o.id} className="card p-5">
                <div className="flex justify-between text-sm mb-2">
                  <div><span className="font-semibold">№{o.id}</span> від {new Date(o.created_at).toLocaleDateString('uk-UA')}</div>
                  <div className="badge bg-amber-100 text-amber-800">{statusLabel[o.status] || o.status}</div>
                </div>
                <div className="text-xs mb-3 text-solar-gray">{o.customer_name} • {o.phone} • {o.address}</div>
                <div className="divide-y text-sm">
                  {o.items.map(it => <div key={it.id} className="py-1 flex justify-between"><div>{it.name} ×{it.qty}</div><div>{(it.price * it.qty).toLocaleString('uk-UA')} грн</div></div>)}
                </div>
                <div className="font-semibold text-right mt-2">Всього: {o.total.toLocaleString('uk-UA')} грн</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Admin Panel
function Admin() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<'products' | 'orders'>('products');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const { show } = useToast();

  const load = async () => {
    const [p, o] = await Promise.all([ProductsAPI.list(), OrdersAPI.all()]);
    setProducts(p); setOrders(o);
  };
  useEffect(() => { if (user?.is_admin) load(); }, [user]);

  if (!user?.is_admin) return <div className="container py-12 text-center">Доступ заборонено</div>;

  async function saveProduct(data: any) {
    try {
      if (editing) await ProductsAPI.update(editing.id, data);
      else await ProductsAPI.create(data);
      setShowAdd(false); setEditing(null); load();
      show('Збережено');
    } catch (e: any) { show(e.message); }
  }

  async function delProduct(id: number) {
    if (!confirm('Видалити товар?')) return;
    await ProductsAPI.remove(id); load();
  }

  async function changeStatus(id: number, status: string) {
    await OrdersAPI.updateStatus(id, status); load();
  }

  const statusOptions = ['new', 'processing', 'shipped', 'completed', 'cancelled'];

  return (
    <div className="container py-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="section-title mb-0">Адмін-панель</div>
        <div className="sm:ml-auto flex flex-wrap gap-2">
          <button onClick={() => { setTab('products'); setShowAdd(false); setEditing(null); }} className={`btn text-sm ${tab === 'products' ? 'btn-primary' : 'btn-outline'}`}>Товари</button>
          <button onClick={() => setTab('orders')} className={`btn text-sm ${tab === 'orders' ? 'btn-primary' : 'btn-outline'}`}>Замовлення</button>
        </div>
      </div>

      {tab === 'products' && (
        <>
          <button onClick={() => { setEditing(null); setShowAdd(true); }} className="btn btn-primary mb-4">+ Додати товар</button>
          <div className="overflow-x-auto card">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left"><tr><th className="p-3">ID</th><th className="p-3">Назва</th><th>Категорія</th><th>Ціна</th><th>Потужн.</th><th>Залишок</th><th></th></tr></thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} className="border-t">
                    <td className="p-3 font-mono text-xs">{p.id}</td>
                    <td className="p-3 font-medium">{p.name}</td>
                    <td>{p.category}</td>
                    <td>{p.price} грн</td>
                    <td>{p.power_w || '—'}</td>
                    <td>{p.stock}</td>
                    <td className="p-3 text-right space-x-2">
                      <button onClick={() => { setEditing(p); setShowAdd(true); }} className="text-blue-600">Редагувати</button>
                      <button onClick={() => delProduct(p.id)} className="text-red-600">Видалити</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'orders' && (
        <div className="space-y-3">
          {orders.map(o => (
            <div key={o.id} className="card p-4 flex flex-col md:flex-row md:items-center gap-4 text-sm">
              <div className="flex-1">
                <div className="font-semibold">№{o.id} • {o.customer_name}</div>
                <div className="text-xs text-solar-gray">{o.phone} • {o.address}</div>
                <div className="text-xs mt-1">{o.items.length} позицій — {o.total} грн</div>
              </div>
              <select value={o.status} onChange={e => changeStatus(o.id, e.target.value)} className="input w-40">
                {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="text-xs text-solar-gray whitespace-nowrap">{new Date(o.created_at).toLocaleDateString('uk-UA')}</div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      {(showAdd || editing) && (
        <ProductFormModal initial={editing} onClose={() => { setShowAdd(false); setEditing(null); }} onSave={saveProduct} />
      )}
    </div>
  );
}

function ProductFormModal({ initial, onClose, onSave }: { initial?: any; onClose: () => void; onSave: (d: any) => void }) {
  const [f, setF] = useState(() => initial || { name: '', category: 'panels', description: '', price: 1000, power_w: 500, stock: 10, image_url: 'https://picsum.photos/id/1015/600/400' });
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="font-semibold text-xl mb-4">{initial ? 'Редагування товару' : 'Новий товар'}</div>
        <div className="space-y-3">
          <input className="input" placeholder="Назва" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
          <select className="input" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>
            {['panels','inverters','batteries','kits','controllers','accessories'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <textarea className="input h-16" placeholder="Опис" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" className="input" placeholder="Ціна" value={f.price} onChange={e => setF({ ...f, price: +e.target.value })} />
            <input type="number" className="input" placeholder="Потужність (Вт)" value={f.power_w || ''} onChange={e => setF({ ...f, power_w: e.target.value ? +e.target.value : null })} />
          </div>
          <input type="number" className="input" placeholder="Залишок" value={f.stock} onChange={e => setF({ ...f, stock: +e.target.value })} />
          <input className="input" placeholder="URL зображення" value={f.image_url} onChange={e => setF({ ...f, image_url: e.target.value })} />
        </div>
        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="btn btn-outline flex-1">Скасувати</button>
          <button onClick={() => onSave(f)} className="btn btn-primary flex-1">Зберегти</button>
        </div>
      </div>
    </div>
  );
}

// ==================== КАЛЬКУЛЯТОР (окрема сторінка) ====================
function CalculatorPage() {
  const [monthlyKwh, setMonthlyKwh] = useState(400);
  const [roofM2, setRoofM2] = useState(30);
  const [region, setRegion] = useState("Київська");
  const [systemType, setSystemType] = useState<"grid" | "hybrid" | "offgrid">("hybrid");
  const [coverage, setCoverage] = useState(80); // % покриття споживання

  const navigate = useNavigate();

  // Коефіцієнти інсоляції (приблизно для України)
  const regionCoeff: Record<string, number> = {
    "Київська": 1.0,
    "Львівська": 0.92,
    "Одеська": 1.12,
    "Харківська": 0.98,
    "Дніпропетровська": 1.05,
    "Вінницька": 1.02,
    "Закарпатська": 0.85,
    "Інший регіон": 0.95,
  };

  const coeff = regionCoeff[region] || 1.0;

  // Базові розрахунки (спрощені, але реалістичні)
  const annualKwh = Math.round(monthlyKwh * 12 * coeff * (coverage / 100));
  const neededKw = Math.max(3, Math.round((annualKwh / 1100) * 10) / 10); // ~1100 годин еквівалентного сонця

  const panelPower = 550;
  const numPanels = Math.ceil((neededKw * 1000) / panelPower);
  const systemKw = Math.round((numPanels * panelPower) / 100) / 10;

  let inverterKw = Math.ceil(systemKw * 1.1);
  let batteryKwh = 0;

  if (systemType === "hybrid") {
    batteryKwh = Math.round(neededKw * 1.8); // ~1.5-2 години автономії
    inverterKw = Math.max(inverterKw, Math.ceil(neededKw * 1.2));
  } else if (systemType === "offgrid") {
    batteryKwh = Math.round(neededKw * 3.2); // більша автономія
    inverterKw = Math.max(inverterKw, Math.ceil(neededKw * 1.3));
  }

  const panelCost = numPanels * 8200;
  const inverterCost = inverterKw * 5200;
  const batteryCost = batteryKwh * 6200;
  const mounting = Math.round(numPanels * 420);
  const totalCost = Math.round(panelCost + inverterCost + (systemType !== "grid" ? batteryCost : 0) + mounting);

  const annualSavings = Math.round(annualKwh * 4.8); // середній тариф + зелений тариф
  const paybackYears = totalCost > 0 ? (totalCost / annualSavings).toFixed(1) : "—";

  const recommendedProductsLink = () => {
    const minPower = Math.floor(neededKw * 700);
    navigate(`/catalog?minPower=${minPower}`);
  };

  return (
    <div className="container py-8 max-w-5xl">
      <div className="mb-8">
        <Link to="/" className="text-sm text-solar-green hover:underline">← На головну</Link>
        <h1 className="section-title mt-2">Калькулятор сонячної електростанції</h1>
        <p className="text-lg text-solar-gray max-w-2xl">
          Отримайте попередній розрахунок потужності, вартості та окупності системи під ваші потреби.
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* Форма */}
        <div className="lg:col-span-3 card p-8">
          <div className="space-y-7">
            <div>
              <label className="label">Середнє місячне споживання, кВт·год</label>
              <input type="range" min={150} max={2000} step={10} value={monthlyKwh} onChange={e => setMonthlyKwh(+e.target.value)} className="w-full accent-solar-green" />
              <div className="flex justify-between text-sm mt-1">
                <span>150</span>
                <span className="font-semibold text-solar-green">{monthlyKwh} кВт·год</span>
                <span>2000</span>
              </div>
            </div>

            <div>
              <label className="label">Доступна площа даху / ділянки, м²</label>
              <input type="range" min={10} max={120} value={roofM2} onChange={e => setRoofM2(+e.target.value)} className="w-full accent-solar-yellow" />
              <div className="font-medium mt-1">{roofM2} м²</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Регіон України</label>
                <select className="input" value={region} onChange={e => setRegion(e.target.value)}>
                  {Object.keys(regionCoeff).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Тип системи</label>
                <select className="input" value={systemType} onChange={e => setSystemType(e.target.value as any)}>
                  <option value="grid">Мережева (зелений тариф)</option>
                  <option value="hybrid">Гібридна (з акумуляторами)</option>
                  <option value="offgrid">Автономна (без мережі)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">Бажане покриття споживання: {coverage}%</label>
              <input type="range" min={50} max={100} step={5} value={coverage} onChange={e => setCoverage(+e.target.value)} className="w-full accent-solar-green" />
            </div>
          </div>

          <div className="mt-8 pt-6 border-t">
            <button onClick={recommendedProductsLink} className="btn btn-primary w-full py-3 text-lg">
              Підібрати обладнання за цими параметрами →
            </button>
            <p className="text-center text-xs text-solar-gray mt-2">Ми підберемо панелі, інвертор та акумулятори у каталозі</p>
          </div>
        </div>

        {/* Результати */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-6 bg-gradient-to-br from-green-50 to-white">
            <div className="uppercase text-xs tracking-widest text-solar-green font-medium mb-1">РЕЗУЛЬТАТ РОЗРАХУНКУ</div>

            <div className="text-5xl font-semibold text-solar-dark tabular-nums mt-2">{systemKw} <span className="text-2xl align-super">кВт</span></div>
            <div className="text-solar-gray">Рекомендована потужність станції</div>

            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <div className="text-solar-gray">Панелей по 550 Вт</div>
                <div className="font-semibold text-xl">{numPanels} шт</div>
              </div>
              <div>
                <div className="text-solar-gray">Інвертор</div>
                <div className="font-semibold text-xl">{inverterKw} кВт</div>
              </div>
              {batteryKwh > 0 && (
                <div className="col-span-2 sm:col-span-1">
                  <div className="text-solar-gray">Акумуляторна ємність</div>
                  <div className="font-semibold text-xl">{batteryKwh} кВт·год</div>
                </div>
              )}
              <div>
                <div className="text-solar-gray">Річна генерація</div>
                <div className="font-semibold text-xl">{annualKwh.toLocaleString('uk-UA')} кВт·год</div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="text-sm text-solar-gray">Орієнтовна вартість обладнання</div>
            <div className="text-4xl font-semibold text-solar-dark mt-1 tabular-nums">
              {totalCost.toLocaleString('uk-UA')} грн
            </div>

            <div className="mt-5 text-sm space-y-1">
              <div className="flex justify-between"><span>Щорічна економія / дохід</span> <span className="font-medium">{annualSavings.toLocaleString('uk-UA')} грн</span></div>
              <div className="flex justify-between"><span>Термін окупності</span> <span className="font-medium">{paybackYears} років</span></div>
            </div>

            <div className="mt-6 pt-4 border-t text-xs text-solar-gray">
              Розрахунок орієнтовний для середніх умов. Точний проєкт потребує виїзду спеціаліста.
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/contacts" className="btn btn-outline flex-1 justify-center">Замовити консультацію</Link>
            <Link to="/catalog" className="btn btn-primary flex-1 justify-center">Перейти в каталог</Link>
          </div>
        </div>
      </div>

      <div className="mt-10 text-sm text-solar-gray max-w-3xl">
        * Розрахунки базуються на середній інсоляції для України (950–1200 кВт·год/кВт встановленої потужності на рік).
        Фактичні показники залежать від орієнтації даху, затінення та якості обладнання.
      </div>
    </div>
  );
}

// ==================== КОНТАКТИ (окрема сторінка) ====================
function ContactsPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", topic: "consult", message: "" });
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState("");
  const { show } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      show("Будь ласка, заповніть ім'я, email та повідомлення");
      return;
    }
    setSending(true);
    setSuccess("");
    try {
      const res = await ContactAPI.send(form);
      setSuccess(res.message);
      setForm({ name: "", email: "", phone: "", topic: "consult", message: "" });
      show("Повідомлення надіслано!");
    } catch (err: any) {
      show(err.message || "Помилка надсилання. Спробуйте пізніше.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="container py-8 max-w-5xl">
      <div className="mb-8">
        <Link to="/" className="text-sm text-solar-green hover:underline">← На головну</Link>
        <h1 className="section-title mt-2">Контакти</h1>
        <p className="text-lg text-solar-gray">Ми завжди раді відповісти на ваші запитання та допомогти з вибором обладнання.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Інформація */}
        <div className="space-y-6">
          <div className="card p-8">
            <div className="font-semibold text-xl mb-4">ТОВ «СонцеЕнерго»</div>

            <div className="space-y-4 text-sm">
              <div>
                <div className="font-medium text-solar-gray">Адреса</div>
                <div>м. Боярка, Київська обл., вул. Сонячна, 15</div>
                <div className="text-xs mt-0.5">Офіс + склад</div>
              </div>

              <div>
                <div className="font-medium text-solar-gray">Телефони</div>
                <div>+380 50 123 45 67</div>
                <div>+380 67 890 12 34</div>
              </div>

              <div>
                <div className="font-medium text-solar-gray">Email</div>
                <a href="mailto:shop@solenergy.ua" className="text-solar-green hover:underline">shop@solenergy.ua</a>
              </div>

              <div>
                <div className="font-medium text-solar-gray">Графік роботи</div>
                <div>Пн–Пт: 09:00 – 18:00</div>
                <div>Сб: 10:00 – 15:00</div>
                <div className="text-xs">Неділя — вихідний</div>
              </div>
            </div>
          </div>

          <div className="card p-8">
            <div className="font-semibold mb-3">Як до нас дістатися</div>
            <div className="text-sm text-solar-gray mb-3">
              20 хв від Києва (ст. м. Виставковий центр або Автовокзал). Безкоштовна парковка.
            </div>
            <div className="aspect-video bg-slate-100 rounded-xl flex items-center justify-center text-solar-gray text-sm border">
              Карта (в реальному проєкті — Google Maps / 2GIS)
            </div>
          </div>

          <div className="card p-6 text-sm">
            <div className="font-medium mb-2">Ми також можемо:</div>
            <ul className="list-disc pl-5 space-y-1 text-solar-gray">
              <li>Виїхати на об'єкт для замірів та проєкту</li>
              <li>Допомогти з документами для «зеленого» тарифу</li>
              <li>Виконати монтаж «під ключ»</li>
              <li>Провести гарантійне та післягарантійне обслуговування</li>
            </ul>
          </div>
        </div>

        {/* Форма */}
        <div>
          <div className="card p-8">
            <div className="text-xl font-semibold mb-1">Залиште заявку</div>
            <p className="text-sm text-solar-gray mb-6">Ми зв'яжемося з вами протягом 1–2 годин у робочий час.</p>

            {success ? (
              <div className="bg-green-50 border border-green-200 text-green-700 p-6 rounded-2xl">
                <CheckCircle className="inline w-5 h-5 mr-2" /> {success}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Ваше ім'я *</label>
                    <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div>
                    <label className="label">Телефон</label>
                    <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                  </div>
                </div>

                <div>
                  <label className="label">Email *</label>
                  <input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                </div>

                <div>
                  <label className="label">Тема звернення</label>
                  <select className="input" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })}>
                    <option value="consult">Консультація та підбір</option>
                    <option value="calculation">Прорахунок станції</option>
                    <option value="order">Питання по замовленню</option>
                    <option value="service">Сервіс та гарантія</option>
                    <option value="other">Інше</option>
                  </select>
                </div>

                <div>
                  <label className="label">Повідомлення *</label>
                  <textarea className="input h-32" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} required />
                </div>

                <button disabled={sending} type="submit" className="btn btn-primary w-full py-3 text-base">
                  {sending ? "Надсилаємо..." : "Надіслати повідомлення"}
                </button>
                <p className="text-[11px] text-center text-solar-gray">Ваші дані захищені. Ми не передаємо їх третім особам.</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Main App
export default function App() {
  const { toasts } = useToast();

  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/catalog" element={<Catalog />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/login" element={<AuthPage mode="login" />} />
                <Route path="/register" element={<AuthPage mode="register" />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/calculator" element={<CalculatorPage />} />
                <Route path="/contacts" element={<ContactsPage />} />
              </Routes>
            </main>
            <Footer />
          </div>

          {/* Toasts */}
          {toasts.map(t => (
            <div key={t.id} className="toast">{t.msg}</div>
          ))}
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
