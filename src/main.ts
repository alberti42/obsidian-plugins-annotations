// main.ts

import {
	Plugin,
	Setting,
	SettingTab,
	Platform,
	MarkdownRenderer,
	Plugins,
	PluginManifest,
	FileSystemAdapter,
	TAbstractFile,
	// PluginSettingTab,
	// App,
} from 'obsidian';
import { around } from 'monkey-around';
import { AnnotationType, isPluginAnnotation, isPluginsAnnotationsSettings, parseAnnotation, PluginAnnotationDict, PluginBackup, PluginsAnnotationsSettings } from './types';
import { PluginAnnotationDict_1_4_0, PluginsAnnotationsSettings_1_4_0, PluginsAnnotationsSettings_1_3_0, isPluginAnnotationDictFormat_1_3_0, isSettingsFormat_1_3_0, isSettingsFormat_1_4_0, parseAnnotation_1_4_0, } from 'types_legacy'
import { DEFAULT_SETTINGS_1_3_0, DEFAULT_SETTINGS_1_4_0 } from './defaults_legacy';
import { DEFAULT_SETTINGS } from 'defaults';
import { PluginsAnnotationsSettingTab } from 'settings_tab'
import * as path from 'path';
import { readAnnotationsFromMdFile, writeAnnotationsToMdFile } from 'manageAnnotations';
import { sortPluginAnnotationsByName } from 'utils';

export default class PluginsAnnotations extends Plugin {
	settings: PluginsAnnotationsSettings = structuredClone(DEFAULT_SETTINGS);
	pluginNameToIdMap: Record<string,string> = {};
	pluginIdToNameMap: Record<string,string> = {};

	private mutationObserver: MutationObserver | null = null;
	private saveTimeout: number | null = null;
	private observedTab: SettingTab | null = null;
	private vaultPath: string | null = null;

	async onload() {

		// console.clear();
		
		// console.log('Loading Plugins Annotations');

		// Add settings tab. It avoids loading the setting at this stage
		// because the cache about the files in the vault is not created yet.
		this.addSettingTab(new PluginsAnnotationsSettingTab(this.app, this));
		
		this.app.workspace.onLayoutReady(() => {
			this.patchSettings();

			const activeTab = this.app.setting.activeTab;
			if (activeTab && activeTab.id === 'community-plugins') {
				this.observeTab(activeTab);
			}
		});

		this.app.vault.on('modify', (modifiedFile: TAbstractFile) => {
			if(this.settings.markdown_file_path !== '') {
				if (modifiedFile.path === this.settings.markdown_file_path) {
					readAnnotationsFromMdFile(this);
				}
			}
		});
	}

