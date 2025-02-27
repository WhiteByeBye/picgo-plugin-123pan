# picgo-plugin-123pan

[![npm](https://img.shields.io/npm/v/picgo-plugin-123pan.svg?style=flat-square)](https://www.npmjs.com/package/picgo-plugin-123pan)
[![downloads](https://img.shields.io/npm/dt/picgo-plugin-123pan.svg?style=flat-square)](https://www.npmjs.com/package/picgo-plugin-123pan)
[![license](https://img.shields.io/npm/l/picgo-plugin-123pan.svg?style=flat-square)](https://github.com/your-github-username/picgo-plugin-123pan/blob/master/LICENSE)  
A PicGo plugin to upload images to [123pan (123云盘)](https://www.123pan.com/). This plugin leverages the official 123pan OpenAPI for secure and efficient uploads.

## Features

- **Official API Integration**: Uses 123pan's official OpenAPI for reliable uploads
- **Optimized for Typora**: Special handling for Typora image uploads
- **Robust Error Recovery**: Automatic retries and fallback mechanisms
- **GUI Support**: Full integration with PicGo GUI, including custom menu options
- **Fast Upload**: Supports server-side duplicate detection for instant uploads
- **Secure**: Your credentials remain securely stored locally

## Installation

### Option 1: PicGo GUI Installation

1. **Download PicGo**: Get the app from the [official PicGo website](https://molunerfinn.com/PicGo/)
2. **Install the Plugin**: 
   - Open PicGo
   - Go to "Plugin Settings"
   - Search for "123pan" in the plugin search
   - Click "Install"

### Option 2: Manual Installation / PicGo-Core

1. **Install PicGo-Core** (command-line version) if you prefer CLI usage:
   ```bash
   npm install picgo -g
   ```

2. **Install the Plugin**:
   - **PicGo-Core (CLI)**:
     ```bash
     picgo install 123pan
     ```
   - **PicGo GUI Manual Installation**:
     - Download the latest release package
     - In PicGo, go to "Plugin Settings"
     - Click "Install from local file"
     - Select the downloaded package

## Configuration

### Obtain 123pan OpenAPI Credentials

To use this plugin, you need:
1. A 123pan account with OpenAPI access (currently only available for VIP members)
2. Your `clientID` and `clientSecret` from the 123pan OpenAPI management interface

### Configure in PicGo GUI

1. Open PicGo
2. Go to "Image Uploader" in the sidebar
3. Select "123pan" as the uploader
4. Enter your credentials:
   - **Client ID**: Your 123pan API client ID
   - **Client Secret**: Your 123pan API client secret
   - **Parent Folder Name** (Optional): The name of a folder to store your images

### Configure in PicGo-Core (CLI)

Edit your PicGo configuration file (usually located at `~/.picgo/config.json` on Linux/macOS or `%USERPROFILE%\.picgo\config.json` on Windows):

```json
{
  "picBed": {
    "uploader": "123pan",
    "current": "123pan",
    "123pan": {
      "clientID": "your_client_id",
      "clientSecret": "your_client_secret",
    }
  },
  "picgoPlugins": {
    "picgo-plugin-123pan": true
  }
}
```

## Usage

### With PicGo GUI

1. **Upload via Clipboard**:
   - Copy an image to your clipboard
   - Click the PicGo tray icon
   - Select "Upload from Clipboard"

2. **Upload from File**:
   - Click the PicGo tray icon
   - Select "Upload from Files"
   - Choose image(s) to upload

3. **Upload from Screenshot** (if you have screenshot plugin):
   - Use your configured screenshot shortcut
   - The image will be automatically uploaded

4. **Using Plugin Menu Options**:
   - In PicGo, navigate to the 123pan plugin settings
   - Use additional options like "Upload from URL" or "Configure API settings"

### With Typora

1. **Configure Typora**:
   - Open Typora
   - Go to File > Preferences > Image
   - Select "Upload image" for Image insertion
   - Choose "PicGo-Core (command line)" or "Custom Command" with path to PicGo
   - Click "Test Uploader" to verify the setup

2. **Using with Typora**:
   - Paste an image directly from clipboard (Ctrl+V)
   - Typora will automatically upload via PicGo

### With PicGo-Core (CLI)

Upload an image using the command line:

```bash
picgo upload /path/to/your/image.jpg
```

## Troubleshooting

### Common Issues

1. **"PreuploadID cannot be empty" Error**:
   - This can occur during first-time uploads with Typora
   - Solution: The plugin will automatically retry. If it fails, try manually uploading by right-clicking the image in Typora.

2. **Upload Hanging in Typora**:
   - If an upload seems to hang indefinitely in Typora
   - Solution: The plugin has a built-in 60-second timeout that will force completion. You can try again if needed.

3. **Authentication Errors**:
   - Check that your Client ID and Client Secret are correct
   - Verify your 123pan VIP subscription is active
   - Try regenerating your API credentials from the 123pan website

4. **Folder Creation Failures**:
   - If specified parent folder can't be created
   - Solution: The plugin will default to uploading to the root directory

### Debug Logging

For advanced troubleshooting, you can enable debug logging:

- **PicGo GUI**: Go to "PicGo Settings" > Enable "Log Level - Debug"
- **PicGo-Core**: Set the debug environment variable: `DEBUG=picgo* picgo upload /path/to/image.jpg`

## Advanced Features

### Keyboard Shortcuts

In PicGo GUI, you can use `Ctrl+Alt+1` as a shortcut for quick uploads from clipboard.

### Custom Upload Directory

Setting a parent folder name in the configuration will:
1. Create the folder if it doesn't exist
2. Find the folder ID if it already exists
3. Use that folder for all uploads

### API Token Management

The plugin automatically handles token refresh and maintains a 5-minute buffer before expiration to ensure seamless uploads.

## License

[MIT License](LICENSE)