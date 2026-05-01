# API Endpoints Reference

> **Legend:**
> - 🔒 `JWT Guard` — requires Bearer token
> - 🔑 `InternalAuthGuard` — internal service authentication

---

## 🟣 Auth Service — Port 3001

### `/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/register` | — | Register a new user |
| `POST` | `/auth/login` | — | Login with email/password |
| `GET` | `/auth/google` | — | Initiate Google OAuth |
| `GET` | `/auth/google/callback` | — | Google OAuth callback |
| `POST` | `/auth/refresh` | — | Refresh access token |
| `POST` | `/auth/logout` | 🔒 JWT | Logout current user |
| `PATCH` | `/auth/profile/image` | 🔒 JWT | Upload profile picture (multipart, max 5MB) |
| `POST` | `/auth/verify-email` | — | Verify email via OTP |
| `POST` | `/auth/resend-otp` | — | Resend OTP code |

### `/users`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/users/me` | 🔒 JWT | Get current user profile |
| `PATCH` | `/users/me` | 🔒 JWT | Update current user profile |
| `POST` | `/users/device-token` | 🔒 JWT | Save FCM device token (Android / iOS) |

---

## 🟢 Flight Service — Port 3002

### `/flights`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/flights/:id` | — | Get flight by ID |
| `GET` | `/flights/number/:flightNumber` | — | Get flight by flight number |

### `/bookings`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/bookings/pnr/:pnr?lastName=` | 🔒 JWT | Get booking by PNR + last name |
| `GET` | `/bookings/user/:userId` | — | Get all bookings for a user |
| `GET` | `/bookings/:id` | — | Get booking by ID |
| `PATCH` | `/bookings/:id/claim` | — | Claim a booking (`{ userId }`) |

### `/passengers`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/passengers/:id` | — | Get passenger by ID |
| `GET` | `/passengers/booking/:bookingId` | — | Get all passengers for a booking |

---

## 🟠 Checkin Service — Port 3003

### `/checkin`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/checkin/start` | 🔑 Internal | Start a check-in |
| `GET` | `/checkin/:id` | 🔑 Internal | Get check-in by ID |
| `PATCH` | `/checkin/:id/ocr-validate` | 🔑 Internal | Validate document via OCR |
| `POST` | `/checkin/:id/baggage` | 🔑 Internal | Declare baggage |
| `POST` | `/checkin/:id/complete` | 🔑 Internal | Complete check-in |
| `DELETE` | `/checkin/:id` | 🔑 Internal | Cancel check-in |

### `/seats`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/seats/:flightId` | — | Get seat map for a flight |
| `POST` | `/seats/lock` | — | Lock a seat (`{ flightId, seatCode, checkinId }`) |
| `PATCH` | `/seats/confirm` | — | Confirm a locked seat |
| `DELETE` | `/seats/lock` | — | Unlock a seat |
