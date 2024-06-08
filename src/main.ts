// main.ts

import {
	Plugin,
	Setting,
	SettingTab,
	Platform,
	normalizePath,
	// PluginSettingTab,
	// App,
} from 'obsidian';
import { around } from 'monkey-around';
import { setAnnotationFilePath, loadAnnotations, saveAnnotations } from './db';
import * as fs from 'fs';

interface PluginAnnotation {
	[pluginId: string]: string;
}

export default class PluginsAnnotations extends Plugin {
	private annotations: PluginAnnotation = {};
	private pluginNameToIdMap ? : Record < string, string >;
	private mutationObserver: MutationObserver | null = null;
	private removeMonkeyPatch: (() => void) | null = null;
	private skipNextAddComments = false;
	private saveTimeout: number | null = null;
	private fsWatcher: fs.FSWatcher | null = null;
	private observedTab: SettingTab | null = null;

	async onload() {
		// console.log('Loading Plugins Annotations');
		
		const annotationsFilePath = await this.getAnnotationsFilePath();
		if (!annotationsFilePath) {
			console.error(`The plugin '${this.manifest.name}' could not be loaded. The path to the annotation file could not be found.`);
			return;
		}

		setAnnotationFilePath(annotationsFilePath);

		this.app.workspace.onLayoutReady(() => {
			this.patchSettings();

			const activeTab = this.app.setting.activeTab;
			if (activeTab && activeTab.id === 'community-plugins') {
				this.observeTab(activeTab);
			}
		});
	}

	async getAnnotationsFilePath(): Promise<string | null> {
		if (!this.manifest.id) {
			return null;
		}
		const pluginFolder = this.app.vault.configDir;
		const filePath = normalizePath(`${pluginFolder}/plugins/${this.manifest.id}/data.json`);
		return filePath;
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
		this.annotations = await loadAnnotations(this.app.vault);
		
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

						label.addEventListener('click', (event) => {
							event.stopPropagation();
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
		
		this.saveTimeout = window.setTimeout(() => {
			saveAnnotations(this.app.vault, this.annotations);
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
