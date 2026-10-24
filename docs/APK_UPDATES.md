# OnlyUs APK updates

## Release destination

The private source repository is `RahulExe69/OnlyUs69`. Signed production APK releases are published to the public `RahulExe69/OnlyUs69-Releases` repository.

The source repository's **Build OnlyUs Dual Android APKs** workflow has a **Publish release** switch. For a production release, leave it enabled and enter customer-facing **What's new** items, one per line. Debug builds and validation builds must leave publication disabled.

Each release publishes:
- The signed `OnlyUs.apk` and `Notes.apk` aliases used by the updater.
- Versioned APK assets for direct downloads.
- `onlyus-update-metadata.json` attached to the GitHub Release.
- The canonical root `latest.json`, generated from the same release metadata for clients that need a stable, CORS-friendly manifest URL.

The manifest contains the shared version name/code, publication date, customer-facing release notes, and per-package download URL, exact byte size, and SHA-256 checksum.

## Required source-repository secret

Add a fine-grained token named `ONLYUS_RELEASE_TOKEN` to **OnlyUs69 → Settings → Secrets and variables → Actions**. Restrict the token to `RahulExe69/OnlyUs69-Releases` and grant **Contents: Read and write**. Do not put the token in source code or in the public release repository.

## Runtime behaviour

- The native APK bridge reads the installed package ID, version name and version code.
- The app first fetches `latest.json` from the public repository's `raw.githubusercontent.com` endpoint with browser caching disabled. This avoids relying on a cross-origin fetch of a JSON file served as a GitHub Release download asset.
- The canonical manifest is validated against the installed edition: schema, semantic version, version code, official release URL/tag, expected edition APK name, exact file size, SHA-256, and non-empty release notes must all be valid.
- If the canonical manifest is unavailable or invalid, the updater falls back to the published-release API and supports both current release-attached metadata and the legacy v1.0.x metadata schema.
- A strictly newer Android version code opens a Play Store-inspired blocking update gate. The close button exits the app; it does not dismiss the gate and continue the current session.
- Downloaded APKs are checked natively against the expected package ID, version name/code, byte size and SHA-256 before Android's system package installer is launched.
- Before a release is published, metadata generation inspects both built APKs and fails unless their actual package IDs, version names and version codes match the release inputs. This prevents the updater from advertising a mismatched or stale APK as the new version.
- A failed update check is never treated as confirmation that the app is current. Startup is allowed if update servers cannot be reached, and a fresh check is attempted on resume, visibility/network recovery, and the retry interval.
- The Notes edition is not checked while the notepad is locked. Its process is kept alive only while the APK installer or install-permission settings are open, preserving the existing background-exit behaviour for ordinary app use.
- Web-only changes continue to use the separate OTA updater. Native/Capacitor changes require a new APK.

## Important

Android still controls installation and may request the user's confirmation. The APK must be signed with the key compatible with the already-installed edition and must have a strictly greater version code to be installed as an update.
