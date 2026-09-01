# 💖 OnlyUs V3 — Private 1-to-1 Couple Hub & Realtime Chat

**OnlyUs** is a private, bespoke 1-to-1 couple companion web application designed specifically for **Rahul** and **Nusrat**. It combines zero-latency messaging, realtime feelings & nudges, shared interactive games, an Instagram-inspired partner profile with media vault, and a unified Multi-Hub dashboard.

---

## 🌟 Key Features & Architecture

### 1. 🎛️ Multi-Hub Dashboard
* **Central Couple Launchpad**: Displays partner online status, real-time presence indicators, unread counts, and quick-action launcher cards.
* **Private Chat**: Direct entry into the realtime encrypted 1-to-1 chat room.
* **External Hub Launchers**:
  * **Instagram Companion**: Seamless launcher for Reels, Stories, and DMs with Android APK bridge detection.
  * **WhatsApp Web Companion**: Includes a step-by-step 8-digit mobile phone number pairing guide for linking devices without scanning QR codes.

---

### 2. 🔐 Symmetric Dual-User Authentication
* **Owner Login (Rahul)**:
  * Seamless Google OAuth authentication.
  * Automatic assignment of the `owner` role tied to `bodruddoja4@gmail.com`.
  * Administrative access to update partner passcodes, manage allowed emails, and configure application settings.
* **Partner Login (Nusrat)**:
  * Instant 6-digit PIN authentication (default: `123456`, customizable by Owner).
  * Alternative Google Auth login for authorized partner email addresses.
  * Full symmetrical access to chat history, media, settings, themes, and interactive games.

---

### 3. 💬 Realtime Messaging & Chat Engine
* **Supabase Postgres Changes**: Instant message delivery, edits, and deletions via PostgreSQL change feeds without polling.
* **Rich Message Actions**:
  * **Emoji Reactions**: Tap-and-hold reaction dock with instant sync for both partners.
  * **Swipe-to-Reply**: Direct contextual quoting for replies.
  * **Inline Editing & Soft Delete**: Full support for "Edit Message", "Delete for Me", and "Delete for Everyone".
  * **Optimistic UI Updates**: Immediate message bubble rendering with automatic background sync and error retry.
* **Media & Image Sharing**:
  * Client-side image optimization using `browser-image-compression` for fast upload speeds.
  * Interactive image previews with full-screen lightbox viewing.
* **Accurate Online Presence & Typing Indicators**:
  * Supabase Realtime Presence tracking with automatic 30-second heartbeat active window.
  * Human-readable relative status indicators (*"Online"*, *"Last seen just now"*, *"Last seen X minutes ago"*, *"Last seen today at [time]"*, *"Last seen yesterday at [time]"*).
  * Broadcast-based live typing feedback.

---

### 4. 💌 Feelings & Nudges
* **Interactive Full-Screen Celebrations**:
  * Send one-tap feelings: **Hugs**, **Kisses**, **Tickles**, **Miss Yous**, and **Floating Hearts**.
  * Dynamic animated overlays with floating emojis and celebratory particle effects.
  * WhatsApp-style double vibration pulses on mobile devices via the HTML5 Vibration API.
  * Broadcast acknowledgement ensures feelings triggered from either account pop up immediately on the partner's screen.

---

### 5. 🎨 Curated Chat Themes
Six custom moods crafted with tailored color palettes, ambient decorations, custom typography, and unique bubble geometries:
1. **Only Us** (*Romantic*): Soft rose curves, warm gradients, and signature pink styling.
2. **Clean Slate** (*Light*): Crisp, bright, and minimal with cool neutral tones.
3. **Moonlight** (*Dark*): A nighttime chat with glowing edges and dark violet surfaces.
4. **Lavender Haze** (*Lavender*): Velvety violet layers with classic serif typography.
5. **Ocean Eyes** (*Ocean*): Cool aquamarine tones and gentle wave aesthetics.
6. **Soft Bloom** (*Sunset*): Warm peach and golden hour tones with elegant styling.

Themes are synchronized with Supabase and persist across sessions and devices.

---

