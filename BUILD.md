# BUILD.md — Getting Auralis running as an Android app

Prereqs, in order. Do these once:

1. **Node.js** (18+) — you probably have this already.
2. **Android Studio** — installs the Android SDK, emulator, and Gradle
   for you. Just install it and open it once so it finishes its setup
   wizard.
3. **JDK 17** — Android Studio bundles one; you generally don't need to
   install a separate one.

---

## 1. Set up the project folder

Put `index.html`, `style.css`, `script.js` into a `www/` subfolder — that's
the convention Capacitor expects for your web assets.

```
auralis/
  www/
    index.html
    style.css
    script.js
  native/
    FolderAccessPlugin.kt
  capacitor.config.ts
```

## 2. Install dependencies

From the `auralis/` folder:

```bash
npm init -y
npm install @capacitor/core @capacitor/cli
npm install @capacitor/preferences
npm install @anuradev/capacitor-background-mode
```

(Note: if you saw `@capacitor-community/background-mode` mentioned
earlier in this chat — that package is deprecated. Use
`@anuradev/capacitor-background-mode` instead, which is what's in your
`capacitor.config.ts` now.)

## 3. Point Capacitor at your web assets

Open `capacitor.config.ts` and confirm `webDir: 'www'` (change it from
`.` to `www` to match the folder structure above).

## 4. Add the Android platform

```bash
npx cap init Auralis com.auralis.app --web-dir www
npx cap add android
```

This generates a full `android/` folder — a real Android Studio project.

## 5. Drop in the custom plugin

Copy `native/FolderAccessPlugin.kt` to:

```
android/app/src/main/java/com/auralis/app/FolderAccessPlugin.kt
```

(Create the `com/auralis/app/` folders if they don't exist yet.)

## 6. Register the plugin

Open `android/app/src/main/java/com/auralis/app/MainActivity.java` and
add:

```java
import com.auralis.app.FolderAccessPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FolderAccessPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
```

The `registerPlugin(...)` call has to happen **before** `super.onCreate()`.

## 7. Permissions

Open `android/app/src/main/AndroidManifest.xml` and add, inside
`<manifest>` but outside `<application>`:

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

`@anuradev/capacitor-background-mode`'s own README may list one or two
more — check it after installing, package READMEs sometimes change.

## 8. Sync and open

```bash
npx cap sync android
npx cap open android
```

The second command opens the project in Android Studio. Let Gradle finish
syncing (first time takes a few minutes), then hit Run ▶ with an emulator
or your phone plugged in (USB debugging on).

---

## Things that will bite you on first run

- **Blank white screen** — almost always means `webDir` in
  `capacitor.config.ts` doesn't match where your `index.html` actually is.
  Double check step 3.
- **"FolderAccess is not a registered plugin"** in the browser console —
  step 6 wasn't done, or `registerPlugin()` was called *after*
  `super.onCreate()`.
- **Folder picker opens but files don't load** — Android's SAF grants
  access to `content://` URIs, not real file paths. That's why
  `resolveSrc()` in script.js uses `Capacitor.convertFileSrc()` rather
  than treating the URI as a normal path. If you edit that function later,
  keep that conversion.
- **Audio stops when you lock the phone** — means the background-mode
  plugin either isn't installed right or its permission (step 7) is
  missing. Check `adb logcat` for a permission-denied line.
- **App crashes immediately on launch** — almost always a Kotlin/Gradle
  version mismatch between the plugin and your Capacitor version. Check
  Android Studio's "Build" tab for the actual error; it's usually
  specific and googleable.

## Testing without a full build

You can sanity-check the JS/HTML/CSS logic (everything except native
folder access and background mode) by opening `www/index.html` directly
in Chrome on desktop — the `showDirectoryPicker` fallback in `script.js`
will kick in automatically, so you can pick a folder and play files right
in the browser before ever touching Android Studio. Good way to catch UI
bugs early.
