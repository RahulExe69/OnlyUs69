#!/usr/bin/env node

/**
 * OnlyUs Android APK CI/CD Build Failure Diagnostic Engine
 * 
 * Automatically analyzes GitHub Actions workflow step execution,
 * identifies the exact failed step, extracts real compiler & runner error logs,
 * generates an actionable fix guide, uploads to an instant web viewer URL,
 * and writes to GitHub Step Summary.
 */

import fs from 'fs';
import path from 'path';

// Strip ANSI escape codes
function stripAnsi(text) {
  if (!text) return '';
  return text.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '');
}

// Read log file safely
function readLogSafely(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return stripAnsi(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (err) {
    // Ignore read errors
  }
  return null;
}

// Map of step IDs to human-readable step descriptions
const STEP_TITLES = {
  step_checkout: 'Repository Source Checkout',
  step_vars: 'Build Versioning & Variables Resolution',
  step_setup_node: 'Node.js 22 Runtime Environment Setup',
  step_install_deps: 'npm Dependencies Installation (npm ci / npm install)',
  step_build_web: 'Web Application Compilation (Vite / TypeScript)',
  step_icons: 'Android Flavor App Icons Generation',
  step_setup_java: 'Java JDK 21 Environment Setup',
  step_setup_gradle: 'Gradle Daemon & Build Cache Setup',
  step_setup_android: 'Android SDK Platform 36 & Licenses Configuration',
  step_cap_sync: 'Capacitor Android Assets & Plugin Sync',
  step_chmod_gradlew: 'Gradle Wrapper Execution Permissions',
  step_build_apks: 'Native Android Compilation (Gradle assembleNusrat & assembleRahul)',
  step_organize_apks: 'APK Verification & File Renaming',
  step_upload_artifacts: 'APK Workflow Artifact Upload',
  step_publish_release: 'GitHub Releases Publishing'
};

async function uploadToPasteViewer(content) {
  try {
    // Try dpaste.org (7-day temporary paste)
    const response = await fetch('https://dpaste.org/api/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        content,
        format: 'url',
        expiry_days: '7',
        title: 'OnlyUs APK Build Failure Diagnostic'
      }),
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      const url = (await response.text()).trim();
      if (url.startsWith('http')) {
        return url;
      }
    }
  } catch (e) {
    // Fallback paste service if dpaste fails
    try {
      const response2 = await fetch('https://paste.rs', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: content,
        signal: AbortSignal.timeout(4000)
      });
      if (response2.ok) {
        const url2 = (await response2.text()).trim();
        if (url2.startsWith('http')) {
          return url2;
        }
      }
    } catch (_) {}
  }
  return null;
}

