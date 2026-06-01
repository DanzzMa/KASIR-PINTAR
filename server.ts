import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import * as dotenv from "dotenv";
import fs from "fs";
import Database from "better-sqlite3";
import cron from "node-cron";

dotenv.config();

const DATA_DIR = path.join(process.cwd(), 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

// --- Penjadwalan Backup Otomatis (Setiap Jam ke Lokal) ---
cron.schedule('0 * * * *', () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}.sqlite`);
  
  try {
    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`[Backup] Database berhasil dibackup ke: ${backupPath}`);
    
    // Hapus backup lama (simpan 24 backup terakhir saja)
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.sqlite'))
      .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 24) {
      files.slice(24).forEach(file => {
        fs.unlinkSync(path.join(BACKUP_DIR, file.name));
        console.log(`[Backup] Menghapus backup lama: ${file.name}`);
      });
    }
  } catch (err) {
    console.error('[Backup] Gagal melakukan backup:', err);
  }
});

// --- Penjadwalan Backup Telegram (Setiap Hari jam 00:00) ---
cron.schedule('0 0 * * *', async () => {
  // Ambil semua user yang punya token telegram
  const usersWithTg = db.prepare("SELECT DISTINCT userId FROM settings WHERE key = 'telegram_token' AND value IS NOT NULL AND value != ''").all();

  for (const userRow of usersWithTg as any[]) {
    const userId = userRow.userId;
    const settingsRows = db.prepare("SELECT * FROM settings WHERE userId = ?").all(userId);
    const settings: any = {};
    settingsRows.forEach((s: any) => settings[s.key] = s.value);

    const token = settings.telegram_token;
    const chatId = settings.telegram_chat_id;

    if (token && chatId) {
      try {
        console.log(`[Auto-Backup] Menjalankan backup otomatis ke Telegram untuk user: ${userId}...`);
        const tables = ["accounts", "transactions", "debts", "settings", "daily_bookkeeping"];
        const backup: any = {};
        
        // Data User itu sendiri
        backup.profile = db.prepare("SELECT id, email, displayName FROM users WHERE id = ?").get(userId);
        
        // Data terkait dengan filter userId
        tables.forEach(table => {
          backup[table] = db.prepare(`SELECT * FROM ${table} WHERE userId = ?`).all(userId);
        });
        
        const content = Buffer.from(JSON.stringify(backup, null, 2));
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `daily-backup-${userId}-${timestamp}.json`;

        await sendToTelegram(
          token, 
          chatId, 
          `🤖 BACKUP OTOMATIS HARIAN\n👤 User: ${backup.profile?.displayName || userId}\n📅 Waktu: ${new Date().toLocaleString('id-ID')}\n📂 File: ${filename}`,
          filename,
          content
        );
      } catch (err) {
        console.error(`[Auto-Backup] Gagal kirim ke Telegram untuk user ${userId}:`, err);
      }
    }
  }
});

const db = new Database(DB_PATH);

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
    profit REAL,
    netAmount REAL,
    netImpact REAL,
    cashImpact REAL,
    note TEXT,
    paymentStatus TEXT,
    timestamp TEXT,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS debts (
    id TEXT PRIMARY KEY,
    userId TEXT,
    customerName TEXT,
    amount REAL,
    remainingAmount REAL,
    status TEXT,
    dueDate TEXT,
    createdAt TEXT,
    note TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    userId TEXT,
    key TEXT,
    value TEXT,
    PRIMARY KEY (userId, key)
  );

  CREATE TABLE IF NOT EXISTS daily_bookkeeping (
    id TEXT PRIMARY KEY,
    userId TEXT,
    date TEXT,
    session TEXT,
    totalBalance REAL,
    timestamp TEXT,
    note TEXT
  );
`);

// Helper for Telegram Backup
async function sendToTelegram(token: string, chatId: string, text: string, filename?: string, content?: Buffer) {
  if (filename && content) {
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('caption', text);
    formData.append('document', new Blob([content]), filename);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData
    });
    return res.json();
  } else {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    return res.json();
  }
}

// Migration: Add profit column if it doesn't exist
try {
  db.prepare("ALTER TABLE transactions ADD COLUMN profit REAL").run();
  console.log("Migration: Added profit column to transactions table");
} catch (err) {
  // Column might already exist
}

