// settings_tab.ts

import PluginsAnnotations from "main";
import { handleMarkdownFilePathChange } from "manageAnnotations";
import { App, normalizePath, Notice, Platform, PluginSettingTab, Setting, TextComponent, ToggleComponent } from "obsidian";
import { PluginAnnotationDict } from "types";
import { parseFilePath, FileSuggestion, downloadJson, showConfirmationDialog, backupSettings, sortAnnotations } from "utils";
import { DEFAULT_SETTINGS } from 'defaults';
import { annotationControl } from "annotation_control";

declare const moment: typeof import('moment');

export class PluginsAnnotationsSettingTab extends PluginSettingTab {
    plugin: PluginsAnnotations;

    private uninstalledPluginsManager: UninstalledPluginsManager | null = null;
    private backupManager: BackupManager | null = null;

    constructor(app: App, plugin: PluginsAnnotations) {
        super(app, plugin);
        this.plugin = plugin;
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

        /* ====== Editing ====== */

        new Setting(containerEl).setName('Editing annotations').setHeading();
        
        const instructions_frag = createFragment((frag) => {

            const div = document.createElement('div');
            div.classList.add('plugin-comment-instructions');

            const p1 = document.createElement('p');
            p1.appendText('To add or edit your personal annotations for the installed plugins, go to the ');
            p1.appendChild(createPluginsPaneFragment());
            p1.appendText(' pane and click over the annotation field of the plugin you want to edit.');
            div.appendChild(p1);

            const p2 = document.createElement('p2');
            p2.innerText = "You can enter rich text annotations using Markdown just the same way you do in Obsidian. \
                Once you are finished editing, the Markdown annotation will be rendered correctly.";
            div.appendChild(p2);

            const p3 = document.createElement('p');
            p3.innerText = "You can directly link notes inside your \
                vault by adding Obsidian links such as ";

            const em = document.createElement('em');
            em.appendText('[[My notes/Review of plugin XYZ|my plugin note]]');
            em.classList.add('plugin-comment-selectable');
            p3.appendChild(em);
            p3.appendText('.');

            div.appendChild(p3);

            frag.appendChild(div);
        });

        new Setting(containerEl).setName(instructions_frag);

        const editable_setting = new Setting(containerEl)
            .setName('Editable:');

        let editable_toggle: ToggleComponent;
        editable_setting.addToggle(toggle => {
            editable_toggle = toggle;
            toggle
            .setValue(this.plugin.settings.editable)
            .onChange((value: boolean) => {
                this.plugin.settings.editable = value;
                this.plugin.debouncedSaveAnnotations(() => { this.uninstalledPluginsManager?.updateUninstalledPluginSettings(containerEl); });
            })
        });

        editable_setting.addExtraButton((button) => {
            button
                .setIcon("reset")
                .setTooltip("Reset to default value")
                .onClick(() => {
                    editable_toggle.setValue(DEFAULT_SETTINGS.editable);
                });
        });

        editable_setting.setDesc(createFragment((frag) => {
                    frag.appendText('If disabled, the annotations cannot be edited from the preference pane and are thus \
                        protected against accidental changes.  In the ');
                    frag.appendChild(createPluginsPaneFragment());
                    frag.appendText(' pane, you can coveniently change this setting by clicking on the displayed icon');
                    const div = frag.createDiv();
                    div.classList.add('plugin-comment-icon-container')
                    const unlock_icon = document.createElement('div');
                    unlock_icon.classList.add('clickable-icon');
                    unlock_icon.innerHTML = this.plugin.svg_unlocked;
                    unlock_icon.addEventListener('click', (event:MouseEvent) => {
                        editable_toggle.setValue(true);
                    });         
                    const lock_icon = document.createElement('div');
                    lock_icon.classList.add('clickable-icon');
                    lock_icon.innerHTML = this.plugin.svg_locked;
                    lock_icon.addEventListener('click', (event:MouseEvent) => {
                        editable_toggle.setValue(false);
                    });
                    div.appendText('{');
                    div.appendChild(lock_icon);
                    div.appendText(',');
                    div.appendChild(unlock_icon);
                    div.appendText('}');
                    frag.appendText('which either locks (make non-editable) or unlocks (make editable) your personal annotations.')            
                }));
        
        /* ==== Storage ==== */

        new Setting(containerEl).setName('Storage').setHeading();

        // Add new setting for storing annotations in a Markdown file
        const md_file_setting = new Setting(containerEl)
            .setName('Store annotations in a Markdown file:')
            .setDesc('With this option enabled, you can select a Markdown file in your vault to \
                contain your personal annotations for the installed plugins. This feature is intended \
                for power users who prefer to edit annotations directly from a Markdown file. \
                A second advantage of this mode is that if you use links to some of your notes in \
                the vault, those links will be automatically updated if your notes are later renamed.');

        let file_path_field_control: TextComponent;
        let md_filepath_error_div: HTMLDivElement;
        // Add new setting for markdown file path
        const md_filepath_setting = new Setting(containerEl)
            .setName('Markdown File Path')
            .setDesc(createFragment((frag) => {
                    frag.appendText('Markdown file where the plugins\' annotations are stored (e.g, ');
                    frag.createEl('em', {'cls': 'plugin-comment-selectable'}).appendText('00 Meta/Misc/Plugins annotations.md');
                    frag.appendText(').');
                    md_filepath_error_div = frag.createDiv({text: 'Error: the filename must end with .md extension.', cls: "mod-warning" });
                    md_filepath_error_div.style.display = 'none';
                }));

        let md_filepath_text: TextComponent;
        md_filepath_setting.addText(text => {
            md_filepath_text = text;

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

                if(filepath === '' || filepath!==this.plugin.settings.markdown_file_path) { // if the path has changed

                    if(filepath.trim()==='') {
                        md_filepath_error_div.style.display = 'none';
                        this.plugin.settings.markdown_file_path = '';
                        text.setValue(this.plugin.settings.markdown_file_path);
                        processingChange = false;
                        this.plugin.debouncedSaveAnnotations();
                        return;
                    }

                    filepath = normalizePath(filepath);

                    if (parseFilePath(filepath).ext !== '.md') {
                        md_filepath_error_div.style.display = '';
                        this.plugin.settings.markdown_file_path = DEFAULT_SETTINGS.markdown_file_path; // reverts to the default behavior
                        await this.plugin.saveSettings();
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

            inputEl.addEventListener('keydown', async (event) => {
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

        md_filepath_setting.addExtraButton((button) => {
            button
                .setIcon("reset")
                .setTooltip("Reset to default value")
                .onClick(() => {
                    md_filepath_text.setValue(DEFAULT_SETTINGS.markdown_file_path);
                });
        });

        md_filepath_setting.settingEl.style.display = this.plugin.settings.markdown_file_path === '' ? 'none' : '';

        let md_file_toggle: ToggleComponent;
        md_file_setting.addToggle(toggle => {
            md_file_toggle = toggle;
            toggle
            .setValue(this.plugin.settings.markdown_file_path !== '')
            .onChange(async (value: boolean) => {
                if (value) {
                    md_filepath_setting.settingEl.style.display = '';
                    this.plugin.settings.markdown_file_path = file_path_field_control.getValue();
                } else {
                    md_filepath_setting.settingEl.style.display = 'none';
                    this.plugin.settings.markdown_file_path = '';
                }
                this.plugin.debouncedSaveAnnotations();
            })
        });

        md_file_setting.addExtraButton((button) => {
                button
                    .setIcon("reset")
                    .setTooltip("Reset to default value")
                    .onClick(() => {
                        md_file_toggle.setValue(DEFAULT_SETTINGS.markdown_file_path !== '');
                    });
            });

        // Append the settings
        containerEl.appendChild(md_file_setting.settingEl);
        containerEl.appendChild(md_filepath_setting.settingEl);

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
                            this.plugin.debouncedSaveAnnotations(() => { 
                                this.uninstalledPluginsManager?.updateUninstalledPluginSettings(containerEl);
                            });
                    };
        } else {
            label = this.plugin.settings.label_desktop;
            label_version = 'desktop';
            label_cb = (value: string) => {
                            this.plugin.settings.label_desktop = value;
                            this.plugin.debouncedSaveAnnotations(() => {
                                this.uninstalledPluginsManager?.updateUninstalledPluginSettings(containerEl);
                            });
                    };
        }

        const label_setting = new Setting(containerEl)
            .setName('Annotation label:')
            .setDesc(createFragment((frag) => {
                frag.appendText(`Choose the annotation label for the ${label_version} version of Obsidian. \
                Use HTML code if you want to format it. Enter an empty string if you want \
                to hide the label. Use `);
                frag.createEl('em',{cls: 'plugin-comment-selectable'}).appendText('${plugin_name}');
                frag.appendText(' as a template for the plugin name; for example, you can generate automatic links to your notes with a label of the kind "');
                frag.createEl('em', {'cls': 'plugin-comment-selectable'}).appendText('[[00 Meta/Installed plugins/${plugin_name} | ${plugin_name}]]');
                frag.appendText('".');
            }));

        let label_text: TextComponent;
        label_setting.addText(text => {
            label_text = text;
            text.setPlaceholder('Annotation label');
            text.setValue(label);
            text.onChange(label_cb)});

        label_setting.addExtraButton((button) => {
            button
                .setIcon("reset")
                .setTooltip("Reset to default value")
                .onClick(() => {
                    label_text.setValue(Platform.isMobile ? DEFAULT_SETTINGS.label_mobile : DEFAULT_SETTINGS.label_desktop);
                });
        });

        const placeholder_setting = new Setting(containerEl)
            .setName('Placeholder label:')
            .setDesc(createFragment((frag) => {
                    frag.appendText('Choose the label appearing where no user annotation is provied yet. Use ');
                    frag.createEl('em',{cls: 'plugin-comment-selectable'}).appendText('${plugin_name}');
                    frag.appendText(' as a template for the plugin name; for example, you can generate automatic \
                        links to your notes with a placeholder of the kind "');
                    frag.createEl('em', {'cls': 'plugin-comment-selectable'}).appendText('[[00 Meta/Installed plugins/${plugin_name} | ${plugin_name}]]');
                    frag.appendText('".')
                }));

        let placeholder_text: TextComponent;
        placeholder_setting.addText(text => {
            placeholder_text = text;
            text.setPlaceholder('Annotation label');
            text.setValue(this.plugin.settings.label_placeholder);
            text.onChange(async (value: string) => {
                this.plugin.settings.label_placeholder = value;
                this.plugin.debouncedSaveAnnotations(() => {
                    this.uninstalledPluginsManager?.updateUninstalledPluginSettings(containerEl);
                });
        })});

        placeholder_setting.addExtraButton((button) => {
            button
                .setIcon("reset")
                .setTooltip("Reset to default value")
                .onClick(() => {
                    placeholder_text.setValue(DEFAULT_SETTINGS.label_placeholder);
                });
        });

        const hide_empty_annotations_setting = new Setting(containerEl)
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
            }));

        let hide_empty_annotations_toggle: ToggleComponent;
        hide_empty_annotations_setting.addToggle(toggle => {
            hide_empty_annotations_toggle = toggle;
            toggle
            .setValue(this.plugin.settings.hide_placeholders)
            .onChange(async (value: boolean) => {
                this.plugin.settings.hide_placeholders = value;
                this.plugin.debouncedSaveAnnotations(() => { this.uninstalledPluginsManager?.updateUninstalledPluginSettings(containerEl); });
            })
        });

        hide_empty_annotations_setting.addExtraButton((button) => {
            button
                .setIcon("reset")
                .setTooltip("Reset to default value")
                .onClick(() => {
                    hide_empty_annotations_toggle.setValue(DEFAULT_SETTINGS.hide_placeholders);
                });
        });

        const delete_placeholder_string_setting = new Setting(containerEl)
            .setName('Delete placeholder text when inserting a new annotation:')
            .setDesc('If this option is enabled, the placeholder text will be deleted \
                    automatically when you start typing a new annotation. If disabled, \
                    the placeholder text will be selected for easier replacement. \
                    This is a minor customization.');

        let delete_placeholder_string_toggle: ToggleComponent;
        delete_placeholder_string_setting.addToggle(toggle => {
            delete_placeholder_string_toggle = toggle;
            toggle
                .setValue(this.plugin.settings.delete_placeholder_string_on_insertion)
                .onChange(async (value: boolean) => {
                    this.plugin.settings.delete_placeholder_string_on_insertion = value;
                    this.plugin.debouncedSaveAnnotations(() => { this.uninstalledPluginsManager?.updateUninstalledPluginSettings(containerEl); });
            });
        });

        delete_placeholder_string_setting.addExtraButton((button) => {
            button
                .setIcon("reset")
                .setTooltip("Reset to default value")
                .onClick(() => {
                    delete_placeholder_string_toggle.setValue(DEFAULT_SETTINGS.delete_placeholder_string_on_insertion);
                });
        });

        /* ====== Backups ====== */
        this.backupManager = new BackupManager(this.plugin, containerEl);

        /* ====== Personal annotations of no longer installed community plugins ====== */
        this.uninstalledPluginsManager = new UninstalledPluginsManager(this.plugin,containerEl);
    }    
}

class BackupManager {
    private backupTableContainer: HTMLElement;

