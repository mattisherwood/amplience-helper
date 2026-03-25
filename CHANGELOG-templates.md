# Changelog Templates & Rules of Engagement

## Top-Level Changelog Template

This is used for entries in the top-level [/CHANGELOG.md](/CHANGELOG.md):

```md
## Changelog

### vX.Y.Z - YYYY-MM-DD

#### Summary

One short paragraph on what changed overall.

#### Module Highlights

- Style Patches: <1-2 bullets, user-facing>
- Flows Filter: <1-2 bullets, user-facing>
- Hotkeys: <1-2 bullets, user-facing>

#### Breaking / Behavioral Changes

- <anything users must know>

#### Migration Notes

- <if users need to do anything, e.g. reload extension>
```

## Per-Module Changelog Template

Use this inside each module README:

```md
## Changelog

### YYYY-MM-DD (extension vX.Y.Z)

#### Added

- ...

#### Changed

- ...

#### Fixed

- ...

#### Notes

- caveats, limitations, known edge-cases
```

This keeps root user-focused and module docs maintainer-focused.

## Release Checklist

To be used each time a new version is shipped:

1. Update module changelog entries first (only modules touched).
2. Roll up a short summary into root changelog.
3. Confirm toggle labels match popup/options wording.
4. Bump extension version in manifest.
5. Reload unpacked extension and smoke test:
   - Styles on/off
   - Flows filter on/off
   - Hotkeys on/off
6. Verify no runtime errors in service worker/content console.
7. Tag release notes with “what users will notice” only.

## Practical Rule Of Thumb

- If it changes user behavior: include in root + module.
- If it’s internal/refactor only: module only.
- If it’s cross-module: root summary + each affected module.