### 6. 📸 Instagram-Style Partner Profile & Shared Media
* **Profile & Nicknames**:
  * Large circular profile picture with upload and crop capabilities (`react-easy-crop`).
  * Custom nickname editor with single-tap couple emoji suggestions (🥺, 🫶🏻, 💋, 💖, 🥰, 🍯, 🧸, 👑).
* **Shared Media Vault (3-Tab Gallery)**:
  * **Photos**: 3-column square photo grid extracted directly from shared chat history.
  * **Reels / Clips**: Video and multimedia attachments gallery.
  * **Links**: Clean list of all shared hyperlinks and web previews.

---

### 7. 🎮 Live Multiplayer Mini-Games
* **Realtime Tic-Tac-Toe**:
  * In-chat interactive game invites.
  * Turn-based board state synchronized in realtime over Supabase.
  * Automatic win and draw detection with rematch controls.

---

## 📱 Companion Native Android APKs

The OnlyUs ecosystem is complemented by two bespoke native Android APKs built for each partner's distinct workflow and privacy needs:

### 1. 🥷 Nusrat's Stealth Private APK
* **Design Philosophy**: Ultimate privacy, discreet identity, and stealth operation on device.
* **Key Characteristics**:
  * **Discreet Presence**: Custom disguised launcher icon and benign app naming to maintain total confidentiality on shared or scrutinized devices.
  * **Fast Access**: 6-digit PIN-based authentication (`partner_passcode`) with biometric unlocking option.
  * **Native Hardware Back Bridge**: Seamless navigation handling via `window.handleAndroidBack()` ensuring smooth return to dashboard without accidental exits.
  * **Full Hub Access**: Direct integration with the private chat, Instagram companion, and WhatsApp launcher.

