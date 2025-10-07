/**
 * Keyboard Informer - Preferences UI
 * Configuration interface for keyboard modifier status extension
 * Copyright (C) 2025 Tomáš Mark
 */

import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

// Constants
const LOG_TAG = 'KBD-Informer-Prefs:';

// Configuration keys grouped by modifier (symbol, icon path, use-icon boolean)
const MODIFIERS = [
    'shift', 'caps', 'control', 'alt', 'num', 'scroll', 'super', 'altgr'
];

function modifierKeys(name) {
    return {
        symbol: `${name}-symbol`,
        icon: `${name}-icon-path`,
        useIcon: `${name}-use-icon`
    };
}

// Predefined symbol presets - initialized in getSymbolPresets()
let SYMBOL_PRESETS = null;

function getSymbolPresets(settingsManager = null) {
    if (!SYMBOL_PRESETS) {
        SYMBOL_PRESETS = {
            modifiers: new Map([
                [_('Symbols'), ['⇧', 'Caps', '⌃', '⎇', 'Num', '⇳', '❖', '⎈']]
            ])
        };
    }
    return SYMBOL_PRESETS;
}

/**
 * Settings Manager - Handles GSettings operations and state tracking
 */
class SettingsManager {
    constructor(extension) {
        this._extension = extension;
        this._settings = null;
        this._schema = null;
        this.currentSymbols = {};
        this.savedSymbols = {};
    }

    initialize() {
        this._settings = this._extension.getSettings();
        this._schema = this._settings.settings_schema;
        this._loadCurrentState();
    }

    _loadCurrentState() {
        // Load symbol and icon path strings per modifier
        this.currentSymbols = {};
        this.currentUseIcon = {};

        MODIFIERS.forEach(name => {
            const keys = modifierKeys(name);
            this.currentSymbols[keys.symbol] = this._settings.get_string(keys.symbol);
            this.currentSymbols[keys.icon] = this._settings.get_string(keys.icon);
            this.currentUseIcon[keys.useIcon] = this._settings.get_boolean(keys.useIcon);
        });

        this.savedSymbols = this._settings.get_value('saved-symbols').deep_unpack();

        console.debug(`${LOG_TAG} Current symbols: ${JSON.stringify(this.currentSymbols)}`);
        console.debug(`${LOG_TAG} Saved symbols: ${JSON.stringify(this.savedSymbols)}`);
    }

    _getSymbolsFromSettings(keys) {
        return Object.fromEntries(
            keys.map(key => [key, this._settings.get_string(key)])
        );
    }

    getSchemaDefaults(keys) {
        return keys.map(key => this._settings.get_default_value(key).deep_unpack());
    }

    getSchemaKey(key) {
        return this._schema.get_key(key);
    }

    setString(key, value) {
        this._settings.set_string(key, value);
        this.currentSymbols[key] = value;
    }

    setBoolean(key, value) {
        this._settings.set_boolean(key, value);
        this.currentUseIcon[key] = value;
    }

    connect(signal, callback) {
        return this._settings.connect(signal, callback);
    }

    setSavedSymbols(symbols) {
        this.savedSymbols = { ...symbols };
        this._settings.set_value('saved-symbols', new GLib.Variant('a{ss}', this.savedSymbols));
    }

    symbolsEqual(obj1, obj2) {
        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);

        if (keys1.length !== keys2.length) return false;

        return keys1.every(key => (obj1[key] ?? '') === (obj2[key] ?? ''));
    }

    currentDiffersFromSaved(keys) {
        return keys.some(key =>
            this.currentSymbols[key] !== (this.savedSymbols[key] ?? '')
        );
    }
}

/**
 * Simple Manager - Handles reset and save operations
 */
class SimpleManager {
    constructor(settingsManager, keys, defaultValues) {
        this.settingsManager = settingsManager;
        this.keys = keys;
        this.defaultValues = defaultValues;
    }

    isCurrentEqualToDefault() {
        return this.keys.every((key, i) =>
            this.settingsManager.currentSymbols[key] === this.defaultValues[i]
        );
    }

