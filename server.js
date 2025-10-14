// server.js — Node + Express: guarda/lee db/store.json con CRUD
import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();

// Middlewares
app.use(cors({ origin: true, methods: ['GET','POST','PUT','DELETE','OPTIONS'] }));
app.options('*', cors());
app.use(express.json({ limit: '15mb' })); // soporta DataURL

// Servir frontend estático (ajusta si tu carpeta pública es otra)
app.use(express.static(path.join(__dirname, 'public')));

// Rutas de DB en disco
const DB_DIR  = path.join(__dirname, 'db');
const DB_FILE = path.join(DB_DIR, 'store.json');

function nowISO(){ return new Date().toISOString(); }
function uid(){ return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }

function baseDB(){
  return {
    persons: [],
    users: [],
    products: [],
    tickets: [],
    _meta: { version: 1, updatedAt: nowISO() },
  };
}
function ensureDB(){
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(baseDB(), null, 2), 'utf8');
  }
}
function readDB(){
  ensureDB();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const db = JSON.parse(raw);

    // Autocorrección de estructura
    if (!db || typeof db !== 'object') return baseDB();
    if (!Array.isArray(db.persons))  db.persons  = [];
    if (!Array.isArray(db.users))    db.users    = [];
    if (!Array.isArray(db.products)) db.products = [];
    if (!Array.isArray(db.tickets))  db.tickets  = [];
    if (!db._meta || typeof db._meta !== 'object') {
      db._meta = { version: 1, updatedAt: nowISO() };
    }
    return db;
  } catch {
    // Si está corrupto, reinicializa
    const fresh = baseDB();
    fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2), 'utf8');
    return fresh;
  }
}
function writeDB(db){
  // Robustez: normalizar
  if (!db || typeof db !== 'object') db = baseDB();
  if (!db._meta || typeof db._meta !== 'object') {
    db._meta = { version: 1, updatedAt: nowISO() };
  } else {
    db._meta.updatedAt = nowISO();
  }
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

/* =========================
   Utilidades comunes
========================= */
function findById(arr, id){ return arr.find(x => x.id === id) || null; }
function requireFields(obj, fields){
  for (const f of fields) if (!(f in obj) || obj[f] === '' || obj[f] == null) return f;
  return null;
}

/* =========================
   DB: lectura total / descarga
========================= */
app.get('/api/db', (req, res) => {
  try { res.json(readDB()); } catch { res.status(500).json({ error: 'No se pudo leer la DB' }); }
});

app.get('/api/db/download', (req, res) => {
  try {
    ensureDB();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="store.json"');
    fs.createReadStream(DB_FILE).pipe(res);
  } catch {
    res.status(500).json({ error: 'No se pudo descargar la DB' });
  }
});

/* =========================
   LOGIN (simple)
========================= */
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });

    const db = readDB();
    const user = db.users.find(u =>
      u.username.toLowerCase() === String(username).toLowerCase() &&
      u.userPassword === String(password)
    );
    if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const person = findById(db.persons, user.personId);
    return res.json({ user, person });
  } catch {
    return res.status(500).json({ error: 'No se pudo iniciar sesión' });
  }
});

/* =========================
   PERSONS CRUD
========================= */
app.get('/api/persons', (req, res) => {
  try { res.json(readDB().persons); } catch { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/persons', (req, res) => {
  try {
    const { name, fatherLastname, motherLastname, email } = req.body || {};
    const missing = requireFields(req.body || {}, ['name','fatherLastname','motherLastname','email']);
    if (missing) return res.status(400).json({ error: `Falta ${missing}` });

    const db = readDB();
    if (db.persons.some(p => p.email.toLowerCase() === String(email).toLowerCase()))
      return res.status(409).json({ error: 'El correo ya existe' });

    const person = { id: uid(), name, fatherLastname, motherLastname, email, createdAt: nowISO() };
    db.persons.push(person);
    writeDB(db);
    res.json(person);
  } catch {
    res.status(500).json({ error: 'No se pudo crear persona' });
  }
});

app.put('/api/persons/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = readDB();
    const idx = db.persons.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Persona no encontrada' });

    const patch = req.body || {};
    if (patch.email && patch.email !== db.persons[idx].email) {
      if (db.persons.some(p => p.email.toLowerCase() === String(patch.email).toLowerCase()))
        return res.status(409).json({ error: 'El correo ya existe' });
    }
    db.persons[idx] = { ...db.persons[idx], ...patch };
    writeDB(db);
    res.json(db.persons[idx]);
  } catch {
    res.status(500).json({ error: 'No se pudo actualizar persona' });
  }
});

