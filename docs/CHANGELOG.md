# Changelog

All notable changes to the Vajra LockApp Backend and client configurations are logged here, newest first.

## [2026-07-03] - Command Feedback loop, Offline Ticketing, Location Permissions & Form Validations

### Added
- **Command Status Feedback (`POST /api/device/command-status`)**: Added a public confirmation endpoint in `routes/deviceCompat.js` that receives command execution reports (`executed` / `failed`) from devices. On failure, it automatically triggers support ticket creation. On success, it calls `applyTagToDevice` to apply tags and updates state flags (`isLocked` / `pin`).
- **Offline Command Auto-Ticketing**: Modified the offline commands endpoint (`POST /:deviceId/offline`) in `routes/commands.js` to automatically log high-priority tickets containing the secure SMS command payload when requested by shopkeepers.
- **Support Ticket `smsPayload` Field**: Extended the `Ticket` schema in `models/Ticket.js` with `smsPayload` to store generated cryptographic SMS actions for super admin terminal visibility.

### Changed
- **Delayed DB Tag Updates**: Removed immediate tag updates during command sending/dispatch in `routes/commands.js`. State tags are now strictly applied on device-reported execution.
- **FCM Safety (Quote Filtering)**: Sanitized `FIREBASE_PRIVATE_KEY` load sequences in `services/fcm.js` to strip leading/trailing quotes and clean newlines (`\n`) for crash-proof Vercel deployments.
- **FCM Response Privacy**: Stripped the secure `smsPayload` field from offline command log responses sent to shopkeepers (`routes/commands.js`), ensuring they do not see or send cryptographic SMS codes directly.
- **Super Admin Frontend Validations & Fixes**:
  - Capped credit top-ups in `ShopkeeperDetailScreen.js` to a maximum of 100 credits per transaction.
  - Restricted gallery photo pick uploads (Payment QRs, Device Owner QRs, Wallpapers) in `ProfileScreen.js` to a maximum size of 5 MB.
  - Corrected shopkeeper user counts on list cards and detail headers by computing sizes dynamically from the live context array instead of unmapped backend schema properties.
- **Android App telemetry and safeties**:
  - Retrofitted runtime Fine, Coarse, and Background location permissions in `MainActivity.kt`.
  - Added try-catch blocks and error diagnostics around policy executions, reporting results to `/api/device/command-status`.
  - Added Device Owner validation checks before calling protected MDM functions in `CommandHandler.kt`.
- **Parallel Session Bootstrapping (Shopkeeper & Super Admin Clients)**: Parallelized initial authentication and dashboard bootstrap queries (`/api/profile`, `/api/devices`, `/api/keys`, `/api/announcements`, `/api/config`) on app startup in `AuthContext.js` and `AdminAuthContext.js` to eliminate sequential network request blockages.
