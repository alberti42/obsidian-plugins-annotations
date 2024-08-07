// settings_tab.ts

import PluginsAnnotations from "main";
import { handleMarkdownFilePathChange } from "manageAnnotations";
import { AbstractInputSuggest, App, Platform, PluginSettingTab, prepareFuzzySearch, SearchResult, Setting, TFile } from "obsidian";
import { PluginAnnotationDict } from "types";

class FileSuggestion extends AbstractInputSuggest<TFile> {
	files: TFile[];

	constructor(app: App, inputEl: HTMLInputElement, private onSelectCallback: (file: TFile) => void = (v: TFile) => {}) {
		super(app, inputEl);

		// Load the list of files
		this.files = this.app.vault.getFiles().filter((f) => f.extension === "md");
	}

	doFuzzySearch(target: string, maxResults = 20, minScore = -2): TFile[] {
		if (!target || target.length < 2) return [];
		const fuzzy = prepareFuzzySearch(target);
		const matches: [TFile, SearchResult | null][] = this.files.map((c) => [c, fuzzy(c.path)]);
		// Filter out the null matches
		const validMatches = matches.filter(([, result]) => result !== null && result.score > minScore);
		// Sort the valid matches by score
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		validMatches.sort(([, a], [, b]) => b!.score - a!.score);
		return validMatches.map((c) => c[0]).slice(0, maxResults);
	}

	getSuggestions(inputStr: string): TFile[] {
		return this.doFuzzySearch(inputStr);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path);
	}

	selectSuggestion(selection: TFile, evt: MouseEvent | KeyboardEvent): void {
		this.onSelectCallback(selection);
		this.textInputEl.value = selection.path;
		this.textInputEl.dispatchEvent(new Event("change"))
		this.textInputEl.setSelectionRange(0, 1)
		this.textInputEl.setSelectionRange(this.textInputEl.value.length,this.textInputEl.value.length)
		this.textInputEl.focus()
		this.close();
	}
}

export class PluginsAnnotationsSettingTab extends PluginSettingTab {
	plugin: PluginsAnnotations;

	constructor(app: App, plugin: PluginsAnnotations) {
		super(app, plugin);
		this.plugin = plugin;
	}

	createUninstalledPluginSettings(containerEl: HTMLElement) {
		const uninstalledPlugins:PluginAnnotationDict = this.plugin.getUninstalledPlugins();
		
		const heading = new Setting(containerEl).setName('Personal annotations of no longer installed community plugins').setHeading();
		const headingEl = heading.settingEl;

		new Setting(containerEl)
			.setName('Automatically remove personal annotations of uninstalled plugins:')
			.setDesc('If this option is enabled, whenever a plugin is uninstalled, the attached personal annotation is automatically removed. \
				If this option is disabled, you can still  manually remove the personal annotations of any plugin that is no longer installed. \
				The list of the no longer installed plugins is shown below, when the list is not empty.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.automatic_remove)
				.onChange(async (value: boolean) => {
					this.plugin.settings.automatic_remove = value;
					this.plugin.debouncedSaveAnnotations();
				}));

		// Check if uninstalledPlugins is empty
		if (Object.keys(uninstalledPlugins).length === 0) {
			return;
		}

		const list_uninstalled_label = new Setting(containerEl)
			.setName('List of no longer installed plugins:')
			.setDesc('If you plan to reinstall the plugin in the future, it is recommended not to remove your annotations, as you can reuse them later.');
		
		// Iterate over uninstalled plugins and add settings to the new subcontainer
		Object.keys({...uninstalledPlugins}).forEach(pluginId => {
			const pluginSetting = new Setting(containerEl)
				.setName(`Plugin ${uninstalledPlugins[pluginId].name}`)
				.setDesc("Annotation: " + uninstalledPlugins[pluginId].anno)
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
							headingEl.remove();
							list_uninstalled_label.settingEl.remove();
						}
					}));
			pluginSetting.settingEl.classList.add('plugin-comment-uninstalled');
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

		// Add new setting for storing annotations in a Markdown file
		const toggle_md_file = new Setting(containerEl)
			.setName('Store annotations in a Markdown file:')
			.setDesc('If this option is enabled, you can select a Markdown file in your vault to contain your personal annotations about the installed plugins.');

		// Add new setting for markdown file path
		const file_path_field = new Setting(containerEl)
			.setName('Markdown File Path')
			.setDesc('Path to the markdown file where annotations will be stored.')
			.addText(text => {
				text.setPlaceholder('Enter the path to the markdown file');
				text.setValue(this.plugin.settings.markdown_file_path);

				const inputEl = text.inputEl;
				new FileSuggestion(this.app, inputEl);

				inputEl.addEventListener('blur', async () => {
					const filepath = inputEl.value;

					if(filepath!==this.plugin.settings.markdown_file_path) {
						handleMarkdownFilePathChange(this.plugin, filepath);
					}

				});
			});

		file_path_field.settingEl.style.display = this.plugin.settings.markdown_file_path === '' ? 'none' : '';

		toggle_md_file.addToggle(toggle => toggle
			.setValue(this.plugin.settings.markdown_file_path !== '')
			.onChange(async (value: boolean) => {
				if (value) {
					file_path_field.settingEl.style.display = '';
				} else {
					file_path_field.settingEl.style.display = 'none';
				}
				await this.plugin.saveSettings(this.plugin.settings);
			}));

		// Append the settings
		containerEl.appendChild(toggle_md_file.settingEl);
		containerEl.appendChild(file_path_field.settingEl);



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
			.setName('Placeholder label:')
			.setDesc(createFragment((frag) => {
					frag.appendText('Choose the label appearing where no user annotation is provied yet. Use ');
					frag.createEl('em').appendText('${plugin_name}');
					frag.appendText(' to refer to the plugin name.')}))
			.addText(text => {
				text.setPlaceholder('Annotation label');
				text.setValue(this.plugin.settings.label_placeholder);
				text.onChange(async (value: string) => {
					this.plugin.settings.label_placeholder = value;
					this.plugin.debouncedSaveAnnotations();
			})});

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

