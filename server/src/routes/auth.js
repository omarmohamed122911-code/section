import express from "express";
import { getDb, mutate } from "../store.js";
import { hashPassword, verifyPassword, signToken, authRequired } from "../auth.js";
import { nowIso, audit, publicUser } from "../helpers.js";
import { requireFields, emailString, isValidEmail, bodyString } from "../validate.js";

const router = express.Router();

router.post("/api/auth/register", async (req, res) => {
  try {
    requireFields(["fullName", "email", "password"], req.body);
    const fullName = bodyString(req.body.fullName);
    const email = bodyString(req.body.email);
    const password = String(req.body.password);
    if (!isValidEmail(email)) throw new Error("Invalid email address");
    if (password.length < 6) throw new Error("Password must be at least 6 characters");
    const result = await mutate((db) => {
      if (db.users.some((u) => emailString(u.email) === emailString(email))) {
        throw new Error("Email already registered");
      }
      const user = {
        id: crypto.randomUUID(),
        fullName,
        email,
        passwordHash: hashPassword(password),
        role: "customer",
        createdAt: nowIso(),
      };
      db.users.push(user);
      audit(db, user.id, "auth.register", `Customer registered ${email}`);
      return user;
    });
    res.status(201).json({ token: signToken(result), user: publicUser(result) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/api/auth/login", (req, res) => {
  const email = bodyString(req.body?.email);
  const password = String(req.body?.password || "");
  const user = getDb().users.find((u) => emailString(u.email) === emailString(email));
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get("/api/me", authRequired, (req, res) => {
  const user = getDb().users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(publicUser(user));
});

export default router;
