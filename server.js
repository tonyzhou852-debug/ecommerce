const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000; // Render sets PORT automatically

app.use(express.json());

// ---------- serve the storefront ----------
app.use(express.static(path.join(__dirname, "public")));

// ---------- data ----------
const products = require("./products.json");

// ---------- API routes ----------

// GET /api/products -> full catalog
app.get("/api/products", (req, res) => {
  res.json(products);
});

// GET /api/products/:file -> single product by file number, e.g. /api/products/001
app.get("/api/products/:file", (req, res) => {
  const item = products.find((p) => p.file === req.params.file);
  if (!item) return res.status(404).json({ error: "File not found in the archive." });
  res.json(item);
});

// POST /api/newsletter -> { email }
// Saves signups to newsletter.json (simple flat-file storage)
app.post("/api/newsletter", (req, res) => {
  const { email } = req.body || {};
  if (!email || !/.+@.+\..+/.test(email)) {
    return res.status(400).json({ error: "Please provide a valid email." });
  }
  const file = path.join(__dirname, "newsletter.json");
  let list = [];
  try {
    list = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {}
  if (!list.includes(email)) {
    list.push(email);
    fs.writeFileSync(file, JSON.stringify(list, null, 2));
  }
  res.json({ ok: true, message: "You're on the list." });
});

// POST /api/orders -> { items: [{file, qty}], email, notes }
// Stores order requests to orders.json so you can follow up manually
app.post("/api/orders", (req, res) => {
  const { items, email, notes } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Cart is empty." });
  }
  if (!email || !/.+@.+\..+/.test(email)) {
    return res.status(400).json({ error: "A valid email is required." });
  }

  // validate items and compute total server-side
  let total = 0;
  const lines = [];
  for (const it of items) {
    const p = products.find((x) => x.file === it.file);
    if (!p) return res.status(400).json({ error: `Unknown product file: ${it.file}` });
    const qty = Math.max(1, parseInt(it.qty || 1, 10));
    total += p.price * qty;
    lines.push({ file: p.file, name: p.name, price: p.price, qty });
  }

  const order = {
    id: "ORD-" + Date.now().toString(36).toUpperCase(),
    createdAt: new Date().toISOString(),
    email,
    notes: notes || "",
    items: lines,
    total,
    status: "pending",
  };

  const file = path.join(__dirname, "orders.json");
  let orders = [];
  try {
    orders = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {}
  orders.push(order);
  fs.writeFileSync(file, JSON.stringify(orders, null, 2));

  res.json({ ok: true, orderId: order.id, total });
});

// health check (Render pings this)
app.get("/healthz", (req, res) => res.send("ok"));

// fallback: send index.html for any other route
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`UNLISTED store running on port ${PORT}`);
});
