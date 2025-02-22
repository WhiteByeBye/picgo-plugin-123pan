# picgo-plugin-123pan

[![npm](https://img.shields.io/npm/v/picgo-plugin-123pan.svg?style=flat-square)](https://www.npmjs.com/package/picgo-plugin-123pan)
[![downloads](https://img.shields.io/npm/dt/picgo-plugin-123pan.svg?style=flat-square)](https://www.npmjs.com/package/picgo-plugin-123pan)
[![license](https://img.shields.io/npm/l/picgo-plugin-123pan.svg?style=flat-square)](https://github.com/your-github-username/picgo-plugin-123pan/blob/master/LICENSE)  
A PicGo plugin to upload images to [123pan (123云盘)](https://www.123pan.com/).  This plugin leverages the official 123pan OpenAPI for secure and efficient uploads.

## Installation

1.  **Install PicGo:** If you haven't already, install PicGo-Core (command-line version) or PicGo (GUI version).  This plugin works with both.
    *   **PicGo-Core:** `npm install picgo -g`
    *   **PicGo (GUI):** Download from the [official PicGo website](https://molunerfinn.com/PicGo/).

2.  **Install the Plugin:**
    *   **PicGo-Core:**
        ```bash
        picgo install 123pan
        ```
    *   **PicGo (GUI):**  Open PicGo, go to "Plugin Settings," search for "123pan," and click "Install."

## Configuration

1.  **Obtain 123pan OpenAPI Credentials:**
    *   You need a 123pan account with OpenAPI access (currently only available for VIP members).
    *   Obtain your `clientID` and `clientSecret` from the 123pan OpenAPI management interface.  *Keep your `clientSecret` secure!*

2.  **Configure the Plugin:**
    *   **PicGo-Core:** Edit your PicGo configuration file (usually located at `~/.picgo/config.json` on Linux/macOS or `%USERPROFILE%\.picgo\config.json` on Windows).  Add or modify the `picBed` section like this:

        ```json
        {
          "picBed": {
            "uploader": "123pan",  // Set 123pan as the active uploader
            "current": "123pan",
            "123pan": {
              "clientID": "your_client_id",
              "clientSecret": "your_client_secret",
            }
          },
          "picgoPlugins": {
            "picgo-plugin-123pan": true // Ensure the plugin is enabled
          }
        }
        ```

        Replace `"your_client_id"`, `"your_client_secret"`, and `"your_folder_name"` with your actual credentials and desired folder name.

    *   **PicGo (GUI):**  Open PicGo, go to "PicGo Settings" -> "Configure Uploader" -> "123pan".  Enter your `clientID`, `clientSecret`.

## Usage

After installation and configuration, any images uploaded through PicGo (either via the command line or the GUI) will be uploaded to your 123pan account.  The uploaded image URL will be copied to your clipboard.

**Example (PicGo-Core):**

```bash
picgo upload /path/to/your/image.jpg