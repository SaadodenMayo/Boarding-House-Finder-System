import React,{useEffect,useState} from 'react';
import {Alert, ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import MapView,{Marker} from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import {StatusBar} from 'expo-status-bar';
import {api,setToken} from './src/api';
import {C} from './src/theme';
import type {User,Property,Booking,Notice,Role} from './src/types';

Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowAlert:true,shouldPlaySound:true,shouldSetBadge:false,shouldShowBanner:true,shouldShowList:true})});
const money=(n:number)=>`₱${Number(n||0).toLocaleString('en-PH')}/mo`;
const Btn=({title,onPress,kind='primary',disabled=false}:{title:string,onPress:()=>void,kind?:'primary'|'outline'|'danger',disabled?:boolean})=><Pressable disabled={disabled} onPress={onPress} style={[s.btn,kind==='outline'&&s.outline,kind==='danger'&&s.danger,disabled&&{opacity:.45}]}><Text style={[s.btnText,kind==='outline'&&{color:C.bronze}]}>{title}</Text></Pressable>;
const Field=({label,value,onChangeText,placeholder,keyboardType,multiline=false,secureTextEntry=false}:{label:string,value:string,onChangeText:(v:string)=>void,placeholder?:string,keyboardType?:any,multiline?:boolean,secureTextEntry?:boolean})=><View style={s.field}><Text style={s.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder||label} placeholderTextColor={C.muted} keyboardType={keyboardType} multiline={multiline} secureTextEntry={secureTextEntry} style={[s.input,multiline&&{height:92,textAlignVertical:'top'}]}/></View>;
const Header=({title,sub}:{title:string,sub?:string})=><View style={{marginBottom:18}}><Text style={s.heading}>{title}</Text>{!!sub&&<Text style={s.sub}>{sub}</Text>}</View>;
const Card=({children}:{children:React.ReactNode})=><View style={s.card}>{children}</View>;

