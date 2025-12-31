# Google Sheets Row Highlighter

A Chrome extension that automatically highlights the current row as you navigate in Google Sheets. Makes it easier to track which row you're working on in large spreadsheets.

![Demo](demo.gif)

## Features

- **Full Row Highlight** - Yellow or Purple background that follows your selection
- **Border Outline** - Black, Yellow, or Purple border around the current row
- **Automatic tracking** - Highlight moves as you click or navigate with keyboard
- **Lightweight** - No permissions required except for Google Sheets access

## Installation

Since this extension isn't on the Chrome Web Store, you'll need to install it manually:

1. **Download** this repository (Code → Download ZIP) and unzip it, or clone it:
   ```
   git clone https://github.com/YOUR_USERNAME/google-sheets-row-highlighter.git
   ```

2. Open Chrome and go to `chrome://extensions/`

3. Enable **Developer mode** (toggle in the top right corner)

4. Click **Load unpacked**

5. Select the folder containing the extension files

6. The extension icon will appear in your Chrome toolbar

## Usage

1. Open any Google Sheets document
2. Click the extension icon in the toolbar
3. Select a highlight mode:
   - **Yellow** or **Purple** for full row background highlight
   - **Bold Black**, **Yellow**, or **Purple** for border outline only
4. Navigate your spreadsheet - the highlight follows your selection!
5. Click **Turn Off** to disable highlighting

## Screenshots

### Full Row Highlight (Yellow)
Highlights the entire row with a semi-transparent yellow background.

### Border Outline (Black)
Draws a border around the current row without changing the background.

## How It Works

The extension injects a content script into Google Sheets pages that:
1. Detects when you click or navigate to a new cell
2. Finds the position of the active cell
3. Draws an overlay that spans the full width of the row
4. Removes the previous highlight when you move to a new row

## Files

- `manifest.json` - Chrome extension configuration
- `content.js` - Main script that handles row detection and highlighting
- `popup.html` / `popup.js` - The popup UI for selecting highlight modes
- `styles.css` - Additional overlay styling
- `icon*.png` - Extension icons

## Privacy

This extension:
- Only runs on Google Sheets (`docs.google.com/spreadsheets/*`)
- Does not collect or transmit any data
- Does not read or modify your spreadsheet content
- Only stores your highlight preference locally

## License

MIT License - feel free to use, modify, and distribute.

## Contributing

Issues and pull requests are welcome!