app.delete('/api/persons/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = readDB();
    const before = db.persons.length;
    db.persons = db.persons.filter(p => p.id !== id);
    if (before === db.persons.length) return res.status(404).json({ error: 'Persona no encontrada' });
    writeDB(db);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'No se pudo eliminar persona' });
  }
});

/* =========================
   USERS CRUD  (+ /register)
========================= */
app.get('/api/users', (req, res) => {
  try { res.json(readDB().users); } catch { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/users/:id', (req, res) => {
  try {
    const db = readDB();
    const user = findById(db.users, req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const person = findById(db.persons, user.personId);
    res.json({ user, person });
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

// Registro combinado persona + usuario (avatar OBLIGATORIO)
app.post('/api/users/register', (req, res) => {
  try {
    const { person, user } = req.body || {};
    if (!person || !user) return res.status(400).json({ error: 'Faltan person y user' });

    const missP = requireFields(person, ['name','fatherLastname','motherLastname','email']);
    if (missP) return res.status(400).json({ error: `Falta persona.${missP}` });

    const missU = requireFields(user, ['username','userPassword','avatar']);
    if (missU) return res.status(400).json({ error: `Falta user.${missU}` });

    const db = readDB();

    if (db.persons.some(p => p.email.toLowerCase() === String(person.email).toLowerCase()))
      return res.status(409).json({ error: 'El correo ya existe' });

    if (db.users.some(u => u.username.toLowerCase() === String(user.username).toLowerCase()))
      return res.status(409).json({ error: 'El username ya existe' });

    const personObj = {
      id: uid(),
      name: String(person.name).trim(),
      fatherLastname: String(person.fatherLastname).trim(),
      motherLastname: String(person.motherLastname).trim(),
      email: String(person.email).trim(),
      createdAt: nowISO()
    };
    db.persons.push(personObj);

    const userObj = {
      id: uid(),
      username: String(user.username).trim(),
      userPassword: String(user.userPassword), // DEMO: en prod hashea
      personId: personObj.id,
      avatar: String(user.avatar),
      role: user.role || 'cliente',
      createdAt: nowISO()
    };
    db.users.push(userObj);

    writeDB(db);
    res.json({ person: personObj, user: userObj });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo registrar' });
  }
});

app.post('/api/users', (req, res) => {
  try {
    const { username, userPassword, personId, avatar, role } = req.body || {};
    const miss = requireFields(req.body || {}, ['username','userPassword','personId']);
    if (miss) return res.status(400).json({ error: `Falta ${miss}` });

    const db = readDB();
    if (db.users.some(u => u.username.toLowerCase() === String(username).toLowerCase()))
      return res.status(409).json({ error: 'El username ya existe' });

    if (!findById(db.persons, personId)) return res.status(400).json({ error: 'Persona asociada no existe' });

    const user = { id: uid(), username, userPassword, personId, avatar: avatar ?? null, role: role || 'cliente', createdAt: nowISO() };
    db.users.push(user);
    writeDB(db);
    res.json(user);
  } catch {
    res.status(500).json({ error: 'No se pudo crear usuario' });
  }
});

app.put('/api/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = readDB();
    const idx = db.users.findIndex(u => u.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Usuario no encontrado' });

    const patch = req.body || {};
    if (patch.username && patch.username !== db.users[idx].username) {
      if (db.users.some(u => u.username.toLowerCase() === String(patch.username).toLowerCase()))
        return res.status(409).json({ error: 'El username ya existe' });
    }
    if (patch.personId && !findById(db.persons, patch.personId))
      return res.status(400).json({ error: 'Persona asociada no existe' });

    db.users[idx] = { ...db.users[idx], ...patch };
    writeDB(db);
    res.json(db.users[idx]);
  } catch {
    res.status(500).json({ error: 'No se pudo actualizar usuario' });
  }
});

app.delete('/api/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = readDB();
    const before = db.users.length;
    db.users = db.users.filter(u => u.id !== id);
    if (before === db.users.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    writeDB(db);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'No se pudo eliminar usuario' });
  }
});

/* =========================
   PRODUCTS CRUD
========================= */

// GET /api/products?q=texto&category=figura&minPrice=10&maxPrice=100
app.get('/api/products', (req, res) => {
  try {
    const db = readDB();
    const { q = '', category = '', minPrice = '', maxPrice = '' } = req.query;

    let items = db.products.slice();

    if (q) {
      const needle = String(q).toLowerCase();
      items = items.filter(p =>
        String(p.name).toLowerCase().includes(needle) ||
        String(p.description || '').toLowerCase().includes(needle) ||
        String(p.sku || '').toLowerCase().includes(needle)
      );
    }
    if (category) {
      items = items.filter(p => (p.category || '') === String(category));
    }
    res.json(items);
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

app.get('/api/products/:id', (req, res) => {
  try {
    const db = readDB();
    const prod = db.products.find(p => p.id === req.params.id);
    if (!prod) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(prod);
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

app.post('/api/products', (req, res) => {
  try {
    const { name, price, stock, sku, image, category, description } = req.body || {};

    const miss = requireFields(req.body || {}, ['name','price','stock']);
    if (miss) return res.status(400).json({ error: `Falta ${miss}` });

    const _name = String(name).trim();
    const _price = Number(price);
    const _stock = Number(stock);
    if (!_name) return res.status(400).json({ error: 'Nombre vacío' });
    if (!Number.isFinite(_price) || _price < 0) return res.status(400).json({ error: 'Precio inválido' });
    if (!Number.isInteger(_stock) || _stock < 0) return res.status(400).json({ error: 'Stock inválido' });

    const db = readDB();

    const prod = {
      id: uid(),
      name: _name,
      price: _price,
      stock: _stock,
      sku: (sku != null && String(sku).trim() !== '') ? String(sku).trim() : null,
      image: image ?? null, // DataURL o URL opcional
      category: (category != null && String(category).trim() !== '') ? String(category).trim() : null,
      description: (description != null && String(description).trim() !== '') ? String(description).trim() : null,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };

    db.products.push(prod);
    writeDB(db);
    res.json(prod);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo crear producto' });
  }
});

app.put('/api/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = readDB();
    const idx = db.products.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Producto no encontrado' });

    const patch = req.body || {};
    const cur = db.products[idx];

    const next = { ...cur, ...patch };
    if (patch.price !== undefined) {
      const n = Number(patch.price);
      if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'Precio inválido' });
      next.price = n;
    }
    if (patch.stock !== undefined) {
      const n = Number(patch.stock);
      if (!Number.isInteger(n) || n < 0) return res.status(400).json({ error: 'Stock inválido' });
      next.stock = n;
    }

    if (patch.name !== undefined) next.name = String(patch.name).trim();
    if (patch.sku !== undefined) next.sku = (String(patch.sku).trim() || null);
    if (patch.category !== undefined) next.category = (String(patch.category).trim() || null);
    if (patch.description !== undefined) next.description = (String(patch.description).trim() || null);
    if (patch.image !== undefined) next.image = patch.image ?? null;

    next.updatedAt = nowISO();

    db.products[idx] = next;
    writeDB(db);
    res.json(db.products[idx]);
  } catch {
    res.status(500).json({ error: 'No se pudo actualizar producto' });
  }
});

app.delete('/api/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = readDB();
    const before = db.products.length;
    db.products = db.products.filter(p => p.id !== id);
    if (before === db.products.length) return res.status(404).json({ error: 'Producto no encontrado' });
    writeDB(db);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'No se pudo eliminar producto' });
  }
});


