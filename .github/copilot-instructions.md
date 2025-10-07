# Copilot Instructions for kbd-informer

## Project Overview
- **kbd-informer** is a GNOME Shell extension that displays active keyboard modifier keys in the top panel and shows OSD notifications when lock keys (Caps Lock, Num Lock, Scroll Lock) change state.
- The extension is written primarily in JavaScript and uses GNOME Shell APIs. Configuration is managed via GSettings schemas.

## Key Files & Structure
- `extension.js`: Main entry point for the extension logic and GNOME Shell integration.
- `prefs.js`: Implements the preferences dialog for customizing modifier symbols.
- `schemas/org.gnome.shell.extensions.kbd-informer.gschema.xml`: GSettings schema for user-configurable options.
- `stylesheet.css`: Styles for the panel indicator and OSD.
- `build-release.sh`, `quick-build.sh`, `bootstrap.sh`: Scripts for building, packaging, and setting up the extension.
- `metadata.json`: Extension metadata (UUID, name, shell version compatibility).

## Developer Workflows
- **Build/Package**: Use `./build-release.sh` to generate a distributable zip file for installation.
- **Quick Build**: Use `./quick-build.sh` for rapid local development and testing.
- **Schema Changes**: After editing the GSettings schema, run `glib-compile-schemas schemas/` to update compiled schemas.
- **Install/Reload**: After building, install the extension via GNOME Extensions or manually copy to `~/.local/share/gnome-shell/extensions/` and reload GNOME Shell (`Alt+F2`, type `r`, press Enter).

## Project-Specific Patterns
- **Panel Integration**: All UI elements are injected into the GNOME Shell top panel via the main extension class in `extension.js`.
- **Notifications**: OSD notifications are triggered on lock key state changes using GNOME Shell's notification API.
- **Customization**: User preferences (modifier symbols, icon/SVG paths, etc.) are accessed via GSettings and reflected in real time.
- **Icon/SVG Support**: For each modifier, if an icon/SVG path is set in preferences, the panel will render the image instead of text. If not set, falls back to text symbol.
- **No external dependencies**: The extension relies only on GNOME Shell and standard JavaScript/GLib APIs.

## Examples
- To add a new modifier key, update both `extension.js` (logic/UI) and `prefs.js` (preferences), and extend the schema if new settings are needed (add both `*-symbol` and `*-icon-path` keys).
- To change the default symbols or icons, edit the schema XML and update defaults, then recompile schemas.
- To use an icon/SVG for a modifier, set the file path in preferences. If the path is empty, the text symbol is used.

## References
- See `README.md` for installation and usage.
- See `metadata.json` for extension metadata and compatibility.
- See `schemas/org.gnome.shell.extensions.kbd-informer.gschema.xml` for all configurable settings.

---

**For AI agents:**
- Follow GNOME Shell extension conventions for structure and API usage.
- Use the provided build scripts for packaging and schema compilation.
- When adding features, ensure both UI and GSettings integration are updated.
- Test changes by reloading the extension in GNOME Shell.
