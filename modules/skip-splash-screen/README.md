[< Back](../../README.md)

# Skip Splash Screen Module

Automatically skips the splash screen when you log in, making for a quicker/smoother login journey.

## Enable Or Disable

Use either:

- Extension popup: toggle **Skip Splash Screen**
- Extension options page: toggle **Skip Splash Screen**

The setting key is `skipSplashScreenEnabled` in `chrome.storage.sync`.

This module defaults to off.

## What It Does

- Watches for the Amplience login route at `https://app.amplience.net/#/login`
- Looks for a button with the `.login-button` class
- Clicks that button once per visit to the login route when enabled
- Resets when you leave the login route, so a later return can trigger it again
- Responds to setting changes without requiring a page reload

## Scope

This module targets the Amplience login route at:

- `https://app.amplience.net/#/login`

## Implementation Details

### Route Handling

The module monitors SPA navigation using:

- `hashchange`
- `popstate`
- DOM mutations

This keeps the behaviour working even if the login route or splash screen content is rendered after the initial page load.

### Button Detection

The module looks for this selector:

```css
.login-button
```

### Pros & Cons

#### Pros of going via the button

Whatever the button functionality is will follow. (If it goes direct to the dashboard, remembers a previous route or changes to do something new) Thus strictly maintaining the existing functionality and future changes.

#### Cons of going via the button

If Amplience changes the splash screen button class or removes that button entirely, the module will fail silently and no automatic click will occur. Watch out for this, but if it happens then the splash screen simply won't be skipped. No noisy crash.

### Retry Behaviour

When the login route is active, the module retries for a short period to allow for delayed rendering before giving up.

## Troubleshooting

1. Confirm **Skip Splash Screen** is turned on.
2. Navigate to `https://app.amplience.net/#/login`.
3. Check DevTools > Sources > Content scripts and verify `skip-splash-screen.js` is injected.
4. If the button is not clicked, inspect the page and confirm the login button still uses the `.login-button` class.
5. Hard refresh the page if the login screen was already open before enabling the module.
