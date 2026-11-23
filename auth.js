import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const registerSchema = z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().email().max(255), password: z.string().min(8).max(72) });
const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });
const tokenFor = (user) => jwt.sign({ id: user.id, name: user.name, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(data.password, 12);
    const result = await pool.query('INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,created_at', [data.name, data.email.toLowerCase(), passwordHash]);
    const user = result.rows[0];
    res.status(201).json({ token: tokenFor(user), user });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [data.email.toLowerCase()]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(data.password, user.password_hash))) return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' });
    const safeUser = { id: user.id, name: user.name, email: user.email };
    res.json({ token: tokenFor(safeUser), user: safeUser });
  } catch (err) { next(err); }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id,name,email,created_at FROM users WHERE id=$1', [req.user.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'Account not found.' });
    res.json({ user: result.rows[0] });
  } catch (err) { next(err); }
});
export default router;
