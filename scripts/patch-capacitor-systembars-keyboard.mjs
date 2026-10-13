import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const NL = String.fromCharCode(10);
const root = process.cwd();
const packagePath = resolve(root, 'node_modules/@capacitor/android/package.json');
const sourcePath = resolve(root, 'node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/plugin/SystemBars.java');
if (!existsSync(packagePath) || !existsSync(sourcePath)) throw new Error('[OnlyUs keyboard patch] Capacitor Android source not found.');
const version = JSON.parse(readFileSync(packagePath, 'utf8')).version;
if (version !== '8.5.3') throw new Error('[OnlyUs keyboard patch] Expected Capacitor Android 8.5.3, found ' + version + '. Review patch before upgrading.');
const marker = 'ONLYUS_SINGLE_IME_RESIZE_PATCH';
let source = readFileSync(sourcePath, 'utf8');
if (source.includes(marker)) { console.log('[OnlyUs keyboard patch] Already applied.'); process.exit(0); }
function replaceOnce(input, before, after, label) {
  const count = input.split(before).length - 1;
  if (count !== 1) throw new Error('[OnlyUs keyboard patch] ' + label + ': expected one match, got ' + count + '.');
  return input.replace(before, after);
}
source = replaceOnce(source,
  '            boolean keyboardVisible = insets.isVisible(WindowInsetsCompat.Type.ime());',
  [
    '            boolean keyboardVisible = insets.isVisible(WindowInsetsCompat.Type.ime());',
    '            // ' + marker + ': Android owns the resize; Chromium must not apply the IME twice.',
    '            boolean padForIme = keyboardVisible && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R;'
  ].join(NL), 'keyboard inset detection');
source = replaceOnce(source,
  '                v.setPadding(0, 0, 0, keyboardVisible ? imeInsets.bottom : 0);',
  '                v.setPadding(0, 0, 0, padForIme ? imeInsets.bottom : 0);', 'edge-to-edge padding');
source = replaceOnce(source,
  '                keyboardVisible ? imeInsets.bottom : systemBarsInsets.bottom',
  '                padForIme ? imeInsets.bottom : (keyboardVisible ? 0 : systemBarsInsets.bottom)', 'legacy padding');
const builderStart = 'WindowInsetsCompat newInsets = new WindowInsetsCompat.Builder(insets)';
const builderCount = source.split(builderStart).length - 1;
if (builderCount !== 2) throw new Error('[OnlyUs keyboard patch] Expected two inset builders, got ' + builderCount + '.');
source = source.split(builderStart).join('WindowInsetsCompat newInsets = withOnlyUsNativeResizeInsets(new WindowInsetsCompat.Builder(insets))');
source = replaceOnce(source,
  '    private void injectSafeAreaCSS(WindowInsetsCompat insets) {',
  [
    '    private WindowInsetsCompat.Builder withOnlyUsNativeResizeInsets(WindowInsetsCompat.Builder builder) {',
    '        // Native SystemBars resizes the content. Do not also send IME insets to Chromium.',
    '        return builder',
    '            .setInsets(WindowInsetsCompat.Type.ime(), Insets.NONE)',
    '            .setVisible(WindowInsetsCompat.Type.ime(), false);',
    '    }', '',
    '    private void injectSafeAreaCSS(WindowInsetsCompat insets) {'
  ].join(NL), 'single-resize helper');
writeFileSync(sourcePath, source, 'utf8');
console.log('[OnlyUs keyboard patch] Applied to Capacitor Android ' + version + '.');
