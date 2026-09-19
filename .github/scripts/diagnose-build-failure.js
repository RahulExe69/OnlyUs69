#!/usr/bin/env node

/**
 * OnlyUs Android APK CI/CD Build Failure Diagnostic Engine
 * 
 * Automatically analyzes GitHub Actions build logs, extracts root causes,
 * eliminates noisy Gradle output, and generates an actionable fix report
 * as both an artifact and a GitHub Step Summary.
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
    console.error(`Failed to read log at ${filePath}:`, err.message);
  }
  return null;
}

function analyzeLogs() {
  const rootDir = process.cwd();
  
  const gradleLog = readLogSafely(path.join(rootDir, 'gradle-build.log'));
  const viteLog = readLogSafely(path.join(rootDir, 'vite-build.log'));
  const capLog = readLogSafely(path.join(rootDir, 'cap-sync.log'));
  const npmLog = readLogSafely(path.join(rootDir, 'npm-install.log'));

  let failedStage = 'Unknown Stage';
  let primaryError = '';
  let extractedSnippet = '';
  let suggestedFixes = [];
  let errorCategory = 'General';

  // 1. Check Web App Build (Vite / TypeScript)
  if (viteLog && (viteLog.includes('error TS') || viteLog.includes('Rollup failed') || viteLog.includes('Build failed'))) {
    failedStage = 'Web Application Compilation (Vite / TypeScript)';
    errorCategory = 'TypeScript / Vite Build Error';
    
    // Extract TypeScript errors
    const tsErrors = viteLog
      .split('\n')
      .filter(line => line.includes('error TS') || line.includes('[vite]') || line.includes('Failed to compile'))
      .slice(0, 10);
    
    extractedSnippet = tsErrors.join('\n') || viteLog.slice(-1500);
    primaryError = tsErrors[0] || 'TypeScript compilation or Vite bundling failed.';
    
    suggestedFixes = [
      'Run `npm run lint` locally to see all TypeScript type mismatches and syntax issues.',
      'Check the files mentioned in the extracted snippet above and fix invalid imports or property accesses.',
      'Run `npm run build` locally in the terminal to verify the web build before triggering the GitHub APK workflow.'
    ];
  }

  // 2. Check Node Dependencies (npm install / ci)
  else if (npmLog && (npmLog.includes('npm ERR!') || npmLog.includes('ERESOLVE'))) {
    failedStage = 'Node Dependencies Installation (npm ci)';
    errorCategory = 'npm Dependency Resolution Failure';
    
    const errLines = npmLog
      .split('\n')
      .filter(line => line.includes('npm ERR!'))
      .slice(0, 15);
      
    extractedSnippet = errLines.join('\n') || npmLog.slice(-1000);
    primaryError = 'npm failed to resolve or install dependencies listed in package.json.';
    
    suggestedFixes = [
      'Check `package.json` for invalid package versions or conflicts.',
      'Run `npm install --package-lock-only` locally to regenerate a clean `package-lock.json`.',
      'Ensure all required private npm tokens (if any) are configured in GitHub Secrets.'
    ];
  }

  // 3. Check Capacitor Sync
  else if (capLog && (capLog.includes('[error]') || capLog.includes('Capacitor: Error') || capLog.includes('ERR_'))) {
    failedStage = 'Capacitor Android Sync (npx cap sync android)';
    errorCategory = 'Capacitor Asset / Plugin Sync Error';
    
    const capErrors = capLog
      .split('\n')
      .filter(line => line.toLowerCase().includes('error') || line.includes('Failed'))
      .slice(0, 10);
      
    extractedSnippet = capErrors.join('\n') || capLog.slice(-1000);
    primaryError = 'Capacitor encountered an error copying web assets or syncing Android plugins.';
    
    suggestedFixes = [
      'Ensure `npm run build` generated a valid `dist/` directory with `index.html`.',
      'Verify that all Capacitor plugins in `package.json` match `@capacitor/core` and `@capacitor/android` versions.',
      'Run `npx cap sync android` locally to inspect the detailed native sync output.'
    ];
  }

  // 4. Check Android Gradle Build
  else if (gradleLog && (gradleLog.includes('FAILURE: Build failed') || gradleLog.includes('BUILD FAILED'))) {
    failedStage = 'Android Gradle Compilation & Packaging';
    
    // Check specific Gradle sub-categories
    if (gradleLog.includes('Keystore file') || gradleLog.includes('keystore') || gradleLog.includes('signingConfig') || gradleLog.includes('Password verification failed') || gradleLog.includes('Cannot find key in keystore')) {
      errorCategory = 'APK Keystore / Digital Signing Failure';
      primaryError = 'Gradle could not sign the release APK with `onlyus.keystore`.';
      suggestedFixes = [
        'Check GitHub Repository Secrets: Ensure `RELEASE_STORE_PASSWORD`, `RELEASE_KEY_ALIAS`, and `RELEASE_KEY_PASSWORD` are set correctly.',
        'Verify that `android/app/onlyus.keystore` exists in the repository.',
        'If building a development test, you can select `build_type = debug` in the GitHub Actions dispatch input to bypass production release signing.'
      ];
    } else if (gradleLog.includes('AAPT: error:') || gradleLog.includes('resource not found') || gradleLog.includes('AndroidManifest.xml')) {
      errorCategory = 'AAPT2 Android Resource or Manifest Failure';
      primaryError = 'Android Asset Packaging Tool (AAPT2) failed to link XML layouts, drawables, or manifest entries.';
      suggestedFixes = [
        'Check `android/app/src/main/AndroidManifest.xml` or product flavor manifests (`nusrat` & `rahul`) for XML typos.',
        'Verify that custom app icons were generated correctly: run `npm run icons`.',
        'Check any newly added resource IDs or drawables in `android/app/src/main/res/`.'
      ];
    } else if (gradleLog.includes('CompilationFailedException') || gradleLog.includes('compiler error') || gradleLog.includes(':app:compile')) {
      errorCategory = 'Java / Kotlin Android Compilation Error';
      primaryError = 'Native Android Java/Kotlin source code failed to compile.';
      suggestedFixes = [
        'Inspect the Java/Kotlin compile error in the snippet below for exact class and line numbers.',
        'Check custom plugins in `android/app/src/main/java/` (e.g. `OnlyUsNotificationPlugin` or `StealthNotepadActivity`).',
        'Ensure Android SDK 36 and Java 21 compatibility across all native files.'
      ];
    } else if (gradleLog.includes('OutOfMemoryError') || gradleLog.includes('heap space') || gradleLog.includes('Metaspace')) {
      errorCategory = 'Gradle JVM Out of Memory';
      primaryError = 'The Gradle build daemon ran out of allocated heap memory.';
      suggestedFixes = [
        'Increase Gradle daemon heap in `android/gradle.properties` (e.g. `org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m`).',
        'Disable parallel execution or daemon caching for low-memory environments.'
      ];
    } else {
      errorCategory = 'Gradle Build Task Failure';
      primaryError = 'A Gradle task execution terminated with an exception.';
      suggestedFixes = [
        'Review the exact Gradle task failure in the snippet below.',
        'Run `./gradlew assembleNusratRelease assembleRahulRelease --stacktrace` in the `android/` directory to inspect stack trace.',
        'Ensure Android SDK platform 36 and build-tools are fully synced.'
      ];
    }

    // Extract "* What went wrong:" block from Gradle log
    const whatWentWrongIdx = gradleLog.indexOf('* What went wrong:');
    if (whatWentWrongIdx !== -1) {
      const whatWentWrongBlock = gradleLog.substring(whatWentWrongIdx, whatWentWrongIdx + 2000);
      const endOfBlock = whatWentWrongBlock.indexOf('* Try:') !== -1 ? whatWentWrongBlock.indexOf('* Try:') : whatWentWrongBlock.length;
      extractedSnippet = whatWentWrongBlock.substring(0, endOfBlock).trim();
    } else {
      // Fallback: extract lines containing ERROR or FAILED
      const errorLines = gradleLog
        .split('\n')
        .filter(l => l.includes('FAILED') || l.includes('error:') || l.includes('AAPT: error:') || l.includes('Exception:'))
        .slice(-15);
      extractedSnippet = errorLines.join('\n') || gradleLog.slice(-1500);
    }
  }

  // 5. Fallback if no specific log matched
  else {
    failedStage = 'APK Assembly or File Organization';
    errorCategory = 'Pipeline Step Failure';
    primaryError = 'A workflow step terminated unexpectedly before completing APK generation.';
    
    // Check if APK artifacts step failed
    suggestedFixes = [
      'Check the GitHub Actions step that has a red ❌ icon in the workflow run view.',
      'If the error was "Nusrat APK not found" or "Rahul APK not found", Gradle may have produced APKs in an unexpected directory.',
      'Inspect the raw runner logs for runner environment issues or canceled jobs.'
    ];
    extractedSnippet = 'No error output found in captured build logs. The failure occurred during step setup, artifact collection, or runner environment configuration.';
  }

  // Generate Markdown report
  const nowUtc = new Date().toISOString();
  const runId = process.env.GITHUB_RUN_ID || 'local';
  const repoName = process.env.GITHUB_REPOSITORY || 'OnlyUs';
  const workflowUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : '#';

  const markdownReport = `
# 🚨 OnlyUs Android Companion APK - Build Failure Diagnostic Report

> **Run ID:** [${runId}](${workflowUrl})  
> **Timestamp:** \`${nowUtc}\`  
> **Repository:** \`${repoName}\`  
> **Primary Failure Category:** **${errorCategory}**

---

### ❌ Failed Workflow Stage
**${failedStage}**

### 🔍 Root Cause Summary
${primaryError}

---

### 📋 Exact Extracted Error Log
\`\`\`text
${extractedSnippet.trim()}
\`\`\`

---

### 🛠️ Recommended Actionable Fix Steps
${suggestedFixes.map((fix, idx) => `${idx + 1}. ${fix}`).join('\n')}

---

### 📦 Diagnostic Artifact Download
- You can download the complete diagnostic bundle (containing this report, full Gradle output, and Vite bundling traces) directly from the **Artifacts** section at the bottom of the GitHub Actions run page: **\`OnlyUs-Build-Failure-Diagnostic-Log\`**.
- Workflow URL: ${workflowUrl}
`.trim();

  // Generate Plain Text report
  const textReport = `
======================================================================
🚨 ONLYUS ANDROID COMPANION APK - BUILD FAILURE DIAGNOSTIC REPORT
======================================================================
Timestamp: ${nowUtc}
Run ID:    ${runId}
Repository:${repoName}
Stage:     ${failedStage}
Category:  ${errorCategory}
======================================================================

[ROOT CAUSE SUMMARY]
${primaryError}

[EXACT EXTRACTED ERROR LOG]
----------------------------------------------------------------------
${extractedSnippet.trim()}
----------------------------------------------------------------------

[ACTIONABLE FIX STEPS]
${suggestedFixes.map((fix, idx) => `${idx + 1}. ${fix}`).join('\n')}

======================================================================
Artifact: OnlyUs-Build-Failure-Diagnostic-Log
View full run: ${workflowUrl}
======================================================================
`.trim();

  // Write reports to disk
  fs.writeFileSync(path.join(rootDir, 'OnlyUs-Build-Failure-Diagnostic.md'), markdownReport, 'utf8');
  fs.writeFileSync(path.join(rootDir, 'OnlyUs-Build-Failure-Diagnostic.txt'), textReport, 'utf8');

  console.log('\n======================================================================');
  console.log('✅ Generated OnlyUs-Build-Failure-Diagnostic.md & .txt');
  console.log('======================================================================\n');
  console.log(textReport);
  console.log('\n======================================================================\n');

  // Write to GitHub Step Summary if available
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

try {
  analyzeLogs();
} catch (error) {
  console.error('Fatal error while diagnosing build failure:', error);
  process.exit(0); // Exit 0 so failure reporting itself never masks the original failure
}
