import { Capacitor } from "@capacitor/core";
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from "@capacitor-community/sqlite";

import { CREATE_TABLE_STATEMENTS, DATABASE_NAME, DATABASE_VERSION } from "./schema.js";

let connection: SQLiteConnection | null = null;
let database: SQLiteDBConnection | null = null;

export async function openMobileDatabase(): Promise<SQLiteDBConnection> {
  if (database) {
    return database;
  }

  connection = connection ?? new SQLiteConnection(CapacitorSQLite);
  const platform = Capacitor.getPlatform();
  if (platform === "web") {
    await connection.initWebStore();
  }

  database = await connection.createConnection(
    DATABASE_NAME,
    false,
    "no-encryption",
    DATABASE_VERSION,
    false,
  );
  await database.open();
  await initializeSchema(database);
  return database;
}

export async function initializeSchema(db: Pick<SQLiteDBConnection, "execute">): Promise<void> {
  for (const statement of CREATE_TABLE_STATEMENTS) {
    await db.execute(statement);
  }
}

export async function closeMobileDatabase(): Promise<void> {
  if (!connection || !database) {
    return;
  }

  await connection.closeConnection(DATABASE_NAME, false);
  database = null;
}
