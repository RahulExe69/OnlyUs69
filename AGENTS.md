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
- **Master PIN Fallback**: Can also authenticate immediately with Master PIN (`696969` / `786786`) in case of offline or Google redirect issues.

### 4. CI/CD & Build Workflow
- Workflow defined at `/.github/workflows/build-apk.yml`.
- **Manual Trigger only** (`workflow_dispatch`) so pushing website updates does NOT unnecessarily re-compile APKs.
- Automatically generates icons via `npm run icons` (`scripts/generate-flavor-icons.js`).
- Compiles both variants (`assembleNusratDebug`, `assembleRahulDebug`) and publishes them directly to GitHub Releases.
