import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dataDir, "db.json");

let db = null;
let writeChain = Promise.resolve();
let mutateChain = Promise.resolve();

function defaultDb() {
  return {
    users: [],
    halls: [],
    movies: [],
    showtimes: [],
    bookings: [],
    tickets: [],
    reviews: [],
    audit: [],
    settings: {
      reservationHoldMinutes: 15,
      maxTicketsPerBooking: 6,
      allowCustomerCancel: false,
    },
  };
}

export function loadDb() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dbPath)) {
    db = defaultDb();
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  } else {
    db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    db.settings = { ...defaultDb().settings, ...(db.settings || {}) };
  }
  return db;
}

export function getDb() {
  if (!db) loadDb();
  return db;
}

export function saveDb() {
  writeChain = writeChain.then(() => {
    const tmp = `${dbPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, dbPath);
  });
  return writeChain;
}

export async function mutate(fn) {
  const run = mutateChain.then(async () => {
    const current = getDb();
    const result = await fn(current);
    await saveDb();
    return result;
  });
  mutateChain = run.catch(() => {});
  return run;
}
