// settings_tab.ts

import PluginsAnnotations from "main";
import { handleMarkdownFilePathChange } from "manageAnnotations";
import { App, normalizePath, Notice, Platform, PluginSettingTab, Setting, SettingDefinitionItem, SettingGroup, ToggleComponent } from "obsidian";
import { PluginAnnotationDict } from "types";
import { parseFilePath, FileSuggestion, downloadJson, showConfirmationDialog, backupSettings, setSvgIcon, sortAnnotations } from "utils";
import { DEFAULT_SETTINGS } from 'default_settings';
import { AnnotationControl } from "annotation_control";

import { svg_locked, svg_unlocked } from "graphics";

declare const moment: typeof import('moment');

export class PluginsAnnotationsSettingTab extends PluginSettingTab {
    plugin: PluginsAnnotations;

    private uninstalledPluginsManager: UninstalledPluginsManager | null = null;
    private backupManager: BackupManager | null = null;

    constructor(app: App, plugin: PluginsAnnotations) {
        super(app, plugin);
        this.plugin = plugin;
        this.containerEl.classList.add('plugin-comment-settings');
    }

    // Declarative settings (Obsidian 1.13.0+) read/write `this.plugin.settings` directly.
    // Override the write path only, so every `control` entry below goes through the
    // existing debounced save instead of an immediate, undebounced saveData() call, and
    // also refreshes the rendered annotations of no-longer-installed plugins, which
    // depend on several of these settings (labels, placeholders).
    setControlValue(key: string, value: unknown): Promise<void> {
        // `key` always comes from a `control` definition below, all of which name real
        // top-level properties of PluginsAnnotationsSettings.
        (this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
        return new Promise<void>((resolve) => {
            this.plugin.debouncedSaveAnnotations(() => {
                this.uninstalledPluginsManager?.updateUninstalledPluginSettings(this.containerEl);
                resolve();
            });
        });
    }

    getSettingDefinitions(): SettingDefinitionItem[] {
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

        return [
            {
                type: 'group',
                heading: 'Editing annotations',
                items: [
                    {
                        name: 'How to edit annotations',
                        render: (setting) => {
                            setting.setName(createFragment((frag) => {
                                const div = activeDocument.createElement('div');
                                div.classList.add('plugin-comment-instructions');

                                const p1 = activeDocument.createElement('p');
                                p1.appendText('To add or edit your personal annotations for the installed plugins, go to the ');
                                p1.appendChild(createPluginsPaneFragment());
                                p1.appendText(' pane and click over the annotation field of the plugin you want to edit.');
                                div.appendChild(p1);

                                const p2 = activeDocument.createElement('p2');
                                p2.innerText = "You can enter rich text annotations using Markdown just the same way you do in Obsidian. \
                                    Once you are finished editing, the Markdown annotation will be rendered correctly.";
                                div.appendChild(p2);

                                const p3 = activeDocument.createElement('p');
                                p3.innerText = "You can directly link notes inside your \
                                    vault by adding Obsidian links such as ";

                                const code = activeDocument.createElement('code');
                                code.appendText('[[My notes/Review of plugin XYZ|my plugin note]]');
                                code.classList.add('plugin-comment-selectable');
                                p3.appendChild(code);
                                p3.appendText('.');

                                div.appendChild(p3);

                                frag.appendChild(div);
                            }));
                        },
                    },
                    {
                        name: 'Editable',
                        render: (setting) => this.renderEditableToggle(setting, createPluginsPaneFragment),
                    },
                ],
            },
            {
                type: 'group',
                heading: 'Storage',
                items: [
                    {
                        name: 'Store annotations in a Markdown file',
                        desc: 'With this option enabled, you can select a Markdown file in your vault to \
                            contain your personal annotations for the installed plugins. This feature is intended \
                            for power users who prefer to edit annotations directly from a Markdown file. \
                            A second advantage of this mode is that if you use links to some of your notes in \
                            the vault, those links will be automatically updated if your notes are later renamed.',
                        render: (setting) => this.renderMarkdownFileToggle(setting),
                    },
                    {
                        name: 'Markdown File Path',
                        visible: () => this.plugin.settings.markdown_file_path !== '',
                        render: (setting) => this.renderMarkdownFilePath(setting),
                    },
                ],
            },
            {
                type: 'group',
                heading: 'Display',
                items: [
                    {
                        name: 'Annotation label',
                        desc: createFragment((frag) => {
                            const label_version = Platform.isMobile ? 'mobile' : 'desktop';
                            frag.appendText(`Choose the annotation label for the ${label_version} version of Obsidian. \
                            Use HTML code if you want to format it. Enter an empty string if you want \
                            to hide the label. Use `);
                            frag.createEl('code',{cls: 'plugin-comment-selectable'}).appendText('${plugin_name}');
                            frag.appendText(' as a template for the plugin name; for example, you can generate automatic links to your notes with a label of the kind ');
                            frag.createEl('code', {'cls': 'plugin-comment-selectable'}).appendText('[[00 Meta/Installed plugins/${plugin_name}|${plugin_name}]]');
                            frag.appendText('.');
                        }),
                        control: {
                            type: 'text',
                            key: Platform.isMobile ? 'label_mobile' : 'label_desktop',
                            placeholder: 'Annotation label',
                        },
                    },
                    {
                        name: 'Placeholder label',
                        desc: createFragment((frag) => {
                            frag.appendText('Choose the label appearing where no user annotation is provied yet. Use ');
                            frag.createEl('code',{cls: 'plugin-comment-selectable'}).appendText('${plugin_name}');
                            frag.appendText(' as a template for the plugin name; for example, you can generate automatic \
                                links to your notes with a placeholder of the kind ');
                            frag.createEl('code', {'cls': 'plugin-comment-selectable'}).appendText('[[00 Meta/Installed plugins/${plugin_name}|${plugin_name}]]');
                            frag.appendText('.');
                        }),
                        control: { type: 'text', key: 'label_placeholder', placeholder: 'Annotation label' },
                    },
                    {
                        name: 'Hide empty annotations',
                        desc: createFragment((frag) => {
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
                        }),
                        control: { type: 'toggle', key: 'hide_placeholders' },
                    },
                    {
                        name: 'Delete placeholder text when inserting a new annotation',
                        desc: 'If this option is enabled, the placeholder text will be deleted \
                                automatically when you start typing a new annotation. If disabled, \
                                the placeholder text will be selected for easier replacement. \
                                This is a minor customization.',
                        control: { type: 'toggle', key: 'delete_placeholder_string_on_insertion' },
                    },
                    {
                        name: 'Show GitHub links',
                        desc: "If this option is enabled, a clickable icon linking to the plugin's GitHub page will be displayed in the Community plugin pane.",
                        control: { type: 'toggle', key: 'show_github_icons' },
                    },
                ],
            },
            {
                type: 'group',
                heading: 'Backups',
                items: [
                    {
                        name: 'Create a backup copy of your current settings and annotations',
                        render: (setting, group) => {
                            this.backupManager = new BackupManager(this.plugin, setting, group);
                        },
                    },
                ],
            },
            {
                type: 'group',
                heading: 'Annotations of no longer installed community plugins',
                items: [
                    {
                        name: 'Automatically remove personal annotations of uninstalled plugins',
                        desc: 'If this option is enabled, whenever a plugin is uninstalled, the \
                            attached personal annotation is automatically removed. \
                            If this option is disabled, you can still  manually remove the personal \
                            annotations of any plugin that is no longer installed. \
                            The list of the no longer installed plugins is shown below, when the list is not empty.',
                        control: { type: 'toggle', key: 'automatic_remove' },
                    },
                    {
                        name: 'List of no longer installed plugins',
                        desc: 'If you plan to reinstall the plugin in the future, \
                            it is recommended not to remove your annotations, as you can reuse them later.',
                        visible: () => Object.keys(this.plugin.getUninstalledPlugins()).length > 0,
                        render: (setting, group) => {
                            this.uninstalledPluginsManager = new UninstalledPluginsManager(this.plugin, group, () => this.update());
                        },
                    },
                ],
            },
        ];
    }

    private renderEditableToggle(setting: Setting, createPluginsPaneFragment: () => DocumentFragment): void {
        let editable_toggle: ToggleComponent;
        setting.addToggle(toggle => {
            editable_toggle = toggle;
            toggle
            .setValue(this.plugin.settings.editable)
            .onChange((value: boolean) => {
                this.plugin.settings.editable = value;
                this.plugin.debouncedSaveAnnotations(() => { this.uninstalledPluginsManager?.updateUninstalledPluginSettings(this.containerEl); });
            })
        });

        setting.setDesc(createFragment((frag) => {
            frag.appendText('If disabled, the annotations cannot be edited from the preference pane and are thus \
                protected against accidental changes.  In the ');
            frag.appendChild(createPluginsPaneFragment());
            frag.appendText(' pane, you can coveniently change this setting by clicking on the displayed icon');
            const div = frag.createDiv();
            div.classList.add('plugin-comment-icon-container')
            const unlock_icon = activeDocument.createElement('div');
            unlock_icon.classList.add('clickable-icon');
            setSvgIcon(unlock_icon, svg_unlocked);
            unlock_icon.addEventListener('click', () => {
                editable_toggle.setValue(true);
            });
            const lock_icon = activeDocument.createElement('div');
            lock_icon.classList.add('clickable-icon');
            setSvgIcon(lock_icon, svg_locked);
            lock_icon.addEventListener('click', () => {
                editable_toggle.setValue(false);
            });
            div.appendText('{');
            div.appendChild(lock_icon);
            div.appendText(',');
            div.appendChild(unlock_icon);
            div.appendText('}');
            frag.appendText('which either locks (make non-editable) or unlocks (make editable) your personal annotations.')
        }));
    }

    private renderMarkdownFileToggle(setting: Setting): void {
        setting.addToggle(toggle => {
            toggle
            .setValue(this.plugin.settings.markdown_file_path !== '')
            .onChange(async (value: boolean) => {
                // Enabling starts from an empty path; the user fills it in via the
                // "Markdown File Path" row below, which appears once this is on.
                // Note: unlike the pre-migration behavior, the path typed before a
                // previous toggle-off is not restored here, since that row is fully
                // unmounted (not just hidden) while this toggle is off.
                this.plugin.settings.markdown_file_path = value ? this.plugin.settings.markdown_file_path : '';
                this.plugin.debouncedSaveAnnotations();
                // The "Markdown File Path" row's `visible` predicate depends on this value.
                this.refreshDomState();
            })
        });
    }

    private renderMarkdownFilePath(setting: Setting): void {
        let md_filepath_error_div: HTMLDivElement;
        setting.setDesc(createFragment((frag) => {
                frag.appendText('Markdown file where the plugins\' annotations are stored (e.g, ');
                frag.createEl('code', {'cls': 'plugin-comment-selectable'}).appendText('00 Meta/Misc/Plugins annotations.md');
                frag.appendText(').');
                md_filepath_error_div = frag.createDiv({text: 'Error: the filename must end with .md extension.', cls: "mod-warning" });
                md_filepath_error_div.hide();
            }));

        setting.addText(text => {
            let processingChange = false;

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
                        md_filepath_error_div.hide();
                        this.plugin.settings.markdown_file_path = '';
                        text.setValue(this.plugin.settings.markdown_file_path);
                        processingChange = false;
                        this.plugin.debouncedSaveAnnotations();
                        return;
                    }

                    filepath = normalizePath(filepath);

                    if (parseFilePath(filepath).ext !== '.md') {
                        md_filepath_error_div.show();
                        this.plugin.settings.markdown_file_path = DEFAULT_SETTINGS.markdown_file_path; // reverts to the default behavior
                        await this.plugin.saveSettings();
                        processingChange = false;
                        return;
                    }

                    md_filepath_error_div.hide();
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

            // Wraps the async handler so it can be passed where a void-returning
            // listener is expected; the returned promise is intentionally ignored.
            const triggerChange = (event: Event) => { void onChangeHandler(event); };

            inputEl.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    triggerChange(event);
                }
            });

