# API Contracts

> The source of truth for what the backend actually sends/receives, and what the
> React Native apps and Android locking client actually expect. Update this whenever an endpoint's shape
> changes — treat a mismatch between this file and reality as a bug.
> Last updated: 2026-07-06

---

## Index of Endpoints

### [Public / Health API](#public--health-api)
- `GET /api/health` — Platform health check

### [Authentication API (`/api/auth`)](#authentication-api-apiauth)
- `POST /api/auth/admin/login` — Admin login
- `POST /api/auth/shopkeeper/register` — Shopkeeper registration
- `POST /api/auth/shopkeeper/login` — Shopkeeper login
- `POST /api/auth/shopkeeper/forgot-password` — Shopkeeper OTP request for password reset
- `POST /api/auth/shopkeeper/reset-password` — Shopkeeper password reset with OTP

### [Shopkeepers Management API (`/api/shopkeepers`) - Admin Only](#shopkeepers-management-api-apishopkeepers---admin-only)
- `GET /api/shopkeepers` — List all shopkeepers (with virtual stats)
- `GET /api/shopkeepers/:id` — Get single shopkeeper details
- `PUT /api/shopkeepers/:id` — Update shopkeeper fields
- `PUT /api/shopkeepers/:id/credits` — Allocate credits to shopkeeper
- `DELETE /api/shopkeepers/:id` — Soft-delete shopkeeper
- `DELETE /api/shopkeepers/:id/permanent` — Permanently delete shopkeeper & related data

### [Shopkeeper Profile API (`/api/profile`) - Shopkeeper Only](#shopkeeper-profile-api-apiprofile---shopkeeper-only)
- `GET /api/profile` — Fetch current shopkeeper profile
- `PUT /api/profile` — Update current shopkeeper profile
- `PUT /api/profile/wallpaper` — Update shopkeeper dashboard wallpaper URL
- `PUT /api/profile/notifications` — Update notification settings
- `PUT /api/profile/password` — Change shopkeeper password

### [Devices Management API (`/api/devices`) - Mixed Auth](#devices-management-api-apidevices---mixed-auth)
- `PUT /api/devices/:deviceId/heartbeat` — Heartbeat telemetry from client (Public)
- `GET /api/devices` — List devices (Role-scoped)
- `GET /api/devices/:deviceId` — Get single device details (Role-scoped)
- `POST /api/devices/activate` — Activate device (Shopkeeper only)
- `PUT /api/devices/:deviceId` — Update customer loan details (Role-scoped)
- `DELETE /api/devices/:deviceId` — Soft-delete device (Role-scoped)
- `DELETE /api/devices/:deviceId/permanent` — Permanently delete device & related logs (Admin only)

### [Device Compatibility API (`/api/device`) - Android Client, Public](#device-compatibility-api-apidevice---android-client-public)
- `POST /api/device/activate` — Register and bind Android lock client
- `POST /api/device/heartbeat` — Telemetry heartbeat from Android lock client
- `POST /api/device/update-token` — Update FCM token from Android lock client
- `POST /api/device/info` — Update hardware details from Android lock client
- `POST /api/device/command-status` — Update command execution log status

### [Activation Keys API (`/api/keys`) - Auth Required](#activation-keys-api-apikeys---auth-required)
- `GET /api/keys` — List activation keys (Role-scoped)
- `POST /api/keys/generate` — Auto-generate unique activation key (Shopkeeper only)
- `POST /api/keys/add` — Create custom activation key for a shopkeeper (Admin only)
- `DELETE /api/keys/:key` — Revoke activation key (Role-scoped)

### [Commands Dispatch API (`/api/commands`) - Auth Required](#commands-dispatch-api-apicommands---auth-required)
- `GET /api/commands/recent` — List recent command dispatch logs (Admin only)
- `POST /api/commands/:deviceId/send` — Dispatch online FCM push command
- `POST /api/commands/:deviceId/offline` — Queue offline SMS-signature command
- `GET /api/commands/:deviceId/logs` — List command logs for a specific device
- `PUT /api/commands/:logId/status` — Update command log status manually

### [Credits Ledger API (`/api/credits`) - Auth Required](#credits-ledger-api-apicredits---auth-required)
- `GET /api/credits/summary/platform` — Platform credit aggregate statistics (Admin only)
- `GET /api/credits/:shopkeeperId` — Get shopkeeper credit transaction history (Role-scoped)
- `POST /api/credits/:shopkeeperId/add` — Allocate credits (Admin only)

### [Tickets Support API (`/api/tickets`) - Auth Required](#tickets-support-api-apitickets---auth-required)
- `GET /api/tickets` — List support tickets (Role-scoped)
- `POST /api/tickets` — Create support ticket
- `GET /api/tickets/:ticketId` — Get single ticket details
- `PUT /api/tickets/:ticketId/resolve` — Resolve support ticket (Admin only)
- `PUT /api/tickets/:ticketId/reject` — Reject support ticket (Admin only)

### [Announcements API (`/api/announcements`) - Auth Required](#announcements-api-apiannouncements---auth-required)
- `GET /api/announcements` — List announcements (Role-scoped)
- `POST /api/announcements` — Create announcement (Admin only)
- `PUT /api/announcements/:id/read` — Mark announcement as read (Shopkeeper only)

### [System Config API (`/api/config`) - Mixed Auth](#system-config-api-apiconfig---mixed-auth)
- `GET /api/config` — Get platform configuration parameters (Public)
- `PUT /api/config` — Update system config properties (Admin only)
- `POST /api/config/wallpapers` — Add wallpaper design template (Admin only)
- `DELETE /api/config/wallpapers/:index` — Delete wallpaper design template (Admin only)
- `PUT /api/config/qr` — Update system UPI payment QR URL (Admin only)
- `POST /api/config/upload` — Upload asset to Cloudinary (Admin only)
- `PUT /api/config/device-owner-qr` — Update device owner app download QR (Admin only)