	/* Load settings for different versions */
	async importSettings(data: unknown): Promise<{importedSettings: unknown, wasUpdated: boolean}> {

		// Set to true when the settings are updated to the new format
		let wasUpdated = false;
		
		// Nested function to handle different versions of settings
		const getSettingsFromData = async (data: unknown): Promise<unknown> => {
			
			if(data === null) { // if the file is empty
				return data;
			} else if (isPluginsAnnotationsSettings(data)) {
				const settings: PluginsAnnotationsSettings = data;
				return settings;
			} else if (isSettingsFormat_1_4_0(data)) { // previous versions where the name of the plugins was not stored
				// Make a backup
				await this.backupSettings('Settings before upgrade from 1.4 to 1.5',data);

				const default_settings = DEFAULT_SETTINGS;

				// Upgrade annotations format
				const upgradedAnnotations: PluginAnnotationDict = {};
				for (const pluginId in data.annotations) {
					const annotation = data.annotations[pluginId];
					const {type,content} = parseAnnotation_1_4_0(annotation.anno);
					upgradedAnnotations[pluginId] = {
						name: annotation.name,
						desc: content,
						type: type,
					};
				}

				const oldSettings: PluginsAnnotationsSettings_1_4_0 = data;

				// Update the data with the new format
				const newSettings: PluginsAnnotationsSettings = {
					...oldSettings,
					annotations: upgradedAnnotations,
					plugins_annotations_uuid: default_settings.plugins_annotations_uuid,
					backups: this.settings.backups,
					compatibility: default_settings.compatibility,
					markdown_file_path: default_settings.markdown_file_path
				};
				wasUpdated = true;

				return await getSettingsFromData(newSettings);
			} else if (isSettingsFormat_1_3_0(data)) { // previous versions where the name of the plugins was not stored
				// Make a backup
				await this.backupSettings('Settings before upgrade from 1.3 to 1.4',data);

				const default_settings_1_4_0 = DEFAULT_SETTINGS_1_4_0

				// Upgrade annotations format
				const upgradedAnnotations: PluginAnnotationDict_1_4_0 = {};
				
				for (const pluginId in data.annotations) {
					const annotation = data.annotations[pluginId];
					upgradedAnnotations[pluginId] = {
						name: this.pluginIdToNameMap[pluginId] || pluginId,
						anno: annotation,
					};
				}
				const oldSettings: PluginsAnnotationsSettings_1_3_0 = data;

				// Update the data with the new format
				const newSettings: PluginsAnnotationsSettings_1_4_0 = {
					...oldSettings,
					annotations: upgradedAnnotations,
					plugins_annotations_uuid: default_settings_1_4_0.plugins_annotations_uuid,
				};
				wasUpdated = true;
				return await getSettingsFromData(newSettings);
			} else {
				// Make a backup
				await this.backupSettings('Settings before upgrade from 1.0 to 1.3',data);

				const default_settings_1_3_0 = structuredClone(DEFAULT_SETTINGS_1_3_0);

				// Very first version of the plugin 1.0 -- no options were stored, only the dictionary of annotations
				const newSettings: PluginsAnnotationsSettings_1_3_0 = default_settings_1_3_0;
				newSettings.annotations = isPluginAnnotationDictFormat_1_3_0(data) ? data : default_settings_1_3_0.annotations;
				wasUpdated = true;
				return await getSettingsFromData(newSettings);
			}
		};

		const importedSettings = await getSettingsFromData(data);

		return {importedSettings, wasUpdated};
	}

	async backupSettings(backupName: string, settings: unknown) {
		// Ensure settings is an object
		if (typeof settings !== 'object' || settings === null) return;

		let settingsWithoutBackup;

		// Remove the backups field from the settings to be backed up
		if (settings.hasOwnProperty('backups')) {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { backups: _, ...rest } = settings as { backups: unknown };
			settingsWithoutBackup = rest;
		} else {
			settingsWithoutBackup = settings;
		}

		// Deep copy
		const deepCopiedSettings = structuredClone(settingsWithoutBackup);

		// Add the backup with the deep-copied settings
		this.settings.backups.push({
			name: backupName,
			date: new Date(),
			settings: deepCopiedSettings
		});

		await this.saveSettings();
	}


	async loadSettings(data?: unknown, forceSave?: boolean): Promise<void> {
		
		// Create a mapping of names to IDs for the installed plugins
		this.pluginNameToIdMap = this.constructPluginNameToIdMap();
		this.pluginIdToNameMap = this.generateInvertedMap(this.pluginNameToIdMap);
		
		if(data === undefined) {
			data = await this.loadData();
		}

		if(forceSave === undefined) {
			forceSave = false;
		}

		if (!data || typeof data !== 'object') {
			console.error('Invalid settings.');
			return;
		}

		const {importedSettings, wasUpdated} = await this.importSettings(data);

		// Merge loaded settings with default settings
		this.settings = Object.assign({}, structuredClone(DEFAULT_SETTINGS), importedSettings);
		
		if (this.settings.backups) {
			this.settings.backups.forEach((backup: PluginBackup) => {
				backup.date = new Date(backup.date); // Convert the date string to a Date object
			});
		}

		if(forceSave || wasUpdated) { // if it requires to store the new settings, the .md file will be overwritten
			await this.saveSettings();
		} else { // otherwise read from the md file
			if(this.settings.markdown_file_path!=='') {
				await readAnnotationsFromMdFile(this);
			}
		}
	}