    isCurrentEqualToSaved() {
        return !this.settingsManager.currentDiffersFromSaved(this.keys);
    }

    applyDefaults(entryManager) {
        console.debug(`${LOG_TAG} Applying defaults: ${this.defaultValues}`);

        this.keys.forEach((key, i) => {
            const value = this.defaultValues[i];
            if (this.settingsManager.currentSymbols[key] !== value) {
                entryManager.updateEntry(key, value);
                this.settingsManager.setString(key, value);
            }
        });
    }

    saveCurrentAsPreset() {
        this.keys.forEach(key => {
            this.settingsManager.savedSymbols[key] = this.settingsManager.currentSymbols[key];
        });

        console.debug(`${LOG_TAG} Saving current symbols: ${JSON.stringify(this.settingsManager.savedSymbols)}`);
        this.settingsManager.setSavedSymbols(this.settingsManager.savedSymbols);
    }
}

/**
 * Entry Manager - Handles text entry widgets and their signals
 */
class EntryManager {
    constructor() {
        this.entries = new Map();
    }

    addEntry(key, entry, changeCallback) {
        const changeId = entry.connect('changed', () => {
            const newValue = entry.text;
            console.debug(`${LOG_TAG} Entry changed ${key}: -> ${newValue}`);
            changeCallback(key, newValue);
        });

        this.entries.set(key, { entry, changeId });
        console.debug(`${LOG_TAG} Added entry for ${key}: ${entry.text}`);
    }

    updateEntry(key, value) {
        const entryData = this.entries.get(key);
        if (!entryData) return;

        const { entry, changeId } = entryData;

        // Block signal to prevent recursion
        entry.block_signal_handler(changeId);
        console.debug(`${LOG_TAG} Updating entry ${key}: ${entry.text} -> ${value}`);
        entry.text = value;

        // Unblock after idle to ensure proper signal handling
        GLib.idle_add(null, () => {
            entry.unblock_signal_handler(changeId);
            return GLib.SOURCE_REMOVE;
        });
    }

    getEntry(key) {
        const entryData = this.entries.get(key);
        return entryData ? entryData.entry : null;
    }
}

/**
 * Dialog Manager - Handles confirmation dialogs
 */
class DialogManager {
    static showSwitchConfirmation(window, title, keys, settingsManager, onConfirm, onCancel) {
        console.debug(`${LOG_TAG} Showing switch confirmation dialog`);

        const dialog = new Adw.MessageDialog({
            transient_for: window,
            modal: true,
            heading: _('Unsaved custom symbols'),
            body: _('Switching presets will discard your custom symbols. Do you want to save before switching?'),
        });

        // Create comparison table if there are differences
        const grid = DialogManager._createComparisonGrid(title, keys, settingsManager);
        if (grid) {
            dialog.set_extra_child(grid);
        }

        // Add response buttons
        dialog.add_response('cancel', _('Cancel'));
        dialog.add_response('save', _('Save'));
        dialog.add_response('switch', _('Switch'));
        dialog.set_response_appearance('save', Adw.ResponseAppearance.SUGGESTED);
        dialog.set_response_appearance('switch', Adw.ResponseAppearance.DESTRUCTIVE);
        dialog.set_default_response('cancel');
        dialog.set_close_response('cancel');

        dialog.connect('response', (_dialog, response) => {
            console.debug(`${LOG_TAG} Dialog response: ${response}`);

            switch (response) {
                case 'cancel':
                    onCancel();
                    break;
                case 'save':
                    onConfirm(true);
                    break;
                case 'switch':
                    onConfirm(false);
                    break;
            }

            dialog.destroy();
        });

        dialog.show();
    }

