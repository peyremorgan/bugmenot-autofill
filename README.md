# BugMeNot Autofill

Browser extension to autofill login forms with BugMeNot credentials.

## Current status

- Uses a mock credential service with hardcoded credentials.
- Real BugMeNot retrieval is intentionally out of scope for now.
- Right-click on a password field and choose `BugMeNot Autofill...`.
- A modal displays multiple credentials; user selection fills username/password.
- Error handling is intentionally console-only for this phase.
- Success feedback UI after fill is currently out of scope.

## Development

```bash
npm install
npm run lint
npm test
```

### Test scripts

- `npm run test:unit`: unit tests for mock service, form detection, and modal logic.
- `npm run test:e2e`: DOM-level end-to-end flow tests for modal selection and cancel behavior.

## Load in Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `manifest.json`