async function runDiagnostic() {
  const rootDir = process.cwd();
  const logsDir = path.join(rootDir, 'logs');

  let failedStepId = null;
  let failedStepTitle = 'Unknown Workflow Step';

  // 1. Inspect GitHub Actions step outcomes via STEPS_CONTEXT
  if (process.env.STEPS_CONTEXT) {
    try {
      const steps = JSON.parse(process.env.STEPS_CONTEXT);
      for (const [stepId, stepData] of Object.entries(steps)) {
        if (stepData && (stepData.conclusion === 'failure' || stepData.outcome === 'failure')) {
          failedStepId = stepId;
          failedStepTitle = STEP_TITLES[stepId] || stepId;
          break;
        }
      }
    } catch (e) {
      console.warn('Could not parse STEPS_CONTEXT:', e.message);
    }
  }

  // Fallback: If STEPS_CONTEXT didn't identify a failed step, look for the newest non-empty error log
  if (!failedStepId && fs.existsSync(logsDir)) {
    const logFiles = fs.readdirSync(logsDir).filter(f => f.endsWith('.log')).sort().reverse();
    for (const logFile of logFiles) {
      const content = readLogSafely(path.join(logsDir, logFile));
      if (content && (content.includes('error') || content.includes('ERROR') || content.includes('FAILED') || content.includes('FAILURE'))) {
        failedStepId = logFile.replace('.log', '');
        failedStepTitle = STEP_TITLES[failedStepId] || failedStepId;
        break;
      }
    }
  }

  // 2. Read log file for the failed step or check general logs
  let stepLog = '';
  if (failedStepId) {
    const candidatePath = path.join(logsDir, `${failedStepId}.log`);
    stepLog = readLogSafely(candidatePath) || '';
  }

  // If still empty, check legacy root log files
  if (!stepLog) {
    stepLog = readLogSafely(path.join(rootDir, 'gradle-build.log'))
      || readLogSafely(path.join(rootDir, 'vite-build.log'))
      || readLogSafely(path.join(rootDir, 'cap-sync.log'))
      || readLogSafely(path.join(rootDir, 'npm-install.log'))
      || '';
  }

  let errorCategory = 'Build Pipeline Error';
  let rootCauseSummary = '';
  let extractedSnippet = '';
  let suggestedFixes = [];

  // 3. Analyze specific error based on step & log content
  if (failedStepId === 'step_build_web' || stepLog.includes('error TS') || stepLog.includes('Rollup failed') || stepLog.includes('vite: not found')) {
    failedStepTitle = STEP_TITLES.step_build_web;
    errorCategory = 'TypeScript / Web Compilation Failure';
    rootCauseSummary = 'Vite or TypeScript compiler failed while building the web application assets.';

    const lines = stepLog.split('\n');
    const tsErrors = lines.filter(l => l.includes('error TS') || l.includes('[vite]') || l.includes('Failed to compile') || l.includes('Error:')).slice(0, 15);
    extractedSnippet = tsErrors.join('\n') || lines.slice(-35).join('\n');

    suggestedFixes = [
      'Run `npm run lint` locally to identify and fix TypeScript type mismatches or broken imports.',
      'Run `npm run build` locally to ensure Vite can bundle the web project into `dist/` without errors.',
      'Check the files and line numbers highlighted in the error log snippet below.'
    ];
  }
  else if (failedStepId === 'step_install_deps' || stepLog.includes('npm ERR!') || stepLog.includes('ERESOLVE')) {
    failedStepTitle = STEP_TITLES.step_install_deps;
    errorCategory = 'npm Package Installation Failure';
    rootCauseSummary = 'npm failed to resolve dependencies or package-lock.json integrity check failed.';

    const lines = stepLog.split('\n');
    const npmErrors = lines.filter(l => l.includes('npm ERR!')).slice(0, 15);
    extractedSnippet = npmErrors.join('\n') || lines.slice(-30).join('\n');

    suggestedFixes = [
      'Run `npm install` locally and commit the updated `package-lock.json` to the repository.',
      'Check `package.json` for invalid package versions or conflicting peer dependencies.',
      'Ensure any required private npm registry tokens are defined in repository secrets.'
    ];
  }
  else if (failedStepId === 'step_icons' || stepLog.includes('generate-flavor-icons')) {
    failedStepTitle = STEP_TITLES.step_icons;
    errorCategory = 'Android Flavor Icon Generator Failure';
    rootCauseSummary = 'The custom icon generator script (`scripts/generate-flavor-icons.js`) encountered an error.';

    const lines = stepLog.split('\n');
    extractedSnippet = lines.slice(-30).join('\n');

    suggestedFixes = [
      'Run `npm run icons` locally to test generating launcher and notification icons.',
      'Check that `sharp` is installed in `node_modules` and that `android/app/src/main/res/` directories are writable.',
      'Verify that SVG icon definitions in `scripts/generate-flavor-icons.js` have valid syntax.'
    ];
  }
  else if (failedStepId === 'step_setup_android' || stepLog.includes('sdkmanager') || stepLog.includes('platforms;android-36')) {
    failedStepTitle = STEP_TITLES.step_setup_android;
    errorCategory = 'Android SDK / Platform 36 Setup Failure';
    rootCauseSummary = 'Failed to configure Android SDK, accept licenses, or install SDK Platform 36.';

    const lines = stepLog.split('\n');
    extractedSnippet = lines.slice(-30).join('\n');

    suggestedFixes = [
      'Ensure Android SDK licenses are accepted using `yes | sdkmanager --licenses`.',
      'Verify that `$ANDROID_HOME` points to a valid Android SDK installation in the GitHub runner.',
      'Verify that Gradle has `android.builder.sdkDownload=true` enabled so it can auto-download missing platforms.'
    ];
  }
  else if (failedStepId === 'step_cap_sync' || stepLog.includes('Capacitor') || stepLog.includes('npx cap sync')) {
    failedStepTitle = STEP_TITLES.step_cap_sync;
    errorCategory = 'Capacitor Android Sync Failure';
    rootCauseSummary = 'Capacitor failed to copy web assets to `android/app/src/main/assets/public` or sync native plugins.';

    const lines = stepLog.split('\n');
    const capErrors = lines.filter(l => l.toLowerCase().includes('error') || l.includes('ERR_') || l.includes('Failed')).slice(0, 15);
    extractedSnippet = capErrors.join('\n') || lines.slice(-30).join('\n');

    suggestedFixes = [
      'Ensure `dist/index.html` exists and was properly generated by `npm run build`.',
      'Run `npx cap sync android` locally to verify Android plugin compatibility.',
      'Check `android/capacitor.settings.gradle` and native Capacitor dependencies in `package.json`.'
    ];
  }
  else if (failedStepId === 'step_build_apks' || stepLog.includes('FAILURE: Build failed') || stepLog.includes('BUILD FAILED')) {
    failedStepTitle = STEP_TITLES.step_build_apks;

    if (stepLog.includes('keystore') || stepLog.includes('signingConfig') || stepLog.includes('Cannot find key in keystore') || stepLog.includes('Password verification failed')) {
      errorCategory = 'Android Release Keystore / Digital Signing Failure';
      rootCauseSummary = 'Gradle could not load or verify the release keystore `onlyus.keystore`.';
      suggestedFixes = [
        'Check GitHub Repository Secrets: Verify that `RELEASE_STORE_PASSWORD`, `RELEASE_KEY_ALIAS`, and `RELEASE_KEY_PASSWORD` match `android/app/onlyus.keystore`.',
        'Verify that `android/app/onlyus.keystore` is committed and not corrupted.',
        'If testing in CI, trigger the workflow with input `build_type: debug` to test compilation without release signing.'
      ];
    } else if (stepLog.includes('AAPT: error:') || stepLog.includes('resource not found') || stepLog.includes('AAPT2 process')) {
      errorCategory = 'Android AAPT2 XML Resource Linking Failure';
      rootCauseSummary = 'AAPT2 encountered invalid XML syntax, missing drawables, or duplicate resource IDs.';
      suggestedFixes = [
        'Inspect XML files in `android/app/src/main/res/` and `android/app/src/main/AndroidManifest.xml` for syntax errors.',
        'Check product flavor manifests (`nusrat` and `rahul`) for conflicting attribute declarations.',
        'Run `./gradlew assembleDebug` locally to get detailed AAPT2 file and line numbers.'
      ];
    } else if (stepLog.includes('CompilationFailedException') || stepLog.includes('compileDebugJavaWithJavac') || stepLog.includes('compileReleaseJavaWithJavac')) {
      errorCategory = 'Java / Kotlin Native Code Compilation Failure';
      rootCauseSummary = 'Native Java/Kotlin Android code failed to compile.';
      suggestedFixes = [
        'Review custom Java classes in `android/app/src/main/java/com/onlyus/` (e.g. `OnlyUsNotificationPlugin`, `StealthNotepadActivity`).',
        'Ensure compatibility with Java 21 and Android API 36.',
        'Check for missing imports or method signature mismatches.'
      ];
    } else {
      errorCategory = 'Android Gradle Task Execution Failure';
      rootCauseSummary = 'A Gradle compilation or packaging task terminated with an error.';
      suggestedFixes = [
        'Review the exact Gradle task failure in the log snippet below.',
        'Run `./gradlew assembleNusratRelease assembleRahulRelease --stacktrace` locally.',
        'Check Gradle daemon and JVM heap memory in `android/gradle.properties`.'
      ];
    }

    // Extract "* What went wrong:" block if available
    const whatWentWrongIdx = stepLog.indexOf('* What went wrong:');
    if (whatWentWrongIdx !== -1) {
      const block = stepLog.substring(whatWentWrongIdx, whatWentWrongIdx + 2500);
      const tryIdx = block.indexOf('* Try:');
      extractedSnippet = (tryIdx !== -1 ? block.substring(0, tryIdx) : block).trim();
    } else {
      const lines = stepLog.split('\n');
      const errLines = lines.filter(l => l.includes('FAILED') || l.includes('error:') || l.includes('Exception:') || l.includes('Error:'));
      extractedSnippet = errLines.slice(-20).join('\n') || lines.slice(-40).join('\n');
    }
  }
  else if (failedStepId === 'step_organize_apks') {
    failedStepTitle = STEP_TITLES.step_organize_apks;
    errorCategory = 'APK Packaging & Verification Failure';
    rootCauseSummary = 'Gradle completed, but the expected APK files were not found in the output directory.';

    const lines = stepLog ? stepLog.split('\n') : [];
    extractedSnippet = lines.slice(-25).join('\n') || 'Nusrat or Rahul APK was not found at android/app/build/outputs/apk/.';

    suggestedFixes = [
      'Check if the build flavor names match `nusrat` and `rahul` in `android/app/build.gradle`.',
      'Verify if Gradle generated APKs in a different subdirectory (e.g. debug vs release).',
      'Check the preceding Gradle build step logs to confirm whether APK assembly finished cleanly.'
    ];
  }
  else {
    // General fallback: grab the literal tail of whatever log exists
    errorCategory = 'Workflow Execution Error';
    rootCauseSummary = failedStepTitle !== 'Unknown Workflow Step'
      ? `Step "${failedStepTitle}" terminated with a non-zero exit code.`
      : 'A workflow step terminated with an error before APK artifacts could be collected.';

    if (stepLog) {
      const lines = stepLog.split('\n');
      extractedSnippet = lines.slice(-35).join('\n');
    } else {
      extractedSnippet = `Failed Step ID: ${failedStepId || 'unknown'}\nCheck the GitHub Actions step with a red ❌ icon in the workflow run.`;
    }

    suggestedFixes = [
      `Check the step titled "${failedStepTitle}" in the GitHub Actions run timeline.`,
      'Examine the runner error message in the console for missing dependencies or permissions.',
      'Download the complete diagnostic log artifact below for the unedited console stream.'
    ];
  }

  // Ensure snippet is not empty
  if (!extractedSnippet || !extractedSnippet.trim()) {
    extractedSnippet = stepLog ? stepLog.slice(-1500) : `Step [${failedStepTitle}] failed with no captured terminal output.`;
  }

  // Generate plain text report
  const nowUtc = new Date().toISOString();
  const runId = process.env.GITHUB_RUN_ID || 'local';
  const repoName = process.env.GITHUB_REPOSITORY || 'RahulExe69/OnlyUs69';
  const workflowUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : `https://github.com/${repoName}/actions/runs/${runId}`;

  const textReport = `
======================================================================
🚨 ONLYUS ANDROID COMPANION APK - BUILD FAILURE DIAGNOSTIC REPORT
======================================================================
Timestamp:  ${nowUtc}
Run ID:     ${runId}
Repository: ${repoName}
Failed Step:${failedStepTitle} (${failedStepId || 'N/A'})
Category:   ${errorCategory}
======================================================================

[ROOT CAUSE SUMMARY]
${rootCauseSummary}

[EXACT EXTRACTED ERROR LOG]
----------------------------------------------------------------------
${extractedSnippet.trim()}
----------------------------------------------------------------------

[ACTIONABLE FIX STEPS]
${suggestedFixes.map((fix, idx) => `${idx + 1}. ${fix}`).join('\n')}

======================================================================
Workflow Run URL: ${workflowUrl}
======================================================================
`.trim();

  // Try uploading to online paste service for direct web link
  let webViewerUrl = await uploadToPasteViewer(textReport);

  // Generate Markdown report
  const markdownReport = `
# 🚨 OnlyUs Android Companion APK - Build Failure Diagnostic Report

> **Run ID:** [${runId}](${workflowUrl})  
> **Timestamp:** \`${nowUtc}\`  
> **Repository:** \`${repoName}\`  
> **Failed Step:** **${failedStepTitle}** (\`${failedStepId || 'N/A'}\`)  
> **Primary Failure Category:** **${errorCategory}**

${webViewerUrl ? `\n> 🌐 **[👉 Click Here to Open Raw Fix Log in Browser Tab](${webViewerUrl})**\n` : ''}

---

### ❌ Failed Workflow Stage
**${failedStepTitle}**

### 🔍 Root Cause Summary
${rootCauseSummary}

---

### 📋 Exact Extracted Error Log
\`\`\`text
${extractedSnippet.trim()}
\`\`\`

---

### 🛠️ Recommended Actionable Fix Steps
${suggestedFixes.map((fix, idx) => `${idx + 1}. ${fix}`).join('\n')}

---

### 🔗 Direct Access & Artifacts
${webViewerUrl ? `- **Direct Web Viewer URL:** [${webViewerUrl}](${webViewerUrl})` : ''}
- **GitHub Actions Run URL:** [${workflowUrl}](${workflowUrl})
- **Complete Diagnostic Artifact:** Download **\`OnlyUs-Build-Failure-Diagnostic-Log\`** from the Artifacts section below for all raw logs.
`.trim();

  // Save reports to root dir
  fs.writeFileSync(path.join(rootDir, 'OnlyUs-Build-Failure-Diagnostic.md'), markdownReport, 'utf8');
  fs.writeFileSync(path.join(rootDir, 'OnlyUs-Build-Failure-Diagnostic.txt'), textReport, 'utf8');

  console.log('\n======================================================================');
  console.log(`🚨 BUILD FAILURE DIAGNOSTIC COMPLETED [${failedStepTitle}]`);
  console.log('======================================================================');
  if (webViewerUrl) {
    console.log(`\n🌐 ONLINE FIX LOG URL: ${webViewerUrl}\n`);
  }
  console.log(textReport);
  console.log('======================================================================\n');

  // Append to GitHub Step Summary
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile && fs.existsSync(path.dirname(summaryFile))) {
    try {
      fs.appendFileSync(summaryFile, `\n\n${markdownReport}\n\n`, 'utf8');
      console.log('✅ Successfully wrote diagnostic report to $GITHUB_STEP_SUMMARY');
    } catch (err) {
      console.warn('Could not write to GITHUB_STEP_SUMMARY:', err.message);
    }
  }
}

runDiagnostic().catch(err => {
  console.error('Diagnostic engine crashed:', err);
  process.exit(0);
});
