// settings_tab.ts

import PluginsAnnotations from "main";
import { handleMarkdownFilePathChange } from "manageAnnotations";
import { App, Platform, PluginSettingTab, Setting, TextComponent } from "obsidian";
import { PluginAnnotationDict } from "types";
import { parseFilePath, FileSuggestion } from "utils";

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
				.setDesc("Annotation: " + uninstalledPlugins[pluginId].desc)
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
			.setDesc('With this option enabled, you can select a Markdown file in your vault to contain your personal annotations for the installed plugins. This feature is intended for power users who prefer to edit annotations directly from a Markdown file. A second advantage of this mode is that if you use links to some of your notes in the vault, those links will be automatically updated if your notes are later renamed.');

		let file_path_field_control: TextComponent;
		let md_filepath_error_div: HTMLDivElement;
		// Add new setting for markdown file path
		const file_path_field = new Setting(containerEl)
			.setName('Markdown File Path')
			.setDesc(createFragment((frag) => {
					frag.appendText('Path to the markdown file where the plugins\' annotations will be stored.');
					md_filepath_error_div = frag.createDiv({text: 'Error: the filename must end with .md extension.', cls: "mod-warning" });
					md_filepath_error_div.style.display = 'none';
				}))
			.addText(text => {

				file_path_field_control = text;

				text.setPlaceholder('E.g.: 00 Meta/Plugins annotations.md');
				text.setValue(this.plugin.settings.markdown_file_path);

				const vault_files = this.app.vault.getFiles().filter((f) => f.extension === "md");

				const inputEl = text.inputEl;
				new FileSuggestion(this.app, inputEl, vault_files);

				text.onChange(async (value: string) => {
				});

				inputEl.addEventListener('blur', async () => {
					const filepath = inputEl.value;

					if(filepath!==this.plugin.settings.markdown_file_path) { // if the path has changed

						if (parseFilePath(filepath).ext !== '.md') {
							md_filepath_error_div.style.display = '';
							this.plugin.settings.markdown_file_path = '';
							return;
						}

						md_filepath_error_div.style.display = 'none';
						if(await handleMarkdownFilePathChange(this.plugin, filepath)) {
							this.plugin.settings.markdown_file_path = filepath;
							this.plugin.debouncedSaveAnnotations();
						} else {
							text.setValue(this.plugin.settings.markdown_file_path);
						}
					}

				});
			});

		file_path_field.settingEl.style.display = this.plugin.settings.markdown_file_path === '' ? 'none' : '';

		toggle_md_file.addToggle(toggle => toggle
			.setValue(this.plugin.settings.markdown_file_path !== '')
			.onChange(async (value: boolean) => {
				if (value) {
					file_path_field.settingEl.style.display = '';
					this.plugin.settings.markdown_file_path = file_path_field_control.getValue();
				} else {
					file_path_field.settingEl.style.display = 'none';
					this.plugin.settings.markdown_file_path = '';
				}
				this.plugin.debouncedSaveAnnotations();
			}));

		// Append the settings
		containerEl.appendChild(toggle_md_file.settingEl);
		containerEl.appendChild(file_path_field.settingEl);

		/* ==== Display heading ==== */

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

