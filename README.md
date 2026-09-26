# DREAM RUN — Android resources

These source files generate all native Android icons + splash screens via
`@capacitor/assets` (runs automatically in CI, or locally):

- `icon.png` — 1024×1024 app icon (adaptive-safe, full-bleed `#05060f` background)
- `splash.png` — 2732×2732 launch splash (centered emblem, dark background)

## Regenerate locally

```bash
npm run build
npx cap sync android
npx @capacitor/assets generate --android \
  --iconBackgroundColor '#05060f' \
  --splashBackgroundColor '#05060f'
```

Outputs go to `android/app/src/main/res/` (mipmap + drawable folders).
