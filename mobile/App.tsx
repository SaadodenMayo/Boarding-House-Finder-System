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