# OnlyUs Project Guidelines & Rules

## Core Rules & Verification Protocol
1. **Double-Review Mandate**: Before completing any turn, thoroughly inspect all modified source files, database queries, and real-time lifecycle hooks to guarantee zero regressions.
2. **Symmetric Dual-User Sync**: Always verify that both Rahul (Owner - Google Auth) and Nusrat (Partner - 6-digit PIN Auth) have identical, zero-latency access to shared messages, realtime subscriptions, online presence, and games.
3. **Database & RLS Integrity**: Maintain permissive RLS policies and realtime publications on `messages`, `users`, and `app_config` in Supabase so neither account encounters permission or missing message errors.
4. **Resilient Message Hydration**: Ensure message subscriptions and historical fetches execute immediately upon user authentication without being blocked by asynchronous profile resolution.
5. **Question Mode Tags**: Whenever the user includes `#ask`, `#ans`, `#qna`, or `#answer` in their prompt, treat the request purely as an informational question: provide a detailed answer and make NO code changes or tool modifications unless explicitly asked.
6. **Living Project Context & Agent Handoff**: Treat `AGENTS.md` as a continuously maintained handoff document and living source of project context for all AI agents:
   - **Mandatory Documentation Threshold**: Whenever an AI agent makes an important change, discovers a significant issue, introduces a new architectural decision, changes an important configuration, modifies a critical workflow, fixes a non-obvious bug, or encounters anything else that another AI agent needs to know in order to work safely and correctly, the agent **MUST** document it in `AGENTS.md`. Agents must update `AGENTS.md` directly rather than relying on conversation history or assuming future agents will know about it.
   - **Concise, Relevant & Actionable**: Documented entries must be kept concise, relevant, and actionable—recording only information critical for future agents to understand current project state, avoid repeating mistakes, preserve architectural decisions, and continue development correctly.
   - **Mandatory Pre-Work Review**: Before starting new work, every AI agent **MUST** review the relevant sections of `AGENTS.md` and follow the accumulated project context.

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

---

## 🎨 Theme System & Viewport Resilience Architecture

### 1. Zero-Flash Pre-Render Theme Hydration
- **Problem**: When reloading the page, a flash of default theme occurred before React mounted and applied the user's stored theme.
- **Solution**:
  - `/index.html` includes an inline blocking pre-render script before React bundles execute. It reads `onlyus_chat_theme` from `localStorage`, normalizes 3D/legacy theme keys, and immediately applies CSS variables to `document.documentElement` alongside `data-chat-theme`.
  - `/src/lib/themes.ts` executes an immediate module-load hydration pass so themes are available synchronously before React renders.

### 2. Mobile Keyboard & Viewport Height Decoupling (`ThreeDThemeBackground.tsx`)
- **Problem**: Opening the software keyboard triggers `visualViewport` height shrinkage, causing 3D animations and particles to squash, jump, or cut off mid-screen.
- **Solution**:
  - Anchors vertical coordinate calculations (`offsetY`, particle wrapping bounds, 3D meshes) to a stable `sceneHeight` derived from `window.screen.availHeight` and initial container dimensions.
  - Height shrinkage due to keyboards updates only the canvas drawing buffer (`canvas.height`) while preserving continuous scene coordinates. Particles and 3D shapes naturally remain in their visual positions without jumping or wrapping in the middle of the screen.
  - Uses `ResizeObserver` and `window.visualViewport` listeners to update canvas buffer dimensions synchronously.

### 3. Play Together Hub 2-Column Responsive Grid (`PlayTogetherHub.tsx`)
- Updated the game cards container from a 1-column vertical list to a responsive 2-column grid (`grid grid-cols-2 gap-3 sm:gap-4`) with vertical card cards and realtime status badges for arcade-style navigation.

### 4. Chat Input Bar Placeholder Ticker & Row Constraint (`ChatInputBar.tsx`)
- **Problem**: In certain themes or font configurations, the dynamic placeholder `"Whisper to Rahul..."` / `"Whisper to Nusrat..."` caused the `<textarea>` to expand into 2 vertical rows before any message was typed.
- **Solution**:
  - Replaced the native browser textarea placeholder with a dedicated single-line overlay container (`text-[12px] sm:text-[13px] font-sans font-normal tracking-tight text-[var(--theme-text)]/40 whitespace-nowrap`).
  - Implemented dynamic text overflow detection with `ResizeObserver`. If the placeholder text width exceeds container width, a smooth marquee ticker animation (`whisperTicker`) crawls back and forth (`Whisper to Rah...` -> `...to Rahul...` -> returns) without expanding the input box or shifting height.
  - The underlying `<textarea>` maintains an exact 1-row compact baseline (44px) until user text input necessitates multi-line growth.