---

## Endpoint Details

### Public / Health API

#### `GET /api/health`
**Purpose:** Verify if the server is up and check FCM module loading.  
**Auth required:** No  
**Request:** None  
**Response (success):**
```json
{
  "success": true,
  "message": "Vajra Lock App Server is running",
  "timestamp": "2026-07-06T13:40:00.000Z",
  "environment": "production",
  "fcm": {
    "initialized": true,
    "projectId": "lockapp-xxxx"
  }
}
```

---

### Authentication API (`/api/auth`)

#### `POST /api/auth/admin/login`
**Purpose:** Admin credentials login.  
**Auth required:** No  
**Request**
```json
{
  "adminId": "admin_username",
  "password": "securepassword"
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Admin login successful.",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "admin": {
      "_id": "603fde9b8e8f8c2b4c8b4567",
      "adminId": "admin_username",
      "name": "Super Admin",
      "email": "admin@vajra.com",
      "role": "super_admin",
      "isActive": true,
      "lastLoginAt": "2026-07-06T13:40:00.000Z"
    }
  }
}
```
**Response (error cases)**
| Status | Condition | Shape |
|---|---|---|
| 400 | Missing adminId or password | `{ "success": false, "message": "Admin ID and password are required.", "data": {} }` |
| 401 | Invalid credentials or Admin not found | `{ "success": false, "message": "Invalid credentials.", "data": {} }` |
| 403 | Admin account is deactivated | `{ "success": false, "message": "Account is deactivated. Contact super admin.", "data": {} }` |

