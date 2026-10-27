import { runRawSql, getRawValue } from '../sqlite-client';

export function runMigrations() {
  runRawSql(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      openid TEXT NOT NULL,
      nickname TEXT,
      avatar_url TEXT,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'customer',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    )
  `);

  runRawSql(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      file_key TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      page_count INTEGER NOT NULL DEFAULT 1,
      file_path TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 补全旧表缺失的 file_path 列（幂等）
  try {
    runRawSql(`ALTER TABLE documents ADD COLUMN file_path TEXT`);
  } catch (_) {
    // 列已存在，忽略
  }

  runRawSql(`
    CREATE TABLE IF NOT EXISTS addresses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      province TEXT NOT NULL,
      city TEXT NOT NULL,
      district TEXT NOT NULL,
      detail TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    )
  `);

  runRawSql(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_no TEXT NOT NULL,
      user_id TEXT NOT NULL,
      merchant_id TEXT,
      address_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      total_price REAL NOT NULL,
      shipping_fee REAL DEFAULT 0,
      order_type TEXT DEFAULT 'normal',
      print_settings TEXT NOT NULL,
      logistics_company TEXT,
      logistics_no TEXT,
      remark TEXT,
      paid_at TEXT,
      printed_at TEXT,
      shipped_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    )
  `);

  runRawSql(`
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_url TEXT,
      copies INTEGER NOT NULL DEFAULT 1,
      color_mode TEXT NOT NULL DEFAULT 'bw',
      sides TEXT NOT NULL DEFAULT 'single',
      paper_size TEXT NOT NULL DEFAULT 'a4',
      binding TEXT DEFAULT 'none',
      has_cover INTEGER NOT NULL DEFAULT 0,
      cover_laminated INTEGER NOT NULL DEFAULT 0,
      page_count INTEGER NOT NULL DEFAULT 1,
      price REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  runRawSql(`
    CREATE TABLE IF NOT EXISTS price_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      option_name TEXT NOT NULL,
      price REAL NOT NULL,
      unit TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  runRawSql(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      invite_code TEXT NOT NULL,
      commission_rate REAL NOT NULL DEFAULT 0.05,
      status TEXT NOT NULL DEFAULT 'pending',
      total_commission REAL NOT NULL DEFAULT 0,
      balance REAL NOT NULL DEFAULT 0,
      real_name TEXT,
      phone TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    )
  `);

  runRawSql(`
    CREATE TABLE IF NOT EXISTS agent_commissions (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // agent_withdrawals: manual settlement workflow — no auto payout
  runRawSql(`
    CREATE TABLE IF NOT EXISTS agent_withdrawals (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      alipay_account TEXT,
      real_name TEXT,
      reject_reason TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    )
  `);

  // Incremental migrations — safe to run on existing DBs
  const alterWithdrawal = (col: string, def: string) => {
    try { runRawSql(`ALTER TABLE agent_withdrawals ADD COLUMN ${col} ${def}`); } catch (_) {}
  };
  alterWithdrawal('alipay_account', 'TEXT');
  alterWithdrawal('real_name', 'TEXT');
  alterWithdrawal('reject_reason', 'TEXT');
  alterWithdrawal('reviewed_at', 'TEXT');

  // Unique index: one commission record per (order, agent) — idempotency guard
  try {
    runRawSql(`CREATE UNIQUE INDEX IF NOT EXISTS uidx_agent_commissions_order_agent ON agent_commissions(order_id, agent_id)`);
  } catch (_) {}

  runRawSql(`
    CREATE TABLE IF NOT EXISTS user_referrals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      invited_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Unique index: one referral per user (idempotency guard for bindReferral)
  try {
    runRawSql(`CREATE UNIQUE INDEX IF NOT EXISTS uidx_user_referrals_user ON user_referrals(user_id)`);
  } catch (_) {}

  runRawSql(`
    CREATE TABLE IF NOT EXISTS user_points (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      total_points INTEGER NOT NULL DEFAULT 0,
      used_points INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    )
  `);

  runRawSql(`
    CREATE TABLE IF NOT EXISTS gifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      required_points INTEGER NOT NULL,
      stock INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      image_url TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  runRawSql(`
    CREATE TABLE IF NOT EXISTS exchange_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      gift_id INTEGER NOT NULL,
      points_used INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  runRawSql(`
    CREATE TABLE IF NOT EXISTS draft_orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      documents TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    )
  `);

  const priceCount = getRawValue('SELECT COUNT(*) as count FROM price_items') as { count: number };
  if (priceCount.count === 0) {
    const prices = [
      ['黑白打印', 0.10, '页'],
      ['彩色打印', 0.50, '页'],
      ['单面打印', 0.00, '页'],
      ['双面打印', 0.05, '页'],
      ['A4纸张', 0.00, '张'],
      ['A3纸张', 0.10, '张'],
      ['平钉装订', 1.00, '份'],
      ['骑马钉装订', 2.00, '份'],
      ['胶装装订', 5.00, '份'],
      ['普通封面', 1.00, '份'],
      ['铜版纸覆膜封面', 3.00, '份'],
      ['皮纹纸封面', 2.00, '份'],
      ['配送费', 5.00, '单'],
      ['免费配送门槛', 10.00, '元'],
    ];
    prices.forEach(([name, price, unit]) => {
      runRawSql('INSERT INTO price_items (option_name, price, unit) VALUES (?, ?, ?)', [name, price, unit]);
    });
  }

  const giftCount = getRawValue('SELECT COUNT(*) as count FROM gifts') as { count: number };
  if (giftCount.count === 0) {
    runRawSql('INSERT INTO gifts (name, description, required_points, stock, is_active) VALUES (?, ?, ?, ?, ?)', ['打印优惠券', '满10元减2元', 100, 100, 1]);
    runRawSql('INSERT INTO gifts (name, description, required_points, stock, is_active) VALUES (?, ?, ?, ?, ?)', ['免费打印券', '免费打印5页', 200, 50, 1]);
    runRawSql('INSERT INTO gifts (name, description, required_points, stock, is_active) VALUES (?, ?, ?, ?, ?)', ['会员体验卡', '7天会员体验', 500, 20, 1]);
  }

  console.log('✅ 数据库迁移完成');
}
