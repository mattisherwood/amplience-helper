# Privacy Policy

**Amplience Helper** is a browser extension that adds productivity & usability improvements to the Amplience web apps (CMS, DAM, Workforce and UnifiedApp). This page explains what it does with your data.

**In short: the extension does not collect, store or send your data to the developer or to any third party.** It has no analytics, tracking or advertising, and it requests only the `storage` permission.

## What the extension stores

Your settings (which modules are switched on, per-hub theme colours, and similar preferences) are saved with Chrome's storage API. If you have Chrome sync turned on, Chrome syncs them across your signed-in browsers. This data stays within your browser and Google account and is never sent to the developer.

## Where it runs

The extension runs only on Amplience's own web apps on `amplience.net` (for example `app.amplience.net` and `unifiedapp.amplience.net`) and on `support.amplience.com`. It changes how those pages look and behave in your browser. Page content is processed locally and is not collected or transmitted by the extension.

## Dashboard Home (optional, off by default)

When you turn on the Dashboard Home module, it reads the Amplience access token that the Amplience web app already stores in your browser (in the page's local storage). The Flows Webhooks module reads the same token.

- The token is used only to make requests to Amplience's own APIs (`api.amplience.net` and `auth.amplience.net`) on your behalf, for example to count your hub's content for the Content overview and to list the dashboard extensions registered on your hub.
- The token is used only within your browser. It is not stored by the extension, not sent to the developer or any third party, and never shared with embedded extensions.
- Requests are made with your own permissions, so the extension can only see or change what you could already see or change in Amplience.

### Embedded dashboard extensions

Dashboard Home can display Dashboard extensions that your organisation has registered on your hub, loaded from the URLs in that registration. They run in sandboxed frames and are operated by whoever hosts them; they are not part of this extension. They receive only the API responses they are permitted to read or modify under their own registration in your hub, according to that registration's Read and Modify settings. How such an extension handles data is governed by its own provider, not by this extension.

## What the extension does not do

- It does not collect personal information, browsing history or analytics.
- It does not sell data or share it with third parties.
- It does not use data for advertising, profiling or credit decisions.
- It does not load or run remote code as part of the extension itself.

## Changes to this policy

If the extension's data handling changes, this page will be updated and the change noted in the [changelog](CHANGELOG.md).

## Contact

Questions about this policy can be raised as an issue at <https://github.com/mattisherwood/amplience-helper/issues>.
