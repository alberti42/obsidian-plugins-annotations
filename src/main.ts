import {
	Plugin,
	Setting,
	SettingTab,
	// PluginSettingTab,
	// App,
} from 'obsidian';
import { around } from 'monkey-around';
import { loadAnnotations, saveAnnotations } from './db';

interface PluginAnnotation {
	[pluginId: string]: string;
}

export default class PluginComment extends Plugin {
	private annotations: PluginAnnotation = {};
	private pluginNameToIdMap?: Record < string, string >;

	async onload() {
		console.log('Loading Plugin Comment');
		this.annotations = await loadAnnotations(this.app.vault);

		this.app.workspace.onLayoutReady(() => {
			this.patchSettings();
		});
	}

	getPluginNameToIdMap(): Record < string, string > {
		const map: Record < string, string > = {};
		for (const pluginId in this.app.plugins.manifests) {
			const plugin = this.app.plugins.manifests[pluginId];
			if (plugin) {
				map[plugin.name] = plugin.id;
			}
		}
		return map;
	}

	patchSettings() {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this;

		// Patch openTab to detect when a tab is opened
		this.register(
			around(this.app.setting, {
				openTab: (next: (tab: SettingTab) => void) => {
					return function(this: Setting, tab: SettingTab) {
						const result = next.call(this, tab);
						if (tab && tab.id === 'community-plugins') {
							// Create a mapping of plugin names to IDs
							self.pluginNameToIdMap = self.getPluginNameToIdMap();
							self.observeTab(tab);
						}
						return result;
					};
				},
			})
		);
	}

	observeTab(tab: SettingTab) {
		const observer = new MutationObserver(() => {
			this.addComments(tab);
		});

		observer.observe(tab.containerEl, { childList: true, subtree: true });

		// Initial call to add comments to already present plugins
		this.addComments(tab);

		// Clean up observer on unload
		this.register(() => observer.disconnect());
	}

	addComments(tab: SettingTab) {
		const pluginsContainer = tab.containerEl.querySelector('.installed-plugins-container');
		if (!pluginsContainer) return;

		const plugins = pluginsContainer.querySelectorAll('.setting-item');
		plugins.forEach(plugin => {
			const settingItemInfo = plugin.querySelector('.setting-item-info');
			if (settingItemInfo) {
				const pluginNameDiv = plugin.querySelector('.setting-item-name');
				const pluginName = pluginNameDiv ? pluginNameDiv.textContent : null;
				
				if(this.pluginNameToIdMap === undefined) { return; }
				if(!pluginName) {
					console.warn('Plugin name not found');
					return;
				}

				const pluginId = this.pluginNameToIdMap[pluginName];
				if (!pluginId) {
					console.warn(`Plugin ID not found for plugin name: ${pluginName}`);
					return;
				}
				
				const descriptionDiv = settingItemInfo.querySelector('.setting-item-description');
				if (descriptionDiv) {
					const commentDiv = descriptionDiv.querySelector('.plugin-comment');
					if (!commentDiv) {
						const comment_container = document.createElement('div');
						comment_container.className = 'plugin-comment'

						const label = document.createElement('div');
						label.innerText = `Personal annotation:`;
						label.className = 'plugin-comment-label';
						comment_container.appendChild(label);

						const comment = document.createElement('div');
						comment.className = 'plugin-comment';
						comment.contentEditable = 'true';
						comment.innerText = this.annotations[pluginId] || `Add your personal comment about '${pluginName}' here...`;

						// Prevent click event propagation to parent
						comment.addEventListener('click', (event) => {
							event.stopPropagation();
						});

						// Save the comment on input change
						comment.addEventListener('input', () => {
							this.annotations[pluginId] = comment.innerText;
							saveAnnotations(this.app.vault, this.annotations);
						});

						comment_container.appendChild(comment);

						descriptionDiv.appendChild(comment_container);
					}
				}
			}
		});
	}

	onunload() {
		console.log('Unloading Plugin Comment');
	}
}

/*
class CommentSettingTab extends PluginSettingTab {
  constructor(app: App, plugin: Plugin) {
	super(app, plugin);
  }

  display() {
	const { containerEl } = this;

	containerEl.empty();
	containerEl.createEl('h2', { text: 'Plugin Comment Settings' });

	// Add any settings here if necessary
  }
}
*/