/* =========================
   TICKETS CRUD
========================= */
/* =========================
   TICKETS CRUD + PDF
========================= */
import PDFDocument from 'pdfkit';

// Util: arma items desde un array de productIds repetidos
function aggregateItemsById(productIds) {
  const map = new Map();
  for (const id of productIds) map.set(id, (map.get(id) || 0) + 1);
  return Array.from(map.entries()).map(([productId, qty]) => ({ productId, qty }));
}

// POST /api/tickets – crea ticket, valida stock, descuenta stock y guarda line items
app.post('/api/tickets', (req, res) => {
  try {
    const { code, userId, productIds, status, notes } = req.body || {};
    const miss = requireFields(req.body || {}, ['code', 'userId', 'productIds', 'status']);
    if (miss) return res.status(400).json({ error: `Falta ${miss}` });

    const db = readDB();

    // 1) usuario
    const user = findById(db.users, userId);
    if (!user) return res.status(400).json({ error: 'Usuario del ticket no existe' });

    // 2) agrupar items por producto y validar existencia
    const grouped = aggregateItemsById(productIds || []);
    if (!grouped.length) return res.status(400).json({ error: 'No hay productos en el ticket' });

    // 3) construir items y validar stock actual
    const items = [];
    for (const { productId, qty } of grouped) {
      const prod = findById(db.products, productId);
      if (!prod) return res.status(400).json({ error: `Producto no existe: ${productId}` });
      const q = Math.max(1, Math.floor(qty || 1));

      if ((prod.stock ?? 0) < q) {
        return res.status(409).json({ error: `Stock insuficiente para "${prod.name}". Disponible: ${prod.stock}, solicitado: ${q}` });
      }

      items.push({
        productId,
        name: String(prod.name),
        price: Number(prod.price) || 0,
        qty: q,
        lineTotal: (Number(prod.price) || 0) * q,
        sku: prod.sku ?? null
      });
    }

    // 4) descontar stock (toda la operación será atómica en este proceso)
    for (const it of items) {
      const idx = db.products.findIndex(p => p.id === it.productId);
      db.products[idx].stock = Math.max(0, (db.products[idx].stock || 0) - it.qty);
    }

    // 5) total
    const subtotal = items.reduce((s, x) => s + x.lineTotal, 0);
    const total = subtotal; // sin impuestos/envío
    const ticket = {
      id: uid(),
      code,
      userId,
      items,           // ahora items con qty y price
      productIds,      // (mantengo compatibilidad con lo que mandas)
      status,
      notes: notes ?? '',
      subtotal,
      total,
      createdAt: nowISO(),
      updatedAt: nowISO()
    };

    db.tickets.push(ticket);
    writeDB(db);

    // URL del PDF (stream bajo demanda)
    const pdfUrl = `/api/tickets/${encodeURIComponent(ticket.id)}/pdf`;
    res.json({ ticket, pdfUrl });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo crear ticket' });
  }
});

