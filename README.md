# BugMeNot Autofill

Browser extension to autofill login forms with BugMeNot credentials.

## Current status

- Uses a mock credential service with hardcoded credentials.
- Real BugMeNot retrieval is intentionally out of scope for now.
- Right-click on a password field and choose `BugMeNot Autofill...`.
- A modal displays multiple credentials; user selection fills username/password.

## Development

```bash
npm install
npm run lint
npm test
```

### Test scripts

- `npm run test:unit`: unit tests for mock service, form detection, and modal logic.
- `npm run test:e2e`: DOM-level end-to-end flow tests for modal selection and cancel behavior.

## Load in Firefox / LibreWolf

### Option 1: Using XPI package (Recommended)

```bash
./package-extension.sh
```

This creates `bugmenot-autofill.xpi`. Then:

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `bugmenot-autofill.xpi`

### Option 2: Direct load (ZIP archive)

1. Create a ZIP archive containing the required files:
   ```bash
   zip -r bugmenot-autofill.zip manifest.json background/ content/
   ```

2. Open `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on**
4. Select the `bugmenot-autofill.zip` file

**Note:** Loading `manifest.json` directly may fail to load associated files. Use a ZIP archive for reliable loading.