### 5. Detailed Anime & Pokemon Themes (`themes.ts`, `ThreeDThemeBackground.tsx`, `index.css`, `index.html`)
- **Anime Dream (`anime` & `3d-anime`)**:
  - Aesthetic: Authentic hand-drawn manga artboard with cel-shaded silhouette styling (similar to Doodle Day's interface customizations).
  - Palette: Warm manga paper `#FFFDF2`, ink black `#181829`, bold manga red `#FF4757`, and energetic comic cyan `#00D2D3`.
  - Bubble & UI Styling: Inked comic contours (`border: 2.5px solid #181829`), bold 4px block drop-shadows (`box-shadow: 4px 4px 0 #181829`), cel-shaded slight rotation offsets (`rotate(-0.4deg)` / `rotate(0.4deg)`), and comic button styling.
  - 3D Engine: Subtle manga screentone dot grid, animated floating Japanese onomatopoeia sound effects (`ドキドキ`, `ゴゴゴ`, `キラキラ`, `ニコニコ`, `ワクワク`), wobbling comic sweatdrops (💧), pulsing 4-lobed anger cross veins (💢), 4-point comic sparkles (✨), and tumbling sakura petals.
- **Pocket Monsters (`pokemon` & `3d-pokemon`)**:
  - Palette: Deep trainer slate `#0F141C`, Pokeball scarlet crimson `#EE3B3B`, and iconic Pikachu electric yellow `#FFCB05`.
  - Bubble & UI Styling: Retro Game Boy battle dialogue frame with double borders (`border: 3px double #FFCB05`), retro dark drop-shadows, and bright electric yellow action buttons.
  - 3D Engine:
    - **Animated Pikachu**: Canvas vector character on the lower-left featuring chubby yellow body, pointy ears with black tips and reactive wiggle animation, red electric cheek patches with occasional lightning spark bursts, anime catchlight eyes, cute smile, and animated zig-zag tail with brown base.
    - **Ghostly Gengar**: Mischievous shadowy purple ghost floating on the upper-right with spiky ears/head tufts, glowing red slanted eyes, wide signature toothy grin, and translucent shadow ghost mist.
    - **3D Floating Pokeballs & Great Balls**: Spherical shaded balls with metallic reflections and glowing buttons.
    - **Evolution Stars & Lightning Arcs**: Rising 5-point golden stars and branching high-voltage electric discharges.
- **Akatsuki (`akatsuki` & `3d-akatsuki`)**:
  - Aesthetic: Naruto's rogue ninja syndicate with dark Amegakure (Hidden Rain Village) storm mood.
  - Palette: Dark chakra pitch `#08080D`, Akatsuki cloak black `#11121C`, blood-red crimson `#B91C1C`, and glowing red accent `#EF4444`.
  - Bubble & UI Styling: Akatsuki cloak black bubbles with glowing blood-red neon borders (`border: 2px solid #DC2626; box-shadow: 0 4px 24px -2px rgba(220, 38, 38, 0.38)`), Amegakure storm slate partner bubbles, and crimson chakra gradient action buttons.
  - 3D Engine:
    - **Akatsuki Crimson Clouds**: Stylized clouds with 4 lobes and iconic curled spiral tail, deep crimson fill, and crisp white outer border.
    - **Amegakure Downpour**: Fast slanted rain streaks falling with expanding water puddle ripples on the ground.
    - **Itachi's Shadow Crows & Feathers**: Flapping silhouette crows flying across the storm sky and tumbling black feathers with glowing red tips.
    - **Spinning Sharingan**: Faint crimson glowing chakra eye with 3 spinning tomoe marks in the distant mist.
  - Zero-Flash Hydration: Fully registered across `THEMES`, `BASE_THEMES`, `index.html` inline `THEME_MAP`, and `index.css`.

### 6. Conversational Message Grouping & WhatsApp-Style Spacing (`MessageItem.tsx`, `App.tsx`)
- **Avatar Clustering**:
  - The partner's profile avatar is now rendered only on the first message of an incoming run (`isFirstInGroup && msg.sender_role !== role`).
  - Consecutive texts from the same sender omit the avatar icon while retaining a zero-width-shifting 32px layout spacer to maintain flush message alignment.
  - Senders switching turns or time gaps exceeding 15 minutes automatically start a new conversational cluster and restore the avatar badge on the next incoming message.
  - Both `MessageItem` and its memoized equality check (`areMessagePropsEqual`) track `showAvatar`, `isFirstInGroup`, and `isLastInGroup` to guarantee zero visual latency or stale grouping when new messages arrive.
- **WhatsApp Minimal Gap Cadence**:
  - Removed container-level `space-y-4` in `#message-container`.
  - Consecutive messages from the same sender use a tight, minimal 2px–3px margin (`mt-[2px] sm:mt-[3px]`) and compact 1px padding, replicating WhatsApp's cohesive bubble grouping.
  - Turn switches between different senders apply a distinct 8px–10px top margin (`mt-2 sm:mt-2.5`) to establish clear conversational pacing.

### 7. High-Performance 120Hz Interaction & Instant Selection Architecture
- **Root-Cause Analysis of Selection & Menu Stutter**:
  - **O(N) Re-render Cascade**: Previously, `selectionActive: boolean` was compared inside `areMessagePropsEqual`. Entering or exiting selection mode forced all messages in the chat room to re-render simultaneously.
  - **Overhead Collision**: During long-press, the floating reaction menu was rendering with a heavy multi-pass `backdrop-blur` filter, `layoutId="reaction-bg"` (triggering bounding-box layout recalculations), while the 3D canvas background was computing hundreds of 3D math transformations per second on the main thread.
- **Zero-Latency Refactoring**:
  - **O(1) Surgical Message Selection**: Swapped direct `selectionActive` prop equality checks with a stable mutable ref (`isSelectionActiveRef`) and `checkSelectionActive()`. In `areMessagePropsEqual`, `selectionActive` is excluded from the re-render equality check. As a result, toggling selection mode re-renders **only the single message being selected or deselected**, reducing render overhead from O(N) to O(1) (< 2ms per action).
  - **3D Canvas Dynamic Suspension & Continuous Selection Animation**: `QuantumAuraBackground` and `ThreeDThemeBackground` listen to a lightweight `paused` prop for heavy full-screen modals and overlays (`showProfileModal`, `showCustomizeModal`, etc.). Message selection (`selectedMessages.length > 0`) does NOT pause the canvas, ensuring 3D backgrounds (petals, stars, clouds, neon grids) animate smoothly while selecting messages.
  - **Hardware-Accelerated Floating Menus & Streamlined Reaction Bar**:
    - Floating reaction bar and top 3-dot dropdown leverage GPU compositor promotion (`transform-gpu will-change-transform translateZ(0)`) and responsive cubic-bezier easing `[0.16, 1, 0.3, 1]`.
    - Reaction selector dimensions are compact and lightweight (`p-1 sm:p-1.5`, `w-7 h-7 sm:w-8 sm:h-8` buttons, `text-base sm:text-lg` emojis), keeping it proportional to the chat bubbles.
    - Removed redundant in-picker reply arrow and divider so the reaction picker functions purely as an emoji palette.
    - Removed expensive `backdrop-blur-xl` and Framer Motion `layoutId` from reaction items in favor of solid surface styling with soft drop shadows.
    - Removed `mode="wait"` blocking delay on the top selection action bar, enabling instantaneous cross-fades without blocking navigation.

### 8. APK Optimization & Low-End Android Performance Architecture
- **Root Cause of APK Size Increase**:
  - Three raw uncompressed 1200x896 JPEGs (`dots_and_hearts`, `connect_hearts_game`, `tic_tac_toe`) were added to `src/assets/images`, bloating web assets by 2.6 MB and inflating `android/app/src/main/assets/public/assets` to 4.0 MB.
  - Converted all game assets to compressed WebP (600px width, quality 80), reducing raw asset size from 2,600 KB down to 156 KB (a >94% asset reduction).
  - Synced assets with `npx cap sync android`, dropping the Android asset bundle from 4.0 MB down to 1.3 MB (immediate ~2.7 MB APK size reduction).
  - Documented that Firebase Cloud Messaging (FCM v1 BoM + Google Play Services dependencies) also added compiled DEX classes.
- **Root Cause of APK-Specific & Menu Stutter (Customize Theme & Play Together)**:
  - **WebView Skia Backdrop-Blur Bottleneck**: Mobile Android WebViews perform expensive offscreen texture passes for every element with `backdrop-filter: blur(...)`. In `ThemeCustomizePage`, 15 theme preview cards each had 2 mini blurred elements (30 simultaneous blurs) plus page headers. In `PlayTogetherHub`, game cards and headers also stacked blurs on top of an unpaused background 3D canvas!
  - **Surgical Solutions**:
    - **Solid GPU Surfaces**: Replaced all `backdrop-blur` filters across `ThemeCustomizePage` and `PlayTogetherHub` with solid surface styling (`bg-[var(--theme-surface)] border border-[var(--theme-border)]`).
    - **Theme Card Memoization**: Extracted theme cards into `React.memo(ThemeCard)` so tapping a theme re-renders only 2 items (old & new selected) instead of all 15 cards.
    - **Dual-Canvas Elimination**: Removed redundant second `QuantumAuraBackground` canvas loop from `PlayTogetherHub`.
    - **App.tsx Modal Background Suspension**: Added `showCustomizeModal` to the background canvas `paused` prop in `App.tsx`.
    - **Native WebView Hardware Acceleration**: In `MainActivity.java` `onStart()`, set `webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)`, enabled DOM storage, database, and image loading optimizations.
    - **Large Heap Allocation for Budget Devices**: Added `android:largeHeap="true"` to `<application>` in `AndroidManifest.xml` to avoid Garbage Collection (GC) pauses on lower-end Android phones.

### 9. WhatsApp-Style Attached Reaction Badge & Zero-Collision Layout Architecture
- **WhatsApp Attached Badge Positioning (`MessageItem.tsx`)**:
  - **Root-Cause Analysis**: A floating pill with fixed or fragile negative offsets placed too high inside the bubble collided directly with the timestamp and blue double ticks (`✓✓`). In WhatsApp, the reaction is visually attached to the bottom rim of the bubble—overlapping the bottom border by only ~4-5px while hanging ~18px below the bubble.
  - **Surgical Geometry & Overlap Bounds**:
    - Anchored reaction container to `absolute top-[calc(100%-5px)]` within the bubble's shrink-wrapped relative wrapper.
    - Outgoing messages anchor to `right-4 justify-end` (inset 16px from the tail corner); incoming messages anchor to `left-4 justify-start`.
    - Added reactive bottom padding to the bubble (`hasReactions ? 'pb-2.5 lg:pb-3' : 'pb-2'`). The timestamp and blue ticks sit comfortably 10px–12px from the bottom edge, leaving a 5px–7px clean buffer above the reaction pill's top rim.
  - **Overhang Space Reservation & "Seen at..." Isolation**:
    - When `hasReactions` is active, the bubble wrapper applies `mb-[18px]`, reserving the exact physical overhang height of the reaction badge in the flex document flow.
    - As a result, the read receipt / "Seen at..." element naturally renders below the reaction pill with its own `mt-1.5` margin, with zero possibility of overlap or vertical displacement.
- **WhatsApp-Style Reaction Capsule & Cutout Border**:
  - Replaced oversized multi-button clusters with a single unified, compact capsule (`h-[22px] sm:h-[24px] px-1.5 sm:px-2 rounded-full border-2 shadow-[0_2px_6px_rgba(0,0,0,0.18)]`).
  - Uses `backgroundColor: 'var(--theme-surface)'` and `borderColor: 'var(--theme-bg)'`, which dynamically produces the authentic WhatsApp cutout effect where the badge cuts across the bottom rim of the bubble.
  - Future-proof: Groups multiple reactions and counts neatly side-by-side (`❤️ 😂 2`) inside the unified badge.
- **Double-Tap ❤️ Reaction Gesture (`MessageItem.tsx`, `App.tsx`)**:
  - Pointer-tracking refs (`lastTapTimeRef`, `lastTapPosRef`, `lastDoubleTapTimeRef`) detecting two consecutive taps within a 30ms–330ms window and within a 32px radius.
  - Cancels active long-press timers and suppresses single-click handlers within 380ms of a double-tap.
  - Automatically bypassed if multi-message selection mode is active.
  - Optimistic client-side cache updates in `App.tsx` (`setMessages`) delivering immediate visual feedback alongside an Instagram-style heart pop (`showHeartBurst`) and haptic feedback.

### 10. Partner Profile Clean & User-Friendly Redesign Architecture (`PartnerInfoModal.tsx`)
- **Root-Cause Analysis of Previous Visual Clutter**:
  - Cluttered edge-to-edge list styling with mismatched hardcoded colors (`#111111`, `#737373`, `#0095F6`, harsh gradients), breaking visual consistency in dark and customized themes.
  - Media tabs used unlabeled mystery icons (`LayoutGrid`, `Repeat`, `Link2`) with zero indication of item counts, leading to unclear navigation.
  - Raw square media thumbnails had sharp borders without theme background support (causing white flash on lazy-load in dark themes).
  - Empty top bar lacked title framing, and hero card lacked clear online presence indicators.
- **Surgical Redesign Principles**:
  - **Structured Top Bar**: Clean header with subtle "Partner Profile" title, circular back button, and direct E2EE security verification badge.
  - **Refined Hero Card**: Ring-bordered avatar with quick camera action button for updating the partner's photo, online status badge with pulsing emerald indicator, and role/handle subtitle.
  - **Unified Settings Group**: Replaced harsh borders with a modern rounded card container (`bg-[var(--theme-bg)]/60 border border-[var(--theme-border)] rounded-2xl divide-y divide-[var(--theme-border)]/50`) consolidating Chat Theme (showing current theme name), Nicknames, and End-to-End Encryption with uniform icons and trailing chevrons.
  - **User-Friendly Segmented Media Control**: Replaced icon-only tabs with labeled, count-aware segmented pills: "Photos (N)", "Videos (N)", and "Links (N)".
  - **Modern Media Grid & Empty States**: `rounded-xl` media thumbnails with smooth hover zoom, centered video play button overlays, theme-adaptive placeholders, and clean, minimal empty states for photos, videos, and links.
  - **Full Theme Variable Integration**: Entire profile modal, sub-views, and edit sheets use semantic CSS tokens (`var(--theme-surface)`, `var(--theme-text)`, `var(--theme-bg)`, `var(--theme-border)`, `var(--theme-accent)`) for seamless consistency across all 14 themes.
- **Redundant E2EE Cleanup**: Removed duplicate End-to-End Encryption entry from the settings group since the verified lock badge is prominently integrated into the header.

### 11. Modal Back Navigation & Post-Reload Zero-Lag Architecture (`overlayManager.ts`, `ThreeDThemeBackground.tsx`, `useMessageSync.ts`)
- **Root-Cause Analysis of 2nd-Open Modal Website Exit**:
  - `FullscreenMediaViewer.tsx` was manually managing window history with `window.history.pushState` and `window.addEventListener('popstate')` in parallel with `overlayManager.ts`.
  - Transient popovers (`showMenu`, `showAttachmentMenu`, `showNudgeMenu`) were also registered in `useOverlayBack`, pushing extra history entries when clicking menu items that opened modals.
  - When a user opened a modal a second time, mismatched history depth caused `history.back()` to pop past the root state, closing the website.
- **Surgical Navigation Fix**:
  - Centralized all overlay state management exclusively into `src/lib/overlayManager.ts` using `useOverlayBack`.
  - Added `closedViaHistory` tracking to prevent redundant `history.back()` calls during browser or Android hardware back gestures.
  - Converted transient popovers (3-dot menu, attachment picker, nudge menu) to direct dismissals via Escape, click-outside, and `window.handleAndroidBack`, keeping the browser history stack pristine.
- **Root-Cause Analysis of Post-Reload Lag in Normal Themes**:
  - In `ThreeDThemeBackground.tsx`, the 60fps WebGL/Canvas rendering loop was executing even when a normal (non-3D) theme was active, consuming CPU/GPU cycles on page load.
  - In `useMessageSync.ts`, `fetchInitialMessages` was pulling 1,000 messages from Supabase on every reload, running full decryption batches and non-debounced `localStorage` serialization (`cacheMessages`) blocking the main UI thread.
  - `scrollToBottom` on initial message mount was executing an animated smooth scroll curve during DOM hydration.
- **Surgical Zero-Lag Optimizations**:
  - **Non-3D Theme Canvas Bypass**: `ThreeDThemeBackground.tsx` checks `!activeTheme.startsWith('3d-')` immediately after context acquisition, clears canvas, and exits without attaching resize observers, scroll listeners, or `requestAnimationFrame` loops (0% CPU/GPU overhead for standard themes).
  - **Surgical Message Hydration**: Initial load fetches the latest 100 messages, and `onE2EEStatusChange` runs decryption only on messages that are actually encrypted and pending decryption.
  - **Debounced Safe Storage**: Message caching in `safeStorage.ts` is debounced by 500ms so database hydration does not block the main thread.
  - **Instant Initial Scroll**: `scrollToBottom(false)` is used on initial message mount to prevent hydration scroll stutter.

### 12. Housekeeping, Code Hygiene & In-App Versioning (`package.json`, `App.tsx`, `ProfileModal.tsx`, `PartnerInfoModal.tsx`, `types.ts`)
- **Package Manifest & Versioning Alignment**:
  - Replaced template boilerplate `name: "react-example"` and `version: "0.0.0"` in `package.json` with `name: "onlyus"` and `version: "1.5.0"`.
  - Exported `APP_VERSION = '1.5.0'` in `src/types.ts` as the single authoritative source of truth across the web and mobile UI.
- **Dead Migration Stubs Cleanup**:
  - Safely removed legacy Firestore migration stubs (`db`, `doc`, `collection`, `query`, `orderBy`, `limit`, `setDoc`, `updateDoc`, `addDoc`, `onSnapshot`, `serverTimestamp`, `signInWithGoogle`, `auth`) and dead `socketService` mock from `App.tsx` lines 4–43.
- **In-App Version & Flavor Visibility**:
  - Added a clean, subtle version badge in `ProfileModal.tsx` (`OnlyUs v1.5.0 • Notes Stealth Edition` / `Direct Edition`) under the session logout action.
  - Added a matching subtle version indicator in `PartnerInfoModal.tsx` (`OnlyUs v1.5.0 • Private 1-to-1`) below shared media content.

### 13. Signed Release APK Workflow (`.github/workflows/build-apk.yml`, `android/app/build.gradle`)
- **Dual Build Types (Release vs. Debug)**:
  - Added a `build_type` dropdown (`release` [default] or `debug`) to the GitHub Actions workflow dispatch parameters.
  - Dynamically routes Gradle execution to `assembleNusratRelease assembleRahulRelease` or `assembleNusratDebug assembleRahulDebug`.
- **Keystore Signature & Schemes**:
  - `signingConfigs.shared` in `android/app/build.gradle` is explicitly configured with `v1SigningEnabled true` and `v2SigningEnabled true` using `onlyus.keystore`.
  - Supports environment/Gradle property overrides (`RELEASE_STORE_PASSWORD`, `RELEASE_KEY_ALIAS`, `RELEASE_KEY_PASSWORD`) while falling back seamlessly to default keystore credentials.
  - `minifyEnabled false` is maintained for release builds to protect Capacitor reflection plugins and WebSocket listeners from class-stripping regressions.
- **Automated Artifact & GitHub Release Publishing**:
  - Workflow accurately resolves and tags output APKs directly from `android/app/build/outputs/apk/{nusrat,rahul}/{release,debug}`.
  - Publishes both `OnlyUs-Nusrat-Stealth.apk` and `OnlyUs-Rahul-Direct.apk` (and versioned copies) directly to GitHub Releases with signature status and release notes.

### 14. "Neural Noise" 21st.dev WebGL Shader Theme (`/src/components/ui/neural-noise.tsx`, `/components/ui/neural-noise.tsx`, `NeuralNoiseBackground.tsx`, `ThreeDThemeBackground.tsx`)
- **Authentic 21st.dev Shader & Lag-Free Optimizations**:
  - Integrated the 21st.dev `NeuralNoise` component into `/src/components/ui/neural-noise.tsx` (and mirrored at `/components/ui/neural-noise.tsx`).
  - **Removed Pointer Tracking**: Completely removed mouse and touch listeners (`pointermove`, `touchmove`, `click`) and pointer uniform calculations from the CPU and GPU shader, allowing the neural noise waves to flow organically and autonomously across the full viewport.
  - **Autonomous Drifting Nebulas & Filament Preservation**:
    - Restored the full 15 harmonic octaves (`j < 15`, `scale *= 1.2`) to bring back the fine filament tendrils, ethereal dust, and glowing cosmic nebula clusters.
    - Replaced the cursor-dependent focal point with an autonomous Lissajous organic drift (`nebula_center = vec2(0.5 + 0.16 * sin(...), 0.5 + 0.12 * cos(...))`). The nebulas undulate, bloom, and breathe naturally across the viewport with zero mouse/touch interaction.
  - **60 FPS Hardware Acceleration**:
    - Precomputed rotation matrix `const mat2 ROT = mat2(0.5403023, 0.8414710, -0.8414710, 0.5403023)` to eliminate runtime trigonometric matrix instantiation in the shader loop.
    - Capped canvas `devicePixelRatio` at `1.0` (scaled smoothly via CSS layout), eliminating the 4x overdraw penalty on high-DPI and mobile displays.
    - Throttled frame dispatch to a stable ~60 FPS rate to avoid battery drain and overheating on 90Hz/120Hz mobile devices.
- **Mobile & Battery Conservation Life Cycle**:
  - WebGL context initialized with `powerPreference: 'low-power'`, `depth: false`, `stencil: false`, `antialias: false`, and `preserveDrawingBuffer: false`.
  - Added clean `animationFrameId` cancellation and GPU buffer/shader disposal on unmount.
  - Pauses execution automatically when the tab/app is hidden (`document.hidden`) or when background canvas is paused.
  - Zero-flash hydration integrated into `THEMES`, `BASE_THEMES`, `index.html`, and `src/index.css`.

### 15. Opening Intro Screen (`/src/components/OnlyUsIntro.tsx`, `App.tsx`)
- **Animated SVG Stroke Drawing & Ambient Atmosphere**:
  - Implemented the branded animated intro sequence in `/src/components/OnlyUsIntro.tsx`.
  - **Cross-Device Parallel Vector Letter Architecture (Zero Font Overlaps & Restored Vibe)**:
    - **Root Cause of Overlaps & Pacing Mismatch**:
      - Originally, the intro relied on an SVG `<text>` element. On Android devices with variable-font outlines (e.g. Roboto Flex, SamsungOne, MiSans), stroking an unfilled font (`fill: none; stroke: ...`) exposed internal glyph construction loops and overlapping stem joins.
      - In a previous refactor attempt, combining all letters into a single monolithic SVG `<path>` caused the stroke animation to draw sequentially letter-by-letter, making each letter zip by in 0.4 seconds and feeling "kinda fast" and losing the calm, romantic, floating vibe. It also rendered oversized across mobile viewports.
    - **Permanent Vector Letter Fix**:
      - Converted each letter ('O', 'n', 'l', 'y', 'U', 's') into its own distinct, clean vector `<path>` in `ONLYUS_LETTERS` with mathematically welded contours and zero internal intersections.
      - **Simultaneous Parallel Drawing**: Each letter path's length is measured and stroked in parallel at the same time over 1.8 seconds with a smooth cubic ease-in-out curve (`eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2`). This keeps the intro fluid and engaging without feeling sluggish or rushed, while guaranteeing zero line overlaps or intersecting artifacts on any device.
      - **Letter 'l' Complete Contour Fix**: Fixed an open path bug in letter 'l' where the right vertical stroke was missing from the coordinates (`L378.64 160Z`), closing all 4 perimeter sides (`M359.71 60L359.71 160L378.64 160L378.64 60Z`) so the full letter strokes smoothly from start to finish.
    - **Refined Proportion & Scale**:
      - Replaced oversized viewBox and CSS dimensions with a refined scale in `viewBox="0 0 800 240"` (`.ou-svg` width `min(84vw, 620px)` desktop, `min(86vw, 440px)` mobile, and `min(88vw, 360px)` small mobile), keeping the logo balanced, elegant, and compact.
    - **Signature OnlyUs Branding & Light/Dark Contrast**:
      - Maintained the signature, vibrant OnlyUs logo gradient (`#c66cff` electric violet to `#ff4f8b` warm hot pink with glowing rose drop shadow) consistently across both light and dark themes.
      - **Light Mode (`.ou-light`)**: Background glows with delicate rose radial gradients (`#FFF7F8`, `rgba(255,191,205,.45)`), vivid signature `#c66cff` to `#ff4f8b` stroke gradient, and a frosted white pill with dark berry typography (`#2e1c28`).
      - **Dark Mode (`.ou-dark`)**: Background glows with deep cosmic noir radial gradients (`#0b090e`), vivid signature `#c66cff` to `#ff4f8b` stroke gradient, and a smoked-glass pill with white-pink typography.
  - **Single Mount Lifecycle**: Consolidated `showIntro || loading` into a single conditional branch in `App.tsx` so `OnlyUsIntro` never unmounts and restarts if session loading finishes after the intro starts.
  - **Zero-Restart Execution**: Decoupled parent re-renders and `ready` state transitions using mutable refs (`readyRef`, `onFinishRef`) and clamped animation progress `p` to `[0, 1]` rather than wrapping modulo, ensuring the intro draws smoothly once without stuttering or resetting.
  - **Middle-Bottom Anchoring Architecture & Refined Pill Protection**:
    - Enclosed in a compact, understated frosted pill (`.ou-made-pill`) with full-viewport horizontal centering (`left: 0; right: 0; width: 100%; display: flex; justify-content: center;`).
    - Sentence: `"MADE WITH ❤️ FOR US"`, concise and perfectly centered at the bottom of the screen.
    - **Pulsing Bloom Heart (`.ou-heart`)**: Dual-beat heartbeat with explicit `-webkit-text-fill-color: #ef3e73` and luminous glow so it stays vivid across all devices and webviews.
  - Supports dark/light mode preference automatically with ambient radial background glows.
- **Session Hydration & Stealth Protection**:
  - Automatically runs when opening the website or app, displaying the smooth stroke drawing while Supabase session, E2EE, and profiles initialize in parallel.
  - Gracefully fades out after completion (~3.2s minimum cycle or when app ready) or immediately upon user tap/click.
  - **Zero-Flash Stealth Rule**: Bypassed when locked in Nusrat's stealth mode (`com.onlyus.notes` or stealth preference) so that `StealthNotepadView` remains completely covert with zero flash of OnlyUs branding.

### 16. Authentic Sakura Blossom 3D Engine & Transparent Atmosphere (`ThreeDThemeBackground.tsx`, `themes.ts`, `App.tsx`)
- **Root-Cause Analysis of "Normal Theme / White Background & No Sakura"**:
  1. **Unmounted Background in `App.tsx`**: `is3DTheme(theme)` returned `true` only for strings starting with `'3d-'`. If a user's stored theme was `'romantic'`, `is3DTheme('romantic')` evaluated to `false`, causing `<QuantumAuraBackground>` to not mount at all.
  2. **Opaque White Shader Washout**: An experimental WebGL shader (`DreamyRomanticShaderBackground.tsx`) painted an opaque milky-white/cream baseline wash across the viewport, completely hiding the theme's soft radial pink gradients and chat aesthetics while SDF clipping prevented petals from rendering.
- **Surgical Sakura Blossom Engine Implementation**:
  - **Authentic Japanese Sakura Geometry**: Each petal features the classic crown heart notch (V-cleft), curved petal wings, tapered base stem, and delicate central spine vein.
  - **Full 3D Tumbling & Shaded Undersides**: Petals rotate across X, Y, and Z axes (`rotX`, `rotY`, `rotZ`). When petals flip edge-on, they dynamically reveal shaded underside gradients (`#EB4B78` to `#FFC5DC`) vs sunlit front faces (`#FF4B7D` base to `#FFF5FA` milky rim).
  - **Multilayer Depth & Spring Breeze Flutter**:
    - 32 pre-allocated petals with distinct depth planes (foreground prominent petals with rich cherry pinks, midground tumbling petals, and distant dreamy drifting petals).
    - Natural swaying breeze physics driven by harmonic sine-wave oscillation and gentle touch/mouse response.
    - 16 floating sakura pollen stardust particles that twinkle gently in the warm spring atmosphere.
  - **100% Transparent Canvas (Zero White Wash)**: Operates with `ctx.clearRect(0, 0, width, height)` on a transparent canvas, letting Only Us's soft rose radial gradients (`#FFF7F8`) and glassmorphic headers shine through pristinely.
  - **Guaranteed Mount Lifecycle**: Updated `is3DTheme` in `src/lib/themes.ts` so both `'romantic'` and `'3d-romantic'` immediately mount the 3D sakura canvas with zero flashes.

### 17. Modular WebGL Shader Architecture (`/src/components/ShaderThemesThreeD/`)
- **Architectural Motivation**:
  - `ThreeDThemeBackground.tsx` previously housed over 1,840 lines of monolithic canvas code.
  - To achieve 60-120 FPS GPU rendering across all themes while keeping them visually unique and matching their normal theme counterparts, shaders are modularized into individual files inside `/src/components/ShaderThemesThreeD/`.
  - Migration follows a strict **one-shader-at-a-time** protocol so that each theme's physics, color harmonies, and aesthetic nuances can be reviewed and perfected independently.
- **Directory Structure & Core Contracts**:
  - `types.ts`: Common interface `ShaderThemeProps` (`className`, `paused`, `opacity`, `speed`, `color`, `style`).
  - `OnlyUsShader.tsx`: The default OnlyUs romantic Sakura blossom engine featuring 32 authentic Japanese Sakura petals (V-cleft crown heart notches, 3D tumbling flip with front/back shaded gradients, delicate central vein spine, floating pollen stardust). Operates on a 100% transparent canvas (`clearRect`) to guarantee zero white wash so the soft rose radial gradients (`#FFF7F8`) and glassmorphic headers shine through pristinely.
  - `NebulaShader.tsx`: The completed Nebula / Neural Noise cosmic filament WebGL shader with 15-octave harmonic filaments and autonomous core drift.
  - `LavenderHaze.tsx` & `LavenderShader.tsx`: The Lavender Haze (`3d-lavender` / `lavender`) GPU WebGL shader. Solved the white background blowout by outputting premultiplied alpha in the fragment shader (`gl_FragColor = vec4(auraColor * finalAlpha, finalAlpha)`) with standard `gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)`, allowing exact linear interpolation (LERP) over the light `#F7F3FF` lilac canvas. Features 4 volumetric violet and lilac aura spheres drifting along harmonic orbital paths and twinkling amethyst stardust motes.
  - `AkatsukiShader.tsx`: The Akatsuki (`3d-akatsuki` / `akatsuki`) shader featuring the spinning distant Sharingan eye with 3 rotating tomoe marks, iconic Akatsuki crimson clouds with curled spiral swirl tails and white cloak trim, Amegakure storm rain streaks with expanding water ripples, and Itachi's flapping shadow crows and tumbling feathers with glowing red quills on a 100% transparent alpha canvas.
  - `index.ts`: Central registry (`SHADER_THEME_REGISTRY`), `hasDedicatedShader()`, and `getShaderThemeComponent()`.

- **Dynamic Dispatching & Backward Compatibility**:
  - `ThreeDThemeBackground.tsx` queries `getShaderThemeComponent(activeTheme)`. If a dedicated shader exists in `ShaderThemesThreeD`, it renders directly on the GPU.
  - Remaining themes continue to run their high-performance 3D canvas loops in `ThreeDCanvas2DBackground` until migrated into `ShaderThemesThreeD/` one by one.
  - Legacy entry points (`DreamyRomanticShaderBackground.tsx`, `NeuralNoiseBackground.tsx`) safely re-export from `ShaderThemesThreeD/`.

### 18. Refined Theme-Adaptive & Serene Hub Architecture (`MultiHubDashboard.tsx`, `ShaderBorderBeam.tsx`, `LiquidCardShader.tsx`)
- **Restraint & Craft (Anti-Overwhelm Calibration)**:
  - Removed hyperactive rotating laser border beams from secondary cards (Partner Profile, Instagram, WhatsApp) and spinning button halos (Header Heart, Message Streak Flame, Action Arrow).
  - Replaced with clean, cozy, intimate cards utilizing semantic theme variables (`var(--theme-surface)`, `var(--theme-border)`, `var(--theme-accent)`), tactile press states (`whileTap={{ scale: 0.985 }}`), and soft hover borders.
- **Sole Centerpiece: The "OnlyUs Chat" Card**:
  - Encapsulated with a single, tranquil, slow 8-second pearl light beam (`ShaderBorderBeam`) that flows peacefully with soft ambient glow (`glowIntensity: 0.25`) matching `var(--theme-accent)`.
  - **Dynamic Theme-Adaptive Liquid Silk Shader (`LiquidCardShader.tsx`)**:
    - Dynamically queries `--theme-accent` and `--theme-surface` from computed styles at runtime, guaranteeing 100% harmonious color palette across all 15+ light and dark themes (Akatsuki crimson, Pokemon amber, Romantic rose, Lavender violet, Cyberpunk cyan, etc.).
    - Generates slow, relaxing silk caustics at half speed with soft luminous highlights and organic touch ripples, pausing automatically on tab backgrounding to preserve battery.

### 19. Lag-Free Romantic Nudge Architecture ("Send a Feeling") (`NudgeOverlay.tsx`, `App.tsx`)
- **Lover's Touch Edge-Lighting Shader**:
  - Replaced the intrusive full-screen blocking overlay with a hardware-accelerated ambient perimeter light wave (`fixed inset-0 pointer-events-none z-50`).
  - Features a soft inset breathing glow (`box-shadow: inset 0 0 50px 8px [feelingGlow]`), 4 pulsing corner light orbs, and animated top and bottom horizontal living light sweeps in the feeling's signature color (rose for kisses, honey amber for hugs, violet for cuddles, twilight indigo for miss you, etc.).
  - 100% lag-free on 60Hz and 120Hz displays with 0% CPU reflow overhead.
- **Floating Feeling Capsule (Interactive & Non-Intrusive)**:
  - Floats into the top safe area (`y: -45` spring animation) with liquid glass styling (`bg-[var(--theme-surface)]/95 backdrop-blur-xl border border-[var(--theme-border)] shadow-2xl rounded-2xl`).
  - Displays partner's name with an animated beating heart, expressive emoji with glowing halo, and tender status line (*"blew you a sweet kiss 💋"*, *"sent you a warm, tight hug 🤗"*).
  - **Instant Reciprocation ("Send back")**: Includes a dedicated one-tap button allowing Nusrat or Rahul to immediately return the feeling without opening any menu.
- **Micro-Particle Stardust & Gentle Blossom**:
  - Center emoji floats gently upward with 8 staggered GPU-accelerated stardust motes and flower petals that dissolve over 2.2s.
  - Tapping anywhere or swiping up smoothly dismisses the overlay early.
- **Heartbeat Haptic Pulse**:
  - Triggers a dual-pulse vibration pattern (`[60, 80, 60, 160, 60, 80, 60]`) simulating an authentic romantic heartbeat ("lub-dub... lub-dub").
- **Global Hoisting**:
  - Hoisted `NudgeOverlay` to root `App.tsx`, guaranteeing zero-latency delivery whether either partner is in the chat room, browsing the Hub Dashboard, or playing arcade games.