### 2. ⚡ Rahul's WhatsApp-Style Instant Notifier APK
* **Design Philosophy**: High-visibility real-time communication, heads-up notifications, and immediate actionability.
* **Key Characteristics**:
  * **Authentic Branding**: Full "OnlyUs" visual identity with high-res couple launcher icon.
  * **WhatsApp-Style Push Notifications**: Foreground & background service connecting to Supabase Realtime and Firebase Cloud Messaging (FCM). Receives instant heads-up alerts with sound, vibration, and Nusrat's avatar when she messages.
  * **Inline Quick Reply (`RemoteInput`)**: Reply directly from the Android notification shade without opening the app — answers are dispatched directly into the Supabase database.
  * **Direct-to-Chat Deep Linking**: Tapping any notification opens the app immediately with `?tab=chat` to land right in the conversation.
  * **Bi-directional Bridge**: Features `AndroidBridge.onNewMessage` and `window.sendNativeDirectReply` hooks.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Build Tooling** | [Vite 6](https://vite.dev/) |
| **Styling & Design** | [Tailwind CSS 4](https://tailwindcss.com/) + CSS Custom Properties |
| **Animations** | [Motion (Framer Motion)](https://motion.dev/) |
| **Database & Realtime** | [Supabase](https://supabase.com/) (PostgreSQL, Realtime Presence & Broadcast, Storage) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Image Utilities** | `browser-image-compression`, `react-easy-crop` |

---

## 🗄️ Database Architecture & Schema

### `app_config` Table
| Column | Type | Description |
|---|---|---|
| `id` | `text` (PK) | Configuration identifier (e.g. `'main'`) |
| `owner_email` | `text` | Master email with admin privileges (`bodruddoja4@gmail.com`) |
| `partner_allowed_emails` | `text[]` | Whitelisted Google Auth emails for Nusrat |
| `partner_passcode` | `text` | 6-digit PIN passcode for partner authentication |

### `users` Table
| Column | Type | Description |
|---|---|---|
| `id` | `text` (PK) | Unique user ID or Auth UID |
| `email` | `text` | User email address |
| `role` | `text` | `'owner'` or `'partner'` |
| `display_name` | `text` | Display name (Rahul / Nusrat) |
| `photo_url` | `text` | Avatar image URL or base64 data URI |
| `theme` | `text` | Active theme (`'romantic'`, `'light'`, `'dark'`, `'lavender'`, `'ocean'`, `'sunset'`) |
| `partnerNicknames` | `jsonb` | Map of partner UIDs to custom assigned nicknames |
| `last_seen` | `timestamp` | Timestamp of last heartbeat activity |
| `last_read_at` | `timestamp` | Read-receipt synchronization timestamp |

### `messages` Table
| Column | Type | Description |
|---|---|---|
| `id` | `text` (PK) | Unique message ID |
| `sender_role` | `text` | `'owner'` or `'partner'` |
| `text` | `text` | Message content (text or image data) |
| `timestamp` | `timestamp` | Message creation time |
| `reactions` | `jsonb` | Map of user roles to selected emoji reactions |
| `replyTo` | `jsonb` | Quoted message reference `{ id, text, sender_role }` |
| `isEdited` | `boolean` | Flag indicating whether the message has been edited |
| `deleted` | `boolean` | Flag indicating whether the message is deleted for everyone |
| `hidden_for_owner` | `boolean` | Soft delete flag for the owner |
| `hidden_for_partner` | `boolean` | Soft delete flag for the partner |
| `media` | `jsonb` | Shared media metadata, including the public Storage URL and media type |
| `attachment_url` | `text` | Backward-compatible media URL used to hydrate older photo messages |
| `gameInvite` | `jsonb` | Interactive game session data `{ gameType, sessionId, status }` |

### `games` Table
| Column | Type | Description |
|---|---|---|
| `id` | `text` (PK) | Game session ID |
| `board` | `text[]` | 9-element array representing Tic-Tac-Toe grid |
| `turn` | `text` | Current player turn (`'owner'` or `'partner'`) |
| `winner` | `text` | Winning player or `'draw'` |
| `status` | `text` | `'playing'` or `'finished'` |

---

## 🚀 Getting Started

### 1. Prerequisites
* [Node.js](https://nodejs.org/) (version 18 or higher)
* [npm](https://www.npmjs.com/) or [bun](https://bun.sh/)

### 2. Environment Configuration
Create a `.env` file in the root directory (based on `.env.example`):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Installation
```bash
# Install project dependencies
npm install
```

### 4. Development Server
```bash
# Start Vite development server on port 3000
npm run dev
```

### 5. Production Build
```bash
# Build for production
npm run build

# Preview production build locally
npm run preview
```

---

## 📂 Project Structure

```
├── public/                     # Static assets and icons
├── src/
│   ├── components/
│   │   ├── ErrorBoundary.tsx      # Application crash recovery boundary
│   │   ├── ExternalHubView.tsx    # Instagram & WhatsApp Web launcher with pairing guide
│   │   ├── MultiHubDashboard.tsx  # Central hub screen with status & quick actions
│   │   └── TicTacToeModal.tsx     # Realtime multiplayer Tic-Tac-Toe game
│   ├── lib/
│   │   └── supabase.ts            # Supabase client initialization & helpers
│   ├── App.tsx                    # Main application logic, chat views, auth & state
│   ├── index.css                  # Tailwind styles, custom themes & animations
│   ├── main.tsx                   # React entry point
│   └── types.ts                   # TypeScript interfaces & types
├── .env.example                # Sample environment variables
├── AGENTS.md                   # Project developer guidelines & rules
├── metadata.json               # Application metadata & configuration
├── migrate-supabase.js         # Database migration script
├── package.json                # Dependencies and npm scripts
└── tsconfig.json               # TypeScript configuration
```

---

## 🔒 Security & Privacy Invariants

1. **Closed Access Model**: Only the authenticated owner (`bodruddoja4@gmail.com`) and the verified partner identity have access to application data and chat feeds.
2. **Symmetric Dual-User Sync**: Ensures zero-latency access to shared messages, realtime subscriptions, online presence, and games across both accounts.
3. **Database RLS Policies**: Row Level Security policies safeguard profile settings, passcode validations, and message transactions.
4. **Client-Side Media Compression**: Media is compressed prior to upload to optimize bandwidth and maintain responsive delivery.

---

Built with ❤️ for **Rahul & Nusrat**.
