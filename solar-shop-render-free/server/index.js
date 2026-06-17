const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, '.env'));

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'solar-shop-dev-secret-2026-vm1202';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('Telegram is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.');
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
      }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.description || `Telegram HTTP ${response.status}`);
    }

    return true;
  } finally {
    clearTimeout(timeout);
  }
}

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Setup DB
const dbPath = process.env.DB_PATH || path.join(__dirname, 'data.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    is_admin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    power_w INTEGER,
    specs TEXT,
    stock INTEGER DEFAULT 10,
    image_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    total INTEGER NOT NULL,
    status TEXT DEFAULT 'new',
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    qty INTEGER NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    topic TEXT,
    message TEXT NOT NULL,
    telegram_sent INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Seed initial data if empty
const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
if (productCount === 0) {
  const seedProducts = [
    {
      name: 'Сонячна панель 550 Вт JA Solar JAM72S30',
      category: 'panels',
      description: 'Монокристалічна сонячна панель преміум класу. Висока ефективність 21.3%. Гарантія 25 років на продуктивність.',
      price: 8490,
      power_w: 550,
      specs: JSON.stringify({ Потужність: '550 Вт', Тип: 'Монокристал', Ефективність: '21.3%', Гарантія: '25 років', Розмір: '2278x1134x35 мм', Вага: '28.5 кг' }),
      stock: 45,
      image_url: 'https://www.toms-car-hifi.de/media/image/79/00/30/71832_600x600.jpg'
    },
    {
      name: 'Сонячна панель 450 Вт Trina Solar Vertex',
      category: 'panels',
      description: 'Надійна панель з технологією half-cut. Відмінно підходить для приватних будинків та комерції.',
      price: 6790,
      power_w: 450,
      specs: JSON.stringify({ Потужність: '450 Вт', Тип: 'Монокристал', Ефективність: '20.6%', Гарантія: '25 років', Розмір: '2102x1040x35 мм', Вага: '24 кг' }),
      stock: 62,
      image_url: 'https://www.toms-car-hifi.de/media/image/74/2f/20/75221_600x600.png'
    },
    {
      name: 'Гібридний інвертор Deye 8 кВт',
      category: 'inverters',
      description: 'Сучасний гібридний інвертор з підтримкою акумуляторів LiFePO4 та можливістю паралельного підключення. Wi-Fi моніторинг.',
      price: 38900,
      power_w: 8000,
      specs: JSON.stringify({ Потужність: '8 кВт', Тип: 'Гібридний', Фази: '1 / 3', ККД: '97.6%', АКБ: 'LiFePO4 / AGM', Моніторинг: 'Wi-Fi + APP' }),
      stock: 18,
      image_url: 'https://i.otto.de/i/otto/400a8e75-731b-4e25-91b3-276dbbf5b211?h=520&w=551&sm=clamp&upscale=true&fmt=auto'
    },
    {
      name: 'Струнний інвертор Huawei SUN2000 5 кВт',
      category: 'inverters',
      description: 'Надійний інвертор від лідера ринку. Оптимізація потужності, безпечний та тихий. Підтримка Huawei Smart PV.',
      price: 24500,
      power_w: 5000,
      specs: JSON.stringify({ Потужність: '5 кВт', Тип: 'Струнний', Фази: '1', ККД: '98.4%', Гарантія: '10 років', Моніторинг: 'Wi-Fi' }),
      stock: 22,
      image_url: 'https://online-batterien.de/thumbnail/c4/5d/b9/1739177540/9896272-1_800x800.jpg?ts=1739177543'
    },
    {
      name: 'Акумулятор LiFePO4 5.12 кВт·год Pylontech US5000',
      category: 'batteries',
      description: 'Літій-залізо-фосфатний акумулятор 48В. Високий ресурс >6000 циклів. Модульна система. Ідеально для гібридних СЕС.',
      price: 28900,
      power_w: 5120,
      specs: JSON.stringify({ Ємність: '5.12 кВт·год', Напруга: '48 В', Цикли: '>6000', Тип: 'LiFePO4', Гарантія: '10 років', Вага: '45 кг' }),
      stock: 15,
      image_url: 'https://sunstonepower.de/cdn/shop/files/SLPO48-200.jpg?crop=center&height=720&v=1699437370&width=720'
    },
    {
      name: 'Акумулятор LiFePO4 2.56 кВт·год Dyness B3',
      category: 'batteries',
      description: 'Компактний настінний акумулятор для домашнього використання. Легко масштабується.',
      price: 15200,
      power_w: 2560,
      specs: JSON.stringify({ Ємність: '2.56 кВт·год', Напруга: '51.2 В', Цикли: '>4000', Тип: 'LiFePO4', Гарантія: '5 років' }),
      stock: 27,
      image_url: 'https://www.toms-car-hifi.de/media/image/d9/f1/f5/753643_600x600.png'
    },
    {
      name: 'Комплект СЕС 5 кВт "Оптимум" під зелений тариф',
      category: 'kits',
      description: 'Готовий комплект для дому: 10 панелей 550Вт + інвертор 5кВт + кріплення + кабель. Встановлення "під ключ" опційно.',
      price: 112500,
      power_w: 5500,
      specs: JSON.stringify({ Potuzhnist: "5.5 kVt", Paneli: "10x550Vt JA Solar", Inverter: "Huawei 5kVt", AKB: "optsiino", Vyrobnytstvo: "~6500 kVt-god/rik" }),
      stock: 8,
      image_url: 'https://cdn.shopify.com/s/files/1/0901/2612/3357/files/8_X_500W_10_1000x.png?v=1780971779'
    },
    {
      name: 'Комплект автономної СЕС 3 кВт з АКБ',
      category: 'kits',
      description: 'Avtonomnyi komplekt dlia dachi abo budynku bez pidkliuchennia do merezhi. 6 paneliv + hibrydnyi invertor + akumuliator 5.12 kVt-god.',
      price: 87900,
      power_w: 3000,
      specs: JSON.stringify({ Potuzhnist: "3 kVt", Paneli: "6x500Vt", Inverter: "Deye 5 kVt hibryd", AKB: "5.12 kVt-god LiFePO4", Avtonomiia: "do 8 hod" }),
      stock: 5,
      image_url: 'https://cdn.shopify.com/s/files/1/0901/2612/3357/files/4_X_500W_27_1000x.png?v=1780971779'
    },
    {
      name: 'Контролер заряду MPPT 60А EPEVER',
      category: 'controllers',
      description: 'MPPT контролер для ефективної зарядки акумуляторів від сонячних панелей. Підтримка 12/24/36/48В.',
      price: 4650,
      power_w: 3000,
      specs: JSON.stringify({ Струм: '60 А', Напруга: '12-48 В авто', Тип: 'MPPT', ККД: '98%', Дисплей: 'LCD', Захист: 'Повний' }),
      stock: 31,
      image_url: 'https://online-batterien.de/thumbnail/9d/3d/6b/1753879080/1-3d449fd8cdb344aa9ea44b085577fa02_800x800.jpg?ts=1754107301'
    },
    {
      name: 'Контролер заряду MPPT 100А Victron SmartSolar',
      category: 'controllers',
      description: 'Преміум MPPT контролер з Bluetooth та VE.Smart мережею. Максимальна ефективність та надійність.',
      price: 12490,
      power_w: 5800,
      specs: JSON.stringify({ Струм: '100 А', Напруга: '12-48 В', Тип: 'MPPT', ККД: '99%', Bluetooth: 'Так', App: 'VictronConnect' }),
      stock: 12,
      image_url: 'https://i.otto.de/i/otto/cb96aa30-af50-5888-931d-0c214b3c4aff?h=520&w=551&sm=clamp&upscale=true&fmt=auto'
    },
    {
      name: 'Алюмінієві кріплення для даху (комплект на 10 панелей)',
      category: 'accessories',
      description: 'Універсальна система кріплення для скатних дахів. Алюміній + нержавійка. В комплекті всі необхідні елементи.',
      price: 3890,
      power_w: null,
      specs: JSON.stringify({ Кількість: 'на 10 панелей', Матеріал: 'Алюміній 6005 + SUS304', Кут: '15-60°', Гарантія: '10 років' }),
      stock: 40,
      image_url: 'https://i.otto.de/i/otto/03164630-cb28-4e6f-8d40-8c4091faff63?h=520&w=551&sm=clamp&upscale=true&fmt=auto'
    },
    {
      name: 'Силовий кабель PV 6 мм2 (100 м)',
      category: 'accessories',
      description: 'Спеціальний сонячний кабель для підключення панелей. Стійкий до УФ, озону, температури -40..+90 C.',
      price: 2450,
      power_w: null,
      specs: JSON.stringify({ "Pereziz": "6 mm2", "Dovzhyna": "100 m", "Napruga": "1.5 kV DC", "Temp": "-40C do +90C", "Sertyfikat": "TUV" }),
      stock: 55,
      image_url: 'https://solar-sgh-shop.de/cdn/shop/files/solarkabel.jpg?v=1693818015&width=823'
    }
  ];

  const insert = db.prepare(`
    INSERT INTO products (name, category, description, price, power_w, specs, stock, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMany = db.transaction((products) => {
    for (const p of products) insert.run(p.name, p.category, p.description, p.price, p.power_w, p.specs, p.stock, p.image_url);
  });
  insertMany(seedProducts);
  console.log('Seeded 12 solar products');
}

// Seed admin + test user if none
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
if (userCount === 0) {
  const adminHash = bcrypt.hashSync('admin123', 10);
  const userHash = bcrypt.hashSync('123456', 10);
  db.prepare('INSERT INTO users (email, password_hash, full_name, phone, address, is_admin) VALUES (?, ?, ?, ?, ?, 1)')
    .run('admin@solar.ua', adminHash, 'Адміністратор Магазину', '+380501234567', 'м. Київ, вул. Сонячна 15');
  db.prepare('INSERT INTO users (email, password_hash, full_name, phone, address, is_admin) VALUES (?, ?, ?, ?, ?, 0)')
    .run('user@example.com', userHash, 'Іван Петренко', '+380671112233', 'м. Боярка, вул. Шевченка 42, кв. 15');
  console.log('Seeded admin and demo user');
}

// Auth middleware
function authRequired(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Потрібна авторизація' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Невірний або прострочений токен' });
  }
}

function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Доступ тільки для адміністратора' });
    next();
  });
}

// Routes

// Auth
app.post('/api/auth/register', (req, res) => {
  const { email, password, full_name, phone, address } = req.body;
  if (!email || !password || !full_name) return res.status(400).json({ error: 'Заповніть обов\'язкові поля' });
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Користувач з таким email вже існує' });
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (email, password_hash, full_name, phone, address) VALUES (?, ?, ?, ?, ?)')
    .run(email, hash, full_name, phone || '', address || '');
  const user = db.prepare('SELECT id, email, full_name, phone, address, is_admin FROM users WHERE id = ?').get(info.lastInsertRowid);
  const token = jwt.sign({ id: user.id, email: user.email, is_admin: !!user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Невірний email або пароль' });
  }
  const token = jwt.sign({ id: user.id, email: user.email, is_admin: !!user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
  const safeUser = { id: user.id, email: user.email, full_name: user.full_name, phone: user.phone, address: user.address, is_admin: !!user.is_admin };
  res.json({ token, user: safeUser });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT id, email, full_name, phone, address, is_admin FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Користувач не знайдений' });
  res.json({ user });
});

// Products
app.get('/api/products', (req, res) => {
  const { category, q, minPrice, maxPrice, minPower } = req.query;
  let sql = 'SELECT * FROM products';
  const params = [];
  const where = [];
  if (category) {
    where.push('category = ?');
    params.push(category);
  }
  if (q) {
    where.push('(name LIKE ? OR description LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (minPrice) {
    where.push('price >= ?');
    params.push(parseInt(minPrice));
  }
  if (maxPrice) {
    where.push('price <= ?');
    params.push(parseInt(maxPrice));
  }
  if (minPower) {
    where.push('power_w >= ?');
    params.push(parseInt(minPower));
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY id DESC';
  const products = db.prepare(sql).all(...params).map(p => ({
    ...p,
    specs: p.specs ? JSON.parse(p.specs) : {}
  }));
  res.json(products);
});

app.get('/api/products/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Товар не знайдено' });
  p.specs = p.specs ? JSON.parse(p.specs) : {};
  res.json(p);
});

app.post('/api/products', adminRequired, (req, res) => {
  const { name, category, description, price, power_w, specs, stock, image_url } = req.body;
  if (!name || !category || !price) return res.status(400).json({ error: 'name, category, price обов\'язкові' });
  const specsStr = specs ? (typeof specs === 'string' ? specs : JSON.stringify(specs)) : '{}';
  const info = db.prepare(`
    INSERT INTO products (name, category, description, price, power_w, specs, stock, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, category, description || '', price, power_w || null, specsStr, stock || 10, image_url || 'https://picsum.photos/id/1015/600/400');
  const created = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
  created.specs = JSON.parse(created.specs || '{}');
  res.status(201).json(created);
});

app.put('/api/products/:id', adminRequired, (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Товар не знайдено' });
  const { name, category, description, price, power_w, specs, stock, image_url } = req.body;
  const specsStr = specs ? (typeof specs === 'string' ? specs : JSON.stringify(specs)) : existing.specs;
  db.prepare(`
    UPDATE products SET
      name = COALESCE(?, name),
      category = COALESCE(?, category),
      description = COALESCE(?, description),
      price = COALESCE(?, price),
      power_w = COALESCE(?, power_w),
      specs = ?,
      stock = COALESCE(?, stock),
      image_url = COALESCE(?, image_url)
    WHERE id = ?
  `).run(
    name ?? null, category ?? null, description ?? null, price ?? null, power_w ?? null,
    specsStr, stock ?? null, image_url ?? null, id
  );
  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  updated.specs = JSON.parse(updated.specs || '{}');
  res.json(updated);
});

app.delete('/api/products/:id', adminRequired, (req, res) => {
  const info = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Товар не знайдено' });
  res.json({ ok: true });
});

// Orders
app.post('/api/orders', authRequired, (req, res) => {
  const { items, customer_name, phone, address, comment } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Кошик порожній' });
  if (!customer_name || !phone || !address) return res.status(400).json({ error: 'Вкажіть дані доставки' });

  let total = 0;
  const validatedItems = [];
  for (const item of items) {
    const prod = db.prepare('SELECT id, name, price, stock FROM products WHERE id = ?').get(item.product_id);
    if (!prod) return res.status(400).json({ error: `Товар ${item.product_id} не знайдено` });
    if (prod.stock < item.qty) return res.status(400).json({ error: `Недостатньо ${prod.name} на складі` });
    total += prod.price * item.qty;
    validatedItems.push({ product_id: prod.id, name: prod.name, price: prod.price, qty: item.qty });
  }

  const orderInfo = db.prepare(`
    INSERT INTO orders (user_id, total, customer_name, phone, address, comment)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.user.id, total, customer_name, phone, address, comment || '');

  const orderId = orderInfo.lastInsertRowid;
  const insertItem = db.prepare('INSERT INTO order_items (order_id, product_id, name, price, qty) VALUES (?, ?, ?, ?, ?)');
  const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

  const tx = db.transaction(() => {
    for (const it of validatedItems) {
      insertItem.run(orderId, it.product_id, it.name, it.price, it.qty);
      updateStock.run(it.qty, it.product_id);
    }
  });
  tx();

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
  res.status(201).json({ ...order, items: orderItems });
});

app.get('/api/orders/my', authRequired, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  for (const o of orders) {
    o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  }
  res.json(orders);
});

app.get('/api/orders', adminRequired, (req, res) => {
  const orders = db.prepare(`
    SELECT o.*, u.email as user_email, u.full_name as user_name
    FROM orders o LEFT JOIN users u ON u.id = o.user_id
    ORDER BY o.created_at DESC
  `).all();
  for (const o of orders) {
    o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  }
  res.json(orders);
});

app.put('/api/orders/:id/status', adminRequired, (req, res) => {
  const { status } = req.body;
  const allowed = ['new', 'processing', 'shipped', 'completed', 'cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Невірний статус' });
  const info = db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Замовлення не знайдено' });
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  res.json(order);
});

// Contact
app.post('/api/contact', async (req, res) => {
  const { name, email, phone, topic, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: 'Заповніть ім\'я, email та повідомлення' });

  const contactInfo = db.prepare(`
    INSERT INTO contact_messages (name, email, phone, topic, message)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, email, phone || '', topic || '', message);

  const telegramText = [
    'Нова заявка з сайту СонцеЕнерго',
    '',
    `ID заявки: ${contactInfo.lastInsertRowid}`,
    `Ім'я: ${name}`,
    `Email: ${email}`,
    `Телефон: ${phone || 'не вказано'}`,
    topic ? `Тема: ${topic}` : null,
    '',
    'Повідомлення:',
    message,
  ].filter(Boolean).join('\n');

  console.log('Contact message received:', { name, email, phone, topic, message });

  try {
    const sent = await sendTelegramMessage(telegramText);
    if (sent) {
      db.prepare('UPDATE contact_messages SET telegram_sent = 1 WHERE id = ?').run(contactInfo.lastInsertRowid);
    }
  } catch (err) {
    console.error('Telegram send failed:', err.message);
  }

  res.json({ ok: true, message: 'Дякуємо! Ваше повідомлення надіслано. Ми зв\'яжемося з вами найближчим часом.' });
});

app.get('/api/contact-messages', adminRequired, (req, res) => {
  const messages = db.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC').all();
  res.json(messages);
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const frontendCandidates = [
  path.join(__dirname, 'public'),
  path.join(__dirname, '..', 'client', 'dist'),
];
const publicDir = frontendCandidates.find((candidate) => fs.existsSync(path.join(candidate, 'index.html')));

if (publicDir) {
  const indexHtmlPath = path.join(publicDir, 'index.html');
  console.log(`Serving frontend from ${publicDir}`);
  app.use(express.static(publicDir));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(indexHtmlPath);
  });
} else {
  console.warn('Frontend build not found. Run the client build and copy dist to server/public.');
  app.get('/', (req, res) => {
    res.status(503).send('Frontend build not found. Check the Render build command.');
  });
}

app.listen(PORT, () => {
  console.log(`Solar shop API server running on http://localhost:${PORT}`);
  console.log('Demo users: admin@solar.ua / admin123   |   user@example.com / 123456');
});