// Migration: Add userId column to tables if they don't exist
const tablesToMigrate = ["accounts", "transactions", "debts", "settings"];
tablesToMigrate.forEach(table => {
  try {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN userId TEXT`).run();
    console.log(`Migration: Added userId column to ${table} table`);
  } catch (err) {
    // Column might already exist
  }
});

// Migration: Ensure daily_bookkeeping table exists
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_bookkeeping (
      id TEXT PRIMARY KEY,
      userId TEXT,
      date TEXT,
      session TEXT,
      totalBalance REAL,
      timestamp TEXT,
      note TEXT
    );
  `);
  console.log("Migration: Created daily_bookkeeping table if not exists");
} catch (err) {
  // Already exists
}

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
      // Check if any user exists (Personal use only)
      const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
      if (userCount > 0) {
        return res.status(403).json({ error: "Registrasi dibatasi untuk penggunaan personal saja." });
      }

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

  app.get("/api/auth/status", (req, res) => {
    try {
      const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
      res.json({ hasUser: userCount > 0 });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/forgot-password", (req, res) => {
    const { email, newPassword } = req.body;
    const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    
    if (!user) return res.status(404).json({ error: "Email tidak ditemukan" });
    
    const stmt = db.prepare("UPDATE users SET password = ? WHERE email = ?");
    stmt.run(newPassword, email);
    res.json({ success: true, message: "Password berhasil diperbarui" });
  });

  app.post("/api/auth/recover-account", (req, res) => {
    const { displayName } = req.body;
    const users = db.prepare("SELECT email FROM users WHERE displayName LIKE ?").all(`%${displayName}%`);
    
    if (users.length === 0) return res.status(404).json({ error: "Tidak ada akun dengan nama tersebut" });
    
    // Mask emails for security
    const maskedEmails = users.map((u: any) => {
      const parts = u.email.split("@");
      const name = parts[0];
      const maskedName = name[0] + "***" + (name.length > 1 ? name[name.length - 1] : "");
      return maskedName + "@" + parts[1];
    });
    
    res.json({ emails: maskedEmails });
  });

  app.get("/api/transactions", (req, res) => {
    try {
      const userId = req.query.userId;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const stmt = db.prepare("SELECT * FROM transactions WHERE userId = ? ORDER BY createdAt DESC");
      const transactions = stmt.all(userId);
      res.json(transactions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/transactions", (req, res) => {
    try {
      const id = Date.now().toString();
      const t = req.body;
      const createdAt = t.createdAt || new Date().toISOString();
      
      db.transaction(() => {
        // 1. Insert Transaction
        const stmt = db.prepare(`
          INSERT INTO transactions (
            id, userId, accountId, toAccountId, cashAccountId, type, 
            amount, fee, feeExternal, profit, netAmount, netImpact, cashImpact, 
            note, paymentStatus, timestamp, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          id, t.userId, t.accountId, t.toAccountId || null, t.cashAccountId || null, t.type,
          t.amount || 0, t.fee || 0, t.feeExternal || 0, t.profit || 0, t.netAmount || 0, t.netImpact || 0, t.cashImpact || 0,
          t.note || "", t.paymentStatus || "success", t.timestamp || createdAt, createdAt
        );

        // 2. Update Account Balances
        if (t.accountId && t.netImpact !== 0) {
          db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(t.netImpact || 0, t.accountId);
        }

        if (t.cashAccountId && t.cashImpact !== 0) {
          db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(t.cashImpact || 0, t.cashAccountId);
        }

        if (t.type === 'transfer' && t.toAccountId) {
          db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(t.amount || 0, t.toAccountId);
        }
      })();

      res.json({ ...t, id, createdAt });
    } catch (err: any) {
      console.error("Error creating transaction:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/transactions/:id", (req, res) => {
    try {
      db.transaction(() => {
        const tx: any = db.prepare("SELECT * FROM transactions WHERE id = ?").get(req.params.id);
        if (!tx) return;

        // Reverse Net Impact (Subtracting the added impact)
        if (tx.accountId && tx.netImpact !== 0) {
          db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").run(tx.netImpact, tx.accountId);
        }

        // Reverse Cash Impact
        if (tx.cashAccountId && tx.cashImpact !== 0) {
          db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").run(tx.cashImpact, tx.cashAccountId);
        }

        // Reverse Transfer to receiver account
        if (tx.type === 'transfer' && tx.toAccountId) {
          db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").run(tx.amount, tx.toAccountId);
        }

        db.prepare("DELETE FROM transactions WHERE id = ?").run(req.params.id);
      })();
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting transaction:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/accounts/:id", (req, res) => {
    const stmt = db.prepare("DELETE FROM accounts WHERE id = ?");
    stmt.run(req.params.id);
    res.json({ success: true });
  });

  // Debts
  app.get("/api/debts", (req, res) => {
    try {
      const userId = req.query.userId;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const stmt = db.prepare("SELECT * FROM debts WHERE userId = ? ORDER BY createdAt DESC");
      const debts = stmt.all(userId);
      res.json(debts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/debts", (req, res) => {
    try {
      const id = Date.now().toString();
      const d = req.body;
      const createdAt = d.createdAt || new Date().toISOString();
      
      const stmt = db.prepare(`
        INSERT INTO debts (id, userId, customerName, amount, remainingAmount, status, dueDate, createdAt, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(id, d.userId, d.customerName, d.amount, d.remainingAmount, d.status, d.dueDate || null, createdAt, d.note || "");
      res.json({ ...d, id, createdAt });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/debts/:id", (req, res) => {
    try {
      const d = req.body;
      const fields = Object.keys(d).map(k => `${k} = ?`).join(", ");
      const values = Object.values(d);
      
      const stmt = db.prepare(`UPDATE debts SET ${fields} WHERE id = ?`);
      stmt.run(...values, req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/debts/:id", (req, res) => {
    try {
      const stmt = db.prepare("DELETE FROM debts WHERE id = ?");
      stmt.run(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Settings
  app.get("/api/settings", (req, res) => {
    try {
      const userId = req.query.userId;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const stmt = db.prepare("SELECT * FROM settings WHERE userId = ?");
      const settings = stmt.all(userId);
      const config: any = {};
      settings.forEach((s: any) => config[s.key] = s.value);
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/settings", (req, res) => {
    try {
      const { userId, ...config } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const stmt = db.prepare("INSERT OR REPLACE INTO settings (userId, key, value) VALUES (?, ?, ?)");
      Object.entries(config).forEach(([key, value]) => {
        stmt.run(userId, key, String(value));
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Daily Bookkeeping: Get
  app.get("/api/bookkeeping", (req, res) => {
    try {
      const userId = req.query.userId;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const stmt = db.prepare("SELECT * FROM daily_bookkeeping WHERE userId = ? ORDER BY date DESC, session DESC");
      const records = stmt.all(userId);
      res.json(records);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Daily Bookkeeping: Add or Update
  app.post("/api/bookkeeping", (req, res) => {
    try {
      const b = req.body;
      if (!b.userId || !b.date || !b.session) {
        return res.status(400).json({ error: "userId, date, and session are required" });
      }
      const recordId = b.id || Date.now().toString();
      const timestamp = b.timestamp || new Date().toISOString();

      const existing: any = db.prepare("SELECT id FROM daily_bookkeeping WHERE userId = ? AND date = ? AND session = ?").get(b.userId, b.date, b.session);
      
      if (existing) {
        const stmt = db.prepare(`
          UPDATE daily_bookkeeping 
          SET totalBalance = ?, timestamp = ?, note = ? 
          WHERE id = ?
        `);
        stmt.run(b.totalBalance || 0, timestamp, b.note || "", existing.id);
        res.json({ id: existing.id, ...b, timestamp });
      } else {
        const stmt = db.prepare(`
          INSERT INTO daily_bookkeeping (id, userId, date, session, totalBalance, timestamp, note)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(recordId, b.userId, b.date, b.session, b.totalBalance || 0, timestamp, b.note || "");
        res.json({ id: recordId, ...b, timestamp });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Daily Bookkeeping: Delete
  app.delete("/api/bookkeeping/:id", (req, res) => {
    try {
      const stmt = db.prepare("DELETE FROM daily_bookkeeping WHERE id = ?");
      stmt.run(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Data Management
  app.get("/api/db/export", (req, res) => {
    try {
      const tables = ["users", "accounts", "transactions", "debts", "settings", "daily_bookkeeping"];
      const backup: any = {};
      tables.forEach(table => {
        backup[table] = db.prepare(`SELECT * FROM ${table}`).all();
      });
      res.json(backup);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/db/import", (req, res) => {
    const data = req.body;
    const tables = ["users", "accounts", "transactions", "debts", "settings", "daily_bookkeeping"];
    
    try {
      db.transaction(() => {
        tables.forEach(table => {
          if (data[table]) {
            // Clear existing
            db.prepare(`DELETE FROM ${table}`).run();
            // Insert new
            if (data[table].length > 0) {
              const keys = Object.keys(data[table][0]);
              const placeholders = keys.map(() => "?").join(", ");
              const stmt = db.prepare(`INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`);
              data[table].forEach((row: any) => {
                const values = keys.map(k => row[k]);
                stmt.run(...values);
              });
            }
          }
        });
      })();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/db/status", (req, res) => {
    try {
      const tables = ["users", "accounts", "transactions", "debts", "settings", "daily_bookkeeping"];
      const stats = tables.map(table => ({
        table,
        count: db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count
      }));
      const dbSize = fs.statSync(DB_PATH).size;
      res.json({ stats, dbSize, path: DB_PATH });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/db/backup/telegram", async (req, res) => {
    const { token, chatId, userId } = req.body;
    if (!token || !chatId || !userId) return res.status(400).json({ error: "Token, Chat ID, and userId diperlukan" });

    try {
      // Export only user specific data
      const tables = ["accounts", "transactions", "debts", "settings", "daily_bookkeeping"];
      const backup: any = {};
      
      backup.profile = db.prepare("SELECT id, email, displayName FROM users WHERE id = ?").get(userId);
      
      tables.forEach(table => {
        backup[table] = db.prepare(`SELECT * FROM ${table} WHERE userId = ?`).all(userId);
      });
      
      const content = Buffer.from(JSON.stringify(backup, null, 2));
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `manual-backup-${userId}-${timestamp}.json`;

      const result = await sendToTelegram(
        token, 
        chatId, 
        `🚀 BACKUP MANUAL KASIR PINTAR\n👤 User: ${backup.profile?.displayName || userId}\n📅 Waktu: ${new Date().toLocaleString('id-ID')}\n📂 File: ${filename}`,
        filename,
        content
      );

      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
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
