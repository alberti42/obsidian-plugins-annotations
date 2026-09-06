# Change log

## Bug fixes

- The lock and unlock icons are visible again. They disappeared in 1.8.0, both in the **Editable** setting and next to **Installed plugins** in the Community plugins pane. The icons are now drawn from the icon set that Obsidian already ships, so they also follow the current theme. The lock button kept working while the icon was missing, which is why the regression was easy to overlook.
- Annotations no longer accumulate rendered Markdown components for as long as the plugin stays loaded. Each annotation now releases the previous render, and controls are released once their annotation leaves the pane.
- One paragraph of the instructions in the settings tab was built as a `<p2>` element, which is not valid HTML and therefore rendered inline without paragraph spacing. It is a real paragraph now.

## Under the hood

- The plugin no longer decodes any of its assets at runtime: the icons are plain, readable SVG source instead of base64 blobs.
- The linting setup was replaced with the current one, including the rule set that the Obsidian community plugin review uses, so these classes of problem are caught before a release rather than after one.

## Compatibility

- Requires Obsidian **1.13.0** or newer, unchanged from 1.8.1.
