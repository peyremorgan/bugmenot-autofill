# BugMeNot Autofill

Firefox-first WebExtension to autofill login forms with community credentials.

## Current status

- Uses a mock credential service with hardcoded credentials.
- Real BugMeNot retrieval is intentionally out of scope for now.

## Development

```bash
npm install
npm run lint
npm test
```

## Load in Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `manifest.json`