            inputEl.addEventListener('blur', triggerChange);

            // Use change explicitly instead of onChange because onChange
            // reacts to events of type `input` instead of `change`
            inputEl.addEventListener('change', triggerChange);
        });
    }
}

class BackupManager {
    private backupTableContainer: HTMLElement;
    private UNTITLED_BACKUP = 'Untitled backup';

    constructor(private plugin:PluginsAnnotations, private setting: Setting, private group: SettingGroup) {
        this.addBackupButtons();

        // Create a wrapper div for the table, as a sibling of the row within the same group.
        this.backupTableContainer = this.group.listEl.createDiv();
        this.backupTableContainer.classList.add('setting-item');
        this.backupTableContainer.hide();

        this.updateListBackups();
    }

    addBackupButtons() {
        const export_label = (Platform.isDesktopApp) ? ' Use the export and import buttons \
            to copy the current settings and annnotations to an external file and, vicevera, \
            to restore them from an external file.' : '';

        this.setting
            .setDesc('Use the backup button to create an internal backup copy. \
                You can customize the names of existing backups by clicking on their names once you have created them.'
                + export_label)
            .addButton(button => button
                .setButtonText('Create Backup')
                .setCta()
                .onClick(async () => {
                    const backupName = this.UNTITLED_BACKUP;
                    await backupSettings(backupName,this.plugin.settings,this.plugin.settings.backups);
                    await this.plugin.saveSettings();
                    this.updateListBackups();
                })
            );

        this.setting.controlEl.classList.add('plugin-comment-export-buttons');

        if (Platform.isDesktopApp) {
            this.setting.addButton(button => button
                .setButtonText('Export')
                .setCta()
                .onClick(async () => {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- `backups` is intentionally discarded so it isn't included in the exported file
                    const {backups:_,...rest} = this.plugin.settings;
                    downloadJson(rest);
                })
            );

            this.setting.addButton(button => button
                .setButtonText('Import')
                .setCta()
                .onClick(async () => {
                    // Create an input element to upload a file
                    const input = activeDocument.createElement('input');
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
                                    new Notice('Failed to import settings. Please ensure the file is valid.');
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
            this.backupTableContainer.show();

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
                nameDiv.addEventListener('input', () => {
                    const newName = nameDiv.innerText.trim();
                    backup.name = newName === '' ? this.UNTITLED_BACKUP : newName;
                    this.plugin.debouncedSaveAnnotations();
                });

                // Handle saving the updated name when editing is complete
                nameDiv.addEventListener('blur', () => {
                    const newName = nameDiv.innerText.trim();
                    if(newName === '') {
                        nameDiv.innerText = backup.name;
                    }
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
                const handleRestoreClick = async (): Promise<void> => {
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
                };

                actionCell.createEl('button', { text: 'Restore', cls: 'mod-cta' })
                    .addEventListener('click', () => { void handleRestoreClick(); });

                const handleDeleteClick = async (): Promise<void> => {
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
                            this.backupTableContainer.hide();
                        }
                    }
                };

                actionCell.createEl('button', { text: 'Delete', cls: 'mod-cta' })
                    .addEventListener('click', () => { void handleDeleteClick(); });
            });
        } else {
            this.backupTableContainer.hide();
        }
    }

}

class UninstalledPluginsManager {

