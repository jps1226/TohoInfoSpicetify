# \# ⛩️ TohoInfo - Spicetify Extension

# 

# \## 🌟 Overview

# 

# TohoInfo is a lightweight Spicetify extension designed for fans of the Touhou Project music scene. It automatically identifies if the song currently playing on Spotify is an arrangement of a ZUN original and provides immediate, persistent metadata.

# 

# \## ✨ Features

# 

# \* \*\*Arrangement Detection:\*\* Uses title and album matching against the external TouhouDB API to identify arrangements.

# \* \*\*Persistent Character Icon:\*\* Displays the associated Touhou character (e.g., Reimu, Marisa) as an icon in the player bar if it's a character theme.

# \* \*\*Hover-to-View Info:\*\* Hovering the icon reveals a full metadata card, including the original Japanese title and English translation.

# \* \*\*Fast Spotify Link:\*\* Provides a one-click button in the hover card to jump directly to the original ZUN track on Spotify.

# \* \*\*TouhouDB Integration:\*\* Clicking the icon opens the song's TouhouDB page in an in-app browser window.

# \* \*\*Hardcoded Fallback:\*\* Uses a local database for crucial ZUN track links, ensuring the "Play Original" button is highly reliable.

# 

# \## 💾 Installation

# 

# \### Prerequisites

# 1\.  \[Spicetify CLI](https://spicetify.app/docs/getting-started/installation) installed and working.

# 2\.  Node.js installed (for building the file).

# 

# \### Steps

# 1\.  \*\*Place the File:\*\* Place the compiled `tohoinfo.js` file into your Spicetify extensions folder:

# &nbsp;   \* `~/.config/spicetify/Extensions/` (Linux/macOS)

# &nbsp;   \* `%appdata%\\spicetify\\Extensions\\` (Windows)

# 

# 2\.  \*\*Enable the Extension:\*\* Open your terminal and run:

# &nbsp;   ```bash

# &nbsp;   spicetify config extensions tohoinfo.js

# &nbsp;   ```

# 

# 3\.  \*\*Apply Changes:\*\*

# &nbsp;   ```bash

# &nbsp;   spicetify apply

# &nbsp;   ```

# 

# \## 🛠️ Development \& Building

# 

# If you are using the repository's source code, you must first install dependencies and build the TypeScript files:

# 

# ```bash

# \# Inside your project folder

# npm install

# npm run build-local

