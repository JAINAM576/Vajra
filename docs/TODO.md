# TODO / Known Issues

Deferred features, technical debt, and next steps for the Vajra LockApp backend and client suite.

## Deferred (shipped without, on purpose)
- **Status Endpoint Auth**: The `/api/device/command-status` endpoint validates `deviceId` and `logId` but does not cryptographically authenticate the request header signature. Replaced with lightweight validation for launch; device-side token signing should be integrated next.
- **Automated APK Compilation**: Due to local environments lacking Android SDK setups, client code validation is compiled manually.

## Known issues
- **Offline Location Failures**: If GPS is disabled on the client device during a telemetry check, lat/lng coordinates fallback to `0.0`, which are filtered out by the dashboard map.

## Next up
- [ ] **Cryptographic Verification of Device Callbacks**: Implement HMAC/JWT signature checks on the command-status callback router to prevent endpoint spoofing.
- [ ] **WhatsApp/Slack Ticket Alerts**: Trigger notification hooks to administrators when high-priority offline command tickets are auto-created.
- [ ] **CI/CD Build Pipeline**: Configure a GitHub Actions workflow with the Android SDK to auto-compile and build apks on every client-side pull request.
- [ ] **Location Cache Fallback**: Store the last known non-zero location on the device so that when GPS fails, the app transmits the cached coordinates rather than `0.0`.
