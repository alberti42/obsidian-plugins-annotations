// settings_tab.ts

import PluginsAnnotations from "main";
import { handleMarkdownFilePathChange } from "manageAnnotations";
import { App, normalizePath, Notice, Platform, PluginSettingTab, Setting, TextComponent } from "obsidian";
import { PluginAnnotationDict } from "types";
import { parseFilePath, FileSuggestion, downloadJson, showConfirmationDialog, backupSettings } from "utils";

declare const moment: typeof import('moment');

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
            .setDesc('If this option is enabled, whenever a plugin is uninstalled, the \
                attached personal annotation is automatically removed. \
                If this option is disabled, you can still  manually remove the personal \
                annotations of any plugin that is no longer installed. \
                The list of the no longer installed plugins is shown below, when the list is not empty.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.automatic_remove)
                .onChange(async (value: boolean) => {
                    this.plugin.settings.automatic_remove = value;
                    this.plugin.debouncedSaveAnnotations();
                }));

        // Check if uninstalledPlugins is empty
        if (Object.keys(uninstalledPlugins).length === 0) return;

        const list_uninstalled_label = new Setting(containerEl)
            .setName('List of no longer installed plugins:')
            .setDesc('If you plan to reinstall the plugin in the future, \
                it is recommended not to remove your annotations, as you can reuse them later.');
        
        // Iterate over uninstalled plugins and add settings to the new subcontainer
        Object.keys({...uninstalledPlugins}).forEach(pluginId => {
            const pluginSetting = new Setting(containerEl)
                .setName(`Plugin ${uninstalledPlugins[pluginId].name}`)
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
            // Render the annotation
            // FIXME
            // this.plugin.renderAnnotation(pluginSetting.descEl, uninstalledPlugins[pluginId].type, uninstalledPlugins[pluginId].desc);
            pluginSetting.descEl.classList.add('plugin-comment-annotation');
            pluginSetting.settingEl.classList.add('plugin-comment-uninstalled');
        });
    }

    async display(): Promise<void> {
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

        // Load annotations first
        await this.plugin.loadSettings();

        // Clean container in the preference pane 
        const containerEl = this.containerEl;
        containerEl.empty();

        /* ====== Instructions ====== */

        new Setting(containerEl).setName('Instructions').setHeading();
        
        const instructions_frag = createFragment((frag) => {
            const div = document.createElement('div');
            div.classList.add('plugin-comment-instructions');

            const p1 = document.createElement('p');
            p1.appendText('To add or edit your personal annotations for the installed plugins, go to the ');
            p1.appendChild(createPluginsPaneFragment());
            p1.appendText(' pane and click over the annotation fields to edit their content');
            div.appendChild(p1);

            const p2 = document.createElement('p2');
            p2.innerHTML = "You can enter rich text annotations using Markdown. \
                Once you are finished editing, the Markdown annotation will be rendered correctly.";
            div.appendChild(p2);

            const p3 = document.createElement('p');
            p3.innerHTML = "In Markdown annotations, you can directly link notes inside your \
                vault by adding links such as [[My notes/Review of plugin XYZ|my plugin note]].";
            div.appendChild(p3);

            frag.appendChild(div);
        });

        new Setting(containerEl).setName(instructions_frag);
        
        /* ==== Storage ==== */

        new Setting(containerEl).setName('Storage').setHeading();

        // Add new setting for storing annotations in a Markdown file
        const toggle_md_file = new Setting(containerEl)
            .setName('Store annotations in a Markdown file:')
            .setDesc('With this option enabled, you can select a Markdown file in your vault to \
                contain your personal annotations for the installed plugins. This feature is intended \
                for power users who prefer to edit annotations directly from a Markdown file. \
                A second advantage of this mode is that if you use links to some of your notes in \
                the vault, those links will be automatically updated if your notes are later renamed.');

        let file_path_field_control: TextComponent;
        let md_filepath_error_div: HTMLDivElement;
        // Add new setting for markdown file path
        const file_path_field = new Setting(containerEl)
            .setName('Markdown File Path')
            .setDesc(createFragment((frag) => {
                    frag.appendText('Markdown file where the plugins\' annotations are stored (e.g, 00 Meta/Misc/Plugins annotations.md).');
                    md_filepath_error_div = frag.createDiv({text: 'Error: the filename must end with .md extension.', cls: "mod-warning" });
                    md_filepath_error_div.style.display = 'none';
                }))
            .addText(text => {

                let processingChange = false;

                file_path_field_control = text;

                text.setPlaceholder('E.g.: 00 Meta/Plugins annotations.md');
                text.setValue(this.plugin.settings.markdown_file_path);

                const inputEl = text.inputEl;
                const fileSuggestion = new FileSuggestion(this.app, inputEl);

                const updateVaultFiles = () => {
                    if(fileSuggestion) {
                        fileSuggestion.setSuggestions(this.app.vault.getFiles().filter((f) => f.extension === "md"));
                    }
                }

                updateVaultFiles();

                const onChangeHandler = async (event: Event) => {
                    if(processingChange) {
                        return; 
                    } else {
                        processingChange = true;    
                    }

                    let filepath = inputEl.value;

                    if(filepath!==this.plugin.settings.markdown_file_path) { // if the path has changed

                        if(filepath.trim()==='') {
                            this.plugin.settings.markdown_file_path = '';
                            text.setValue(this.plugin.settings.markdown_file_path);
                            processingChange = false;
                            this.plugin.debouncedSaveAnnotations();
                            return;
                        }

                        filepath = normalizePath(filepath);

                        if (parseFilePath(filepath).ext !== '.md') {
                            md_filepath_error_div.style.display = '';
                            text.setValue(this.plugin.settings.markdown_file_path);
                            processingChange = false;
                            return;
                        }

                        md_filepath_error_div.style.display = 'none';
                        const answer = await handleMarkdownFilePathChange(this.plugin, filepath);
                        if(answer) {
                            this.plugin.settings.markdown_file_path = filepath;
                            await this.plugin.saveSettings();
                            updateVaultFiles();
                        }
                        text.setValue(this.plugin.settings.markdown_file_path);
                    }

                    processingChange = false;
                };

                inputEl.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        onChangeHandler(event);
                    }
                });

                inputEl.addEventListener('blur', onChangeHandler);

                // Use change explicitly instead of onChange because onChange
                // reacts to events of type `input` instead of `change`
                inputEl.addEventListener('change', onChangeHandler);
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

        let label: string;
        let label_version: string;
        let label_cb: (value: string) => void;

        if (Platform.isMobile) {
            label = this.plugin.settings.label_mobile;
            label_version = 'mobile';
            label_cb = (value: string) => {
                            this.plugin.settings.label_mobile = value;
                            this.plugin.debouncedSaveAnnotations();
                    };
        } else {
            label = this.plugin.settings.label_desktop;
            label_version = 'desktop';
            label_cb = (value: string) => {
                            this.plugin.settings.label_desktop = value;
                            this.plugin.debouncedSaveAnnotations();
                    };
        }

        new Setting(containerEl)
                .setName('Annotation label:')
                .setDesc(createFragment((frag) => {
                    frag.appendText(`Choose the annotation label for the ${label_version} version of Obsidian. \
                    Use HTML code if you want to format it. Enter an empty string if you want \
                    to hide the label. Use `);
                    frag.createEl('em').appendText('${plugin_name}');
                    frag.appendText(' to refer to the plugin name; for example, you can generate automatic links to your notes with label of the kind ');
                    frag.createEl('em').appendText('[[00 Meta/Installed plugins/${plugin_name} | ${plugin_name}]]');
                    frag.appendText('.');
                }))
                .addText(text => {
                    text.setPlaceholder('Annotation label');
                    text.setValue(label);
                    text.onChange(label_cb)});

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
                frag.appendText('If this option is enabled, only annotations set by the user \
                    will be shown. If you want to insert an annotation to a plugin for the first \
                    time, hover with the mouse over the chosen plugin in the ');
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
            .setDesc('If this option is enabled, the placeholder text will be deleted \
                    automatically when you start typing a new annotation. If disabled, \
                    the placeholder text will be selected for easier replacement. \
                    This is a minor customization.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.delete_placeholder_string_on_insertion)
                .onChange(async (value: boolean) => {
                    this.plugin.settings.delete_placeholder_string_on_insertion = value;
                    this.plugin.debouncedSaveAnnotations();
            }));


        /* ====== Backups ====== */
        this.createBackupManager(containerEl);

        /* ====== Personal annotations of no longer installed community plugins ====== */
        this.createUninstalledPluginSettings(containerEl);
    }

    createBackupManager(containerEl: HTMLElement) {
        new Setting(containerEl)
            .setName('Backups')
            .setHeading();

        const export_label = (Platform.isDesktopApp) ? ' Use the export and import buttons \
            to copy the current settings and annnotations to an external file and, vicevera, \
            to restore them from an external file.' : '';

        const backup_settings = new Setting(containerEl)
            .setName('Create a backup copy of your current settings and annotations:')
            .setDesc('Use the backup button to create an internal backup copy. \
                You can customize the names of existing backups by clicking on their names once you have created them.'
                + export_label)
            .addButton(button => button
                .setButtonText('Create Backup')
                .setCta()
                .onClick(async () => {
                    const backupName = 'Untitled backup';
                    await backupSettings(backupName,this.plugin.settings,this.plugin.settings.backups);
                    await this.plugin.saveSettings();
                    this.display();
                })
            );

        backup_settings.controlEl.classList.add('plugin-comment-export-buttons');

        if (Platform.isDesktopApp) {
            backup_settings.addButton(button => button
                .setButtonText('Export')
                .setCta()
                .onClick(async () => {
                    downloadJson({...this.plugin.settings, backups: []});
                })
            );

            backup_settings.addButton(button => button
                .setButtonText('Import')
                .setCta()
                .onClick(async () => {
                    // Create an input element to upload a file
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.json'; // Only allow JSON files

                    input.onchange = async () => {
                        const file = input.files?.[0];
                        if (file) {
                            // Read the file as text
                            const reader = new FileReader();
                            reader.onload = async (event) => {
                                try {
                                    // Parse the JSON file
                                    const importedData = JSON.parse(event.target?.result as string);

                                    // Validate and merge the imported settings
                                    if (importedData && typeof importedData === 'object') {
                                        const forceSave = true;
                                        await this.plugin.loadSettings(importedData,forceSave);
                                        new Notice('Settings successfully imported.');
                                        this.display(); // Refresh the display to reflect the imported annotations
                                    } else {
                                        alert('Invalid settings file.');
                                    }
                                } catch (error) {
                                    console.error('Error importing settings:', error);
                                    alert('Failed to import settings. Please ensure the file is valid.');
                                }
                            };
                            reader.readAsText(file);
                        }
                    };

                    // Trigger the file input click
                    input.click();
                })
            );
        }

        // List Existing Backups
        if (this.plugin.settings.backups.length > 0) {

            // Sort the backups by date (most recent first)
            this.plugin.settings.backups.sort((a, b) => b.date.getTime() - a.date.getTime());

            // Create a wrapper div for the table
            const backupTableContainer = containerEl.createDiv({ cls: 'setting-item' });

            const tableDiv = backupTableContainer.createDiv({ cls: 'plugin-comment-backup-table' });

            // Create the header row
            const headerRow = tableDiv.createDiv({ cls: 'plugin-comment-backup-table-row header' });
            headerRow.createDiv({ cls: 'plugin-comment-backup-table-cell', text: 'Backup name' + (Platform.isMobileApp ? '' : ' (click to edit)') });
            headerRow.createDiv({ cls: 'plugin-comment-backup-table-cell', text: 'Created on' });
            headerRow.createDiv({ cls: 'plugin-comment-backup-table-cell', text: '' });

            this.plugin.settings.backups.forEach((backup, index) => {
                const rowDiv = tableDiv.createDiv({ cls: 'plugin-comment-backup-table-row' });

                // Backup name cell
                const nameCell = rowDiv.createDiv({ cls: 'plugin-comment-backup-table-cell plugin-comment-backup-name' });
                const nameDiv = nameCell.createDiv({ text: backup.name, attr: { contenteditable: 'true' } });

                // Handle saving the updated name when editing is complete
                nameDiv.addEventListener('blur', async () => {
                    const newName = nameDiv.textContent?.trim() || 'Unnamed Backup';
                    this.plugin.settings.backups[index].name = newName;
                    this.plugin.debouncedSaveAnnotations();
                });

                // Handle the Enter key to finish editing
                nameDiv.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        nameDiv.blur(); // Trigger the blur event to save the name
                    }
                });

                // Created on cell
                const dateCell = rowDiv.createDiv({ cls: 'plugin-comment-backup-table-cell' });
                dateCell.setText(moment(backup.date).format('YYYY-MM-DD HH:mm:ss'));

                // Add Restore and Delete buttons to the last cell
                const actionCell = rowDiv.createDiv({ cls: 'plugin-comment-backup-table-cell plugin-comment-backup-buttons' });
                actionCell.createEl('button', { text: 'Restore', cls: 'mod-cta' })
                    .addEventListener('click', async () => {
                        const answer = await showConfirmationDialog(this.plugin.app, 'Delete backup',
                            createFragment((frag) => {
                                frag.appendText('You are about to restore the settings from the backup named ');
                                frag.createEl('strong',{text: this.plugin.settings.backups[index].name});
                                frag.appendText(' created on ');
                                frag.createEl('strong',{text: moment(this.plugin.settings.backups[index].date).format('YYYY-MM-DD HH:mm:ss')});
                                frag.appendText('. If you proceed, the current settings will be overwritten with those from the backup. \
                                    If you want to keep a copy of the current settings, make a backup before proceeding.\
                                    Do you want to proceed restoring the seettings from the backup?');
                            }));
                        if(answer) {
                            const settingsToBeRestored = structuredClone(this.plugin.settings.backups[index].settings);
                            if(typeof settingsToBeRestored !== 'object') throw new Error("Something went wrong with the data in the backup.");
                            const forceSave = true;
                            await this.plugin.loadSettings({...settingsToBeRestored,backups:this.plugin.settings.backups},forceSave);
                            new Notice(`Annotations restored from backup "${backup.name}"`);
                            this.display(); // Refresh the display to reflect the restored annotations
                        }
                    });

                actionCell.createEl('button', { text: 'Delete', cls: 'mod-cta' })
                    .addEventListener('click', async () => {
                        const answer = await showConfirmationDialog(this.plugin.app, 'Delete backup',
                            createFragment((frag) => {
                                frag.appendText('You are about to delete the backup named ');
                                frag.createEl('strong',{text: this.plugin.settings.backups[index].name});
                                frag.appendText(' created on ');
                                frag.createEl('strong',{text: moment(this.plugin.settings.backups[index].date).format('YYYY-MM-DD HH:mm:ss')});
                                frag.appendText('. Do you want to continue?');
                            }));
                        if(answer) {
                            this.plugin.settings.backups.splice(index, 1);
                            await this.plugin.saveSettings();
                            this.display(); // Refresh the display to remove the deleted backup
                        }
                    });
            });
        }
    }
}

