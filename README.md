# BugMeNot Autofill

Browser extension to autofill login forms with BugMeNot credentials.

## Current status

- Fetches credentials from `https://bugmenot.com/view/{domain}` on demand.
- Caches fetched credentials in memory for 1 hour per normalized domain.
- Deduplicates simultaneous credential requests for the same domain into a single network request.
- Caches empty credential results for the same 1-hour TTL to avoid repeated lookups for domains with no public credentials.
- Decrypts BugMeNot's `data-u` credential fields client-side in the extension.
- Returns an empty credential list when fetch/parsing fails and logs the error.
- Right-click on a password field and choose `BugMeNot Autofill...`.
- A modal displays multiple credentials; user selection fills username/password.

### Cache behavior

- Cache scope: background script in-memory cache (clears when the extension process restarts).
- Cache key: normalized domain (for example, `www.example.com` and `example.com` share the same cache entry).
- TTL: 1 hour.
- Failed HTTP/network requests are not cached.

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
