# Amplience Patches

A Chrome extension that applies extra patches to amplify the Amplience interface including:

- CSS patch to improve the layout and responsiveness of the Amplience Dynamic Content interface
- Flows Filters for easier management of Workforce Flows

## Features

- **Responsive header improvements**: Better wrapping and sizing for the main navigation bar

- **Flexible layout**: Removes minimum width constraints for better viewport compatibility

- **Enhanced table readability**: Improved column widths in content view lists

- **Mobile-friendly**: Responsive design improvements for smaller screens

- **Workflow Filter**: Adds a filter input for content flows with debounced matching and clear control

## Installation

1. Download or clone this repository

2. Open Chrome and go to `chrome://extensions/`

3. Enable **Developer mode** (top right)

4. Click **Load unpacked**

5. Select the `amplience-patches` folder you downloaded in step 1

The extension will now be active on `https://app.amplience.net/content/*` and `https://app.amplience.net/content-studio/*`

![Installing Custom Browser Extensions](screenshots/installing-custom-browser-extensions.gif)\
_Here are steps 2-5 in action. (Also installing our two other browser extensions - [Amplience Hotkeys](https://github.com/mattisherwood/amplience-hotkeys) and [Favicon Swapper](https://github.com/mattisherwood/favicon-swapper))_

_**TIP:** While you're in the extension manager; if you click **Details** on the extension you can select **'Allow in Icongito'** if you wish it to also be applied to incognito windows._

### Updating to newer versions

If you wish to update the extension, merely re-run the above steps but upload the newer version of the folder. It will automatically replace the old one. Then refresh the tab and it'll be applied.

## Usage

1. Navigate to https://app.amplience.net/content

2. The patches will automatically apply

3. Toggle style patches from the extension icon:
   - Left-click the extension icon to open the popup checkbox
   - Right-click the extension icon and use the context-menu checkbox

4. You can also enable/disable patches from extension options:
   - Go to `chrome://extensions/`
   - Find **Amplience Patches** and click **Details**
   - Click **Extension options**
   - Toggle **Enable style patches** and other patch toggles

## How It Works

The extension uses Chrome's Manifest V3 content scripts to:

1. **Inject style patch CSS** (`modules/style-patches/style-patches.css`) - Custom styles scoped to `[data-amplience-patches="enabled"]` for specificity
2. **Run style activation script** (`modules/style-patches/style-patches.js`) - Reads `stylesEnabled` from `chrome.storage.sync` and sets/removes the data attribute used by CSS patches
3. **Run flow filter script** (`modules/flows-filter/flows-filter.js`) - Injects and manages the content-flows filter UI and filtering behavior
4. **Provide an action popup** (`popup.html` + `popup.js`) - Allows toggling patches from the extension icon
5. **Provide a right-click action context menu** (`background.js`) - Adds a checkbox toggle on the extension action
6. **Provide an options page** (`options.html` + `options.js`) - Allows toggling patches on/off and stores preferences

All patches only apply to pages matching `https://app.amplience.net/content*` and `https://app.amplience.net/content-studio/*`.

## File Structure

```
amplience-patches/
├── manifest.json          # Extension configuration
├── background.js          # Service worker for action context menu toggle
├── modules/
│   ├── style-patches/ # Style patches for more responsive styles
│   │   ├── style-patches.js
│   │   └── style-patches.css
│   └── flows-filter/ # Workforce Content Flows Filter
│       ├── flows-filter.js
│       └── flows-filter.css
├── popup.html             # Extension icon popup UI
├── popup.js               # Popup behavior and setting persistence
├── options.html           # Extension options UI
├── options.js             # Options page behavior and setting persistence
├── icons/                 # Extension icons
│   ├── amplience-patches-16x16.png
│   ├── amplience-patches-32x32.png
│   └── amplience-patches-96x96.png
└── README.md             # This file
```

## Troubleshooting

### Styles not applying?

1. **Verify extension is loaded**: Check `chrome://extensions/` - "Amplience Patches" should be enabled
2. **Check console**: Open DevTools on the Amplience page - you should see "Amplience Patches: Extension loaded"
3. **Inspect elements**: Right-click an element and check if your custom styles appear in the Styles panel
4. **Reload extension**: Sometimes Chrome needs the extension reloaded after changes
5. **Hard refresh**: Try Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows) on the Amplience page

### Debugging

Open DevTools on https://app.amplience.net/content:

- **Console tab**: Check for the extension's log message
- **Elements tab**: Inspect `<html>` - should have `data-amplience-patches="enabled"`
- **Sources tab**: Look under "Content scripts" to see if `modules/style-patches/style-patches.js` and `modules/flows-filter/flows-filter.js` are injected

## Development

### Adding New Styles

1. Open `modules/style-patches/style-patches.css`
2. Add your styles inside the `[data-amplience-patches="enabled"]` selector
3. Use `!important` if needed to override existing Amplience styles
4. Reload the extension and refresh the Amplience page to test

### Modifying Content Scripts

The content scripts can be extended to:

- Add dynamic behavior
- Inject additional elements
- Respond to page changes
- Store user preferences

## Permissions

This extension requires:

- **storage**: For potential future settings/preferences
- **host_permissions**: Access to `https://app.amplience.net/content*` and `https://app.amplience.net/content-studio/*`

## License

This is a utility extension for personal/internal use. Amplience is a trademark of Amplience Ltd.

## Contributing

To contribute improvements:

1. Fork/clone this repository
2. Make your changes
3. Test thoroughly on https://app.amplience.net/content
4. Submit a pull request with a clear description

## Support

For issues or questions:

1. Review this README
2. Open an issue on GitHub

## Changelog

### v1.5.1

- Detects the current author's initials and highlight their flows.
- Adds a switch to show only the current user's or everyone's flows.\*

\* NB: We don't have full data, so this only works for initials from the title naming convention. Nice extra usability, not full RBACS security.

### v1.5

- Extracts author and tag data from flow title based on naming convention.

### v1.4

- Added content flows filter input field to search/filter workflow items in real-time
- Filter includes clear button and 100ms debouncing for performance
- Uses data-visibility attributes with CSS to hide/show filtered items
- Added toggle to enable/disable content flows filter from popup, options, and context menu
- Extended content script to support `content-studio/content-flows` URLs
- Added mutation observer to inject filter when panels load dynamically
- Updated settings structure with `flowFilter` flag

### v1.3

- Added popup checkbox when clicking the extension icon
- Added right-click action context-menu checkbox on the extension icon
- Synced popup/context menu/options page toggles via `chrome.storage.sync`

### v1.2

- Added extension options page
- Added `stylesEnabled` setting in `chrome.storage.sync`
- Added UI toggle to enable/disable style patches

### v1.1

- Clean top-nav item interactions

### v1.0

- Initial release
- Responsive header improvements
- Table column width patches
- Flexible layout system

---

**Made with ❤️ for Amplience users**
