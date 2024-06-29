// main.ts

import {
	Plugin,
	Setting,
	SettingTab,
	Platform,
    App,
    PluginSettingTab,
	// PluginSettingTab,
	// App,
} from 'obsidian';
import { around } from 'monkey-around';
import { PluginAnnotationDict, PluginsAnnotationsSettings } from './types';

const DEFAULT_SETTINGS: PluginsAnnotationsSettings = {
	annotations: {},
	plugins_annotations_uuid: 'FAA70013-38E9-4FDF-B06A-F899F6487C19',
	hide_placeholders: false,
	delete_placeholder_string_on_insertion: false,
}

export default class PluginsAnnotations extends Plugin {
	settings: PluginsAnnotationsSettings = {...DEFAULT_SETTINGS};
	private annotations: PluginAnnotationDict = {};
	private pluginNameToIdMap ? : Record < string, string >;
	private mutationObserver: MutationObserver | null = null;
	private removeMonkeyPatch: (() => void) | null = null;
	private skipNextAddComments = false;
	private saveTimeout: number | null = null;
	private observedTab: SettingTab | null = null;
	
	async onload() {
		// console.log('Loading Plugins Annotations');

		// Load and add settings tab
		await this.loadSettings();
		this.addSettingTab(new PluginsAnnotationsSettingTab(this.app, this));
		
		this.app.workspace.onLayoutReady(() => {
			this.patchSettings();

			const activeTab = this.app.setting.activeTab;
			if (activeTab && activeTab.id === 'community-plugins') {
				this.observeTab(activeTab);
			}
		});
	}

	async loadSettings() {
		const data = await this.loadData();
		
		let settings: PluginsAnnotationsSettings;

		// Check if theData contains the field 'Annotations' with the right id
		if (data && data.annotations && data.plugins_annotations_uuid === 'FAA70013-38E9-4FDF-B06A-F899F6487C19') {
			settings = data;
		} else {
			// If not, assume theData itself is the annotations object
			settings = {...DEFAULT_SETTINGS};
			settings.annotations = data;
		}

		this.settings = Object.assign({}, DEFAULT_SETTINGS, settings);
	}

	async saveSettings(settings:PluginsAnnotationsSettings) {
		try {
			await this.saveData(settings);
		} catch (error) {
			console.error('Failed to save annotations:', error);
		}	
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
		// force reload - this is convenient because since the loading of the plugin
		// there could be changes in the settings due to synchronization among devices
		// which only happens after the plugin is loaded
		await this.loadSettings();

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
						if (Platform.isMobile) {
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
						let isPlaceholder = this.settings.annotations[pluginId] ? false : true;
						const initialText = this.settings.annotations[pluginId] || placeholder;

						if (isPlaceholder) {
							comment.classList.add('plugin-comment-placeholder');
							if (this.settings.hide_placeholders) {
								comment_container.classList.add('plugin-comment-placeholder');
							}
						}

						comment.innerText = initialText;

						// Remove placeholder class when user starts typing
						comment.addEventListener('focus', () => {
							if (isPlaceholder) {
								if(this.settings.delete_placeholder_string_on_new_input) {
									comment.innerText = '';
								}
								comment.classList.remove('plugin-comment-placeholder');
								if (this.settings.hide_placeholders) {
									comment_container.classList.remove('plugin-comment-placeholder');
								}
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
								if (this.settings.hide_placeholders) {
									comment_container.classList.add('plugin-comment-placeholder');
								}
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
								delete this.settings.annotations[pluginId];
								comment.classList.add('plugin-comment-placeholder');
							} else {
								isPlaceholder = false;
								this.settings.annotations[pluginId] = comment.innerText;
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

		const settings = this.settings;

		this.saveTimeout = window.setTimeout(() => {
			this.saveSettings(settings);
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


class PluginsAnnotationsSettingTab extends PluginSettingTab {
	plugin: PluginsAnnotations;

	constructor(app: App, plugin: PluginsAnnotations) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		const plugins_pane = createFragment((frag) => {
				const em = frag.createEl('em');
				const link = frag.createEl('a', { href: '#', text: 'Community plugins'});
				link.onclick = () => {
					this.app.setting.openTabById('community-plugins');
				};
				em.appendChild(link)
			});

		containerEl.empty();

		new Setting(containerEl).setName('Annotations').setHeading();

		const instructions = createFragment((frag) => {
				frag.appendText('Please enter your personal annotations about the installed plugins directly in the ');
				frag.appendChild(plugins_pane);
				frag.appendText(' pane.');
				});

		containerEl.appendChild(instructions);

		new Setting(containerEl).setName('Display').setHeading();
		
		new Setting(containerEl)
			.setName('Hide empty annotations:')
			.setDesc(createFragment((frag) => {
				frag.appendText('If this option is enabled, only annotations set by the user will be shown. If you want to insert an annotation to a plugin for the first time, hover with the mouse over the chosen plugin in the ');
				frag.appendChild(plugins_pane);
				frag.appendText(' pane. The annotation field will appear automatically.');
			}))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.hide_placeholders)
				.onChange(async (value: boolean) => {
					this.plugin.settings.hide_placeholders = value;
					await this.plugin.debouncedSaveAnnotations();
				}));


		new Setting(containerEl)
			.setName('Delete placeholder text when inserting a new annotation:')
			.setDesc('If this option is enabled, the placeholder text will be deleted automatically when you start typing a new annotation. If disabled, the placeholder text will be selected for easier replacement. This is a minor customization.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.delete_placeholder_string_on_insertion)
				.onChange(async (value: boolean) => {
					this.plugin.settings.delete_placeholder_string_on_insertion = value;
					await this.plugin.debouncedSaveAnnotations();
			}));
	}
}
