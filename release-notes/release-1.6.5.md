# Change log

## Bug fixes

- When disabling the plugin, the lock icon is now removed.
- This should fix the bug of multiple lock icons being created when the plugin `Divide & Conquer` was used. The plugin disables and re-enables plugins. Every time this plugin was reloaded, a new icon was created because the previous one was never removed.
