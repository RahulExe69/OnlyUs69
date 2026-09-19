# OnlyUs Project Guidelines & Reference

## 1. Core Operating Rules & Verification
1. **Double-Review Mandate**: Inspect all modified files, queries, and real-time hooks before concluding any task to guarantee zero regressions.
2. **Symmetric Dual-User Sync**: Rahul (Owner - Google Auth) and Nusrat (Partner - 6-digit PIN Auth) must always have identical, real-time access to messages, subscriptions, presence, and features.
3. **Database & RLS Integrity**: Maintain open/permissive RLS and realtime publications on `messages`, `users`, and `app_config` in Supabase so neither account encounters permission errors.
4. **Resilient Message Hydration**: Subscriptions and historical message fetches must execute immediately on login without waiting for asynchronous profile queries.
5. **Question Mode Tags**: If the prompt includes `#ask`, `#ans`, `#qna`, or `#answer`, treat it as an informational query only—make no code changes or edits unless explicitly asked.
6. **Concise Agent Documentation**: Keep `AGENTS.md` concise, relevant, and actionable. Document only essential architecture, secrets, configurations, non-obvious bug fixes, and critical rules. Avoid verbose changelogs, narrative essays, or implementation history.

---

## 2. Dual-Architecture: Web App vs. Companion Android APKs
Unified codebase serving both the web app and two Android APK variants via Capacitor and Gradle product flavors. **Never break or remove `/android/` or `.github/workflows/build-apk.yml`.**

- **Web App (Vercel)**: Hosted at `https://onlyus69.vercel.app` (symmetrical experience for Rahul and Nusrat).
- **Nusrat's Stealth APK (`com.onlyus.notes` / `OnlyUs-Nusrat-Stealth.apk`)**:
  - Disguised as **"Notes"** with amber notepad icon.
  - Boots locked in `StealthNotepadView`. Secret trigger **`#6969#`** in the search bar unlocks OnlyUs.
  - Native panic kill on phone shake (`finishAndRemoveTask()` + `System.exit(0)`). Pressing Home or locking screen terminates task. `FLAG_SECURE` blocks screenshots and task switcher previews.
- **Rahul's Direct APK (`com.onlyus.app` / `OnlyUs-Rahul-Direct.apk`)**:
  - Standard OnlyUs branding; launches straight into chat with notifications.
  - Google OAuth uses custom scheme `com.onlyus.app://auth/callback` via `@capacitor/browser` and `CapApp.addListener('appUrlOpen')`.
- **Build Workflow (`.github/workflows/build-apk.yml`)**:
  - Manual trigger (`workflow_dispatch`). Compiles `assembleNusratRelease/Debug` and `assembleRahulRelease/Debug` and publishes APKs to GitHub Releases.

---

## 3. Supabase & AI Studio Credentials
- **Supabase Project ID**: `vrstmtjfqlbfyxtsothf`
- **Management API**: Direct programmatic access via `api.supabase.com/v1/projects/{ref}` using `SUPABASE_ACCESS_TOKEN`. Use for schema migrations, triggers, secrets, and Edge Functions.
- **Direct Hardcoded Credentials (`src/lib/supabase.ts`)**: Exclusively relies on verified hardcoded Supabase project credentials (`vrstmtjfqlbfyxtsothf`) to eliminate any environment variable drift, truncation, or stale overrides.

---

## 4. Push Notifications & FCM Architecture
High-priority Firebase Cloud Messaging (FCM v1) for zero-latency background/locked delivery to Rahul's Android device:
- **Firebase Project**: `onlyus69` (`/android/app/google-services.json`).
- **Native Service**: `OnlyUsFirebaseMessagingService` intercepts FCM data messages and passes them to `OnlyUsNotificationPlugin.showChatNotificationNative(...)`. Notifications are completely suppressed in Nusrat's stealth flavor (`com.onlyus.notes`).
- **Edge Function**: `send-push` (`/supabase/functions/send-push/index.ts`) generates short-lived Google OAuth2 tokens (RS256) and calls FCM v1 REST API.
- **DB Trigger**: `on_message_inserted_fcm_push` on `public.messages` calls `send-push` asynchronously via `pg_net` (`net.http_post`).
- **Token Registration**: Client calls `syncFcmTokenToSupabase` on initial login to store tokens in `public.fcm_tokens`.

---

## 5. Theme System & Persistence Architecture
- **Storage Keys**:
  - `onlyus_chat_theme`: Primary active theme key for the local device.
  - `onlyus_partner_theme`: Secondary key for Nusrat's partner session.
  - `onlyus_cached_profile`: Synchronously cached profile object.
- **Zero-Flash Pre-Render (`index.html`)**:
  - Inline blocking script reads `onlyus_chat_theme` (with fallbacks to cached profile or session) and immediately applies CSS variables to `:root` before React bundles load.
- **Persistence & Sync Rule**:
  - When the user selects a theme (`selectTheme`), write immediately to `localStorage` (`onlyus_chat_theme`, `onlyus_partner_theme`, `onlyus_cached_profile`) and update the `users` table via `updateSettings`.
  - On page reload, `fetchProfile` must honor `localStorage.getItem('onlyus_chat_theme')` as the primary truth. Never overwrite local selection with a stale database entry; instead, sync the local theme back to Supabase.
- **3D & Shader Registry (`/src/components/ShaderThemesThreeD/`)**:
  - Modular WebGL shaders (`OnlyUsShader`, `NebulaShader`, `LavenderShader`, `AkatsukiShader`, `NeonArcadeShader`).
  - WebGL context uses `powerPreference: 'low-power'` and DPR capped at 1.0. Animation loops freeze automatically when backgrounded or when modals are open.

---

## 6. Key Application Modules & Patterns
- **Conversational Grouping & Spacing (`MessageItem.tsx`)**:
  - Avatar renders only on the first message of an incoming run.
  - Consecutive messages use tight 2-3px spacing (`mt-[2px]`); sender turns use an 8-10px separation.
  - Attached WhatsApp-style reaction badge overlaps bottom rim with dedicated margin reservation.
- **Double-Tap ❤️ Reaction**: Tap gesture detection in `MessageItem.tsx` with optimistic updates, haptic vibration, and animated shockwave.
- **Shared 2D Pet Companion Mochi (`ChatPetCompanion.tsx`, `PetSettingsModal.tsx`)**:
  - Procedural 2D canvas kitten living directly inside `#message-container`.
  - Uses message bubbles and input bar as platforms with synchronized scroll coordinates and keyboard avoidance.
  - Interactive gamified playroom with live vector canvas, visual coat options, wardrobe inventory, treat mini-actions, and symmetric dual-partner sync for Mochi's name and configuration via `app_config.pet_config` and realtime broadcasts.
- **Centralized Overlay Management (`src/lib/overlayManager.ts`)**:
  - All modal dialogs and full-screen sheets must register via `useOverlayBack` to ensure predictable hardware/browser back navigation without exiting the app.
- **End-to-End Encryption (`src/lib/e2ee.ts`)**:
  - Web Crypto P-256 ECDH + AES-GCM-256 for private 1-to-1 chat encryption.