	// Store the path to the vault
	getVaultPath():string {
		if(this.vaultPath) return this.vaultPath;

		if (Platform.isDesktopApp) {
			// store the vault path
			const adapter = this.app.vault.adapter;
			if (!(adapter instanceof FileSystemAdapter)) {
				throw new Error("The vault folder could not be determined.");
			}
			// Normalize to POSIX-style path
			this.vaultPath = adapter.getBasePath().split(path.sep).join(path.posix.sep);
			
			return this.vaultPath;
		} else return "";
	}
	
	async saveSettings() {
		try {
			await this.saveData(this.settings);
		} catch (error) {
			console.error('Failed to save annotations:', error);
		}
		if(this.settings.markdown_file_path!=='') {
			try {
				await writeAnnotationsToMdFile(this);
			} catch (error) {
				console.error('Failed to save annotations to md file:', error);
			}
		}		
	}

	constructPluginNameToIdMap(): Record < string, string > {
		const map: Record < string, string > = {};
		for (const pluginId in this.app.plugins.manifests) {
			const plugin = this.app.plugins.manifests[pluginId];
			if (plugin) {
				map[plugin.name] = plugin.id;
			}
		}
		return map;
	}

	// Function to generate the inverted map
	generateInvertedMap(originalMap: Record < string, string >) {
		const invertedMap: Record < string, string > = {};
		for (const key in originalMap) {
			if (originalMap.hasOwnProperty(key)) {
				const value = originalMap[key];
				invertedMap[value] = key;
			}
		}
		return invertedMap;
	}

