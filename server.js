require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const DATA_FILE = path.join(__dirname, 'data', 'store.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Image upload config ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `product-${Date.now()}${ext}`;
    cb(null, safeName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('نوع الصورة غير مدعوم (jpg, png, webp فقط)'));
  }
});

// ---------- Helpers ----------
function readData() { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); }
function writeData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8'); }
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'مفيش توكن دخول' });
  const token = header.replace('Bearer ', '');
  try { jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'الجلسة منتهية، سجل دخول تاني' }); }
}

// ---------- Public ----------
app.get('/api/store', (req, res) => res.json(readData()));

// ---------- Auth ----------
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '12h' });
    return res.json({ token });
  }
  res.status(401).json({ error: 'اسم المستخدم أو كلمة السر غلط' });
});

// ---------- Image upload ----------
app.post('/api/upload', authMiddleware, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'مفيش صورة اتبعتت' });
  res.json({ imagePath: `/uploads/${req.file.filename}` });
});

// ---------- Store info ----------
app.put('/api/store-info', authMiddleware, (req, res) => {
  const data = readData();
  data.store = { ...data.store, ...req.body };
  writeData(data);
  res.json(data.store);
});

// ---------- Products CRUD ----------
app.post('/api/items', authMiddleware, (req, res) => {
  const data = readData();
  const { category, name_ar, name_en, desc_ar, desc_en, price, image, sub } = req.body;
  if (!category || !name_ar || price === undefined) {
    return res.status(400).json({ error: 'القسم والاسم بالعربي والسعر مطلوبين' });
  }
  const newId = data.items.length ? Math.max(...data.items.map(i => i.id)) + 1 : 1;
  const newItem = {
    id: newId, category, sub: sub || null,
    name_ar, name_en: name_en || name_ar,
    desc_ar: desc_ar || '', desc_en: desc_en || '',
    price: Number(price), image: image || ''
  };
  data.items.push(newItem);
  writeData(data);
  res.status(201).json(newItem);
});

app.put('/api/items/:id', authMiddleware, (req, res) => {
  const data = readData();
  const id = Number(req.params.id);
  const item = data.items.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'المنتج ده مش موجود' });
  Object.assign(item, req.body);
  writeData(data);
  res.json(item);
});

app.delete('/api/items/:id', authMiddleware, (req, res) => {
  const data = readData();
  const id = Number(req.params.id);
  data.items = data.items.filter(i => i.id !== id);
  writeData(data);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`✅ السيرفر شغال على http://localhost:${PORT}`);
  console.log(`   الموقع: http://localhost:${PORT}`);
  console.log(`   لوحة التحكم: http://localhost:${PORT}/admin.html`);
});
module.exports = app;
