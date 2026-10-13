import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const NL = String.fromCharCode(10);
const root = process.cwd();
const packagePath = resolve(root, 'node_modules/@capacitor/android/package.json');
const sourcePath = resolve(root, 'node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/plugin/SystemBars.java');
if (!existsSync(packagePath) || !existsSync(sourcePath)) {
  throw new Error('[OnlyUs keyboard patch] Capacitor Android source was not found.');
}
const version = JSON.parse(readFileSync(packagePath, 'utf8')).version;
if (version !== '8.5.3') {
  throw new Error('[OnlyUs keyboard patch] Expected @capacitor/android 8.5.3, found ' + version + '. Review patch before upgrading.');
}
const marker = 'ONLYUS_NATIVE_RESIZE_IME_FIX';
let source = readFileSync(sourcePath, 'utf8');
if (source.includes(marker)) {
  console.log('[OnlyUs keyboard patch] Native-resize IME handling is already applied.');
  process.exit(0);
}
const methodStartText = '    private void initWindowInsetsListener() {';
const methodEndText = '    private void injectSafeAreaCSS(WindowInsetsCompat insets) {';
const methodStart = source.indexOf(methodStartText);
const methodEnd = source.indexOf(methodEndText, methodStart + methodStartText.length);
if (methodStart < 0 || methodEnd < 0) {
  throw new Error('[OnlyUs keyboard patch] Could not locate SystemBars.initWindowInsetsListener in the audited source.');
}
const method = [
  '    private void initWindowInsetsListener() {',
  '        if (INSETS_HANDLING_DISABLE.equals(insetsHandling)) {',
  '            return;',
  '        }',
  '',
  '        View view = getActivity().getWindow().getDecorView();',
  '        ViewCompat.setOnApplyWindowInsetsListener(view, (v, insets) -> {',
  '            Insets systemBarsInsets = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());',
  '            Insets imeInsets = insets.getInsets(WindowInsetsCompat.Type.ime());',
  '            boolean keyboardVisible = insets.isVisible(WindowInsetsCompat.Type.ime());',
  '            // ' + marker + ': avoid the viewport-fit=cover passthrough path, which can leave',
  '            // a navigation-bar-height strip on WebViews whose internal IME resize is inaccurate.',
  '            // Let the native parent own the resize, and zero the handled insets before WebView.',
  '            boolean frameworkAlreadyResizedForIme = keyboardVisible && android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.R;',
  '            int bottomPadding = keyboardVisible',
  '                ? (frameworkAlreadyResizedForIme ? 0 : imeInsets.bottom)',
  '                : systemBarsInsets.bottom;',
  '            v.setPadding(systemBarsInsets.left, systemBarsInsets.top, systemBarsInsets.right, bottomPadding);',
  '',
  '            WindowInsetsCompat newInsets = new WindowInsetsCompat.Builder(insets)',
  '                .setInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout(), Insets.of(0, 0, 0, 0))',
  '                .setInsets(WindowInsetsCompat.Type.ime(), Insets.NONE)',
  '                .setVisible(WindowInsetsCompat.Type.ime(), false)',
  '                .build();',
  '',
  '            injectSafeAreaCSS(newInsets);',
  '            return newInsets;',
  '        });',
  '    }',
  ''
].join(NL);
source = source.slice(0, methodStart) + method + source.slice(methodEnd);
if (!source.includes(marker) || source.includes('boolean shouldPassthroughInsets = getWebViewMajorVersion()')) {
  throw new Error('[OnlyUs keyboard patch] Post-patch validation failed.');
}
writeFileSync(sourcePath, source, 'utf8');
console.log('[OnlyUs keyboard patch] Applied native-owned keyboard resize for Capacitor Android ' + version + '.');
