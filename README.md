# Amplience Patches

A Chrome extension that applies custom CSS patches to improve the layout and responsiveness of the Amplience Dynamic Content interface.

## Features

- **Responsive header improvements**: Better wrapping and sizing for the main navigation bar
- **Flexible layout**: Removes minimum width constraints for better viewport compatibility
- **Enhanced table readability**: Improved column widths in content view lists
- **Mobile-friendly**: Responsive design improvements for smaller screens

## Installation

### From Source (Development)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the `amplience-patches` folder
6. The extension will now be active

### Reloading After Changes

If you make changes to the code:

1. Go to `chrome://extensions/`
2. Find "Amplience Patches"
3. Click the reload icon (🔄)
4. Refresh any open Amplience tabs

## Usage

1. Install the extension following the steps above
2. Navigate to https://app.amplience.net/content
3. The patches will automatically apply
4. Open DevTools Console to verify (you should see: "Amplience Patches: Extension loaded")

## How It Works

The extension uses Chrome's Manifest V3 content scripts to:

1. **Inject CSS** (`styles.css`) - Custom styles scoped to `[data-amplience-patches="enabled"]` for specificity
2. **Run JavaScript** (`content.js`) - Sets a data attribute on the document to activate styles and logs confirmation

All patches only apply to pages matching `https://app.amplience.net/content*`.

## File Structure

```
amplience-patches/
├── manifest.json          # Extension configuration
├── content.js             # Content script that activates patches
├── styles.css             # Custom CSS patches
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
- **Sources tab**: Look under "Content scripts" to see if `styles.css` and `content.js` are injected

## Development

### Adding New Styles

1. Open `styles.css`
2. Add your styles inside the `[data-amplience-patches="enabled"]` selector
3. Use `!important` if needed to override existing Amplience styles
4. Reload the extension and refresh the Amplience page to test

### Modifying the Content Script

The `content.js` file can be extended to:

- Add dynamic behavior
- Inject additional elements
- Respond to page changes
- Store user preferences

## Permissions

This extension requires:

- **storage**: For potential future settings/preferences
- **host_permissions**: Access to `https://app.amplience.net/content*` only

## License

This is a utility extension for personal/internal use. Amplience is a trademark of Amplience Ltd.

## Contributing

To contribute improvements:

1. Fork/clone this repository
2. Make your changes
3. Test thoroughly on https://app.amplience.net/content
4. Submit a pull request with a clear description

## Changelog

### v1.0

- Initial release
- Responsive header improvements
- Table column width patches
- Flexible layout system
