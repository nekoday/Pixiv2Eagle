# Pixiv2Eagle

A Tampermonkey script for saving Pixiv artworks to Eagle image management software.

## Features

- 🖼️ Save Pixiv artworks to Eagle with one click
- 📁 Automatically create artist-specific folders
- 🏷️ Preserve artwork tags and metadata
- 📄 Support for multi-page artwork saving
- 🗂️ Option to create subfolder for multi-page artwork
- 📝 Option to save artwork description to Eagle annotation
- ⏰ Option to use artwork upload time as the addition date
- 🔧 Configurable Pixiv folder ID
- 🐛 Debug mode support
- 🧪 (Experimental) Set artist folder names through custom templates

## Requirements

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Install [Eagle](https://eagle.cool/) image management software
3. Ensure Eagle software is running

## Usage
### First-time Setup

1. Launch Eagle software
2. Create a folder in Eagle for storing Pixiv artworks
3. Right-click on the folder in Eagle and select "Copy Link"
4. On a Pixiv artwork page, click the Tampermonkey icon
5. Select "Set Pixiv Folder ID" and paste the copied folder link (e.g., `http://localhost:41595/folder?id=XXXXXX`) or just the folder ID (`XXXXXX` part)
6. Click "OK" to save the settings

### Daily Use
1. Make sure Eagle software is running
2. Visit any Pixiv artwork page (`/artworks/xxxxx`)
3. Click the "Save to Eagle" button on the page to save the artwork to the specified folder

### Folder ID Setting Rules
- If a Pixiv folder ID is set:
  - The script will search for or create artist-specific folders under the specified Pixiv folder
  - If the specified Pixiv folder cannot be found, an error will be displayed
- If the folder ID is cleared:
  - The script will search for or create artist-specific folders in the Eagle root directory
  - When cleared, a message will appear: "Folder ID has been cleared, artist folders will be created in the root directory by default"

### Artist Folder Name Template Configuration Rules

- `$uid` represents the artist ID, `$name` represents the artist name
- By default, the artist name is used as the folder name, corresponding to the template `$name`
- A template example: `$uid_$name`

## Feature Details
### Saving Artworks

- After clicking the "Save to Eagle" button, the script will automatically:
  - Retrieve artwork information (title, artist, tags, etc.)
  - Check for/create artist-specific folders
  - Download and save the artwork to Eagle
  - Preserve artwork information within Eagle

### Artist Folders
- Each artist will have a dedicated folder created under the configured Pixiv folder
- The folder name uses the artist's name
- The folder description includes the artist's ID for easier management
- Implementation logic:
  1. First, check if a dedicated folder for the artist already exists under the Pixiv main folder
  2. Identify artist folders through the `pid = artistID` in the folder description
  3. If it doesn't exist, automatically create a new artist folder
  4. Newly created folders will automatically be set with the artist's name and a description containing the artist's ID
  5. All artworks will be saved in the corresponding artist's dedicated folder

### Debug Mode
- Debug mode can be enabled/disabled in the Tampermonkey menu
- When enabled, detailed information about the saving process will be displayed

### Upload Time Setting
- The use of upload time feature can be enabled/disabled in the Tampermonkey menu
- When this feature is enabled:
  - Artworks in Eagle will use the upload time on Pixiv as the addition date
  - Since Eagle sorts by addition date in descending order by default, the display order of artworks will be consistent with the artist's upload order
  - Suitable for users who want to view artworks in the order they were uploaded by the artist
- Disabled by default, meaning the actual save time is used as the addition date

## Precautions

1. Make sure Eagle software is running before use
2. Pixiv folder ID needs to be configured correctly
3. Saving large files or multi-page artworks may take longer, please be patient. Download speed mainly depends on your network environment and Pixiv server response time
4. Please comply with Pixiv's terms of use and copyright regulations

## FAQ
### Q: Why doesn't the save button appear?

A: Please ensure:
- Eagle software is running
- The script is installed correctly
- The page is fully loaded

### Q: How do I get the folder ID?
A: Right-click on the target folder in Eagle, select "Copy Link", and extract the ID part from the link (link format: `http://localhost:41595/folder?id=XXXXXX`)

### Q: What should I do if saving fails?
A: Please check:
- Whether Eagle is running
- If the network connection is normal
- If the folder ID is configured correctly
- Enable debug mode to view detailed information
- Check the browser console for error messages

If the problem persists after checking the above steps, feel free to submit an issue on [GitHub](https://github.com/nekoday/Pixiv2Eagle).

## Disclaimer

**This software is provided as is, without any express or implied warranties. The author is not responsible for any loss or damage caused by the use of this software. By using this software, you agree to assume all related risks.**

This tool is only for conveniently collecting and managing artworks you like. During use, please respect the artists' work, and don't forget to like and bookmark the artworks you enjoy - this is the best support and encouragement for creators!

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

### License Notes
- The current version uses the MIT License
- The author reserves the right to change the license type in future versions
- Released versions will maintain their original licenses
