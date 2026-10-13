# OnlyUs APK updates

## Release destination

The private source repository is `RahulExe69/OnlyUs69`. Signed production APK releases are published to the public `RahulExe69/OnlyUs69-Releases` repository.

The source repository's **Build OnlyUs Dual Android APKs** workflow has a **Publish release** switch. For a production release, leave it enabled and enter customer-facing **What's new** items, one per line. Debug builds and validation builds must leave publication disabled.

The public release repository's root `latest.json` is the app's update manifest. It contains the shared version name/code, publication date, the customer-entered release-note items, and per-package download URL, size and SHA-256 checksum. The app does not construct in-app notes from Git commit history or the GitHub Release description.

## Required source-repository secret

Add a fine-grained token named `ONLYUS_RELEASE_TOKEN` to **OnlyUs69 → Settings → Secrets and variables → Actions**. Restrict the token to `RahulExe69/OnlyUs69-Releases` and grant **Contents: Read and write**. Do not put the token in source code or in the public release repository.

## Runtime behaviour

- The native APK bridge reads the installed package ID, version name and version code.
- The update check fetches the public `latest.json` without persisting a failed result.
- A newer version code opens a Play Store-inspired update gate with a close button. The close button exits the app; it does not dismiss the gate and continue the current session.
- Downloaded APKs are checked against expected package ID, version code, byte size and SHA-256 before launching Android's system package installer.
- If the update metadata cannot be reached, startup is allowed and a fresh check is attempted on the next app run.
- The Notes edition is not checked while the notepad is locked. Its process is kept alive only while the APK installer or install-permission settings are open, preserving the existing background-exit behaviour for ordinary app use.
- Web-only changes continue to use the separate OTA updater. Native/Capacitor changes require a new APK.

## Important

Android still controls installation and may request the user's confirmation. The APK must be signed with the key compatible with the already-installed edition and must have a strictly greater version code to be installed as an update.
