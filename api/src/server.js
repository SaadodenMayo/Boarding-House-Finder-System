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
app.patch('/api/me',auth,(req,res)=>{
 const {name,phone}=req.body||{};
 if(!name?.trim()) return res.status(400).json({error:'Name is required.'});
 db.prepare('UPDATE users SET name=?,phone=? WHERE id=?').run(name.trim(),phone||'',req.user.id);
 res.json({user:db.prepare('SELECT id,name,email,phone,role FROM users WHERE id=?').get(req.user.id)});
});
app.post('/api/properties',auth,roles('owner'),(req,res)=>{
 const b=req.body||{};
 if(!b.title||!b.type||!b.description||!b.address||!Number.isFinite(Number(b.latitude))||!Number.isFinite(Number(b.longitude))||!b.contact_phone||Number(b.monthly_price)<=0||Number(b.total_rooms)<1)
  return res.status(400).json({error:'Complete all required property details and location.'});
 const total=Math.floor(Number(b.total_rooms));
 const info=db.prepare(`INSERT INTO properties(owner_id,title,type,description,address,latitude,longitude,contact_phone,monthly_price,total_rooms,available_rooms,image_data,status)
 VALUES(?,?,?,?,?,?,?,?,?,?,?,?, 'pending')`).run(req.user.id,b.title,b.type,b.description,b.address,Number(b.latitude),Number(b.longitude),b.contact_phone,Number(b.monthly_price),total,total,b.image_data||null);
 notify(1,'New property submission',`A property named "${b.title}" is waiting for approval.`);
 res.status(201).json({property:db.prepare(propertySelect+' WHERE p.id=?').get(info.lastInsertRowid)});
});
app.get('/api/properties',(req,res)=>{
 const {q,type,minPrice,maxPrice}=req.query;
 let sql=propertySelect+" WHERE p.status='approved'";
 const args=[];
 if(q){sql+=' AND (p.title LIKE ? OR p.address LIKE ? OR p.description LIKE ?)';args.push(`%${q}%`,`%${q}%`,`%${q}%`);}
 if(type){sql+=' AND p.type=?';args.push(type);}
 if(minPrice){sql+=' AND p.monthly_price>=?';args.push(Number(minPrice));}
 if(maxPrice){sql+=' AND p.monthly_price<=?';args.push(Number(maxPrice));}
 sql+=' ORDER BY p.created_at DESC';
 res.json({properties:db.prepare(sql).all(...args).map(publicProperty)});
});
app.get('/api/properties/mine',auth,roles('owner'),(req,res)=>{
 res.json({properties:db.prepare(propertySelect+' WHERE p.owner_id=? ORDER BY p.created_at DESC').all(req.user.id)});
});
app.get('/api/properties/pending',auth,roles('admin'),(req,res)=>{
 res.json({properties:db.prepare(propertySelect+" WHERE p.status='pending' ORDER BY p.created_at").all()});
});
app.get('/api/properties/:id',(req,res)=>{
 const p=db.prepare(propertySelect+' WHERE p.id=?').get(Number(req.params.id));
 if(!p || (p.status!=='approved' && (!req.user || req.user.role!=='admin'))) return res.status(404).json({error:'Property not found.'});
 res.json({property:p,reviews:db.prepare(`SELECT r.*,u.name student_name FROM reviews r JOIN users u ON u.id=r.student_id WHERE r.property_id=? ORDER BY r.created_at DESC`).all(p.id)});
});
app.patch('/api/properties/:id/decision',auth,roles('admin'),(req,res)=>{
 const {decision,reason}=req.body||{};
 if(!['approved','rejected'].includes(decision)) return res.status(400).json({error:'Invalid decision.'});
 const p=db.prepare('SELECT * FROM properties WHERE id=?').get(Number(req.params.id));
 if(!p) return res.status(404).json({error:'Property not found.'});
 db.prepare('UPDATE properties SET status=?,rejection_reason=? WHERE id=?').run(decision,decision==='rejected'?(reason||'Please review your submission and resubmit.'):null,p.id);
 notify(p.owner_id,decision==='approved'?'Property approved':'Property needs changes',decision==='approved'?`${p.title} is now visible to students.`:`${p.title}: ${reason||'Please review your submission.'}`);
 res.json({ok:true});
});
app.patch('/api/properties/:id/rooms',auth,roles('owner'),(req,res)=>{
 const p=db.prepare('SELECT * FROM properties WHERE id=? AND owner_id=?').get(Number(req.params.id),req.user.id);
 const count=Number(req.body.available_rooms);
 if(!p) return res.status(404).json({error:'Property not found.'});
 if(!Number.isInteger(count)||count<0||count>p.total_rooms) return res.status(400).json({error:'Available rooms must be between zero and total rooms.'});
 db.prepare('UPDATE properties SET available_rooms=? WHERE id=?').run(count,p.id);
 res.json({ok:true,available_rooms:count});
});
app.post('/api/properties/:id/favorite',auth,roles('student'),(req,res)=>{
 const id=Number(req.params.id);
 const exists=db.prepare('SELECT 1 FROM favorites WHERE student_id=? AND property_id=?').get(req.user.id,id);
 if(exists) db.prepare('DELETE FROM favorites WHERE student_id=? AND property_id=?').run(req.user.id,id);
 else db.prepare('INSERT OR IGNORE INTO favorites(student_id,property_id) VALUES(?,?)').run(req.user.id,id);
 res.json({favorite:!exists});
});
app.get('/api/favorites',auth,roles('student'),(req,res)=>{
 res.json({properties:db.prepare(propertySelect+' JOIN favorites f ON f.property_id=p.id WHERE f.student_id=?').all(req.user.id)});
});
app.post('/api/bookings',auth,roles('student'),(req,res)=>{
 const {property_id,rooms=1,move_in_date,message}=req.body||{};
 const p=db.prepare("SELECT * FROM properties WHERE id=? AND status='approved'").get(Number(property_id));
 const n=Number(rooms);
 if(!p||!Number.isInteger(n)||n<1||!move_in_date) return res.status(400).json({error:'Choose a valid property, room quantity and move-in date.'});
 if(p.available_rooms<n) return res.status(409).json({error:'Not enough rooms are currently available.'});
 const info=db.prepare('INSERT INTO bookings(property_id,student_id,rooms,move_in_date,message) VALUES(?,?,?,?,?)').run(p.id,req.user.id,n,move_in_date,message||'');
 notify(p.owner_id,'New booking request',`A student requested ${n} room(s) at ${p.title}.`);
 res.status(201).json({booking:db.prepare('SELECT * FROM bookings WHERE id=?').get(info.lastInsertRowid)});
});
app.get('/api/bookings/mine',auth,(req,res)=>{
 const sql=req.user.role==='owner'
  ? `SELECT b.*,p.title property_title,p.address,p.monthly_price,u.name student_name FROM bookings b JOIN properties p ON p.id=b.property_id JOIN users u ON u.id=b.student_id WHERE p.owner_id=? ORDER BY b.created_at DESC`
  : `SELECT b.*,p.title property_title,p.address,p.monthly_price,u.name owner_name FROM bookings b JOIN properties p ON p.id=b.property_id JOIN users u ON u.id=p.owner_id WHERE b.student_id=? ORDER BY b.created_at DESC`;
 res.json({bookings:db.prepare(sql).all(req.user.id)});
});
app.patch('/api/bookings/:id/decision',auth,roles('owner'),(req,res)=>{
 const {decision}=req.body||{};
 if(!['confirmed','rejected'].includes(decision)) return res.status(400).json({error:'Invalid decision.'});
 const booking=db.prepare(`SELECT b.*,p.owner_id,p.title,p.available_rooms FROM bookings b JOIN properties p ON p.id=b.property_id WHERE b.id=?`).get(Number(req.params.id));
 if(!booking||booking.owner_id!==req.user.id) return res.status(404).json({error:'Booking not found.'});
 if(booking.status!=='pending') return res.status(409).json({error:'This booking has already been processed.'});
 if(decision==='confirmed' && booking.available_rooms<booking.rooms) return res.status(409).json({error:'There are not enough available rooms.'});
 const tx=db.transaction(()=>{
  db.prepare('UPDATE bookings SET status=?,confirmed_at=? WHERE id=?').run(decision,decision==='confirmed'?new Date().toISOString():null,booking.id);
  if(decision==='confirmed') db.prepare('UPDATE properties SET available_rooms=available_rooms-? WHERE id=?').run(booking.rooms,booking.property_id);
  notify(booking.student_id,decision==='confirmed'?'Booking confirmed':'Booking request declined',`${booking.title}: your booking is ${decision}.`);
 });
 tx(); res.json({ok:true});
});
app.patch('/api/bookings/:id/cancel',auth,roles('student'),(req,res)=>{
 const b=db.prepare('SELECT * FROM bookings WHERE id=? AND student_id=?').get(Number(req.params.id),req.user.id);
 if(!b||!['pending','confirmed'].includes(b.status)) return res.status(404).json({error:'Booking cannot be cancelled.'});
 const tx=db.transaction(()=>{
  db.prepare("UPDATE bookings SET status='cancelled' WHERE id=?").run(b.id);
  if(b.status==='confirmed') db.prepare('UPDATE properties SET available_rooms=MIN(total_rooms,available_rooms+?) WHERE id=?').run(b.rooms,b.property_id);
 });
 tx(); res.json({ok:true});
});
app.post('/api/reviews',auth,roles('student'),(req,res)=>{
 const {booking_id,rating,comment}=req.body||{};
 const b=db.prepare("SELECT * FROM bookings WHERE id=? AND student_id=? AND status='confirmed'").get(Number(booking_id),req.user.id);
 if(!b) return res.status(400).json({error:'Only confirmed rentals can be reviewed.'});
 const age=Date.now()-new Date(b.confirmed_at).getTime();
 if(age<7*24*60*60*1000) return res.status(400).json({error:'Ratings become available seven days after confirmation.'});
 try {
  db.prepare('INSERT INTO reviews(property_id,booking_id,student_id,rating,comment) VALUES(?,?,?,?,?)').run(b.property_id,b.id,req.user.id,Number(rating),comment||'');
  const owner=db.prepare('SELECT owner_id,title FROM properties WHERE id=?').get(b.property_id);
  notify(owner.owner_id,'New property rating',`A tenant rated ${owner.title}.`);
  res.status(201).json({ok:true});
 } catch { res.status(409).json({error:'This booking has already been rated.'}); }
});
app.get('/api/notifications',auth,(req,res)=>{
 res.json({notifications:db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(req.user.id)});
});
app.patch('/api/notifications/:id/read',auth,(req,res)=>{
 db.prepare('UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').run(Number(req.params.id),req.user.id);
 res.json({ok:true});
});