    constructor(private plugin:PluginsAnnotations, private containerEl:HTMLElement) {

        new Setting(this.containerEl)
            .setName('Backups')
            .setHeading();

        this.addBackupButtons();

        // Create a wrapper div for the table
        this.backupTableContainer = this.containerEl.createDiv();
        this.backupTableContainer.classList.add('setting-item');
        this.backupTableContainer.style.display = 'none';

        this.updateListBackups();
    }

    addBackupButtons() {
        const export_label = (Platform.isDesktopApp) ? ' Use the export and import buttons \
            to copy the current settings and annnotations to an external file and, vicevera, \
            to restore them from an external file.' : '';

        const backup_settings = new Setting(this.containerEl)
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
                    this.updateListBackups();
                })
            );

        backup_settings.controlEl.classList.add('plugin-comment-export-buttons');

        if (Platform.isDesktopApp) {
            backup_settings.addButton(button => button
                .setButtonText('Export')
                .setCta()
                .onClick(async () => {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const {backups:_,...rest} = this.plugin.settings;
                    downloadJson(rest);
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
                                    if(importedData === undefined || importedData === null || typeof importedData !== 'object') throw new Error("Something went wrong with the data in the backup.");
                                    await this.plugin.loadSettings({...importedData,backups:this.plugin.settings.backups});
                                    new Notice('Settings successfully imported.');
                                    this.updateListBackups();
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
    }

    updateListBackups() {
        this.backupTableContainer.innerHTML = '';
        
        // List Existing Backups
        if (this.plugin.settings.backups.length > 0) {
            this.backupTableContainer.style.display = '';
            
            // Sort the backups by date (most recent first)
            this.plugin.settings.backups.sort((a, b) => b.date.getTime() - a.date.getTime());

            const tableDiv = this.backupTableContainer.createDiv({ cls: 'plugin-comment-backup-table' });

            // Create the header row
            const headerRow = tableDiv.createDiv({ cls: 'plugin-comment-backup-table-row header' });
            headerRow.createDiv({ cls: 'plugin-comment-backup-table-cell', text: 'Backup name' + (Platform.isMobileApp ? '' : ' (click to edit)') });
            headerRow.createDiv({ cls: 'plugin-comment-backup-table-cell', text: 'Created on' });
            headerRow.createDiv({ cls: 'plugin-comment-backup-table-cell', text: '' });

            this.plugin.settings.backups.forEach((backup) => {
                const rowDiv = tableDiv.createDiv({ cls: 'plugin-comment-backup-table-row' });

                // Backup name cell
                const nameCell = rowDiv.createDiv({ cls: 'plugin-comment-backup-table-cell plugin-comment-backup-name' });
                const nameDiv = nameCell.createDiv({ text: backup.name, attr: { contenteditable: 'true' } });

                // Handle saving the updated name when editing is complete
                nameDiv.addEventListener('blur', async () => {
                    const newName = nameDiv.textContent?.trim() || 'Unnamed Backup';
                    backup.name = newName;
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
                                frag.createEl('strong',{text: backup.name});
                                frag.appendText(' created on ');
                                frag.createEl('strong',{text: moment(backup.date).format('YYYY-MM-DD HH:mm:ss')});
                                frag.appendText('. If you proceed, the current settings will be overwritten with those from the backup. \
                                    If you want to keep a copy of the current settings, make a backup before proceeding.\
                                    Do you want to proceed restoring the seettings from the backup?');
                            }));
                        if(answer) {
                            const settingsToBeRestored = structuredClone(backup.settings);
                            if(settingsToBeRestored === undefined || settingsToBeRestored === null || typeof settingsToBeRestored !== 'object') throw new Error("Something went wrong with the data in the backup.");
                            await this.plugin.loadSettings({...settingsToBeRestored, backups:this.plugin.settings.backups});
                            new Notice(`Annotations restored from backup "${backup.name}"`);
                            this.updateListBackups();
                        }
                    });

                actionCell.createEl('button', { text: 'Delete', cls: 'mod-cta' })
                    .addEventListener('click', async () => {
                        const answer = await showConfirmationDialog(this.plugin.app, 'Delete backup',
                            createFragment((frag) => {
                                frag.appendText('You are about to delete the backup named ');
                                frag.createEl('strong',{text: backup.name});
                                frag.appendText(' created on ');
                                frag.createEl('strong',{text: moment(backup.date).format('YYYY-MM-DD HH:mm:ss')});
                                frag.appendText('. Do you want to continue?');
                            }));
                        if(answer) {
                            const index = this.plugin.settings.backups.indexOf(backup);
                            if (index !== -1) {
                                this.plugin.settings.backups.splice(index, 1);  // Removes the element at the found index
                            }
                            this.plugin.debouncedSaveAnnotations();
                            rowDiv.remove();
                            if(this.plugin.settings.backups.length===0) {
                                this.backupTableContainer.style.display = 'none';
                            }
                        }
                    });
            });
        } else {
            this.backupTableContainer.style.display = 'none';
        }
    }

}