export default function App(){
 const [user,setUser]=useState<User|null>(null),[token,setTok]=useState<string|null>(null),[loading,setLoading]=useState(true);
 const [tab,setTab]=useState('Home'),[authMode,setAuthMode]=useState<'login'|'register'>('login');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[phone,setPhone]=useState(''),[role,setRole]=useState<Role>('student');
 const [properties,setProperties]=useState<Property[]>([]),[mine,setMine]=useState<Property[]>([]),[pending,setPending]=useState<Property[]>([]);
 const [bookings,setBookings]=useState<Booking[]>([]),[notices,setNotices]=useState<Notice[]>([]);
 const [selected,setSelected]=useState<Property|null>(null),[query,setQuery]=useState(''),[filter,setFilter]=useState('All');
 const [photo,setPhoto]=useState<string|null>(null),[form,setForm]=useState<any>({title:'',type:'Boarding House',description:'',address:'',latitude:'10.283',longitude:'125.170',contact_phone:'',monthly_price:'',total_rooms:'1'});
 const [profileName,setProfileName]=useState(''),[profilePhone,setProfilePhone]=useState('');
 const [rooms,setRooms]=useState('1'),[moveDate,setMoveDate]=useState(''),[message,setMessage]=useState('');
 const [rating,setRating]=useState('5'),[reviewText,setReviewText]=useState(''),[reviewBooking,setReviewBooking]=useState<Booking|null>(null);
 const [modal,setModal]=useState<'none'|'add'|'book'|'review'|'profile'>('none');
 useEffect(()=>{(async()=>{try{const raw=await AsyncStorage.getItem('session');if(raw){const v=JSON.parse(raw);setTok(v.token);setToken(v.token);setUser(v.user);}}catch{}finally{setLoading(false);}})();},[]);
 useEffect(()=>{if(user){refresh();if(user.role==='student')checkReminders();}},[user,tab]);

 async function refresh(){
  try{
   if(user?.role==='student'){const [p,b,n]=await Promise.all([api<{properties:Property[]}>('/properties'),api<{bookings:Booking[]}>('/bookings/mine'),api<{notifications:Notice[]}>('/notifications')]);setProperties(p.properties);setBookings(b.bookings);setNotices(n.notifications);}
   if(user?.role==='owner'){const [p,b,n]=await Promise.all([api<{properties:Property[]}>('/properties/mine'),api<{bookings:Booking[]}>('/bookings/mine'),api<{notifications:Notice[]}>('/notifications')]);setMine(p.properties);setBookings(b.bookings);setNotices(n.notifications);}
   if(user?.role==='admin'){const [p,n]=await Promise.all([api<{properties:Property[]}>('/properties/pending'),api<{notifications:Notice[]}>('/notifications')]);setPending(p.properties);setNotices(n.notifications);}
  }catch(e:any){Alert.alert('Unable to refresh',e.message);}
 }

 async function checkReminders(){try{await api('/reminders/check',{method:'GET'});}catch{}}
 async function signIn(){
  try{const r=await api<{token:string,user:User}>('/auth/login',{method:'POST',body:JSON.stringify({email,password})});await saveSession(r.token,r.user);}
  catch(e:any){Alert.alert('Sign in failed',e.message);}
 }

 async function signUp(){
  try{const r=await api<{token:string,user:User}>('/auth/register',{method:'POST',body:JSON.stringify({name,email,password,phone,role})});await saveSession(r.token,r.user);}
  catch(e:any){Alert.alert('Registration failed',e.message);}
 }
 async function saveSession(t:string,u:User){setTok(t);setToken(t);setUser(u);setTab('Home');await AsyncStorage.setItem('session',JSON.stringify({token:t,user:u}));setProfileName(u.name);setProfilePhone(u.phone||'');}
 async function logout(){await AsyncStorage.removeItem('session');setToken(null);setTok(null);setUser(null);setSelected(null);}
 async function pickPhoto(){
  const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!permission.granted){Alert.alert('Permission needed','Allow photo library access to add property photos.');return;}
  const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:.55,base64:true,allowsEditing:true,aspect:[4,3]});
  if(!result.canceled&&result.assets[0].base64)setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
 }
 async function pinCurrentLocation(){
  try{const perm=await Location.requestForegroundPermissionsAsync();if(!perm.granted)throw new Error('Location permission was not granted.');const loc=await Location.getCurrentPositionAsync({});setForm({...form,latitude:String(loc.coords.latitude),longitude:String(loc.coords.longitude)});}
  catch(e:any){Alert.alert('Location unavailable',e.message);}
 }
 async function submitProperty(){
  try{await api('/properties',{method:'POST',body:JSON.stringify({...form,latitude:Number(form.latitude),longitude:Number(form.longitude),monthly_price:Number(form.monthly_price),total_rooms:Number(form.total_rooms),image_data:photo})});setModal('none');setPhoto(null);Alert.alert('Submitted','Your property is waiting for admin approval.');refresh();}
  catch(e:any){Alert.alert('Submission failed',e.message);}
 }
 async function decideProperty(id:number,decision:'approved'|'rejected'){try{await api(`/properties/${id}/decision`,{method:'PATCH',body:JSON.stringify({decision})});refresh();}catch(e:any){Alert.alert('Error',e.message);}}
 async function updateRooms(p:Property){Alert.prompt?.('Available rooms','Enter the current available room count',async(v)=>{try{await api(`/properties/${p.id}/rooms`,{method:'PATCH',body:JSON.stringify({available_rooms:Number(v)})});refresh();}catch(e:any){Alert.alert('Error',e.message);}},'plain-text',String(p.available_rooms));}
 async function book(){if(!selected)return;try{await api('/bookings',{method:'POST',body:JSON.stringify({property_id:selected.id,rooms:Number(rooms),move_in_date:moveDate,message})});setModal('none');Alert.alert('Request sent','The owner will review your booking request.');refresh();}catch(e:any){Alert.alert('Booking failed',e.message);}}
 async function decideBooking(id:number,decision:'confirmed'|'rejected'){try{await api(`/bookings/${id}/decision`,{method:'PATCH',body:JSON.stringify({decision})});refresh();}catch(e:any){Alert.alert('Error',e.message);}}
 async function cancelBooking(id:number){try{await api(`/bookings/${id}/cancel`,{method:'PATCH'});refresh();}catch(e:any){Alert.alert('Error',e.message);}}
 async function submitReview(){if(!reviewBooking)return;try{await api('/reviews',{method:'POST',body:JSON.stringify({booking_id:reviewBooking.id,rating:Number(rating),comment:reviewText})});setModal('none');setReviewBooking(null);setReviewText('');Alert.alert('Thank you','Your review has been submitted.');refresh();}catch(e:any){Alert.alert('Review unavailable',e.message);}}
 async function favorite(p:Property){try{await api(`/properties/${p.id}/favorite`,{method:'POST'});Alert.alert('Favorites','Your favorites have been updated.');}catch(e:any){Alert.alert('Error',e.message);}}
 async function saveProfile(){try{const r=await api<{user:User}>('/me',{method:'PATCH',body:JSON.stringify({name:profileName,phone:profilePhone})});setUser(r.user);setModal('none');}catch(e:any){Alert.alert('Error',e.message);}}
 const visible=properties.filter(p=>(filter==='All'||p.type===filter)&&(!query||`${p.title} ${p.address}`.toLowerCase().includes(query.toLowerCase())));
 const unread=notices.filter(n=>!n.read_at).length;

 if(loading)return <View style={s.center}><ActivityIndicator color={C.bronze}/><Text style={s.sub}>Preparing Dorm Finder…</Text></View>;
 if(!user)return <KeyboardAvoidingView style={s.auth} behavior={Platform.OS==='ios'?'padding':undefined}><StatusBar style="dark"/><View style={s.brandMark}><Text style={{fontSize:34}}>⌂</Text></View><Text style={s.brand}>HOMESTEAD</Text><Text style={s.tagline}>Find a place to feel at home.</Text><View style={s.authCard}><Header title={authMode==='login'?'Welcome back':'Create your account'} sub={authMode==='login'?'Sign in to continue your search':'Join the rental community'}/>
 {authMode==='register'&&<><Field label="Full name" value={name} onChangeText={setName}/><Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad"/><Text style={s.label}>Register as</Text><View style={s.row}>{(['student','owner'] as Role[]).map(v=><Pressable key={v} onPress={()=>setRole(v)} style={[s.chip,role===v&&s.chipActive]}><Text style={role===v?s.chipTextActive:s.chipText}>{v==='student'?'Student / Tenant':'Property Owner'}</Text></Pressable>)}</View></>}
 <Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address"/><Field label="Password" value={password} onChangeText={setPassword} secureTextEntry/>
 <Btn title={authMode==='login'?'Sign In':'Create Account'} onPress={authMode==='login'?signIn:signUp}/>
 <Pressable onPress={()=>setAuthMode(authMode==='login'?'register':'login')}><Text style={s.switch}>{authMode==='login'?"New here? Create an account":"Already registered? Sign in"}</Text></Pressable>
 {authMode==='login'&&<Text style={s.hint}>Admin demo: admin@dormfinder.local · Admin123!</Text>}
 </View></KeyboardAvoidingView>;
}