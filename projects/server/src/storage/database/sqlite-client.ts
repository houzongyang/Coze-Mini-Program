import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './shared/sqlite-schema';
import Database = require('better-sqlite3');

const sqlite = new Database('./data/example_db.sqlite');

export const db = drizzle(sqlite, { schema });

function runRawSql(sql: string, params?: any[]) {
  if (params) {
    sqlite.prepare(sql).run(...params);
  } else {
    sqlite.exec(sql);
  }
}

function getRawValue(sql: string, params?: any[]) {
  const stmt = sqlite.prepare(sql);
  return params ? stmt.get(...params) : stmt.get();
}

export { runRawSql, getRawValue };