    static _createComparisonGrid(title, keys, settingsManager) {
        const schema = settingsManager._schema;
        let hasChanges = false;

        const grid = new Gtk.Grid({
            column_spacing: 12,
            row_spacing: 12,
            halign: Gtk.Align.CENTER,
            hexpand: true,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
        });

        // Add headers
        const headers = [title, _('Custom'), _('Saved')];
        headers.forEach((header, col) => {
            const label = new Gtk.Label({
                label: header,
                halign: Gtk.Align.CENTER,
                hexpand: true,
                width_chars: Math.max(6, header.length),
            });
            label.add_css_class('heading');
            grid.attach(label, col, 0, 1, 1);
        });

        // Add rows for different values
        let row = 1;
        keys.forEach(key => {
            const current = settingsManager.currentSymbols[key] ?? '';
            const saved = settingsManager.savedSymbols[key] ?? '';

            if (current !== saved) {
                hasChanges = true;
                const schemaKey = schema.get_key(key);
                const cells = [_(schemaKey.get_summary()), current, saved];

                cells.forEach((value, col) => {
                    const label = new Gtk.Label({
                        label: value,
                        halign: Gtk.Align.CENTER,
                        hexpand: true,
                    });

                    if (col === 0) {
                        label.add_css_class('heading');
                    }

                    grid.attach(label, col, row, 1, 1);
                });

                row++;
            }
        });

        return hasChanges ? grid : null;
    }
}

/**
 * Group Builder - Creates preference groups with simple reset and save buttons
 */
class GroupBuilder {
    constructor(settingsManager, page, parentWindow) {
        this.settingsManager = settingsManager;
        this.page = page;
        this.parentWindow = parentWindow; // Adw.PreferencesWindow (Gtk.Window)
    }

    createGroup(title, description, keys, defaultValues) {
        console.debug(`${LOG_TAG} Creating group: ${title}`);

        const group = new Adw.PreferencesGroup({ title, description });
        const entryManager = new EntryManager();
        const simpleManager = new SimpleManager(this.settingsManager, keys, defaultValues);

        // Create control buttons
        const { resetButton, saveButton, headerBox } = this._createControlButtons();
        group.set_header_suffix(headerBox);

        // Setup button logic
        this._setupButtonLogic(resetButton, saveButton, entryManager, simpleManager);

        // Create entry rows
        this._createEntryRows(group, keys, entryManager, () => {
            this._updateButtonStates(resetButton, saveButton, simpleManager);
        });

        this.page.add(group);
        console.debug(`${LOG_TAG} Group created: ${title}`);
    }

    _createControlButtons() {
        const headerBox = new Gtk.Box({ spacing: 6 });

        const resetButton = Gtk.Button.new_with_label(_('Reset to defaults'));
        resetButton.valign = Gtk.Align.CENTER;

        const saveButton = Gtk.Button.new_with_label(_('Save'));
        saveButton.add_css_class('suggested-action');
        saveButton.valign = Gtk.Align.CENTER;
        saveButton.visible = false;

        headerBox.append(resetButton);
        headerBox.append(saveButton);

        return { resetButton, saveButton, headerBox };
    }

    _setupButtonLogic(resetButton, saveButton, entryManager, simpleManager) {
        const updateButtonStates = () => {
            this._updateButtonStates(resetButton, saveButton, simpleManager);
        };

        // Handle reset button
        resetButton.connect('clicked', () => {
            console.debug(`${LOG_TAG} Reset button clicked`);
            simpleManager.applyDefaults(entryManager);
            updateButtonStates();
        });

        // Handle save button
        saveButton.connect('clicked', () => {
            console.debug(`${LOG_TAG} Save button clicked`);
            simpleManager.saveCurrentAsPreset();
            updateButtonStates();
        });

        // Handle external changes to saved symbols
        this.settingsManager.connect('changed::saved-symbols', () => {
            console.debug(`${LOG_TAG} Saved symbols changed externally`);
            const newSavedSymbols = this.settingsManager._settings.get_value('saved-symbols').deep_unpack();

            if (!this.settingsManager.symbolsEqual(this.settingsManager.savedSymbols, newSavedSymbols)) {
                this.settingsManager.savedSymbols = newSavedSymbols;
                updateButtonStates();
            }
        });

        // Initial update
        updateButtonStates();
    }

