import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import * as dotenv from "dotenv";
import fs from "fs";
import Database from "better-sqlite3";

dotenv.config();

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const db = new Database(path.join(DATA_DIR, 'database.sqlite'));

// Inisialisasi Tabel SQLite
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT,
    displayName TEXT
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    userId TEXT,
    name TEXT,
    type TEXT,
    balance REAL,
    initialBalance REAL,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    userId TEXT,
    accountId TEXT,
    toAccountId TEXT,
    cashAccountId TEXT,
    type TEXT,
    amount REAL,
    fee REAL,
    feeExternal REAL,
    netAmount REAL,
    netImpact REAL,
    cashImpact REAL,
    note TEXT,
    paymentStatus TEXT,
    timestamp TEXT,
    createdAt TEXT
  );
`);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // --- API SQlite ---
  
  // Accounts: Get
  app.get("/api/accounts", (req, res) => {
    const userId = req.query.userId;
    const stmt = db.prepare("SELECT * FROM accounts WHERE userId = ?");
    const accounts = stmt.all(userId);
    res.json(accounts);
  });

  // Accounts: Add/Update
  app.post("/api/accounts", (req, res) => {
    const account = req.body;
    const id = account.id || Date.now().toString();
    
    const stmtCheck = db.prepare("SELECT id FROM accounts WHERE id = ? AND userId = ?");
    const existing = stmtCheck.get(id, account.userId);

    if (existing) {
      const stmtUpdate = db.prepare(`
        UPDATE accounts 
        SET name = ?, type = ?, balance = ?, initialBalance = ? 
        WHERE id = ? AND userId = ?
      `);
      stmtUpdate.run(account.name, account.type, account.balance, account.initialBalance, id, account.userId);
    } else {
      const stmtInsert = db.prepare(`
        INSERT INTO accounts (id, userId, name, type, balance, initialBalance, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmtInsert.run(id, account.userId, account.name, account.type, account.balance, account.initialBalance, account.createdAt || new Date().toISOString());
    }
    
    res.json({ ...account, id });
  });

  app.post("/api/auth/register", (req, res) => {
    const { email, password, displayName } = req.body;
    const id = Date.now().toString();
    
    try {
      const stmt = db.prepare("INSERT INTO users (id, email, password, displayName) VALUES (?, ?, ?, ?)");
      stmt.run(id, email, password, displayName);
      res.json({ id, email, displayName });
    } catch (err: any) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: "Email sudah terdaftar" });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const stmt = db.prepare("SELECT * FROM users WHERE email = ? AND password = ?");
    const user: any = stmt.get(email, password);
    
    if (!user) return res.status(401).json({ error: "Email atau Password salah" });
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });

  app.get("/api/transactions", (req, res) => {
    const userId = req.query.userId;
    const stmt = db.prepare("SELECT * FROM transactions WHERE userId = ? ORDER BY createdAt DESC");
    const transactions = stmt.all(userId);
    res.json(transactions);
  });

  app.post("/api/transactions", (req, res) => {
    const id = Date.now().toString();
    const t = req.body;
    const createdAt = t.createdAt || new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO transactions (
        id, userId, accountId, toAccountId, cashAccountId, type, 
        amount, fee, feeExternal, netAmount, netImpact, cashImpact, 
        note, paymentStatus, timestamp, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id, t.userId, t.accountId, t.toAccountId || null, t.cashAccountId || null, t.type,
      t.amount || 0, t.fee || 0, t.feeExternal || 0, t.netAmount || 0, t.netImpact || 0, t.cashImpact || 0,
      t.note || "", t.paymentStatus || "success", t.timestamp || createdAt, createdAt
    );

    res.json({ ...t, id, createdAt });
  });

  app.delete("/api/transactions/:id", (req, res) => {
    const stmt = db.prepare("DELETE FROM transactions WHERE id = ?");
    stmt.run(req.params.id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