	patchSettings() {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this;
		
		// Patch openTab to detect when a tab is opened
		const removeMonkeyPatchForSetting = around(this.app.setting, {
			openTab: (next: (tab: SettingTab) => void) => {
				return function(this: Setting, tab: SettingTab) {
					next.call(this, tab);
					if (tab && tab.id === 'community-plugins') {
						if(self.observedTab!==tab)
						{
							self.observeTab(tab);
						}
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

		// Register the cleanup for openTab patch
		this.register(removeMonkeyPatchForSetting);

		// Monkey patch for uninstallPlugin
		const removeMonkeyPatchForPlugins = around(this.app.plugins, {
			uninstallPlugin: (next: (pluginId: string) => Promise<void>) => {
				return async function (this: Plugins, pluginId: string): Promise<void> {
					await next.call(this, pluginId);
					// Triggered when pluginId has been uninstalled
					if (self.settings.automatic_remove && self.settings.annotations.hasOwnProperty(pluginId)) {
						// If automatic_remove is enabled and there is an annotation, remove the annotation 
						delete self.settings.annotations[pluginId];
						self.debouncedSaveAnnotations();
					}
				};
			},
		});

		// Register the patch to ensure it gets cleaned up
		this.register(removeMonkeyPatchForPlugins);
	}

	observeTab(tab: SettingTab) {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this;

		// Monkey patch for uninstallPlugin
		const removeMonkeyPatchForUpdateSearch = around(tab, {
			renderInstalledPlugin: (next: (
					pluginManifest: PluginManifest,
					containerEl:HTMLElement,
					nameMatch: boolean | null,
					authorMatch: boolean | null,
					descriptionMatch: boolean | null
				) => void ) => {

				return function (this: SettingTab,
						pluginManifest: PluginManifest,
						containerEl: HTMLElement,
						nameMatch: boolean | null,
						authorMatch: boolean | null,
						descriptionMatch: boolean | null
					): void {
						next.call(this, pluginManifest, containerEl, nameMatch, authorMatch, descriptionMatch);

						// Add your custom code for personal annotations here
						const annotation = self.settings.annotations[pluginManifest.id];
						if (annotation) {
							if(containerEl && containerEl.lastElementChild)
							{
								self.addAnnotation(containerEl.lastElementChild)
							}							
						}
				};
			}
		});

		// // Register the patch to ensure it gets cleaned up
		this.register(removeMonkeyPatchForUpdateSearch);	

		if(!this.mutationObserver) {
			this.observedTab = tab;

			const observer = new MutationObserver(() => {
				this.addIcon(tab);
				this.addAnnotations(tab);
			});

			observer.observe(tab.containerEl, { childList: true, subtree: false });
			this.mutationObserver = observer;
		}

		// Initial call to add comments to already present plugins
		this.addIcon(tab);
		this.addAnnotations(tab);
	}

	disconnectObservers() {
		if (this.mutationObserver) {
			this.mutationObserver.disconnect();
			this.mutationObserver = null;
			this.observedTab = null;
		}
	}

	// Helper function to parse links and add click listeners
	handleAnnotationLinks(element: HTMLElement) {
		const links = element.querySelectorAll('a');
		links.forEach(link => {
			link.addEventListener('click', (event) => {
				event.preventDefault();
				const href = link.getAttribute('href');
				if (href) {
					this.app.workspace.openLinkText(href, '', false);
					this.app.setting.close(); // Close the settings pane when a link is clicked
				}
			});
		});
	}

	create_label(): HTMLSpanElement | null {
		const label = Platform.isMobile ? this.settings.label_mobile : this.settings.label_desktop;
		if(label.trim() === "") {
			return null;
		} else {
			const span = document.createElement('span');
			span.innerHTML = label;
			span.classList.add('plugin-comment-label');
			return span;
		}
	}

	async renderAnnotation(annotation_div: HTMLElement, annoType:AnnotationType, desc:string) {
		annotation_div.innerText = '';
		switch(annoType) {
			case AnnotationType.text: {
				const p = document.createElement('p');
				p.dir = 'auto';
				const label = this.create_label();
				if(label) {
					p.appendChild(label);
					p.appendText(desc);
				}
				else {
					p.innerText = desc;
				}					
				annotation_div.appendChild(p);
				break;
			}
			case AnnotationType.html: {
				const label = Platform.isMobile ? this.settings.label_mobile : this.settings.label_desktop;
				const desc_with_label = desc.replace(/\$\{label\}/g, label);
				annotation_div.innerHTML = desc_with_label;
				this.handleAnnotationLinks(annotation_div);
				break;
			}
			case AnnotationType.markdown: {
				const label = Platform.isMobile ? this.settings.label_mobile : this.settings.label_desktop;
				const desc_with_label = label + desc;
				await MarkdownRenderer.renderMarkdown(desc_with_label, annotation_div, '', this);
				this.handleAnnotationLinks(annotation_div);
				break;
			}
		}
	}

	configureAnnotation(annotation_container:HTMLDivElement,annotation_div:HTMLDivElement,pluginId:string,pluginName:string) {
		
		if(this.settings.editable) {
			annotation_div.contentEditable = 'true';
			annotation_div.classList.add('plugin-comment-annotation-editable');
		} else {
			annotation_div.contentEditable = 'false';
			annotation_div.classList.remove('plugin-comment-annotation-editable');
		}

		const placeholder = (this.settings.label_placeholder).replace(/\$\{plugin_name\}/g, pluginName);

		let isPlaceholder = this.settings.annotations[pluginId] ? false : true;
		let annotationDesc:string;
		let annoType:AnnotationType;
		
		if(!isPlaceholder && isPluginAnnotation(this.settings.annotations[pluginId])) {
			const annotation = this.settings.annotations[pluginId];
			annotationDesc = annotation.desc;
			annoType = annotation.type;
		} else {
			annotationDesc = placeholder.trim();
			annoType = AnnotationType.html;
		
			annotation_div.classList.add('plugin-comment-placeholder');
			if (this.settings.hide_placeholders) { // if it is a placeholder
				if(this.settings.editable) { // if fields can be edited, set the placeholder tag
					annotation_container.classList.add('plugin-comment-placeholder');
				} else { // if fields cannot be edited, just simply hide placeholders
					annotation_container.classList.add('plugin-comment-hidden');
				}
			}
		}

		// Initial render
		this.renderAnnotation(annotation_div,annoType,annotationDesc);

		let clickedLink = false;
		const handleMouseDown = (event:MouseEvent) => {
			if(!this.settings.editable) { return; }
			if (event.target && (event.target as HTMLElement).tagName === 'A') {
				clickedLink = true;
			} else {
				clickedLink = false;
			}
		}

		// Handle mousedown event to check if a link was clicked
		annotation_div.addEventListener('mousedown', handleMouseDown);

		// Remove placeholder class when user starts typing
		annotation_div.addEventListener('focus', (event:FocusEvent) => {
			if(!this.settings.editable) { return; }
			if (isPlaceholder) {
				if (this.settings.delete_placeholder_string_on_insertion) {
					annotation_div.innerText = '';
				}
				annotation_div.classList.remove('plugin-comment-placeholder');
				if (this.settings.hide_placeholders) {
					// we remove 'plugin-comment-placeholder' only when 'this.settings.hide_placeholders' is true
					// when 'this.settings.hide_placeholders' is false, the class is not set and does not need to be removed.
					annotation_container.classList.remove('plugin-comment-placeholder');
				}
				
				const text = annotation_div.innerText; // text without html markup
				annotation_div.innerText = text; // this removes all html markup for editing

				// Force a DOM reflow by reading the offsetHeight (or another property)
				annotation_div.offsetHeight;

				const range = document.createRange();
				range.selectNodeContents(annotation_div);
				const selection = window.getSelection();
				if (selection) {
					selection.removeAllRanges();
					selection.addRange(range);
				}
			} else {
				// Only update annotation_div.innerText if not clicking on a link
				if (!clickedLink) {
					let preamble;
					switch(annoType) {
					case AnnotationType.html:
						preamble = 'html:';
						break;
					case AnnotationType.markdown:
						preamble = 'markdown:';
						break;
					case AnnotationType.text:
						preamble = 'text:';
						break;
					default:
						preamble = 'markdown:';
					}

					annotation_div.innerText = preamble + '\n' + annotationDesc;
				}
			}
		});

		// Save the comment on input change and update inputTriggered status
		annotation_div.addEventListener('input', (event: Event) => {
			if(!this.settings.editable) return;
			isPlaceholder = false;
		});

		// Add placeholder class back if no changes are made
		annotation_div.addEventListener('blur', (event:FocusEvent) => {
			if(!this.settings.editable) { return; }

			const {annoType: type, annoDesc: content} = parseAnnotation(annotation_div.innerText.trim());

			if (isPlaceholder || content === '') { // placeholder
				annotation_div.innerHTML = placeholder;
				delete this.settings.annotations[pluginId];
				annotation_div.classList.add('plugin-comment-placeholder');
				if (this.settings.hide_placeholders) {
					annotation_container.classList.add('plugin-comment-placeholder');
				}
				isPlaceholder = true;
				annotationDesc = '';
				annoType = AnnotationType.html;
			} else {
				isPlaceholder = false;

				annotationDesc = content.trim();
				annoType = type;
				
				this.settings.annotations[pluginId] = {
					desc: annotationDesc,
					name: pluginName,
					type: type,
				};
				annotation_div.classList.remove('plugin-comment-placeholder');

				this.renderAnnotation(annotation_div,type,content);
			}
			this.debouncedSaveAnnotations();
		});

		// Prevent click event propagation to parent
		annotation_div.addEventListener('click', (event:MouseEvent) => {
			if(!this.settings.editable) { return; }
			event.stopPropagation();
		});
	}

	async addIcon(tab: SettingTab) {
		// Add new icon to the existing icons container
		const headingContainer = tab.containerEl.querySelector('.setting-item-heading .setting-item-control');
		if (headingContainer) {
			const svg_unlocked = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" \
					fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lock-open">\
					<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>\
					 <path d="M7 11v-4c0-2.8 2.2-5 5-5 1.6 0 3.1.8 4 2"/> \
				</svg>';
			const svg_locked ='<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" \
					fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lock">\
					<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>\
					<path d="M7 11V7a5 5 0 0 1 10 0v4"/>\
				</svg>';

			const newIcon = document.createElement('div');
			newIcon.classList.add('clickable-icon', 'extra-setting-button');
			if(this.settings.editable) {
				newIcon.setAttribute('aria-label', 'Click to lock personal annotations');
				newIcon.innerHTML = svg_unlocked;
			} else {
				newIcon.setAttribute('aria-label', 'Click to be able to edit personal annotations');
				newIcon.innerHTML = svg_locked;
			}

			newIcon.addEventListener('click', (event:MouseEvent) => {
				this.settings.editable = !this.settings.editable;
				this.debouncedSaveAnnotations();
				if(this.settings.editable) {
					newIcon.setAttribute('aria-label', 'Click to lock personal annotations');
					newIcon.innerHTML = svg_unlocked;
				} else {
					newIcon.setAttribute('aria-label', 'Click to unlock personal annotations');
					newIcon.innerHTML = svg_locked;

				}
				const plugins = tab.containerEl.querySelectorAll('.plugin-comment-annotation');
				plugins.forEach((div:Element) => {
					if (div instanceof HTMLDivElement) {
						if(this.settings.editable) {
							div.contentEditable = 'true';
							div.classList.add('plugin-comment-annotation-editable');
						} else {
							div.contentEditable = 'false';
							div.classList.remove('plugin-comment-annotation-editable');
						}
					}
				});

				// Select all div elements that have both 'plugin-comment' and 'plugin-comment-placeholder' classes
				const placeholders = document.querySelectorAll<HTMLDivElement>(!this.settings.editable ? 'div.plugin-comment.plugin-comment-placeholder' : 'div.plugin-comment.plugin-comment-hidden');

				// Loop through each element
				placeholders.forEach((el) => {
					if(this.settings.editable) {
						// Add the 'plugin-comment-placeholder' class
						el.classList.add('plugin-comment-placeholder');
						// Remove the 'plugin-comment-hidden' class
						el.classList.remove('plugin-comment-hidden');	
					} else {
						// Add the 'plugin-comment-hidden' class
						el.classList.add('plugin-comment-hidden');
						// Remove the 'plugin-comment-placeholder' class
						el.classList.remove('plugin-comment-placeholder');	
					}
					
				});
			});

			headingContainer.appendChild(newIcon);
		}
	}

	addAnnotation(plugin: Element) {
		const settingItemInfo = plugin.querySelector('.setting-item-info');
		if (settingItemInfo) {
			const pluginNameDiv = plugin.querySelector('.setting-item-name');
			const pluginName = pluginNameDiv ? pluginNameDiv.textContent : null;

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
					const annotation_container = document.createElement('div');
					annotation_container.className = 'plugin-comment';

					const annotation_div = document.createElement('div');
					annotation_div.className = 'plugin-comment-annotation';

					this.configureAnnotation(annotation_container,annotation_div,pluginId,pluginName);

					annotation_container.appendChild(annotation_div);
					descriptionDiv.appendChild(annotation_container);						
				}
			}
		}
	}

	async addAnnotations(tab: SettingTab) {
		// force reload - this is convenient because since the loading of the plugin
		// there could be changes in the settings due to synchronization among devices
		// which only happens after the plugin is loaded
		await this.loadSettings();
		
		const pluginsContainer = tab.containerEl.querySelector('.installed-plugins-container');
		if (!pluginsContainer) return;

		const plugins = pluginsContainer.querySelectorAll('.setting-item');
		plugins.forEach(plugin => {
			this.addAnnotation(plugin);
		});
	}

	async debouncedSaveAnnotations(timeout_ms = 250) {
		
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout);
		}
		
		this.saveTimeout = window.setTimeout(async () => {
			this.saveSettings();
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
	}

	getUninstalledPlugins(): PluginAnnotationDict {
		const installedPluginIds = new Set(Object.keys(this.app.plugins.manifests));
		const uninstalledPlugins: PluginAnnotationDict = {};

		for (const pluginId of sortPluginAnnotationsByName(this.settings.annotations)) {
			if (!installedPluginIds.has(pluginId)) {
				uninstalledPlugins[pluginId] = this.settings.annotations[pluginId];
			}
		}
		return uninstalledPlugins;
	}
}