    private uninstalledPlugins:PluginAnnotationDict = {};

    constructor(private plugin:PluginsAnnotations, private group: SettingGroup, private onListEmptied: () => void) {
        this.uninstalledPlugins = this.plugin.getUninstalledPlugins();

        // Iterate over uninstalled plugins and add settings to the group
        sortAnnotations(this.uninstalledPlugins).forEach(pluginId => {
            this.group.addSetting((pluginSetting) => {
                pluginSetting
                    .setName(`Plugin ${this.uninstalledPlugins[pluginId].name}`)
                    .addButton(button => button
                        .setButtonText('Delete')
                        .setCta()
                        .onClick(() => {
                            delete this.plugin.settings.annotations[pluginId];
                            delete this.uninstalledPlugins[pluginId];
                            this.plugin.debouncedSaveAnnotations();
                            pluginSetting.settingEl.remove();

                            // If no more uninstalled plugins, hide the whole section.
                            if (Object.keys(this.uninstalledPlugins).length === 0) {
                                this.onListEmptied();
                            }
                        }));

                pluginSetting.descEl.dataset.plugin=pluginId;

                // Render the annotation
                new AnnotationControl(this.plugin,pluginSetting.descEl,pluginId,this.uninstalledPlugins[pluginId].name);

                // Set the attributes by applying the correct classes
                pluginSetting.descEl.classList.add('plugin-comment-annotation');
                pluginSetting.settingEl.classList.add('plugin-comment-uninstalled');
            });
        });
    }

    updateUninstalledPluginSettings(containerEl: HTMLElement) {
        const elements = containerEl.querySelectorAll('div.setting-item-description.plugin-comment-annotation');
        elements.forEach((descEl) => {
            if (descEl.instanceOf(HTMLElement)) {
                const pluginId = descEl.dataset.plugin;
                if(pluginId) {
                    descEl.innerHTML = '';
                    new AnnotationControl(this.plugin,descEl,pluginId,this.uninstalledPlugins[pluginId].name);
                }
            }
        });
    }


}