    _updateButtonStates(resetButton, saveButton, simpleManager) {
        const isDefault = simpleManager.isCurrentEqualToDefault();
        const isSaved = simpleManager.isCurrentEqualToSaved();

        resetButton.sensitive = !isDefault;
        saveButton.visible = !isSaved;

        console.debug(`${LOG_TAG} Button states - Reset enabled: ${!isDefault}, Save visible: ${!isSaved}`);
    }

    _createEntryRows(group, keys, entryManager, onEntryChanged) {
        // keys is no longer used; we build rows per MODIFIERS
        MODIFIERS.forEach(name => {
            const keys = modifierKeys(name);
            const schemaKeySymbol = this.settingsManager.getSchemaKey(keys.symbol);
            const schemaKeyIcon = this.settingsManager.getSchemaKey(keys.icon);
            const schemaKeyUseIcon = this.settingsManager.getSchemaKey(keys.useIcon);

            if (!schemaKeySymbol || !schemaKeyIcon || !schemaKeyUseIcon) {
                console.warn(`${LOG_TAG} Schema missing keys for modifier: ${name}`);
                return;
            }

            // Create widgets
            const textEntry = new Gtk.Entry({ text: this.settingsManager.currentSymbols[keys.symbol] || '' });

            // GTK4: Use Gtk.FileDialog with a normal button instead of deprecated/non-existent FileChooserButton
            const createFilePickerButton = (initialPath, title, onPicked) => {
                const button = new Gtk.Button({
                    label: initialPath ? GLib.path_get_basename(initialPath) : _('Select file...'),
                });

                const updateLabel = (path) => {
                    button.label = path ? GLib.path_get_basename(path) : _('Select file...');
                };
                // expose for external updates when setting changes elsewhere
                button._updateChosenPathLabel = updateLabel;

                button.connect('clicked', () => {
                    const dialog = new Gtk.FileDialog({ title });
                    // نگه داشتن رفرنس تا پایان عملیات (جلوگیری از GC)
                    button._activeFileDialog = dialog;

                    // Filters: SVG and common raster images (سازگار با GTK4: استفاده از Gio.ListStore)
                    const svgFilter = new Gtk.FileFilter();
                    svgFilter.set_name('SVG');
                    svgFilter.add_suffix('svg');
                    svgFilter.add_mime_type('image/svg+xml');

                    const imgFilter = new Gtk.FileFilter();
                    imgFilter.set_name('Images');
                    imgFilter.add_mime_type('image/png');
                    imgFilter.add_mime_type('image/jpeg');
                    imgFilter.add_mime_type('image/webp');

                    const filtersStore = Gio.ListStore.new(Gtk.FileFilter.$gtype);
                    filtersStore.append(svgFilter);
                    filtersStore.append(imgFilter);
                    dialog.set_filters(filtersStore);

                    // اگر مسیر اولیه موجود است، دایرکتوری شروع را ست کنیم
                    if (initialPath && GLib.file_test(initialPath, GLib.FileTest.EXISTS)) {
                        const folder = Gio.File.new_for_path(initialPath).get_parent();
                        if (folder) dialog.set_initial_folder(folder);
                    }

                    const parent = this.parentWindow instanceof Gtk.Window ? this.parentWindow : button.get_root();

                    // GNOME 46: Promise API
                    dialog.open(parent).then(file => {
                        const path = file ? file.get_path() : '';
                        onPicked(path || '');
                        updateLabel(path || '');
                        button._activeFileDialog = null;
                    }).catch(() => {
                        // cancel یا خطا؛ نادیده بگیر
                        button._activeFileDialog = null;
                    });
                });

                return button;
            };

            const fileButton = createFilePickerButton(
                this.settingsManager.currentSymbols[keys.icon] || '',
                _(schemaKeyIcon.get_summary()),
                (newValue) => {
                    if (this.settingsManager.currentSymbols[keys.icon] !== newValue) {
                        this.settingsManager.setString(keys.icon, newValue);
                        onEntryChanged();
                    }
                }
            );

            const stack = new Gtk.Stack({ hexpand: true });
            stack.add_named(textEntry, 'text');
            stack.add_named(fileButton, 'file');

            const useIconSwitch = new Gtk.Switch({ active: this.settingsManager.currentUseIcon[keys.useIcon] });

            // ActionRow with switch as suffix
            const row = new Adw.ActionRow({ title: _(schemaKeySymbol.get_summary()) });
            const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
            box.append(stack);
            box.append(useIconSwitch);
            row.add_suffix(box);
            row.activatable_widget = textEntry;
            group.add(row);

            // Wire text entry
            entryManager.addEntry(keys.symbol, textEntry, (changedKey, newValue) => {
                const fullKey = keys.symbol;
                if (this.settingsManager.currentSymbols[fullKey] !== newValue) {
                    this.settingsManager.setString(fullKey, newValue);
                    onEntryChanged();
                }
            });

            this.settingsManager.connect(`changed::${keys.symbol}`, () => {
                const newValue = this.settingsManager._settings.get_string(keys.symbol);
                if (this.settingsManager.currentSymbols[keys.symbol] !== newValue) {
                    this.settingsManager.currentSymbols[keys.symbol] = newValue;
                    entryManager.updateEntry(keys.symbol, newValue);
                    onEntryChanged();
                }
            });

            // Wire file selection updates (settings → UI)
            this.settingsManager.connect(`changed::${keys.icon}`, () => {
                const newValue = this.settingsManager._settings.get_string(keys.icon);
                if (this.settingsManager.currentSymbols[keys.icon] !== newValue) {
                    this.settingsManager.currentSymbols[keys.icon] = newValue;
                    if (typeof fileButton._updateChosenPathLabel === 'function') {
                        fileButton._updateChosenPathLabel(newValue);
                    }
                    onEntryChanged();
                }
            });

            // Wire switch
            useIconSwitch.connect('state-set', (_switch, isActive) => {
                // state-set handler gets proposed state; set it explicitly
                this.settingsManager.setBoolean(keys.useIcon, isActive);
                // Update UI stack
                stack.set_visible_child_name(isActive ? 'file' : 'text');
                onEntryChanged();
                return false; // allow default toggling
            });

            this.settingsManager.connect(`changed::${keys.useIcon}`, () => {
                const newVal = this.settingsManager._settings.get_boolean(keys.useIcon);
                if (this.settingsManager.currentUseIcon[keys.useIcon] !== newVal) {
                    this.settingsManager.currentUseIcon[keys.useIcon] = newVal;
                    useIconSwitch.set_active(newVal);
                    stack.set_visible_child_name(newVal ? 'file' : 'text');
                    onEntryChanged();
                }
            });

            // Set initial visible child according to setting
            stack.set_visible_child_name(this.settingsManager.currentUseIcon[keys.useIcon] ? 'file' : 'text');
        });
    }
}

/**
 * Main Preferences Class
 */
export default class KeyboardInformerPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        console.debug(`${LOG_TAG} Initializing preferences window`);

        this.settingsManager = new SettingsManager(this);
        this.settingsManager.initialize();

        const page = new Adw.PreferencesPage();
        const groupBuilder = new GroupBuilder(this.settingsManager, page, window);

        // Create preference groups
        this._createPreferenceGroups(groupBuilder);

        window.add(page);
        window.show();

        console.debug(`${LOG_TAG} Preferences window initialized`);
    }

    _createPreferenceGroups(groupBuilder) {
        const symbolPresets = getSymbolPresets(this.settingsManager);

        // Build a single group containing all modifiers
        const keys = [];
        MODIFIERS.forEach(name => {
            const ks = modifierKeys(name);
            keys.push(ks.symbol, ks.icon, ks.useIcon);
        });

        groupBuilder.createGroup(
            _('Symbols for modifier keys'),
            _('Sets the symbols or icons displayed for modifier keys when they are pressed.'),
            keys,
            symbolPresets.modifiers.get(_('Symbols'))
        );
    }
}

export function init() {
    return new KeyboardInformerPreferences();
}
