# Change log

## Bug fix

- The **Show GitHub links** setting is now honoured at startup. The list of community plugins backing the GitHub icons was previously downloaded on every launch even when the option was turned off, because the download started before the saved settings had been read. Turning the option on later now fetches the list on demand, so the icons still appear without restarting Obsidian.
- The same list is no longer downloaded twice while Obsidian starts up.

## Compatibility

- Requires Obsidian **1.13.0** or newer, unchanged from 1.8.0.