// GET /api/tickets – listado simple
app.get('/api/tickets', (req, res) => {
  try { res.json(readDB().tickets); } catch { res.status(500).json({ error: 'Error' }); }
});

// GET /api/tickets/:id – leer 1 ticket
app.get('/api/tickets/:id', (req, res) => {
  try {
    const db = readDB();
    const t = findById(db.tickets, req.params.id);
    if (!t) return res.status(404).json({ error: 'Ticket no encontrado' });
    res.json(t);
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

// PUT /api/tickets/:id – actualizar estado/notas (no stock aquí)
app.put('/api/tickets/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = readDB();
    const idx = db.tickets.findIndex(t => t.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Ticket no encontrado' });

    const patch = { ...(req.body || {}) };
    db.tickets[idx] = { ...db.tickets[idx], ...patch, updatedAt: nowISO() };
    writeDB(db);
    res.json(db.tickets[idx]);
  } catch {
    res.status(500).json({ error: 'No se pudo actualizar ticket' });
  }
});

// DELETE /api/tickets/:id
app.delete('/api/tickets/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = readDB();
    const before = db.tickets.length;
    db.tickets = db.tickets.filter(t => t.id !== id);
    if (before === db.tickets.length) return res.status(404).json({ error: 'Ticket no encontrado' });
    writeDB(db);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'No se pudo eliminar ticket' });
  }
});

// GET /api/tickets/:id/pdf – generar PDF on-the-fly
app.get('/api/tickets/:id/pdf', (req, res) => {
  try {
    const db = readDB();
    const t = findById(db.tickets, req.params.id);
    if (!t) return res.status(404).json({ error: 'Ticket no encontrado' });

    const user = findById(db.users, t.userId);
    const person = user ? findById(db.persons, user.personId) : null;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${t.code || ('ticket-' + t.id)}.pdf"`);

    const doc = new PDFDocument({ margin: 48 });
    doc.pipe(res);

    doc.fontSize(18).text('SHOP D&D - Ticket de compra', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Código: ${t.code}`);
    doc.text(`Fecha: ${new Date(t.createdAt).toLocaleString('es-MX')}`);
    if (person) doc.text(`Cliente: ${person.name} (${person.email})`);
    doc.moveDown();

    // Tabla simple
    doc.fontSize(12).text(`Items:`);
    doc.moveDown(0.2);

    // Encabezados
    doc.font('Helvetica-Bold').text('Producto', { continued: true, width: 240 });
    doc.text('Cant.', { continued: true, width: 60, align: 'right' });
    doc.text('Precio', { continued: true, width: 80, align: 'right' });
    doc.text('Importe', { width: 100, align: 'right' });
    doc.font('Helvetica');
    doc.moveDown(0.2);

    t.items.forEach(it => {
      doc.text(it.name, { continued: true, width: 240 });
      doc.text(String(it.qty), { continued: true, width: 60, align: 'right' });
      doc.text((it.price || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }), { continued: true, width: 80, align: 'right' });
      doc.text((it.lineTotal || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }), { width: 100, align: 'right' });
    });

    doc.moveDown();
    doc.font('Helvetica-Bold').text(`Total: ${ (t.total || 0).toLocaleString('es-MX',{ style:'currency', currency:'MXN'}) }`, { align: 'right' });
    doc.moveDown(2);
    doc.font('Helvetica').fontSize(10).text('Gracias por su compra.', { align: 'center', opacity: 0.8 });

    doc.end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo generar el PDF' });
  }
});
/* =========================
   Levantar servidor
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  ensureDB();
  console.log(`✅ Servidor listo: http://localhost:${PORT}`);
  console.log(`📄 DB: ${DB_FILE}`);
});
