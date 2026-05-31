# BugMeNot Autofill

Browser extension to autofill login forms with BugMeNot credentials.

## Current status

- Fetches credentials from `https://bugmenot.com/view/{domain}` on demand.
- Decrypts BugMeNot's `data-s` credential fields client-side in the extension.
- Returns an empty credential list when fetch/parsing fails and logs the error.
- Right-click on a password field and choose `BugMeNot Autofill...`.
- A modal displays multiple credentials; user selection fills username/password.

## Development

```bash
npm install
npm run build  # Build the extension
npm run lint
npm test
```

### Build process

The extension source code is in `src/` and is bundled into `dist/` using esbuild:

- `src/background/` → `dist/background/background.js`
- `src/content/` → `dist/content/content.js`

Run `npm run build` before loading the extension or testing locally.

### Test scripts

- `npm run test:unit`: unit tests for BugMeNot service, form detection, and modal logic.
- `npm run test:e2e`: DOM-level end-to-end flow tests for modal selection and cancel behavior.

## Load in Firefox / LibreWolf

First, build the extension:

```bash
npm run build
```

Then load it in Firefox:

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `dist/manifest.json`

**Note:** Always run `npm run build` after making changes to the source code.
