import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadDb, getDb, mutate } from "./store.js";
import { buildSeed } from "./seed.js";
import { expireHolds } from "./helpers.js";
import { createApp } from "./app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;

loadDb();
if (getDb().users.length === 0) {
  const seeded = buildSeed();
  Object.assign(getDb(), seeded);
  fs.writeFileSync(
    path.join(__dirname, "..", "data", "db.json"),
    JSON.stringify(getDb(), null, 2)
  );
}

setInterval(() => {
  mutate((db) => expireHolds(db)).catch(() => {});
}, 30 * 1000);

createApp().listen(PORT, () => {
  console.log(`Cinema API running on http://localhost:${PORT}`);
});
