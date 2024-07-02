// main.ts

import {
	Plugin,
	Setting,
	SettingTab,
	Platform,
	App,
	PluginSettingTab,
	MarkdownRenderer,
	// PluginSettingTab,
	// App,
} from 'obsidian';
import { around } from 'monkey-around';
import { PluginAnnotationDict, PluginsAnnotationsSettings, AnnotationType } from './types';

const DEFAULT_SETTINGS: PluginsAnnotationsSettings = {
	annotations: {},
	plugins_annotations_uuid: 'FAA70013-38E9-4FDF-B06A-F899F6487C19',
	hide_placeholders: false,
	delete_placeholder_string_on_insertion: false,
	label_mobile: '<b>Annotation:&nbsp;</b>',
	label_desktop: '<b>Personal annotation:&nbsp;</b>',
	editable: true,
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
		if (data && data.annotations && data.plugins_annotations_uuid === DEFAULT_SETTINGS.plugins_annotations_uuid) {
			settings = data;
		} else {
			// If not, assume theData itself is the annotations object
			settings = {...DEFAULT_SETTINGS};
			settings.annotations = data || DEFAULT_SETTINGS.annotations;
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
	}

	observeTab(tab: SettingTab) {	
		if(!this.mutationObserver) {
			this.observedTab = tab;

			const observer = new MutationObserver(() => {
				this.addComments(tab);
			});

			observer.observe(tab.containerEl, { childList: true, subtree: false });
			this.mutationObserver = observer;
		}

		// Initial call to add comments to already present plugins
		this.addComments(tab);
	}

	disconnectObservers() {
		if (this.mutationObserver) {
			this.mutationObserver.disconnect();
			this.mutationObserver = null;
			this.observedTab = null;
		}
	}

	// Function to render the annotation based on preamble
	parse_annotation(annotation_div: HTMLDivElement, text: string): {type:AnnotationType,content:string} {
		const lines = text.split('\n');
		const preamble = lines[0].toLowerCase();
		const sliced = lines.slice(1).join('\n');

		annotation_div.innerHTML = '';
		if (preamble.startsWith('html:')) {
			return {type: AnnotationType.html, content: sliced};
		} else if (preamble.startsWith('markdown:')) {
			return {type: AnnotationType.markdown, content: sliced};
		} else if (preamble.startsWith('text:')) {
			return {type: AnnotationType.text, content: sliced};
		} else {
			return {type: AnnotationType.text, content: text};
		}
	}

	// Helper function to parse links and add click listeners
	parse_links(element: HTMLElement) {
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

	async render_annotation(annotation_div: HTMLDivElement, t:AnnotationType,c:string) {
		switch(t) {
			case AnnotationType.text: {
				const p = document.createElement('p');
				p.dir = 'auto';
				const label = this.create_label();
				if(label) {
					p.appendChild(label);
					p.appendText(c);
				}
				else {
					p.innerText = c;
				}					
				annotation_div.appendChild(p);
				break;
			}
			case AnnotationType.html: {
				const label = Platform.isMobile ? this.settings.label_mobile : this.settings.label_desktop;
				let c_with_label;
				if(label.trim()==="") {
					c_with_label = c;
				} else {
					c_with_label = c.replace(/\$\{label\}/g, label);
				}
				annotation_div.innerHTML = c_with_label;
				this.parse_links(annotation_div);
				break;
			}
			case AnnotationType.markdown: {
				const label = Platform.isMobile ? this.settings.label_mobile : this.settings.label_desktop;
				let c_with_label;
				if(label.trim()==="") {
					c_with_label = c;
				} else {
					c_with_label = c.replace(/\$\{label\}/g, label);
				}
				await MarkdownRenderer.renderMarkdown(c_with_label, annotation_div, '', this);
				this.parse_links(annotation_div);
				break;
			}
		}
	}

	set_annotation(annotation_container:HTMLDivElement,annotation_div:HTMLDivElement,pluginId:string,pluginName:string) {
		
		annotation_div.contentEditable = this.settings.editable ? 'true' : 'false';

		const placeholder = `Add your personal comment about '${pluginName}' here...`;
		let isPlaceholder = this.settings.annotations[pluginId] ? false : true;
		let annotation_text = (this.settings.annotations[pluginId] || placeholder).trim();
		
		if (isPlaceholder) {
			annotation_div.classList.add('plugin-comment-placeholder');
			if (this.settings.hide_placeholders) {
				annotation_container.classList.add(this.settings.editable ? 'plugin-comment-placeholder' : 'plugin-comment-hidden');
			}
		}

		// Parsing the stored annotation
		let type:AnnotationType;
		let content:string;
		({type,content} = this.parse_annotation(annotation_div,annotation_text));
		
		// Initial render
		this.render_annotation(annotation_div,type,content);

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

		const handleFocus = (event:FocusEvent) => {
			if(!this.settings.editable) { return; }
			if (isPlaceholder) {
				if (this.settings.delete_placeholder_string_on_insertion) {
					annotation_div.innerText = '';
				}
				annotation_div.classList.remove('plugin-comment-placeholder');
				if (this.settings.hide_placeholders) {
					annotation_container.classList.remove('plugin-comment-placeholder');
				}
				const range = document.createRange();
				range.selectNodeContents(annotation_div);
				const selection = window.getSelection();
				if (selection) {
					selection.removeAllRanges();
					selection.addRange(range);
				}
			} else {
				// Only update innerText if not clicking on a link
				if (!clickedLink) {
					annotation_div.innerText = annotation_text;
				}
			}
		}

		// Remove placeholder class when user starts typing
		annotation_div.addEventListener('focus', handleFocus);

		const handleBlur = (event:FocusEvent) => {
			if(!this.settings.editable) { return; }
			if (isPlaceholder || annotation_div.innerText.trim() === '') {
				annotation_div.innerText = placeholder;
				annotation_div.classList.add('plugin-comment-placeholder');
				if (this.settings.hide_placeholders) {
					annotation_container.classList.add('plugin-comment-placeholder');
				}
				isPlaceholder = true;
			} else {
				({type,content} = this.parse_annotation(annotation_div,annotation_text));
				this.render_annotation(annotation_div,type,content);
			}
		}

		// Add placeholder class back if no changes are made
		annotation_div.addEventListener('blur', handleBlur);

		const handleClick = (event:MouseEvent) => {
			if(!this.settings.editable) { return; }
			event.stopPropagation();
		}

		// Prevent click event propagation to parent
		annotation_div.addEventListener('click', handleClick);

		const handleInput = (event: Event) => {
			if(!this.settings.editable) { return; }
			annotation_text = annotation_div.innerText.trim();
			if (annotation_text === '') {
				annotation_text = '';
				isPlaceholder = true;
				delete this.settings.annotations[pluginId];
				annotation_div.classList.add('plugin-comment-placeholder');
			} else {
				isPlaceholder = false;
				this.settings.annotations[pluginId] = annotation_text;
				annotation_div.classList.remove('plugin-comment-placeholder');
				isPlaceholder = false;
			}
			this.debouncedSaveAnnotations();
		}

		// Save the comment on input change and update inputTriggered status
		annotation_div.addEventListener('input', handleInput);
	}

	async addComments(tab: SettingTab) {
	
		// force reload - this is convenient because since the loading of the plugin
		// there could be changes in the settings due to synchronization among devices
		// which only happens after the plugin is loaded
		await this.loadSettings();

		// Create a mapping of names to IDs for the installed plugins
		this.constructPluginNameToIdMap();

		// Add new icon to the existing icons container
		const headingContainer = tab.containerEl.querySelector('.setting-item-heading .setting-item-control');
		if (headingContainer) {
			const svg_unlocked = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" \
					fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lock-open">\
					<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>\
					<path d="M7 11V7a5 5 0 0 1 9.9-1"/>\
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
						} else {
							div.contentEditable = 'false';
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
						const annotation_container = document.createElement('div');
						annotation_container.className = 'plugin-comment';

						const annotation_div = document.createElement('div');
						annotation_div.className = 'plugin-comment-annotation';

						this.set_annotation(annotation_container,annotation_div,pluginId,pluginName);

						annotation_container.appendChild(annotation_div);
						descriptionDiv.appendChild(annotation_container);						
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

	getUninstalledPlugins(): { [pluginId: string]: string } {
		const installedPluginIds = new Set(Object.keys(this.app.plugins.manifests));
		const uninstalledPlugins: { [pluginId: string]: string } = {};

		for (const pluginId in this.settings.annotations) {
			if (!installedPluginIds.has(pluginId)) {
				uninstalledPlugins[pluginId] = this.settings.annotations[pluginId];
			}
		}
		return uninstalledPlugins;
	}
}


class PluginsAnnotationsSettingTab extends PluginSettingTab {
	plugin: PluginsAnnotations;

	constructor(app: App, plugin: PluginsAnnotations) {
		super(app, plugin);
		this.plugin = plugin;
	}

	createUninstalledPluginSettings(containerEl: HTMLElement) {
		const uninstalledPlugins = this.plugin.getUninstalledPlugins();

		// Check if uninstalledPlugins is empty
		if (Object.keys(uninstalledPlugins).length === 0) {
			return;
		}
		
		const heading = new Setting(containerEl).setName('Personal annotations of no longer installed community plugins').setHeading();
		const headingEl = heading.settingEl;

		// Append instructions right after the Annotations heading
		const instructions = containerEl.createDiv();
		instructions.classList.add('setting-item');
		instructions.appendChild(createFragment((frag) => {
			const p = frag.createEl('p');
			p.appendText('The following plugins are no longer installed. For each plugin, you can choose to remove its annotation from memory. If you plan to reinstall the plugin in the future, it is recommended to keep the annotation.');
			frag.appendChild(p);
		}));

		Object.keys({...uninstalledPlugins}).forEach(pluginId => {
			const pluginSetting = new Setting(containerEl)
				.setName(`Plugin ${pluginId}`)
				.setDesc("Annotation: " + uninstalledPlugins[pluginId])
				.addButton(button => button
					.setButtonText('Delete')
					.setCta()
					.onClick(async () => {
						delete this.plugin.settings.annotations[pluginId];
						delete uninstalledPlugins[pluginId];
						pluginSetting.settingEl.remove();
						this.plugin.debouncedSaveAnnotations();
							
						// If no more uninstalled plugins, remove the section container
						if (Object.keys(uninstalledPlugins).length === 0) {
							instructions.remove();
							headingEl.remove();
						}
					}));
		});
	}

	display(): void {
		const { containerEl } = this;

		const createPluginsPaneFragment = (): DocumentFragment => {
			return createFragment((frag) => {
				const em = frag.createEl('em');
				const link = frag.createEl('a', { href: '#', text: 'Community plugins'});
				link.onclick = () => {
					this.app.setting.openTabById('community-plugins');
				};
				em.appendChild(link);
			});
		};

		containerEl.empty();

		new Setting(containerEl).setName('Personal annotations').setHeading();
		const instructions = createFragment((frag) => {
			const div = document.createElement('div');
			div.classList.add('plugin-comment-instructions');

			const p1 = document.createElement('p');
			p1.appendText('To add or edit your personal annotations for the installed plugins, go to the ');
			p1.appendChild(createPluginsPaneFragment());
			p1.appendText(' pane and click over the annotation fields to edit their content');
			div.appendChild(p1);

			const p2 = document.createElement('p2');
			p2.innerHTML = "You can enter rich text notes using Markdown and HTML. Markdown annotations will be dispalyed as Obsidian normally renders Markdown text. \
				To this purpose, your annotation needs to start with a preamble line containing one \
				of three strings:\
				 <ul>\
					<li>markdown:</li>\
					<li>html:</li>\
					<li>text:</li>\
				</ul>\
				If you do not enter any preamble line, the default <em>text:</em> will be assumed.";
			div.appendChild(p2);

			const p3 = document.createElement('p');
			p3.innerHTML = "You can directly link your Obsidian notes from inside your annotations by adding links such as [[My notes/Review of plugin XYZ|my plugin note]].";
			div.appendChild(p3);

			const p4 = document.createElement('p');
			p4.innerHTML = "When editing HTML and Markdown annotations, use the placeholder <em>${label}</em> to display the <em>annotation label</em> at the chosen location."
			div.appendChild(p4);

			frag.appendChild(div);
		});

		// Append instructions right after the Annotations heading
		const instructions_div = containerEl.createDiv();
		instructions_div.classList.add('setting-item');
		instructions_div.appendChild(instructions);

		new Setting(containerEl).setName('Display').setHeading();

		if (Platform.isMobile) {
			new Setting(containerEl)
					.setName('Annotation label:')
					.setDesc('Choose the annotation label for the mobile version of Obsidian. Use HTML code if you want to format it. Enter an empty string if you want to hide the label.')
					.addText(text => {
						text.setPlaceholder('Annotation label');
						text.setValue(this.plugin.settings.label_mobile);
						text.onChange(async (value: string) => {
							this.plugin.settings.label_mobile = value;
							this.plugin.debouncedSaveAnnotations();
					})});
		} else {
			new Setting(containerEl)
					.setName('Annotation label:')
					.setDesc('Choose the annotation label for the desktop version of Obsidian. Use HTML code if you want to format it. Enter an empty string if you want to hide the label.')
					.addText(text => {
						text.setPlaceholder('Annotation label');
						text.setValue(this.plugin.settings.label_desktop);
						text.onChange(async (value: string) => {
							this.plugin.settings.label_desktop = value;
							this.plugin.debouncedSaveAnnotations();
					})});
		}

		new Setting(containerEl)
			.setName('Hide empty annotations:')
			.setDesc(createFragment((frag) => {
				frag.appendText('If this option is enabled, only annotations set by the user will be shown. If you want to insert an annotation to a plugin for the first time, hover with the mouse over the chosen plugin in the ');
				frag.appendChild(createPluginsPaneFragment());
				frag.appendText(' pane. The annotation field will appear automatically.');

				if (Platform.isMobile) {
					const p = frag.createEl('p');
					const warning = p.createEl('span', {
						text: 'On mobile devices, you can hover over plugins with your finger instead of using the mouse.',
					});
					warning.classList.add('mod-warning');
					frag.appendChild(p);
				}
			}))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.hide_placeholders)
				.onChange(async (value: boolean) => {
					this.plugin.settings.hide_placeholders = value;
					this.plugin.debouncedSaveAnnotations();
				}));

		new Setting(containerEl)
			.setName('Delete placeholder text when inserting a new annotation:')
			.setDesc('If this option is enabled, the placeholder text will be deleted automatically when you start typing a new annotation. If disabled, the placeholder text will be selected for easier replacement. This is a minor customization.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.delete_placeholder_string_on_insertion)
				.onChange(async (value: boolean) => {
					this.plugin.settings.delete_placeholder_string_on_insertion = value;
					this.plugin.debouncedSaveAnnotations();
			}));

		this.createUninstalledPluginSettings(containerEl);
	}
}
