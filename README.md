# 💖 OnlyUs — Private Couple Web & Companion Android Apps

Private 1-to-1 couple companion app handcrafted for **Rahul** & **Nusrat**.
This repository powers both the **Vercel Web App** (`https://onlyus69.vercel.app`) and the **Dual-Flavor Android Companion APKs** from a single unified codebase.

---

## 📱 The Two Companion Android APKs

Built directly from this repository via GitHub Actions (`.github/workflows/build-apk.yml`):

### 1. 📓 Nusrat's Stealth Edition (`OnlyUs-Nusrat-Stealth.apk`)
- **App Name on Phone**: **"Notes"**
- **App Icon**: Authentic amber/yellow notepad icon.
- **Boot Behavior**: Always opens directly to a functional Notepad. No OnlyUs branding or chat is visible.
- **Secret Unlock**: Type **`#6969#`** into the Notepad search bar to instantly unlock OnlyUs.
- **Hardware Panic Close**:
  - **Shake Phone**: Accelerometer sensor immediately triggers `finishAndRemoveTask()` and kills the app process.
  - **Home Button / Screen Off**: Minimizing or turning off the screen terminates the activity and purges it from Android's Recent Apps carousel.
  - **Screenshots & App Switcher Blocked**: Natively secured with `FLAG_SECURE`.

### 2. 💬 Rahul's Direct Edition (`OnlyUs-Rahul-Direct.apk`)
- **App Name on Phone**: **"OnlyUs"**
- **App Icon**: Official heart website favicon (`/public/favicon.webp`).
- **Direct Entry**: Launches straight into the chat and Multi-Hub dashboard.
- **Google OAuth Login**: Deep link callback integration (`com.onlyus.app://auth/callback` via `@capacitor/browser`).
- **Master PIN Fallback**: Enter `696969` in the PIN login tab for instant 1-second sign-in.
- **Notifications**: `POST_NOTIFICATIONS` permission enabled.

---

## 🚀 How to Build New APKs (Manual GitHub Workflow)

1. Go to your repository on GitHub.
2. Click on the **Actions** tab.
3. In the left sidebar, click **"Build OnlyUs Dual Android APKs"**.
4. Click the **"Run workflow"** button on the right.
5. (Optional) Enter a release version tag (e.g. `v1.0.1`).
6. Click **"Run workflow"**.
7. In ~3–4 minutes:
   - Both APKs will be published to the **GitHub Releases** tab (`OnlyUs-Nusrat-Stealth.apk` and `OnlyUs-Rahul-Direct.apk`).
   - They will also be downloadable from the workflow **Artifacts** section.

---

## 🛠️ Local Developer Commands

```bash
# Install dependencies
npm install

# Run web app in development (port 3000)
npm run dev

# Generate Android launcher icons for both flavors
npm run icons

# Build web assets and sync to Android project
npm run cap:build

# Type check
npm run lint
```

---

## 🔐 Credentials & Secrets

- **Vercel & Supabase**:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- **Owner Account**: `bodruddoja4@gmail.com`
- **Partner Account**: PIN authenticated (`app_config.partner_passcode` or default `123456`)
- **Nusrat Stealth Keyword**: `#6969#`