**Consumed by (RN app):** [AdminAuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/superadmin/src/context/AdminAuthContext.js#L161)

---

#### `POST /api/auth/shopkeeper/register`
**Purpose:** Create a new shopkeeper account.  
**Auth required:** No  
**Request**
```json
{
  "shopkeeperName": "John Doe",
  "shopName": "JD Electronics",
  "location": "Mumbai, MH",
  "mobileNo": "9876543210",
  "password": "secretpassword",
  "aadhaarNo": "123456789012",
  "gmail": "jd@gmail.com"
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Shopkeeper registered successfully.",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "shopkeeper": {
      "_id": "603fde9b8e8f8c2b4c8b4568",
      "shopkeeperName": "John Doe",
      "shopName": "JD Electronics",
      "location": "Mumbai, MH",
      "mobileNo": "9876543210",
      "gmail": "jd@gmail.com",
      "profilePic": "https://ui-avatars.com/api/?name=John+Doe...",
      "wallpaperUrl": "https://res.cloudinary.com/...",
      "credits": 0,
      "isActive": true,
      "isDeleted": false
    }
  }
}
```
**Response (error cases)**
| Status | Condition | Shape |
|---|---|---|
| 400 | Missing fields or invalid password/mobile | `{ "success": false, "message": "shopkeeperName, shopName... are required.", "data": {} }` |
| 400 | Duplicate mobile or Aadhaar | `{ "success": false, "message": "Mobile number is already registered.", "data": {} }` |

**Consumed by (RN app):** [AuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/shopkeeper/src/context/AuthContext.js#L124)  
**Notes / gotchas:** Triggers asynchronous personalized wallpaper generation using Cloudinary.

---

#### `POST /api/auth/shopkeeper/login`
**Purpose:** Shopkeeper credentials login.  
**Auth required:** No  
**Request**
```json
{
  "mobileNo": "9876543210",
  "password": "secretpassword"
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Shopkeeper login successful.",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "shopkeeper": {
      "_id": "603fde9b8e8f8c2b4c8b4568",
      "shopkeeperName": "John Doe",
      "shopName": "JD Electronics",
      "location": "Mumbai, MH",
      "mobileNo": "9876543210",
      "credits": 15,
      "isActive": true
    }
  }
}
```
**Response (error cases)**
| Status | Condition | Shape |
|---|---|---|
| 400 | Missing credentials | `{ "success": false, "message": "Mobile number and password are required.", "data": {} }` |
| 401 | Invalid credentials or not found | `{ "success": false, "message": "Invalid credentials.", "data": {} }` |
| 403 | Shopkeeper account is deactivated | `{ "success": false, "message": "Account is deactivated. Contact admin.", "data": {} }` |

**Consumed by (RN app):** [AuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/shopkeeper/src/context/AuthContext.js#L76)

---

#### `POST /api/auth/shopkeeper/forgot-password`
**Purpose:** Generate a password reset verification code (OTP) and email it to the user.  
**Auth required:** No  
**Request**
```json
{
  "gmail": "jd@gmail.com"
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Verification code sent to your registered email address.",
  "data": {}
}
```
**Response (error cases)**
| Status | Condition | Shape |
|---|---|---|
| 400 | Missing email | `{ "success": false, "message": "Email address is required.", "data": {} }` |
| 404 | Shopkeeper email not registered | `{ "success": false, "message": "No shopkeeper account registered with this email address.", "data": {} }` |
| 429 | Rate limit: Requested within 1 minute of last request | `{ "success": false, "message": "Please wait 1 minute before requesting another OTP.", "data": {} }` |

**Consumed by (RN app):** [AuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/shopkeeper/src/context/AuthContext.js#L157)

---

#### `POST /api/auth/shopkeeper/reset-password`
**Purpose:** Reset password using the received OTP.  
**Auth required:** No  
**Request**
```json
{
  "gmail": "jd@gmail.com",
  "otp": "123456",
  "newPassword": "newsecretpassword"
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Password updated successfully. You can now log in.",
  "data": {}
}
```
**Response (error cases)**
| Status | Condition | Shape |
|---|---|---|
| 400 | Missing input fields | `{ "success": false, "message": "Email, verification code, and new password are required.", "data": {} }` |
| 400 | Invalid or expired OTP | `{ "success": false, "message": "Invalid or expired verification code.", "data": {} }` |

**Consumed by (RN app):** [AuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/shopkeeper/src/context/AuthContext.js#L172)

---

### Shopkeepers Management API (`/api/shopkeepers`) - Admin Only

#### `GET /api/shopkeepers`
**Purpose:** Retrieve a list of registered shopkeepers.  
**Auth required:** Yes (Admin)  
**Query params**
| Param | Type | Required | Notes |
|---|---|---|---|
| `search` | String | No | Search query for shopkeeperName, shopName, or mobileNo |
| `active` | String | No | Filter by active state ("true" or "false") |

**Response (success)**
```json
{
  "success": true,
  "message": "Shopkeepers retrieved successfully.",
  "data": {
    "shopkeepers": [
      {
        "_id": "603fde9b8e8f8c2b4c8b4568",
        "shopkeeperName": "John Doe",
        "shopName": "JD Electronics",
        "credits": 24,
        "deviceCount": 12,
        "keyCount": 5,
        "isActive": true
      }
    ],
    "count": 1
  }
}
```

**Consumed by (RN app):** [AdminAuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/superadmin/src/context/AdminAuthContext.js#L50)

---

#### `GET /api/shopkeepers/:id`
**Purpose:** Fetch detailed profile of a single shopkeeper.  
**Auth required:** Yes (Admin)  
**Response (success)**
```json
{
  "success": true,
  "message": "Shopkeeper retrieved successfully.",
  "data": {
    "shopkeeper": {
      "_id": "603fde9b8e8f8c2b4c8b4568",
      "shopkeeperName": "John Doe",
      "shopName": "JD Electronics",
      "location": "Mumbai, MH",
      "mobileNo": "9876543210",
      "credits": 24,
      "deviceCount": 12,
      "isActive": true
    }
  }
}
```

---

#### `PUT /api/shopkeepers/:id`
**Purpose:** Update shopkeeper registration details.  
**Auth required:** Yes (Admin)  
**Request**
```json
{
  "shopkeeperName": "John A. Doe",
  "shopName": "JD Smart Electronics",
  "location": "Mumbai North, MH",
  "gmail": "jd.new@gmail.com",
  "isActive": true
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Shopkeeper updated successfully.",
  "data": {
    "shopkeeper": {
      "_id": "603fde9b8e8f8c2b4c8b4568",
      "shopkeeperName": "John A. Doe",
      "shopName": "JD Smart Electronics"
    }
  }
}
```

**Consumed by (RN app):** [AdminAuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/superadmin/src/context/AdminAuthContext.js#L269)

---

#### `PUT /api/shopkeepers/:id/credits`
**Purpose:** Allocate purchase credits to shopkeeper account.  
**Auth required:** Yes (Admin)  
**Request**
```json
{
  "amount": 50,
  "paymentMethod": "UPI",
  "paymentReference": "UPI9273948273",
  "notes": "Premium retailer refill"
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "50 credits added successfully.",
  "data": {
    "credits": 74,
    "transaction": {
      "_id": "603fde9b8e8f8c2b4c8b459a",
      "shopkeeperId": "603fde9b8e8f8c2b4c8b4568",
      "type": "purchase",
      "amount": 50,
      "balanceBefore": 24,
      "balanceAfter": 74,
      "paymentMethod": "UPI"
    }
  }
}
```

**Consumed by (RN app):** [AdminAuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/superadmin/src/context/AdminAuthContext.js#L240)

---

#### `DELETE /api/shopkeepers/:id`
**Purpose:** Soft-delete a shopkeeper's account.  
**Auth required:** Yes (Admin)  
**Response (success)**
```json
{
  "success": true,
  "message": "Shopkeeper soft-deleted successfully.",
  "data": {}
}
```

**Consumed by (RN app):** [AdminAuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/superadmin/src/context/AdminAuthContext.js#L285)

---

#### `DELETE /api/shopkeepers/:id/permanent`
**Purpose:** Hard-delete shopkeeper and cascade delete all related database entries (activation keys, devices, command logs, credits history).  
**Auth required:** Yes (Admin)  
**Request**
```json
{
  "confirmDelete": true
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Shopkeeper and all related data permanently deleted.",
  "data": {}
}
```

---

### Shopkeeper Profile API (`/api/profile`) - Shopkeeper Only

#### `GET /api/profile`
**Purpose:** Retrieve the profile details of the authenticated shopkeeper.  
**Auth required:** Yes (Shopkeeper)  
**Response (success)**
```json
{
  "success": true,
  "message": "Profile retrieved successfully.",
  "data": {
    "shopkeeper": {
      "_id": "603fde9b8e8f8c2b4c8b4568",
      "shopkeeperName": "John Doe",
      "shopName": "JD Electronics",
      "mobileNo": "9876543210",
      "credits": 24,
      "profilePic": "https://ui-avatars.com/api/...",
      "wallpaperUrl": "https://res.cloudinary.com/..."
    }
  }
}
```

**Consumed by (RN app):** [AuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/shopkeeper/src/context/AuthContext.js#L31)

---

#### `PUT /api/profile`
**Purpose:** Update authenticated shopkeeper details.  
**Auth required:** Yes (Shopkeeper)  
**Request**
```json
{
  "shopkeeperName": "John A. Doe",
  "shopName": "JD Smart Electronics",
  "location": "Mumbai, MH",
  "gmail": "jd@gmail.com",
  "profilePic": "https://newprofilepic..."
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Profile updated successfully.",
  "data": {
    "shopkeeper": {
      "_id": "603fde9b8e8f8c2b4c8b4568",
      "shopkeeperName": "John A. Doe",
      "shopName": "JD Smart Electronics"
    }
  }
}
```

**Consumed by (RN app):** [AuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/shopkeeper/src/context/AuthContext.js#L220)

---

#### `PUT /api/profile/wallpaper`
**Purpose:** Set custom dashboard wallpaper.  
**Auth required:** Yes (Shopkeeper)  
**Request**
```json
{
  "wallpaperUrl": "https://res.cloudinary.com/..."
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Wallpaper updated successfully.",
  "data": {
    "wallpaperUrl": "https://res.cloudinary.com/..."
  }
}
```

**Consumed by (RN app):** [AuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/shopkeeper/src/context/AuthContext.js#L254)

---

#### `PUT /api/profile/notifications`
**Purpose:** Set notification preferences.  
**Auth required:** Yes (Shopkeeper)  
**Request**
```json
{
  "dashboardReminders": true,
  "pushAlerts": true,
  "whatsappAuto": false,
  "smsAlerts": true
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Notification settings updated successfully.",
  "data": {
    "notificationSettings": {
      "dashboardReminders": true,
      "pushAlerts": true,
      "whatsappAuto": false,
      "smsAlerts": true
    }
  }
}
```

**Consumed by (RN app):** [AuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/shopkeeper/src/context/AuthContext.js#L511)

---

#### `PUT /api/profile/password`
**Purpose:** Update password.  
**Auth required:** Yes (Shopkeeper)  
**Request**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newsecurepassword"
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Password changed successfully.",
  "data": {}
}
```

**Consumed by (RN app):** [AuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/shopkeeper/src/context/AuthContext.js#L239)

---

### Devices Management API (`/api/devices`) - Mixed Auth

#### `PUT /api/devices/:deviceId/heartbeat`
**Purpose:** Receives background health, system telemetry, and GPS updates from Android app.  
**Auth required:** No  
**Request**
```json
{
  "batteryLevel": 85,
  "isCharging": false,
  "isOnline": true,
  "networkType": "WIFI",
  "latitude": 19.0760,
  "longitude": 72.8777,
  "storageAvailable": 127893129,
  "ramAvailable": 28312984,
  "isLocked": false,
  "appVersion": "1.0.4",
  "isDeviceOwner": true
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Heartbeat received.",
  "data": {
    "lastSeen": "2026-07-06T13:40:00.000Z"
  }
}
```

---

#### `GET /api/devices`
**Purpose:** Retrieve lists of registered devices. Shopkeepers only see their own devices. Admins see all devices.  
**Auth required:** Yes (Admin or Shopkeeper)  
**Query params**
| Param | Type | Required | Notes |
|---|---|---|---|
| `search` | String | No | Search by customerName, customerMobile, deviceId, or deviceModel |
| `online` | String | No | Filter by connection state ("true" or "false") |
| `locked` | String | No | Filter by overlay lock state ("true" or "false") |

**Response (success)**
```json
{
  "success": true,
  "message": "Devices retrieved successfully.",
  "data": {
    "devices": [
      {
        "_id": "603fde9b8e8f8c2b4c8b45a2",
        "deviceId": "VJR-ABC-123",
        "customerName": "Steve Rogers",
        "customerMobile": "9998887776",
        "isLocked": false,
        "isOnline": true,
        "lastSeen": "2026-07-06T13:38:00.000Z"
      }
    ],
    "count": 1
  }
}
```

**Consumed by (RN app):** [AuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/shopkeeper/src/context/AuthContext.js#L39) (Shopkeeper), [AdminAuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/superadmin/src/context/AdminAuthContext.js#L52) (Admin)

---

#### `GET /api/devices/:deviceId`
**Purpose:** Fetch details of a single device.  
**Auth required:** Yes (Admin or Shopkeeper)  
**Response (success)**
```json
{
  "success": true,
  "message": "Device retrieved successfully.",
  "data": {
    "device": {
      "_id": "603fde9b8e8f8c2b4c8b45a2",
      "deviceId": "VJR-ABC-123",
      "activationKey": "XYZ-987",
      "customerName": "Steve Rogers",
      "customerMobile": "9998887776",
      "deviceModel": "Samsung S23",
      "isLocked": false,
      "isOnline": true
    }
  }
}
```

---

#### `POST /api/devices/activate`
**Purpose:** Activates a device on the backend under the shopkeeper's account. Deducts exactly 1 credit.  
**Auth required:** Yes (Shopkeeper only)  
**Request**
```json
{
  "key": "ABCDE12345",
  "customerName": "Tony Stark",
  "customerMobile": "9988776655",
  "deviceModel": "Samsung A34",
  "totalAmount": 15000,
  "emiAmount": 1250,
  "totalMonths": 12,
  "interestRate": 10
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Device activated successfully.",
  "data": {
    "device": {
      "deviceId": "VJR-XCD-938",
      "activationKey": "ABCDE12345",
      "customerName": "Tony Stark",
      "deviceModel": "Samsung A34",
      "totalAmount": 15000,
      "isActive": true
    },
    "creditsRemaining": 23
  }
}
```
**Response (error cases)**
| Status | Condition | Shape |
|---|---|---|
| 400 | Insufficient credits | `{ "success": false, "message": "Insufficient credits. You need at least 1 credit...", "data": {} }` |
| 403 | Key does not belong to user | `{ "success": false, "message": "This key does not belong to you.", "data": {} }` |
| 404 | Invalid or already used key | `{ "success": false, "message": "Invalid or already used activation key.", "data": {} }` |

**Consumed by (RN app):** [AuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/shopkeeper/src/context/AuthContext.js#L314)

---

#### `PUT /api/devices/:deviceId`
**Purpose:** Update customer information or finance records.  
**Auth required:** Yes (Admin or Shopkeeper)  
**Request**
```json
{
  "customerName": "Tony Stark Jr.",
  "customerMobile": "9988776600",
  "paidEmis": 4
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Device updated successfully.",
  "data": {
    "device": {
      "deviceId": "VJR-XCD-938",
      "customerName": "Tony Stark Jr."
    }
  }
}
```

**Consumed by (RN app):** [AuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/shopkeeper/src/context/AuthContext.js#L354)

---

#### `DELETE /api/devices/:deviceId`
**Purpose:** Soft-deactivates and deletes a device.  
**Auth required:** Yes (Admin or Shopkeeper)  
**Response (success)**
```json
{
  "success": true,
  "message": "Device deactivated and soft-deleted.",
  "data": {}
}
```

**Consumed by (RN app):** [AuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/shopkeeper/src/context/AuthContext.js#L377)

---

#### `DELETE /api/devices/:deviceId/permanent`
**Purpose:** Permanently deletes a device and all associated command logs.  
**Auth required:** Yes (Admin only)  
**Response (success)**
```json
{
  "success": true,
  "message": "Device and related logs permanently deleted.",
  "data": {}
}
```

---

### Device Compatibility API (`/api/device`) - Android Client, Public

#### `POST /api/device/activate`
**Purpose:** Android hardware app invokes this to bind itself to an activation key.  
**Auth required:** No  
**Request**
```json
{
  "activationKey": "ABCDE12345",
  "imei": "358920192842019",
  "fcmToken": "fcm_token_string_here",
  "deviceModel": "OnePlus Nord",
  "androidVersion": "13"
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Device registered successfully.",
  "deviceId": "VJR-XCD-938",
  "shopName": "JD Electronics",
  "shopPhone": "9876543210"
}
```

---

#### `POST /api/device/heartbeat`
**Purpose:** Regular polling from Android lock client to sync coordinates and locked state.  
**Auth required:** No  
**Request**
```json
{
  "deviceId": "VJR-XCD-938",
  "lat": 19.0760,
  "lng": 72.8777,
  "batteryLevel": 45,
  "isLocked": false,
  "isCharging": true,
  "networkType": "MOBILE"
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Heartbeat received.",
  "isLocked": false
}
```

---

#### `POST /api/device/update-token`
**Purpose:** Refresh Firebase token.  
**Auth required:** No  
**Request**
```json
{
  "deviceId": "VJR-XCD-938",
  "fcmToken": "new_fcm_token_string"
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "FCM token updated successfully."
}
```

---

#### `POST /api/device/info`
**Purpose:** Update hardware specs.  
**Auth required:** No  
**Request**
```json
{
  "deviceId": "VJR-XCD-938",
  "imei": "358920192842019",
  "deviceModel": "OnePlus Nord 2",
  "androidVersion": "14",
  "appVersion": "1.0.9",
  "isDeviceOwner": true,
  "batteryLevel": 99,
  "storageAvailable": 1982739482,
  "ramAvailable": 1928374
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Device hardware specifications updated successfully."
}
```

---

#### `POST /api/device/command-status`
**Purpose:** Callback from Android client confirming command execution.  
**Auth required:** No  
**Request**
```json
{
  "deviceId": "VJR-XCD-938",
  "logId": "603fde9b8e8f8c2b4c8b45fa",
  "status": "executed",
  "errorReason": ""
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Command status updated to 'executed'."
}
```
**Notes / gotchas:** Triggers automated support Ticket creation if the status is marked as `failed`. On execution of `lock` or `unlock`, updates `isLocked` flag on Device schema.

---

### Activation Keys API (`/api/keys`) - Auth Required

#### `GET /api/keys`
**Purpose:** List generated activation keys. Shopkeepers only see their own keys. Admins see all keys.  
**Auth required:** Yes (Admin or Shopkeeper)  
**Query params**
| Param | Type | Required | Notes |
|---|---|---|---|
| `used` | String | No | Filter by usage ("true" or "false") |

**Response (success)**
```json
{
  "success": true,
  "message": "Activation keys retrieved successfully.",
  "data": {
    "keys": [
      {
        "_id": "603fde9b8e8f8c2b4c8b456d",
        "key": "ABCDE12345",
        "isUsed": false,
        "status": "pending",
        "createdAt": "2026-07-06T11:00:00.000Z"
      }
    ],
    "count": 1
  }
}
```

**Consumed by (RN app):** [AuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/shopkeeper/src/context/AuthContext.js#L40) (Shopkeeper), [AdminAuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/superadmin/src/context/AdminAuthContext.js#L53) (Admin)

---

#### `POST /api/keys/generate`
**Purpose:** Generate a randomized unique activation key.  
**Auth required:** Yes (Shopkeeper only)  
**Request:** None  
**Response (success)**
```json
{
  "success": true,
  "message": "Activation key generated successfully.",
  "data": {
    "activationKey": {
      "key": "VJ3K9A1B2",
      "shopkeeperId": "603fde9b8e8f8c2b4c8b4568",
      "status": "pending",
      "isUsed": false
    }
  }
}
```

**Consumed by (RN app):** [AuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/shopkeeper/src/context/AuthContext.js#L281)

---

#### `POST /api/keys/add`
**Purpose:** Manually create a custom activation key for a shopkeeper.  
**Auth required:** Yes (Admin only)  
**Request**
```json
{
  "shopkeeperId": "603fde9b8e8f8c2b4c8b4568",
  "customKey": "CUSTOMKEY999"
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Activation key added successfully.",
  "data": {
    "activationKey": {
      "key": "CUSTOMKEY999",
      "shopkeeperId": "603fde9b8e8f8c2b4c8b4568",
      "status": "pending"
    }
  }
}
```

---

#### `DELETE /api/keys/:key`
**Purpose:** Revoke an unused activation key.  
**Auth required:** Yes (Admin or Shopkeeper)  
**Response (success)**
```json
{
  "success": true,
  "message": "Activation key revoked successfully.",
  "data": {
    "activationKey": {
      "key": "VJ3K9A1B2",
      "status": "revoked"
    }
  }
}
```

---

### Commands Dispatch API (`/api/commands`) - Auth Required

#### `GET /api/commands/recent`
**Purpose:** Fetch recent remote commands across all devices.  
**Auth required:** Yes (Admin only)  
**Response (success)**
```json
{
  "success": true,
  "message": "Recent commands retrieved successfully.",
  "data": {
    "commands": [
      {
        "_id": "603fde9b8e8f8c2b4c8b45fa",
        "deviceId": "603fde9b8e8f8c2b4c8b45a2",
        "shopkeeperId": {
          "_id": "603fde9b8e8f8c2b4c8b4568",
          "shopkeeperName": "John Doe",
          "shopName": "JD Electronics"
        },
        "commandId": "lock",
        "commandType": "LOCK_DEVICE",
        "mode": "online",
        "status": "sent"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 125, "pages": 7 }
  }
}
```

---

#### `POST /api/commands/:deviceId/send`
**Purpose:** Sends FCM remote lock/hardware commands to the Android device.  
**Auth required:** Yes (Admin or Shopkeeper)  
**Request**
```json
{
  "commandId": "lock",
  "commandType": "LOCK_DEVICE",
  "commandLabel": "Lock Device",
  "category": "lock",
  "inputValue": "",
  "mode": "online"
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Command sent successfully.",
  "data": {
    "commandLog": {
      "_id": "603fde9b8e8f8c2b4c8b45fa",
      "deviceId": "603fde9b8e8f8c2b4c8b45a2",
      "commandId": "lock",
      "commandType": "LOCK_DEVICE",
      "status": "sent"
    }
  }
}
```
**Response (error cases)**
| Status | Condition | Shape |
|---|---|---|
| 400 | Missing command params | `{ "success": false, "message": "commandId and commandType are required.", "data": {} }` |
| 400 | Device does not have FCM token | `{ "success": false, "message": "Device has not registered an FCM token yet...", "data": {} }` |
| 502 | FCM server gateway failure | `{ "success": false, "message": "Failed to dispatch command: ...", "data": {} }` |

**Consumed by (RN app):** [AuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/shopkeeper/src/context/AuthContext.js#L445) (Shopkeeper), [AdminAuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/superadmin/src/context/AdminAuthContext.js#L538) (Admin)  
**Notes / gotchas:** Supported commandId mapping:
- `lock` ➡️ `LOCK_DEVICE` (Locks screen)
- `unlock` ➡️ `UNLOCK_DEVICE` (Clears overlay)
- `set_pin` ➡️ `SET_PASSWORD` (Locks user settings via PIN in `inputValue`)
- `clear_pin` ➡️ `CLEAR_PASSWORD` (Resets locking PIN)
- `camera_off` ➡️ `DISABLE_CAMERA`
- `camera_on` ➡️ `ENABLE_CAMERA`
- `mute` ➡️ `MUTE_VOLUME`
- `unmute` ➡️ `UNMUTE_VOLUME`
- `mic_off` ➡️ `MUTE_MIC`
- `mic_on` ➡️ `UNMUTE_MIC`
- `usb_block` ➡️ `BLOCK_USB`
- `usb_unblock` ➡️ `UNBLOCK_USB`
- `hide_app` ➡️ `HIDE_APP_ICON`
- `show_app` ➡️ `SHOW_APP_ICON`
- `alert` ➡️ `SHOW_ALERT` (Launches overlay message using `inputValue`)
- `wallpaper` ➡️ `SET_WALLPAPER` (Changes device wallpaper to URL in `inputValue`)
- `terminate_owner` ➡️ `TERMINATE_OWNER_PERMISSION`

---

#### `POST /api/commands/:deviceId/offline`
**Purpose:** Generate a signed manual bypass promotional SMS verification code.  
**Auth required:** Yes (Admin or Shopkeeper)  
**Request**
```json
{
  "commandId": "lock",
  "commandType": "LOCK_DEVICE",
  "commandLabel": "Lock Device",
  "category": "lock",
  "inputValue": ""
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Offline request submitted. An admin will process the SMS command shortly.",
  "data": {
    "commandLog": {
      "_id": "603fde9b8e8f8c2b4c8b45fa",
      "commandId": "lock",
      "mode": "offline",
      "status": "pending"
    },
    "ticket": {
      "ticketId": "TKT-00125",
      "status": "open",
      "priority": "high"
    }
  }
}
```
**Notes / gotchas:** Signature is calculated on `smsSecretPin`, command code (`LK`, `UL`, `SP`, `SA`, `MV`, `FR`), input param, and device ID, then appended to a promotional marketing SMS format. If executed by a Shopkeeper, a support ticket is auto-created for the admin to execute manual SMS dispatch.

**Consumed by (RN app):** [AuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/shopkeeper/src/context/AuthContext.js#L474) (Shopkeeper), [AdminAuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/superadmin/src/context/AdminAuthContext.js#L558) (Admin)

---

#### `GET /api/commands/:deviceId/logs`
**Purpose:** Retrieve logs of commands executed on a specific device.  
**Auth required:** Yes (Admin or Shopkeeper)  
**Response (success)**
```json
{
  "success": true,
  "message": "Command logs retrieved successfully.",
  "data": {
    "logs": [
      {
        "_id": "603fde9b8e8f8c2b4c8b45fa",
        "commandId": "lock",
        "status": "executed",
        "sentAt": "2026-07-06T11:00:00.000Z",
        "executedAt": "2026-07-06T11:00:05.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "pages": 1 }
  }
}
```

---

#### `PUT /api/commands/:logId/status`
**Purpose:** Manually update execution status of a command.  
**Auth required:** Yes (Admin or Shopkeeper)  
**Request**
```json
{
  "status": "executed",
  "errorReason": ""
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Command status updated to 'executed'.",
  "data": {
    "commandLog": {
      "_id": "603fde9b8e8f8c2b4c8b45fa",
      "status": "executed"
    }
  }
}
```

---

### Credits Ledger API (`/api/credits`) - Auth Required

#### `GET /api/credits/summary/platform`
**Purpose:** Aggregate database credit statistics.  
**Auth required:** Yes (Admin only)  
**Response (success)**
```json
{
  "success": true,
  "message": "Platform credit summary retrieved successfully.",
  "data": {
    "totalCreditsPurchased": 1500,
    "totalCreditsUsed": 1100,
    "totalRevenue": 1500,
    "purchaseTransactions": 45,
    "deductionTransactions": 1100
  }
}
```

**Consumed by (RN app):** [AnalyticsScreen.js](file:///home/jainam/Documents/Vajra_MobileApps/superadmin/src/screens/main/AnalyticsScreen.js#L36)

---

#### `GET /api/credits/:shopkeeperId`
**Purpose:** Fetch transaction ledger list for a specific shopkeeper.  
**Auth required:** Yes (Admin or Shopkeeper)  
**Response (success)**
```json
{
  "success": true,
  "message": "Credit transactions retrieved successfully.",
  "data": {
    "transactions": [
      {
        "_id": "603fde9b8e8f8c2b4c8b459a",
        "type": "purchase",
        "amount": 50,
        "balanceBefore": 24,
        "balanceAfter": 74,
        "paymentMethod": "UPI",
        "createdAt": "2026-07-06T10:00:00.000Z"
      }
    ],
    "count": 1
  }
}
```

---

#### `POST /api/credits/:shopkeeperId/add`
**Purpose:** Allocate credits (alternative admin endpoint).  
**Auth required:** Yes (Admin only)  
**Request**
```json
{
  "amount": 100,
  "paymentMethod": "UPI",
  "paymentReference": "UPI298374928"
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "100 credits added to shopkeeper.",
  "data": {
    "credits": 174,
    "transaction": {
      "_id": "603fde9b8e8f8c2b4c8b459f",
      "amount": 100,
      "balanceBefore": 74,
      "balanceAfter": 174
    }
  }
}
```

---

### Tickets Support API (`/api/tickets`) - Auth Required

#### `GET /api/tickets`
**Purpose:** Retrieve list of active support tickets. Shopkeepers only see tickets created under their account.  
**Auth required:** Yes (Admin or Shopkeeper)  
**Query params**
| Param | Type | Required | Notes |
|---|---|---|---|
| `status` | String | No | Comma-separated filters (e.g. `open,resolved`) |

**Response (success)**
```json
{
  "success": true,
  "message": "Tickets retrieved successfully.",
  "data": {
    "tickets": [
      {
        "_id": "603fde9b8e8f8c2b4c8b45b5",
        "ticketId": "TKT-00125",
        "customerName": "Steve Rogers",
        "commandAttempted": "LOCK_DEVICE",
        "errorReason": "Device offline",
        "status": "open",
        "priority": "medium"
      }
    ],
    "count": 1
  }
}
```

**Consumed by (RN app):** [AdminAuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/superadmin/src/context/AdminAuthContext.js#L51) (Admin)

---

#### `POST /api/tickets`
**Purpose:** Create support ticket.  
**Auth required:** Yes (Admin or Shopkeeper)  
**Request**
```json
{
  "commandAttempted": "LOCK_DEVICE",
  "errorReason": "Manual reporting of unlock failure",
  "deviceId": "603fde9b8e8f8c2b4c8b45a2",
  "priority": "high"
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Ticket created successfully.",
  "data": {
    "ticket": {
      "ticketId": "TKT-00126",
      "commandAttempted": "LOCK_DEVICE",
      "status": "open"
    }
  }
}
```

---

#### `GET /api/tickets/:ticketId`
**Purpose:** Retrieve details of a support ticket.  
**Auth required:** Yes (Admin or Shopkeeper)  
**Response (success)**
```json
{
  "success": true,
  "message": "Ticket retrieved successfully.",
  "data": {
    "ticket": {
      "ticketId": "TKT-00125",
      "commandAttempted": "LOCK_DEVICE",
      "errorReason": "Device offline",
      "status": "open"
    }
  }
}
```

---

#### `PUT /api/tickets/:ticketId/resolve`
**Purpose:** Mark ticket as resolved.  
**Auth required:** Yes (Admin only)  
**Request**
```json
{
  "resolution": "Locked manually via SMS gateway."
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Ticket resolved successfully.",
  "data": {
    "ticket": {
      "ticketId": "TKT-00125",
      "status": "resolved",
      "resolution": "Locked manually via SMS gateway."
    }
  }
}
```

**Consumed by (RN app):** [AdminAuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/superadmin/src/context/AdminAuthContext.js#L305)

---

#### `PUT /api/tickets/:ticketId/reject`
**Purpose:** Reject support ticket.  
**Auth required:** Yes (Admin only)  
**Request**
```json
{
  "resolution": "Not reproducible or client cancelled."
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Ticket rejected.",
  "data": {
    "ticket": {
      "ticketId": "TKT-00125",
      "status": "rejected"
    }
  }
}
```

**Consumed by (RN app):** [AdminAuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/superadmin/src/context/AdminAuthContext.js#L333)

---

### Announcements API (`/api/announcements`) - Auth Required

#### `GET /api/announcements`
**Purpose:** List marketing or system announcements. Shopkeepers only see targeted announcements. Admins see all.  
**Auth required:** Yes (Admin or Shopkeeper)  
**Response (success)**
```json
{
  "success": true,
  "message": "Announcements retrieved successfully.",
  "data": {
    "announcements": [
      {
        "_id": "603fde9b8e8f8c2b4c8b45c2",
        "title": "Welcome to Vajra",
        "body": "Thank you for using our locking platform.",
        "type": "SYSTEM",
        "createdAt": "2026-07-01T12:00:00.000Z"
      }
    ],
    "count": 1
  }
}
```

**Consumed by (RN app):** [AuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/shopkeeper/src/context/AuthContext.js#L41) (Shopkeeper), [AdminAuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/superadmin/src/context/AdminAuthContext.js#L53) (Admin)

---

#### `POST /api/announcements`
**Purpose:** Create announcement.  
**Auth required:** Yes (Admin only)  
**Request**
```json
{
  "title": "Scheduled Maintenance",
  "body": "System will be down for 2 hours on Sunday.",
  "type": "SYSTEM",
  "targetType": "all"
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Announcement created successfully.",
  "data": {
    "announcement": {
      "title": "Scheduled Maintenance",
      "type": "SYSTEM"
    }
  }
}
```

**Consumed by (RN app):** [AdminAuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/superadmin/src/context/AdminAuthContext.js#L395)

---

#### `PUT /api/announcements/:id/read`
**Purpose:** Mark announcement read.  
**Auth required:** Yes (Shopkeeper only)  
**Response (success)**
```json
{
  "success": true,
  "message": "Announcement marked as read.",
  "data": {}
}
```

---

### System Config API (`/api/config`) - Mixed Auth

#### `GET /api/config`
**Purpose:** Fetch platform configuration parameter singleton.  
**Auth required:** No  
**Response (success)**
```json
{
  "success": true,
  "message": "Config retrieved successfully.",
  "data": {
    "config": {
      "creditPriceINR": 1,
      "upiId": "vajra@upi",
      "maintenanceMode": false,
      "minAppVersion": "1.0.0",
      "paymentQrUrl": "https://res.cloudinary.com/...",
      "deviceOwnerQrUrl": "https://res.cloudinary.com/..."
    }
  }
}
```

**Consumed by (RN app):** [AuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/shopkeeper/src/context/AuthContext.js#L42) (Shopkeeper), [AdminAuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/superadmin/src/context/AdminAuthContext.js#L93) (Admin)

---

#### `PUT /api/config`
**Purpose:** Update config variables.  
**Auth required:** Yes (Admin only)  
**Request**
```json
{
  "creditPriceINR": 2,
  "upiId": "newvajra@upi",
  "maintenanceMode": false
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Config updated successfully.",
  "data": {
    "config": {
      "creditPriceINR": 2,
      "upiId": "newvajra@upi"
    }
  }
}
```

---

#### `POST /api/config/wallpapers`
**Purpose:** Add design template wallpaper.  
**Auth required:** Yes (Admin only)  
**Request**
```json
{
  "name": "Nebula Blue",
  "url": "https://res.cloudinary.com/..."
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Wallpaper template added successfully.",
  "data": {
    "wallpaperTemplates": [
      {
        "_id": "603fde9b8e8f8c2b4c8b45df",
        "name": "Nebula Blue",
        "url": "https://res.cloudinary.com/..."
      }
    ]
  }
}
```

**Consumed by (RN app):** [AdminAuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/superadmin/src/context/AdminAuthContext.js#L435)

---

#### `DELETE /api/config/wallpapers/:index`
**Purpose:** Delete wallpaper template at array index.  
**Auth required:** Yes (Admin only)  
**Response (success)**
```json
{
  "success": true,
  "message": "Wallpaper template removed successfully.",
  "data": {
    "wallpaperTemplates": []
  }
}
```

**Consumed by (RN app):** [AdminAuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/superadmin/src/context/AdminAuthContext.js#L458)

---

#### `PUT /api/config/qr`
**Purpose:** Update platform payment QR.  
**Auth required:** Yes (Admin only)  
**Request**
```json
{
  "paymentQrUrl": "https://res.cloudinary.com/..."
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Payment QR URL updated successfully.",
  "data": {
    "paymentQrUrl": "https://res.cloudinary.com/..."
  }
}
```

**Consumed by (RN app):** [AdminAuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/superadmin/src/context/AdminAuthContext.js#L479)

---

#### `POST /api/config/upload`
**Purpose:** Upload images (wallpapers, QRs) to Cloudinary.  
**Auth required:** Yes (Admin only)  
**Request**
```json
{
  "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...",
  "folder": "custom_assets"
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Image uploaded to Cloudinary successfully.",
  "data": {
    "url": "https://res.cloudinary.com/..."
  }
}
```

**Consumed by (RN app):** [AdminAuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/superadmin/src/context/AdminAuthContext.js#L519)

---

#### `PUT /api/config/device-owner-qr`
**Purpose:** Update device owner download link QR.  
**Auth required:** Yes (Admin only)  
**Request**
```json
{
  "deviceOwnerQrUrl": "https://res.cloudinary.com/..."
}
```
**Response (success)**
```json
{
  "success": true,
  "message": "Device owner QR URL updated successfully.",
  "data": {
    "deviceOwnerQrUrl": "https://res.cloudinary.com/..."
  }
}
```

**Consumed by (RN app):** [AdminAuthContext.js](file:///home/jainam/Documents/Vajra_MobileApps/superadmin/src/context/AdminAuthContext.js#L499)
