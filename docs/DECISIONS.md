# Decisions Log

Short record of architectural design choices and trade-offs made in the Vajra LockApp backend and client suite.

## 2026-07-03 - Delayed DB Tag Application (Eventual Consistency)
**Why:** Previously, database tags (e.g. `appliedTags` on the Device model) were updated immediately when an online command was dispatched, leading to false-positives when commands failed or devices remained offline. Transitioning to a callback model (`POST /api/device/command-status`) ensures the dashboard state accurately matches the physical device state.
**Alternatives considered:** Periodic background polling of device state (highly resource-intensive on mobile battery/telemetry).

## 2026-07-03 - Admin-Mediated Offline Command Gateway
**Why:** To prevent shopkeepers from bypassing tracking, sharing raw cryptographic command SMS strings, or triggering locks without supervision. By routing offline commands through auto-generated High-priority tickets, we keep the secure payload in control of the Super Admin terminal while providing shopkeepers with a clean "Queued for processing" UX.
**Alternatives considered:** Direct shopkeeper SMS dispatch (shipped in POC, rejected for production security audit).

## 2026-07-03 - Vercel FCM Secret Formatting Resiliency
**Why:** Vercel's console and CLI tools frequently quote-wrap multi-line strings (like private keys) or parse `\n` incorrectly. Stripping surrounding quotes and cleaning newlines programmatically in `fcm.js` prevents deployment startup crashes.
**Alternatives considered:** Restructuring the credentials payload into a raw inline JSON block.

## 2026-07-03 - Client-side Image Size Validation (Expo FileSystem)
**Why:** Checking file size using `FileSystem.getInfoAsync` in the frontend picker callback provides instantaneous user feedback, prevents unnecessary cellular data usage, and protects Cloudinary configurations from processing oversized payloads.
**Alternatives considered:** Relying purely on backend Express-body limits (wastes client network upload bandwidth).
