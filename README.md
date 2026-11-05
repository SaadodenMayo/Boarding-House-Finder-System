# Dorm, Boarding House & Apartment Finder System

A TypeScript React Native + Expo SDK 54 mobile app with an Express + SQLite API.

## Included
- Admin default account; no public admin registration
- Owner and student registration/login
- Owner property submissions with photos, address, coordinates, room count, price and contact details
- Admin approval/rejection workflow
- Student property browsing, filters, favorites, map pins and property details
- Booking requests and owner booking decisions
- Transaction-safe room availability updates
- Reviews and rating averages
- In-app notifications and a seven-day rating reminder check
- Aged Bronze & Ballet White theme

## Requirements
- Node.js 20+ (Node 22 recommended)
- npm
- Expo Go compatible phone
- Phone and computer on the same Wi-Fi for local API testing

## 1. Start the API
```bash
cd api
npm install
cp .env.example .env
npm run dev
```
The API starts on port 4000. On first start it creates `data.sqlite` and seeds the admin account:
- Email: `admin@dormfinder.local`
- Password: `Admin123!`

Change the admin password and JWT secret before any real deployment.

## 2. Configure the mobile app
Edit `mobile/src/config.ts` and set `API_BASE_URL` to your computer's LAN IPv4 address, for example:
```ts
export const API_BASE_URL = 'http://192.168.1.10:4000/api';
```
Do not use `localhost` on your phone. Find your PC address with `ipconfig` on Windows.

## 3. Start Expo
```bash
cd mobile
npm install
npx expo start
```
Scan the QR code using Expo Go. This project targets Expo SDK 54. Install the matching Expo Go build if your device currently has a newer incompatible SDK.

## Notes
- Map view uses `react-native-maps`; Expo Go supports the standard map view. Android/iOS map tiles and location permissions depend on device settings.
- Image picker uploads images as base64 to the API. Keep images reasonably sized.
- The seven-day review reminder is checked when the app loads and when a tenant opens their bookings. For dependable background delivery while the app is closed, add a production push-notification provider and scheduled server worker.
- This is a functional academic MVP foundation, not a production-hardened marketplace. Before public launch add HTTPS, rate limiting, email/phone verification, stronger moderation, backups, privacy policy and secure image storage.
