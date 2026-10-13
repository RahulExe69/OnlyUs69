import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const NL = String.fromCharCode(10);
const root = process.cwd();
const packagePath = resolve(root, 'node_modules/@capacitor/android/package.json');
const sourcePath = resolve(root, 'node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/plugin/SystemBars.java');
if (!existsSync(packagePath) || !existsSync(sourcePath)) throw new Error('[OnlyUs keyboard patch] Capacitor Android source not found.');
const version = JSON.parse(readFileSync(packagePath, 'utf8')).version;
if (version !== '8.5.3') throw new Error('[OnlyUs keyboard patch] Expected Capacitor Android 8.5.3, found ' + version + '. Review patch before upgrading.');
const marker = 'ONLYUS_PASSTHROUGH_IME_FIX';
let source = readFileSync(sourcePath, 'utf8');
if (source.includes(marker)) { console.log('[OnlyUs keyboard patch] Correct IME pass-through is already applied.'); process.exit(0); }
const branchStartText = '            if (shouldPassthroughInsets) {';
const legacyBranchAnchor = [
  '            // We need to correct for a possible shown IME',
  '            v.setPadding(',
  '                systemBarsInsets.left,'
].join(NL);
const branchStart = source.indexOf(branchStartText);
const legacyStart = source.indexOf(legacyBranchAnchor, branchStart + branchStartText.length);
if (branchStart < 0 || legacyStart < 0) throw new Error('[OnlyUs keyboard patch] Could not identify SystemBars passthrough branch.');
const correctedBranch = [
  '            if (shouldPassthroughInsets) {',
  '                // ' + marker + ': modern WebView handles IME viewport resizing when viewport-fit=cover is active.',
  '                // Parent padding plus the WebView IME inset shifts the composer up and leaves a blank strip.',
  '                v.setPadding(0, 0, 0, 0);',
  '',
  '                WindowInsetsCompat newInsets = new WindowInsetsCompat.Builder(insets)',
  '                    .setInsets(',
  '                        WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout(),',
  '                        Insets.of(',
  '                            systemBarsInsets.left,',
  '                            systemBarsInsets.top,',
  '                            systemBarsInsets.right,',
  '                            getBottomInset(systemBarsInsets, keyboardVisible)',
  '                        )',
  '                    )',
  '                    .build();',
  '',
  '                injectSafeAreaCSS(newInsets);',
  '',
  '                // Keep IME insets in newInsets so WebView handles keyboard space once.',
  '                return newInsets;',
  '            }',
  ''
].join(NL);
source = source.slice(0, branchStart) + correctedBranch + source.slice(legacyStart);
// Migrate installs that received the previous incorrect patch.
source = source.split('WindowInsetsCompat newInsets = withOnlyUsNativeResizeInsets(new WindowInsetsCompat.Builder(insets))').join('WindowInsetsCompat newInsets = new WindowInsetsCompat.Builder(insets)');
source = source.split('padForIme ? imeInsets.bottom : (keyboardVisible ? 0 : systemBarsInsets.bottom)').join('keyboardVisible ? imeInsets.bottom : systemBarsInsets.bottom');
const oldHelperStartText = '    private WindowInsetsCompat.Builder withOnlyUsNativeResizeInsets(WindowInsetsCompat.Builder builder) {';
const oldHelperStart = source.indexOf(oldHelperStartText);
if (oldHelperStart >= 0) {
  const oldHelperEnd = source.indexOf('    private void injectSafeAreaCSS(WindowInsetsCompat insets) {', oldHelperStart);
  if (oldHelperEnd < 0) throw new Error('[OnlyUs keyboard patch] Could not remove old helper safely.');
  source = source.slice(0, oldHelperStart) + source.slice(oldHelperEnd);
}
if (!source.includes(marker) || source.includes('withOnlyUsNativeResizeInsets') || source.includes('padForIme ? imeInsets.bottom')) throw new Error('[OnlyUs keyboard patch] Post-patch validation failed.');
writeFileSync(sourcePath, source, 'utf8');
console.log('[OnlyUs keyboard patch] Applied zero-parent-padding IME pass-through to Capacitor Android ' + version + '.');
