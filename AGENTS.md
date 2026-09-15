# OnlyUs Project Guidelines & Rules

## Core Rules & Verification Protocol
1. **Double-Review Mandate**: Before completing any turn, thoroughly inspect all modified source files, database queries, and real-time lifecycle hooks to guarantee zero regressions.
2. **Symmetric Dual-User Sync**: Always verify that both Rahul (Owner - Google Auth) and Nusrat (Partner - 6-digit PIN Auth) have identical, zero-latency access to shared messages, realtime subscriptions, online presence, and games.
3. **Database & RLS Integrity**: Maintain permissive RLS policies and realtime publications on `messages`, `users`, and `app_config` in Supabase so neither account encounters permission or missing message errors.
4. **Resilient Message Hydration**: Ensure message subscriptions and historical fetches execute immediately upon user authentication without being blocked by asynchronous profile resolution.
5. **Question Mode Tags**: Whenever the user includes `#ask`, `#ans`, `#qna`, or `#answer` in their prompt, treat the request purely as an informational question: provide a detailed answer and make NO code changes or tool modifications unless explicitly asked.

---

## 📱 Dual-Architecture Overview: Web App vs. Companion Android APKs
This repository is a **unified single-codebase project** that serves both the production web app (hosted on Vercel at `onlyus69.vercel.app`) and the two companion Android APKs via Capacitor and Gradle product flavors. **Never delete or break the Android setup (`/android/`) or `.github/workflows/build-apk.yml`.**

### 1. Web Version (Vercel)
- Accessed in browser at `https://onlyus69.vercel.app`.
- Symmetrical web experience for both Rahul and Nusrat.

### 2. Nusrat's Stealth APK (`OnlyUs-Nusrat-Stealth.apk` / `com.onlyus.notes`)
- **Disguise**: Named **"Notes"** with a realistic amber notepad launcher icon.
- **Initial Boot**: Always starts locked in `StealthNotepadView` (zero flash of OnlyUs).
- **Secret Trigger**: Entering **`#6969#`** into the Notepad search bar reveals the OnlyUs app.
- **Panic Protection**: 
  - Shaking the phone triggers native hardware accelerometer kill (`finishAndRemoveTask()` + `System.exit(0)`).
  - Pressing the Home button or locking the screen instantly terminates the task and removes it from Recent Apps.
  - `FLAG_SECURE` is active to prevent screenshots and blank out recent app switcher previews.

### 3. Rahul's Direct APK (`OnlyUs-Rahul-Direct.apk` / `com.onlyus.app`)
- **Branding**: Official "OnlyUs" name and website favicon as app icon.
- **Direct Entry**: Launches straight into the chat/hub with notifications.
- **Google OAuth**: Uses deep link custom scheme `com.onlyus.app://auth/callback` opened with `@capacitor/browser` and listened via `CapApp.addListener('appUrlOpen')`.

### 4. CI/CD & Build Workflow
- Workflow defined at `/.github/workflows/build-apk.yml`.
- **Manual Trigger only** (`workflow_dispatch`) so pushing website updates does NOT unnecessarily re-compile APKs.
- Automatically generates icons via `npm run icons` (`scripts/generate-flavor-icons.js`).
- Compiles both variants (`assembleNusratDebug`, `assembleRahulDebug`) and publishes them directly to GitHub Releases.

---

## 🔑 AI Studio Secrets & Supabase Automation
- **Supabase Credentials in AI Studio**:
  - `SUPABASE_PROJECT_ID`: `vrstmtjfqlbfyxtsothf`
  - `SUPABASE_ACCESS_TOKEN`: Configured in AI Studio Settings -> Secrets.
  - The AI agent has direct programmatic access to the Supabase Management API (`api.supabase.com/v1/projects/{ref}`) to run database queries (`/database/query`), manage Edge Functions (`/functions`), and manage project secrets (`/secrets`).
  - The user prefers automated schema updates, triggers, and edge function deploys rather than manual Supabase dashboard operations.

---

## 🔔 Firebase Cloud Messaging (FCM) & Push Architecture
OnlyUs uses high-priority Firebase Cloud Messaging (FCM v1) to ensure zero-latency notification delivery to Rahul's Android device even when the app is in the background, screen locked, or killed/swiped away.

### 1. Firebase Project & Android Configuration
- **Firebase Project**: `onlyus69`
- **Config file**: `/android/app/google-services.json` (contains configuration for both `com.onlyus.app` and `com.onlyus.notes`).
- **Dependencies**: Integrated via Gradle BOM (`com.google.firebase:firebase-bom` and `com.google.firebase:firebase-messaging`).
- **Firebase Service Account Secrets**: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` are stored securely inside Supabase Project Secrets.

### 2. Native Android Service & Notification Dispatch
- **`OnlyUsFirebaseMessagingService`** (`/android/app/src/main/java/com/onlyus/app/OnlyUsFirebaseMessagingService.java`):
  - Extends `FirebaseMessagingService`.
  - Registered in `AndroidManifest.xml` with `com.google.firebase.MESSAGING_EVENT`.
  - Intercepts incoming High-Priority FCM Data messages and passes title, body, reply role, and avatar to `OnlyUsNotificationPlugin.showChatNotificationNative(...)`.
  - Automatically caches new FCM registration tokens and notifies JavaScript listeners.
  - In Nusrat's stealth flavor (`com.onlyus.notes`), all notification display is blocked to maintain complete privacy.

### 3. Edge Function & Database Webhook Dispatch
- **Edge Function**: `send-push` (`/supabase/functions/send-push/index.ts`):
  - Deployed on Supabase Edge Runtime (`https://vrstmtjfqlbfyxtsothf.supabase.co/functions/v1/send-push`).
  - Generates short-lived Google OAuth2 tokens via Web Crypto RS256 signing and dispatches high-priority `data` payloads via FCM v1 REST API.
  - Automatically cleans up invalidated or unregistered tokens from `public.fcm_tokens`.
- **Database Trigger**: `on_message_inserted_fcm_push` on `public.messages`:
  - Utilizes PostgreSQL `pg_net` extension (`net.http_post`) to trigger `send-push` asynchronously whenever a non-deleted message is inserted into `messages`.
- **Client Sync**:
  - `syncFcmTokenToSupabase` in `/src/lib/notifications.ts` registers and updates the device's FCM token in the `public.fcm_tokens` table on initial login.
  - Direct invoke `triggerPushNotification` runs client-side on send for immediate delivery alongside the database trigger.