class UninstalledPluginsManager {

    private uninstalledPlugins:PluginAnnotationDict = {};

    constructor(private plugin:PluginsAnnotations,private containerEl: HTMLElement) {
        this.uninstalledPlugins = this.plugin.getUninstalledPlugins();
        
        new Setting(containerEl).setName('Annotations of no longer installed community plugins').setHeading();
        
        const automatic_remove_setting = new Setting(containerEl)
            .setName('Automatically remove personal annotations of uninstalled plugins:')
            .setDesc('If this option is enabled, whenever a plugin is uninstalled, the \
                attached personal annotation is automatically removed. \
                If this option is disabled, you can still  manually remove the personal \
                annotations of any plugin that is no longer installed. \
                The list of the no longer installed plugins is shown below, when the list is not empty.');

        let automatic_remove_toggle: ToggleComponent;
        automatic_remove_setting.addToggle(toggle => {
            automatic_remove_toggle = toggle;
            toggle
                .setValue(this.plugin.settings.automatic_remove)
                .onChange(async (value: boolean) => {
                    this.plugin.settings.automatic_remove = value;
                    this.plugin.debouncedSaveAnnotations();
            });
        });

        automatic_remove_setting.addExtraButton((button) => {
            button
                .setIcon("reset")
                .setTooltip("Reset to default value")
                .onClick(() => {
                    automatic_remove_toggle.setValue(DEFAULT_SETTINGS.automatic_remove);
                });
        });

        // Check if uninstalledPlugins is empty
        if (Object.keys(this.uninstalledPlugins).length === 0) return;

        const list_uninstalled_label = new Setting(containerEl)
            .setName('List of no longer installed plugins:')
            .setDesc('If you plan to reinstall the plugin in the future, \
                it is recommended not to remove your annotations, as you can reuse them later.');

        // Iterate over uninstalled plugins and add settings to the new subcontainer
        sortAnnotations(this.uninstalledPlugins).forEach(pluginId => {
            const pluginSetting = new Setting(containerEl)
                .setName(`Plugin ${this.uninstalledPlugins[pluginId].name}`)
                .addButton(button => button
                    .setButtonText('Delete')
                    .setCta()
                    .onClick(async () => {
                        delete this.plugin.settings.annotations[pluginId];
                        delete this.uninstalledPlugins[pluginId];
                        pluginSetting.settingEl.remove();
                        this.plugin.debouncedSaveAnnotations();
                            
                        // If no more uninstalled plugins, remove the section container
                        if (Object.keys(this.uninstalledPlugins).length === 0) {
                            list_uninstalled_label.settingEl.remove();
                        }
                    }));
            
            pluginSetting.descEl.dataset.plugin=pluginId;

            // Render the annotation
            new annotationControl(this.plugin,pluginSetting.descEl,pluginId,this.uninstalledPlugins[pluginId].name);
            
            // Set the attributes by applying the correct classes
            pluginSetting.descEl.classList.add('plugin-comment-annotation');
            pluginSetting.settingEl.classList.add('plugin-comment-uninstalled');
        });
    }

    updateUninstalledPluginSettings(containerEl: HTMLElement) {
        const elements = containerEl.querySelectorAll('div.setting-item-description.plugin-comment-annotation');
        elements.forEach((descEl) => {
            if (descEl instanceof HTMLElement) {
                const pluginId = descEl.dataset.plugin;
                if(pluginId) {
                    descEl.innerHTML = '';
                    new annotationControl(this.plugin,descEl,pluginId,this.uninstalledPlugins[pluginId].name);
                }
            }
        });
    }


}

