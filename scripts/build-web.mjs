// Copies the static web app into www/ for the iOS app (Capacitor's webDir).
// The website itself is served straight from the repo root, so this is only
// needed for native builds.
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const files = ['index.html', 'config.js', 'manifest.webmanifest', 'install.html', 'privacy.html', 'support.html', 'assets', 'icons', 'welcome'];
rmSync('www', { recursive: true, force: true });
mkdirSync('www');
for (const f of files) cpSync(f, `www/${f}`, { recursive: true });
// The service worker is for browsers only; the native app ships its files offline already.
console.log(`Copied ${files.length} entries into www/`);
