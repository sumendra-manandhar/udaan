# Publishing Udaan on Google Play

Udaan ships to Play as a **Trusted Web Activity (TWA)**: a thin Android app that opens your deployed PWA full-screen, with no browser bar. The app on Play and the website are the same code; you update the site and the app updates too. Offline mode, sync and the map cache all work inside the TWA.

## Before you start

- The PWA is deployed on HTTPS at its final domain (for example `https://udaan.app`).
- Lighthouse's PWA checks pass on that domain (installable, service worker, manifest).
- A Google Play developer account (one-time fee).
- Node 18+ and a JDK installed locally. Bubblewrap can download the Android SDK for you.

## 1. Generate the Android project

```bash
npm i -g @bubblewrap/cli
mkdir udaan-android && cd udaan-android
bubblewrap init --manifest https://YOUR-DOMAIN/manifest.webmanifest
```

Answer the prompts:

| Prompt | Value |
| --- | --- |
| Application ID | `np.udaan.app` (must match `public/.well-known/assetlinks.json`) |
| Display mode | `standalone` |
| Orientation | `portrait` |
| Status bar / nav bar colour | `#0E1012` |
| Signing key | let Bubblewrap create one, and back it up somewhere safe |
| Location delegation | **yes** (pilots use the locate button) |

## 2. Build

```bash
bubblewrap build
```

This produces `app-release-bundle.aab` (upload this to Play) and `app-release-signed.apk` (install on a phone to test).

## 3. Link the app and the site (removes the browser bar)

1. In Play Console → your app → **Setup → App signing**, copy the **SHA-256 certificate fingerprint** of the *app signing key*.
2. Put it in `public/.well-known/assetlinks.json` in place of `REPLACE_WITH_…`. Add your upload key's fingerprint too while testing (`bubblewrap fingerprint list`).
3. Redeploy the site. Check `https://YOUR-DOMAIN/.well-known/assetlinks.json` returns JSON.
4. Verify with Google's tool: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://YOUR-DOMAIN&relation=delegate_permission/common.handle_all_urls`

If the URL bar still shows in the app, the fingerprint or package name doesn't match.

## 4. Store listing checklist

- Short and full description, at least two phone screenshots (take them from the installed app), the 512×512 icon (`public/icons/icon-512.png`) and a 1024×500 feature graphic.
- **Privacy policy URL** (required). Udaan stores email, profile details, spots, flight tracks and photos.
- **Data safety form**: email (account), approximate and precise location (spots, flight logs, user-initiated), photos and videos (user uploads). Data is encrypted in transit; users can delete their content.
- **Content rating** questionnaire.
- **Target audience**: 18+ is simplest (drone rules apply to adults; hiring involves contact details).
- Mention in the description that rule guidance is not legal advice.

## 5. Updating the app

- Web changes: just deploy the site. Users get the update prompt inside the app.
- Manifest changes (name, icons, colours): run `bubblewrap update`, bump the version, build, and upload a new bundle.
