// main.ts

import {
	Plugin,
	Setting,
	SettingTab,
	// PluginSettingTab,
	// App,
} from 'obsidian';
import { around } from 'monkey-around';
import { setPluginId, loadAnnotations, saveAnnotations } from './db';

interface PluginAnnotation {
	[pluginId: string]: string;
}

export default class PluginComment extends Plugin {
	private annotations: PluginAnnotation = {};
	private pluginNameToIdMap ? : Record < string, string >;
	private mutationObserver: MutationObserver | null = null;
	private removeMonkeyPatch: (() => void) | null = null;
	private skipNextAddComments = false;

	async onload() {
		console.log('Loading Plugin Comment');
		setPluginId(this.manifest.id);

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
		this.removeMonkeyPatch = around(this.app.setting, {
			openTab: (next: (tab: SettingTab) => void) => {
				return function(this: Setting, tab: SettingTab) {
					next.call(this, tab);
					if (tab && tab.id === 'community-plugins') {
						// Create a mapping of plugin names to IDs
						self.pluginNameToIdMap = self.getPluginNameToIdMap();
						self.observeTab(tab);
					}
				};
			},
			onClose: (next: () => void) => {
				return function (this: Setting) {
					const result = next.call(this);
					// closing settings pane
					self.disconnectObservers();
					return result;
				};
			}
		});
	}

	observeTab(tab: SettingTab) {
		if(!this.mutationObserver) {
			const observer = new MutationObserver(() => {
				if(!this.skipNextAddComments){
					this.skipNextAddComments = true;
					this.addComments(tab);	
				} else {
					this.skipNextAddComments = false;
				}
				
			});

			observer.observe(tab.containerEl, { childList: true, subtree: true });
			this.mutationObserver = observer;
		}

		// Initial call to add comments to already present plugins
		this.skipNextAddComments = true;
		this.addComments(tab);
	}

	disconnectObservers() {
		if (this.mutationObserver) {
			this.mutationObserver.disconnect();
			this.mutationObserver = null;
		}
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

				if (this.pluginNameToIdMap === undefined) { return; }
				if (!pluginName) {
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
						comment_container.className = 'plugin-comment';

						const label = document.createElement('div');
						label.innerText = `Personal annotation:`;
						label.className = 'plugin-comment-label';
						comment_container.appendChild(label);

						const comment = document.createElement('div');
						comment.className = 'plugin-comment-annotation';
						comment.contentEditable = 'true';
						const placeholder = `Add your personal comment about '${pluginName}' here...`;
						let isPlaceholder = this.annotations[pluginId] ? false : true;
						const initialText = this.annotations[pluginId] || placeholder;

						if(isPlaceholder) {
							comment.addClass('plugin-comment-placeholder');
						}

						comment.innerText = initialText;

						// Remove placeholder class when user starts typing
						comment.addEventListener('focus', () => {
							if (isPlaceholder) {
								comment.innerText = '';
								comment.classList.remove('plugin-comment-placeholder');
								isPlaceholder = false;
							}
						});

						comment.addEventListener('blur', () => {
							if (comment.innerText.trim() === '') {
								comment.innerText = placeholder;
								comment.classList.add('plugin-comment-placeholder');
								isPlaceholder = true;
							}
						});

						// Prevent click event propagation to parent
						comment.addEventListener('click', (event) => {
							event.stopPropagation();
						});

						// Save the comment on input change
						comment.addEventListener('input', () => {
							if (comment.innerText.trim() === '') {
								delete this.annotations[pluginId];
								comment.classList.add('plugin-comment-placeholder');
								isPlaceholder = true;
							} else {
								this.annotations[pluginId] = comment.innerText;
								comment.classList.remove('plugin-comment-placeholder');
								isPlaceholder = false;
							}
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

		// Uninstall the monkey patch
		if (this.removeMonkeyPatch) {
			this.removeMonkeyPatch();
		}
	}
}
