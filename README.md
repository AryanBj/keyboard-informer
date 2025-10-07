
# Keyboard Informer

A GNOME Shell extension that displays keyboard modifier keys in the top panel and shows notifications when lock keys change state.

![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-45%2B-blue)
![License](https://img.shields.io/badge/License-GPL%20v3-green)

## Features

- Shows active modifier keys in the top panel
- OSD notifications for Caps Lock, Num Lock, Scroll Lock changes
- Customizable symbols or icons (SVG/image) for all modifier keys
- Multi-monitor support

## Installation

### From GNOME Extensions Website
Install directly from: **https://extensions.gnome.org/extension/8500/keyboard-informer/**

### Manual Installation
```bash
git clone https://github.com/tomasmark79/kbd-informer.git
cd kbd-informer
./build-release.sh
# Install the generated zip file
```

## Screenshots

![Panel Indicator](screenshot-panel.png)
![OSD Notification](screenshot-osd.png)


## Configuration

Open extension preferences to customize modifier symbols or set an icon/SVG path for each modifier key.

**To use an icon or SVG:**
- In preferences, for each modifier, you can set a file path to an SVG or icon file on your computer.
- If an icon path is set, it will be shown in the panel instead of the text symbol.
- Leave the icon path empty to use only text.

**Example:**
- Set `/usr/share/icons/Adwaita/scalable/devices/input-keyboard-symbolic.svg` as the icon for Shift.

## License

GPL v3.0 - see [LICENSE](LICENSE) file.

## Author

**Tomáš Mark** - *Initial work*

Partially inspired by sneetsher/keyboard_modifiers_status
