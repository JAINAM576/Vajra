# Architecture

> Keep this file updated as the backend evolves. It's the fastest way for anyone
> (human or AI) to understand the system without re-reading every file.
> Last updated: 2026-07-06

---

## 1. Overview

- **What this backend does:** Acts as the central telemetry and command gateway for the Vajra Lock App ecosystem. It manages shopkeeper accounts, processes device telemetries, coordinates activation keys, handles customer loan profiles, dispatches lock/unlock and system commands via FCM and offline SMS gateway, and tracks support tickets.
- **Clients it serves:** 
  1. **Shopkeeper App:** React Native + Expo app used by retailers to register, purchase credits, generate keys, track customer devices, and dispatch lock/unlock triggers.
  2. **Super Admin App:** React Native + Expo dashboard used by platform administrators to monitor tickets, manage retailers, adjust configurations, and top up credits.
  3. **Android Locking Client:** Native Kotlin application (`LockApp3`) executing remote lockdowns and reporting GPS, battery, and connection status.
- **Framework:** Express.js (v4.21.0)
- **Language/runtime:** Node.js, JavaScript (ES6+)
- **Module system:** CommonJS module format (`require` / `module.exports`)

---

## 2. Entry Point & Structure

```text
lockapp-server/
├── config/             # DB connection configuration
│   └── db.js           # Mongoose MongoDB Atlas connection bootstrap
├── docs/               # System API and design documentation
│   ├── API_CONTRACTS.md
│   └── ARCHITECTURE.md
├── middleware/         # Express middlewares
│   └── auth.js         # JWT validation & role-based checks (Admin/Shopkeeper)
├── models/             # Mongoose schemas and models
│   ├── ActivationKey.js
│   ├── Admin.js
│   ├── Announcement.js
│   ├── CommandLog.js
│   ├── CreditTransaction.js
│   ├── Device.js
│   ├── Shopkeeper.js
│   ├── SystemConfig.js
│   └── Ticket.js
├── routes/             # Express routes / endpoints
│   ├── announcements.js
│   ├── auth.js
│   ├── commands.js
│   ├── config.js
│   ├── credits.js
│   ├── deviceCompat.js # Compatibility endpoints for Android client app
│   ├── devices.js      # Core device management endpoints
│   ├── keys.js
│   ├── profile.js
│   ├── shopkeepers.js
│   └── tickets.js
├── scripts/            # Database seed, migration, and testing utilities
├── services/           # External integration services
│   └── fcm.js          # Firebase Cloud Messaging Admin SDK client dispatcher
├── utils/              # Helper utilities
│   ├── alertImage.js   # Dynamic SVG generation for customized alert display
│   ├── email.js        # Nodemailer SMTP code sender for password recovery
│   ├── helpers.js      # Key/ticket/device ID generation scripts
│   └── wallpaper.js    # Canvas/SVG lockscreen wallpaper generator
├── server.js           # Application main entry point / server bootstrap
└── package.json        # Dependencies and dev scripts
```

- **Where routes are registered:** [server.js](file:///home/jainam/Documents/Vajra_MobileApps/lockapp-server/server.js#L22-L32) (lines 22-32)
- **Where middleware is registered:** [server.js](file:///home/jainam/Documents/Vajra_MobileApps/lockapp-server/server.js#L16-L19) (lines 16-19)
- **Where the app is started/listens:** [server.js](file:///home/jainam/Documents/Vajra_MobileApps/lockapp-server/server.js#L72-L86) (lines 72-86)

---

## 3. Layers

| Layer | Present? | Where it lives | Notes |
|---|---|---|---|
| **Route/Controller** | Yes | `routes/` | Express route definitions and handler callbacks are heavily coupled (business logic, request validation, database query, and response dispatch are handled inline inside route handlers). |
| **Service (business logic)** | Yes | `services/`, `utils/` | External helper orchestrations such as Firebase Admin FCM commands (`services/fcm.js`), Nodemailer password resets (`utils/email.js`), and image canvas generation (`utils/wallpaper.js`). |
| **Repository (data access)** | No | N/A | No abstract repository pattern. Database interactions are called directly on Mongoose model abstractions (e.g. `Shopkeeper.findOne()`, `Device.create()`) from route handlers. |

---

## 4. Data Layer

- **Database:** MongoDB (hosted via MongoDB Atlas cloud platform).
- **ORM/query builder:** Mongoose (v8.5.0).
- **Where schema/models live:** [models/](file:///home/jainam/Documents/Vajra_MobileApps/lockapp-server/models/) directory.
- **Migrations:** Script-based manual migrations (e.g. `scripts/migrate_wallpapers.js`). There is no automated database schema migration manager.

---

## 5. Authentication

- **Mechanism:** JSON Web Token (JWT) signatures.
- **Where tokens are issued:** [routes/auth.js](file:///home/jainam/Documents/Vajra_MobileApps/lockapp-server/routes/auth.js#L21-L25) (using token-signing utility `signToken` during login/registration).
- **Where auth is enforced:** [middleware/auth.js](file:///home/jainam/Documents/Vajra_MobileApps/lockapp-server/middleware/auth.js#L12) (via `authenticate` middleware, which parses incoming `Bearer` token from `Authorization` header, decodes user payload, matches DB records, and defines `req.user`).
- **Token storage expected on client:** Encrypted at rest using `expo-secure-store` in the React Native Expo apps.
- **Token lifetime / refresh flow:** Configurable via `.env` (`JWT_EXPIRES_IN`, default is `7d`). No separate OAuth refresh tokens exist; clients re-prompt credentials on expiration.

---

## 6. Error Handling

- **Centralized error middleware?** Yes. Express global error handler middleware is registered at [server.js:L62-69](file:///home/jainam/Documents/Vajra_MobileApps/lockapp-server/server.js#L62-L69). It logs stack traces to console and returns a 500 error envelope.
- **Standard error response shape:**
  ```json
  {
    "success": false,
    "message": "User-friendly error reason details.",
    "error": "Raw stack error detail (only sent when NODE_ENV is development)"
  }
  ```

---

## 7. Configuration & Secrets

- **Config loading method:** `dotenv` package imports environment secrets from `.env` directly into `process.env` on startup.
- **Where env vars are validated/typed (if at all):** No runtime verification/typing library (like Zod or Joi) is used for configuration fields.
- **Never in the repo:**
  - `MONGODB_URI` / `DATABASE_URL` (MongoDB Atlas connectivity string)
  - `JWT_SECRET` (HMAC token signing key)
  - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (Cloudinary credentials)
  - `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` (SMTP login credentials)
  - Firebase SDK configuration credentials (private key files)

---

## 8. Conventions

- **Naming conventions:** Standard JavaScript camelCase for field names, schemas, database properties, and JSON request/response packages. Pluralized resource naming for paths (e.g. `/api/devices`, `/api/shopkeepers`).
- **Response envelope:** Restful standard `{ success: Boolean, message: String, data: Object }` format wrapper.
- **API versioning scheme (if any):** No API versioning prefix (such as `/v1`) is used.

---

## 9. Known Rough Edges

- **Telemetry Endpoint Duplicity:** Android client telemetry maps to two redundant pathways: `PUT /api/devices/:deviceId/heartbeat` and `POST /api/device/heartbeat`. The latter returns the `isLocked` flag to help keep client overlays synced.
- **Router Fatness:** Endpoint files contain extensive code bloat because Express routes directly host data query, parameter validation, error catch, and external service routines.
- **SMS Security PIN:** Offline manual unlock commands utilize a static, defaults-bound `smsSecretPin` string on the Shopkeeper model to compute MD5 payloads.
