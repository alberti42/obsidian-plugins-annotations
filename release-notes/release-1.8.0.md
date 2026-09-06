# Change log

## Improvements

- The settings tab is now built with Obsidian's declarative settings API, introduced in Obsidian 1.13. Its settings are now indexed by Obsidian's global settings search, so you can jump straight to them from the search box at the top of the settings window.
- Better behaviour in pop-out windows: the plugin now works against the active window's document instead of assuming the main one, and uses cross-window-safe element checks.
- The list of community plugins used for the GitHub icons is now fetched through Obsidian's own network API, which avoids CORS restrictions.

## Changes

- The per-setting **Reset to default** buttons have been removed from the settings tab, following Obsidian's current design for settings panes.

## Under the hood

- Addressed the findings of the automated plugin review: no direct `innerHTML` writes, no Node.js `path` import, no deprecated `MarkdownRenderer.renderMarkdown` or `SettingTab.display`, and no unhandled promises.
- Release assets are now published with GitHub build provenance attestations, so they can be cryptographically verified as having been built from this repository.

## Compatibility

- Requires Obsidian **1.13.0** or newer, unchanged from 1.7.12. Users on older Obsidian versions keep receiving 1.7.11.
