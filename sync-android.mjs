// Helper: build web + sync Capacitor Android + generate assets.
// Usage: node scripts/sync-android.mjs [--open]
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const run = (cmd) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
};

try {
  run('npm run build');

  if (!existsSync('android')) {
    console.log('\n[android] No native project — running `npx cap add android` …');
    run('npx cap add android');
  } else {
    console.log('\n[android] Native project exists — syncing …');
  }

  run('npx cap sync android');
  run(`npx @capacitor/assets generate --android --iconBackgroundColor "#05060f" --splashBackgroundColor "#05060f"`);

  // Portrait lock + permissions (idempotent manifest patch)
  if (process.platform !== 'win32') {
    try {
      run(`sed -i 's/android:screenOrientation="[^"]*"/android:screenOrientation="portrait"/g' android/app/src/main/AndroidManifest.xml || true`);
    } catch { /* manifest patch is best-effort locally; CI enforces it */ }
  }

  console.log('\n✅ Android sync done. Next:');
  console.log('   npx cap open android   → Run in Android Studio');
  console.log('   cd android && ./gradlew assembleDebug   → CLI APK build');

  if (process.argv.includes('--open')) run('npx cap open android');
} catch (e) {
  console.error('\n❌ sync-android failed:', e?.message || e);
  process.exit(1);
}
