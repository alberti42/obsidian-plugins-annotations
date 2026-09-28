# Change log

## New feature

- You can now adopt a Markdown file that already contains annotations. When you select an existing file in **Markdown File Path**, the plugin asks whether to **Import** your personal annotations from the file or **Replace** the file with your current annotations. Importing replaces all your current annotations with those in the file. If you choose to replace the file, the existing file is moved to the trash. Before this release, the only choice was to replace the file.

## Bug fixes

- **Store annotations in a Markdown file** can be turned on when no path was set before. The toggle used to flip back to off, and the path field never appeared, so the only way to enable the option was to edit `data.json` by hand. Thanks to @Gelaende51 for reporting this in [#28](https://github.com/alberti42/obsidian-plugins-annotations/issues/28).
- Turning the toggle on always shows an empty path field. It used to restore the previous path without asking, and then wrote your current annotations over that file, discarding any edits made to it in the meantime. Every path now goes through the dialog that asks whether to create, import or replace the file.
- If you leave the settings tab with the toggle on but no path set, the toggle is turned off.
- If the Markdown file cannot be created, for example because its name contains characters the file system does not allow, the settings show an error under the path field and the path is cleared. The path used to stay saved while no file existed.
- A failed write to the Markdown file no longer stops the plugin from reading later changes to that file until Obsidian is restarted.

## Compatibility

- Requires Obsidian **1.13.0** or newer, unchanged from 1.8.2.
