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
const notify = (userId,title,body) => db.prepare('INSERT INTO notifications(user_id,title,body) VALUES(?,?,?)').run(userId,title,body);
const publicProperty = (p) => ({...p, image_data: p.image_data || null});

const propertySelect = `
SELECT p.*, u.name owner_name,
 COALESCE((SELECT ROUND(AVG(r.rating),1) FROM reviews r WHERE r.property_id=p.id),0) average_rating,
 (SELECT COUNT(*) FROM reviews r WHERE r.property_id=p.id) review_count
FROM properties p JOIN users u ON u.id=p.owner_id`;

app.get('/api/health',(req,res)=>res.json({ok:true,service:'Dorm Finder API'}));
app.post('/api/auth/register',(req,res)=>{
  const {name,email,password,phone,role}=req.body || {};
  if(!name || !email || !password || !['owner','student'].includes(role))
    return res.status(400).json({error:'Name, email, password and a valid role are required.'});
  if(String(password).length<8) return res.status(400).json({error:'Password must be at least 8 characters.'});
  try {
    const info=db.prepare('INSERT INTO users(name,email,phone,password_hash,role) VALUES(?,?,?,?,?)')
      .run(String(name).trim(),String(email).toLowerCase().trim(),phone||'',bcrypt.hashSync(password,10),role);
    const user=db.prepare('SELECT id,name,email,phone,role FROM users WHERE id=?').get(info.lastInsertRowid);
    const token=jwt.sign({id:user.id,role:user.role},SECRET,{expiresIn:'7d'});
    res.status(201).json({token,user});
  } catch(e) { res.status(409).json({error:'That email address is already registered.'}); }
});
app.post('/api/auth/login',(req,res)=>{
  const {email,password}=req.body||{};
  const user=db.prepare('SELECT * FROM users WHERE email=?').get(String(email||'').toLowerCase().trim());
  if(!user || !bcrypt.compareSync(password||'',user.password_hash)) return res.status(401).json({error:'Incorrect email or password.'});
  const safe={id:user.id,name:user.name,email:user.email,phone:user.phone,role:user.role};
  res.json({token:jwt.sign({id:user.id,role:user.role},SECRET,{expiresIn:'7d'}),user:safe});
});
app.get('/api/me',auth,(req,res)=>{
 const user=db.prepare('SELECT id,name,email,phone,role,created_at FROM users WHERE id=?').get(req.user.id);
 res.json({user});
});