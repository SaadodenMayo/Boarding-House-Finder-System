import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from './db.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '12mb' }));
const SECRET = process.env.JWT_SECRET || 'dev-only-change-this-secret';
const PORT = Number(process.env.PORT || 4000);

function auth(req,res,next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i,'');
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { res.status(401).json({ error:'Please sign in again.' }); }
}
const roles = (...allowed) => (req,res,next) => allowed.includes(req.user.role) ? next() : res.status(403).json({error:'Not allowed.'});