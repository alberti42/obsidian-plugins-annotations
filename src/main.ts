// main.ts

import {
	Plugin,
	Setting,
	SettingTab,
	Platform,
	// PluginSettingTab,
	// App,
} from 'obsidian';
import { around } from 'monkey-around';
import * as db from './db';
import { PluginAnnotationDict } from './types';

export default class PluginsAnnotations extends Plugin {
	private annotations: PluginAnnotationDict = {};
	private pluginNameToIdMap ? : Record < string, string >;
	private mutationObserver: MutationObserver | null = null;
	private removeMonkeyPatch: (() => void) | null = null;
	private skipNextAddComments = false;
	private saveTimeout: number | null = null;
	private observedTab: SettingTab | null = null;

	async onload() {
		// console.log('Loading Plugins Annotations');
		
		db.setPluginObj(this);

		this.app.workspace.onLayoutReady(() => {
			this.patchSettings();

			const activeTab = this.app.setting.activeTab;
			if (activeTab && activeTab.id === 'community-plugins') {
				this.observeTab(activeTab);
			}
		});
	}

	constructPluginNameToIdMap() {
		const map: Record < string, string > = {};
		for (const pluginId in this.app.plugins.manifests) {
			const plugin = this.app.plugins.manifests[pluginId];
			if (plugin) {
				map[plugin.name] = plugin.id;
			}
		}
		this.pluginNameToIdMap = map;
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
		// Create a mapping of plugin names to IDs
		this.constructPluginNameToIdMap();
							
		if(!this.mutationObserver) {
			this.observedTab = tab;

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
			this.observedTab = null;
		}
	}

	async addComments(tab: SettingTab) {
		this.annotations = await db.loadAnnotations(this.app.vault);
		
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
						if(Platform.isMobile){
							label.innerText = `Annotation`;
						} else {
							label.innerText = `Personal annotation:`;
						}
						label.className = 'plugin-comment-label';
						comment_container.appendChild(label);
						
						const comment = document.createElement('div');
						comment.className = 'plugin-comment-annotation';
						comment.contentEditable = 'true';
						const placeholder = `Add your personal comment about '${pluginName}' here...`;
						let isPlaceholder = this.annotations[pluginId] ? false : true;
						const initialText = this.annotations[pluginId] || placeholder;

						if(isPlaceholder) {
							comment.classList.add('plugin-comment-placeholder');
							comment_container.style.display = 'none';
						}

						comment.innerText = initialText;

						// Remove placeholder class when user starts typing
						comment.addEventListener('focus', () => {
							if (isPlaceholder) {
								// comment.innerText = '';
								comment.classList.remove('plugin-comment-placeholder');
								comment_container.style.display = 'block';
								const range = document.createRange();
								range.selectNodeContents(comment);
								const selection = window.getSelection();
								if (selection) {
									selection.removeAllRanges();
									selection.addRange(range);
								}
							}
						});

						// Add placeholder class back if no changes are made
						comment.addEventListener('blur', () => {
							if (isPlaceholder || comment.innerText.trim() === '') {
								comment.innerText = placeholder;
								comment.classList.add('plugin-comment-placeholder');
								comment_container.style.display = 'none';
								isPlaceholder = true;
							}
						});

						label.addEventListener('click', (event) => {
							event.stopPropagation();
						});
						
						// Prevent click event propagation to parent
						comment.addEventListener('click', (event) => {
							event.stopPropagation();
						});

						// Save the comment on input change and update inputTriggered status
						comment.addEventListener('input', () => {
							if (comment.innerText.trim() === '') {
								isPlaceholder = true;
								delete this.annotations[pluginId];
								comment.classList.add('plugin-comment-placeholder');
							} else {
								isPlaceholder = false;
								this.annotations[pluginId] = comment.innerText;
								comment.classList.remove('plugin-comment-placeholder');
								isPlaceholder = false;
							}
							this.debouncedSaveAnnotations();
						});

						comment_container.appendChild(comment);

						descriptionDiv.appendChild(comment_container);
					}
				}
			}
		});
	}


	debouncedSaveAnnotations() {
		// timeout after 250 ms
		const timeout_ms = 250;

		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout);
		}

		const annotations = this.annotations;

		this.saveTimeout = window.setTimeout(() => {
			db.saveAnnotations(this.app.vault, annotations);
			this.saveTimeout = null;
		}, timeout_ms);
	}

	removeCommentsFromTab() {
		if (this.observedTab) {
			const commentElements = this.observedTab.containerEl.querySelectorAll('.plugin-comment');
			commentElements.forEach(element => {
				element.remove();
			});
		}
	}

	onunload() {
		// console.log('Unloading Plugins Annotations');

		// Remove all comments
		this.removeCommentsFromTab();

		// Just in case, disconnect observers if they still exist
		this.disconnectObservers();

		// Uninstall the monkey patch
		if (this.removeMonkeyPatch) {
			this.removeMonkeyPatch();
		}		
	}
}
