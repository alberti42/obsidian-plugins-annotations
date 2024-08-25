// main.ts

import {
    Plugin,
    Setting,
    SettingTab,
    Platform,
    Plugins,
    PluginManifest,
    FileSystemAdapter,
    TAbstractFile,
    App,
    // PluginSettingTab,
    // App,
} from 'obsidian';
import { around } from 'monkey-around';
import { isPluginAnnotation, isPluginsAnnotationsSettings, PluginAnnotation, PluginAnnotationDict, PluginBackup, PluginsAnnotationsSettings } from './types';
import { PluginAnnotationDict_1_4_0, PluginsAnnotationsSettings_1_4_0, PluginsAnnotationsSettings_1_3_0, isPluginAnnotationDictFormat_1_3_0, isSettingsFormat_1_3_0, isSettingsFormat_1_4_0, parseAnnotation_1_4_0, PluginsAnnotationsSettings_1_5_0, PluginAnnotationDict_1_5_0, isPluginsAnnotationsSettings_1_5_0, } from 'types_legacy'
import { DEFAULT_SETTINGS_1_3_0, DEFAULT_SETTINGS_1_4_0, DEFAULT_SETTINGS_1_5_0 } from './defaults_legacy';
import { DEFAULT_SETTINGS } from 'defaults';
import { PluginsAnnotationsSettingTab } from 'settings_tab'
import * as path from 'path';
import { readAnnotationsFromMdFile, writeAnnotationsToMdFile } from 'manageAnnotations';
import { backupSettings, debounceFactoryWithWaitMechanism, delay, sortAnnotations } from 'utils';
import { annotationControl } from 'annotation_control';

export default class PluginsAnnotations extends Plugin {
    settings: PluginsAnnotationsSettings = structuredClone(DEFAULT_SETTINGS);
    pluginNameToIdMap: Record<string,string> = {};
    pluginIdToNameMap: Record<string,string> = {};
    sortedPluginIds: string[] = [];

    svg_unlocked ='<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" \
                    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lock-open">\
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>\
                     <path d="M7 11v-4c0-2.8 2.2-5 5-5 1.6 0 3.1.8 4 2"/> \
                </svg>';
    svg_locked ='<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" \
                    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lock">\
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>\
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>\
                </svg>';

    svg_github_light=atob('PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZlcnNpb249IjEuMSIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgY2xhc3M9InN2Zy1pY29uIGx1Y2lkZS1zZXR0aW5ncyI+CiAgPGRlZnM+CiAgICA8c3R5bGU+CiAgICAgIC5jbHMtMSB7CiAgICAgICAgZmlsbDogIzI0MjkyZjsKICAgICAgICBmaWxsLXJ1bGU6IGV2ZW5vZGQ7CiAgICAgICAgc3Ryb2tlLXdpZHRoOiAwcHg7CiAgICAgIH0KICAgIDwvc3R5bGU+CiAgPC9kZWZzPgogIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTEyLC4zQzUuNC4zLjEsNS43LjEsMTIuM3MzLjQsOS44LDguMSwxMS40Yy42LjEuOC0uMy44LS42czAtMS4yLDAtMi4yYy0zLjMuNy00LTEuNC00LTEuNC0uNS0xLjQtMS4zLTEuNy0xLjMtMS43LTEuMS0uNywwLS43LDAtLjcsMS4yLDAsMS44LDEuMiwxLjgsMS4yLDEuMSwxLjgsMi44LDEuMywzLjUsMSwwLS44LjQtMS4zLjctMS42LTIuNi0uMy01LjQtMS4zLTUuNC01LjlzLjUtMi40LDEuMi0zLjJjLS4xLS4zLS41LTEuNS4xLTMuMiwwLDAsMS0uMywzLjMsMS4yLDEtLjMsMi0uNCwzLS40LDEsMCwyLC4xLDMsLjQsMi4zLTEuNSwzLjMtMS4yLDMuMy0xLjIuNywxLjYuMiwyLjkuMSwzLjIuOC44LDEuMiwxLjksMS4yLDMuMiwwLDQuNi0yLjgsNS42LTUuNCw1LjkuNC40LjgsMS4xLjgsMi4yLDAsMS42LDAsMi45LDAsMy4zcy4yLjcuOC42YzQuNy0xLjYsOC4xLTYuMSw4LjEtMTEuNCwwLTYuNi01LjMtMTItMTEuOS0xMloiLz4KPC9zdmc+');
    svg_github_dark=atob('PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZlcnNpb249IjEuMSIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgY2xhc3M9InN2Zy1pY29uIGx1Y2lkZS1zZXR0aW5ncyI+CiAgPGRlZnM+CiAgICA8c3R5bGU+CiAgICAgIC5jbHMtMSB7CiAgICAgICAgZmlsbDogI2ZmZjsKICAgICAgICBmaWxsLXJ1bGU6IGV2ZW5vZGQ7CiAgICAgICAgc3Ryb2tlLXdpZHRoOiAwcHg7CiAgICAgIH0KICAgIDwvc3R5bGU+CiAgPC9kZWZzPgogIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTEyLC4zQzUuNC4zLjEsNS43LjEsMTIuM3MzLjQsOS44LDguMSwxMS40Yy42LjEuOC0uMy44LS42czAtMS4yLDAtMi4yYy0zLjMuNy00LTEuNC00LTEuNC0uNS0xLjQtMS4zLTEuNy0xLjMtMS43LTEuMS0uNywwLS43LDAtLjcsMS4yLDAsMS44LDEuMiwxLjgsMS4yLDEuMSwxLjgsMi44LDEuMywzLjUsMSwwLS44LjQtMS4zLjctMS42LTIuNi0uMy01LjQtMS4zLTUuNC01LjlzLjUtMi40LDEuMi0zLjJjLS4xLS4zLS41LTEuNS4xLTMuMiwwLDAsMS0uMywzLjMsMS4yLDEtLjMsMi0uNCwzLS40LDEsMCwyLC4xLDMsLjQsMi4zLTEuNSwzLjMtMS4yLDMuMy0xLjIuNiwxLjYuMiwyLjkuMSwzLjIuOC44LDEuMiwxLjksMS4yLDMuMiwwLDQuNi0yLjgsNS42LTUuNCw1LjkuNC40LjgsMS4xLjgsMi4yLDAsMS42LDAsMi45LDAsMy4zcy4yLjcuOC42YzQuNy0xLjYsOC4xLTYuMSw4LjEtMTEuNCwwLTYuNi01LjMtMTItMTEuOS0xMloiLz4KPC9zdmc+');

    private lockIcon: HTMLDivElement | null = null;

    private mutationObserver: MutationObserver | null = null;
    private observedTab: SettingTab | null = null;
    private vaultPath: string | null = null;

    /* For debounced saving */
    private saveTimeout: number | null = null;
    private savePromise: Promise<void> | null = null;
    private resolveSavePromise: (() => void) | null = null;

     // Declare class methods that will be initialized in the constructor
    debouncedSaveAnnotations: (callback?: () => void) => void;
    waitForSaveToComplete: () => Promise<void>;

    constructor(app:App, manifest:PluginManifest) {
        super(app, manifest);


        // Set up debounced saving functions
        const timeout_debounced_saving_ms = 100;
        const { debouncedFct, waitFnc } = debounceFactoryWithWaitMechanism(
            async (callback: () => void = (): void => {}) => {
                await this.saveSettings();
                if(callback) callback();
                console.log("FINISHED SAVING ANNOTATIONS");
            }, timeout_debounced_saving_ms);
        this.debouncedSaveAnnotations = debouncedFct;
        this.waitForSaveToComplete = waitFnc;
    }

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
    async importSettings(data: unknown,saveData: boolean): Promise<void> {

        const importBackups: PluginBackup[] = [];

        // Set to true when the settings are updated to the new format
        let wasUpdated = false;
        
        // Nested function to handle different versions of settings
        const getSettingsFromData = async (data: unknown): Promise<unknown> => {
            if (isPluginsAnnotationsSettings(data)) {
                const settings: PluginsAnnotationsSettings = data;
                return settings as PluginsAnnotationsSettings;
            } else if (isPluginsAnnotationsSettings_1_5_0(data)) {
                // Make a backup
                await backupSettings('Settings before upgrade from 1.5 to 1.6',data,importBackups);
                await delay(10); // add a small delay to shift the timestamp of the backup

                // Upgrade annotations format
                const upgradedAnnotations: PluginAnnotationDict = {};
                for (const pluginId in data.annotations) {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { type, ...rest } = data.annotations[pluginId];
                    upgradedAnnotations[pluginId] = rest;
                }

                const oldSettings: PluginsAnnotationsSettings_1_5_0 = data;

                // Update the data with the new format
                const default_new_settings = DEFAULT_SETTINGS;
                const newSettings: PluginsAnnotationsSettings = {
                    ...oldSettings,
                    annotations: upgradedAnnotations,
                    plugins_annotations_uuid: default_new_settings.plugins_annotations_uuid,
                    compatibility: default_new_settings.compatibility,
                };
                wasUpdated = true;

                return await getSettingsFromData(newSettings);
            } else if (isSettingsFormat_1_4_0(data)) { // previous versions where the name of the plugins was not stored
                // Make a backup
                await backupSettings('Settings before upgrade from 1.4 to 1.5',data,importBackups);
                await delay(10); // add a small delay to shift the timestamp of the backup

                // Upgrade annotations format
                const upgradedAnnotations: PluginAnnotationDict_1_5_0 = {};
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
                const default_new_settings = DEFAULT_SETTINGS_1_5_0;
                const newSettings: PluginsAnnotationsSettings_1_5_0 = {
                    ...oldSettings,
                    annotations: upgradedAnnotations,
                    plugins_annotations_uuid: default_new_settings.plugins_annotations_uuid,
                    backups: default_new_settings.backups,
                    compatibility: default_new_settings.compatibility,
                    markdown_file_path: default_new_settings.markdown_file_path
                };
                wasUpdated = true;

                return await getSettingsFromData(newSettings);
            } else if (isSettingsFormat_1_3_0(data)) { // previous versions where the name of the plugins was not stored
                // Make a backup
                await backupSettings('Settings before upgrade from 1.3 to 1.4',data,importBackups);
                await delay(10); // add a small delay to shift the timestamp of the backup

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
                const default_new_settings_1_4_0 = DEFAULT_SETTINGS_1_4_0
                const newSettings: PluginsAnnotationsSettings_1_4_0 = {
                    ...oldSettings,
                    annotations: upgradedAnnotations,
                    plugins_annotations_uuid: default_new_settings_1_4_0.plugins_annotations_uuid,
                };
                wasUpdated = true;
                return await getSettingsFromData(newSettings);
            } else {
                // Make a backup
                await backupSettings('Settings before upgrade from 1.0 to 1.3',data,importBackups);
                await delay(10); // add a small delay to shift the timestamp of the backup

                // Very first version of the plugin 1.0 -- no options were stored, only the dictionary of annotations
                const default_new_settings_1_3_0 = structuredClone(DEFAULT_SETTINGS_1_3_0);
                const newSettings: PluginsAnnotationsSettings_1_3_0 = default_new_settings_1_3_0;
                newSettings.annotations = isPluginAnnotationDictFormat_1_3_0(data) ? data : default_new_settings_1_3_0.annotations;
                wasUpdated = true;
                return await getSettingsFromData(newSettings);
            }
        };

        const importedSettings = await getSettingsFromData(data) as PluginsAnnotationsSettings;
    
        // for consistency, checks that all imported annotations contain the right information
        for (const pluginId in importedSettings.annotations) {
            if(!isPluginAnnotation(importedSettings.annotations[pluginId])) {
                delete importedSettings.annotations[pluginId];
            }
        }

        // Restore date/time stamps from JSON string format
        importedSettings.backups.forEach((backup: PluginBackup) => {
            backup.date = new Date(backup.date); // Convert the date string to a Date object
        });

        // Merge imported backups with backups created while importing the data
        importedSettings.backups = [...importBackups, ...importedSettings.backups];
        
        // Merge loaded settings with default settings
        this.settings = Object.assign({}, structuredClone(DEFAULT_SETTINGS), importedSettings);

        if(saveData || wasUpdated) { // if it requires to store the new settings, the .md file will be overwritten
            await this.saveSettings();
        } else { // otherwise read from the md file
            if(this.settings.markdown_file_path!=='') {
                await readAnnotationsFromMdFile(this);
            }
        }

        this.sortPluginAnnotationsByName();
    }

    async loadSettings(data?: unknown): Promise<void> {

        // Create a mapping of names to IDs for the installed plugins
        this.pluginNameToIdMap = this.constructPluginNameToIdMap();
        this.pluginIdToNameMap = this.generateInvertedMap(this.pluginNameToIdMap);
        
        let isRestoreOperation;
        if(data === undefined) {
            // we load directly from file, but first wait until
            // the previous debounced writing operation is completed
            this.waitForSaveToComplete();
            data = await this.loadData();
            isRestoreOperation = false;
        } else {
            isRestoreOperation = true;
        }
        
        if(data===undefined || data===null || typeof data !== 'object') {
            // if loadData failes, data is set to undefined
            // if loadData finds no file, data is set to null
            // in both cases, we use the default settings
            // we also added a check that data is of object type to be safer.
            data = structuredClone(DEFAULT_SETTINGS);
        }

        const saveData = isRestoreOperation ? true : false;
        await this.importSettings(data,saveData);
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
                        self.removeAnnotation(pluginId);
                        self.debouncedSaveAnnotations();
                    }
                };
            },
        });

        // Register the patch to ensure it gets cleaned up
        this.register(removeMonkeyPatchForPlugins);
    }

    removeAnnotation(pluginId: string) {
        delete this.settings.annotations[pluginId];
        this.sortedPluginIds = this.sortedPluginIds.filter(item => item !== pluginId);
    }

    modifyAnnotation(pluginId: string, annotation: PluginAnnotation) {
        const alreadyExisted = this.settings.annotations.hasOwnProperty(pluginId);
        this.settings.annotations[pluginId] = annotation;
        if(!alreadyExisted) this.sortPluginAnnotationsByName();
    }

    sortPluginAnnotationsByName() {
        this.sortedPluginIds = sortAnnotations(this.settings.annotations);
    }


    async observeTab(tab: SettingTab) {
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

                        // Custom code for personal annotations here
                        if(containerEl && containerEl.lastElementChild)
                        {
                            self.addAnnotation(containerEl.lastElementChild)
                        }                           
                };
            }
        });

        // // Register the patch to ensure it gets cleaned up
        this.register(removeMonkeyPatchForUpdateSearch);    

        if(!this.mutationObserver) {
            this.observedTab = tab;

            const observer = new MutationObserver(async () => {
                // force reload - this is convenient because since the loading of the plugin
                // there could be changes in the settings due to synchronization among devices
                // which only happens after the plugin is loaded
                await this.loadSettings();
        
                this.addIcon(tab);
                this.addAnnotations(tab);
            });

            observer.observe(tab.containerEl, { childList: true, subtree: false });
            this.mutationObserver = observer;
        }

        // force reload - this is convenient because since the loading of the plugin
        // there could be changes in the settings due to synchronization among devices
        // which only happens after the plugin is loaded
        await this.loadSettings();
        
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

    async addIcon(tab: SettingTab) {
        // This should not be necessary, but just in case, remove the icon if it was there
        this.removeIcon();

        // Add new icon to the existing icons container
        const headingContainer = tab.containerEl.querySelector('.setting-item-heading .setting-item-control');
        if (headingContainer) {
            
            this.lockIcon = document.createElement('div');

            const lockIcon = this.lockIcon;
            lockIcon.classList.add('clickable-icon', 'extra-setting-button');
            
            if(this.settings.editable) {
                lockIcon.setAttribute('aria-label', 'Click to lock personal annotations');
                lockIcon.innerHTML = this.svg_unlocked;
            } else {
                lockIcon.setAttribute('aria-label', 'Click to be able to edit personal annotations');
                lockIcon.innerHTML = this.svg_locked;
            }

            lockIcon.addEventListener('click', (event:MouseEvent) => {
                this.settings.editable = !this.settings.editable;
                
                this.debouncedSaveAnnotations();
                if(this.settings.editable) {
                    lockIcon.setAttribute('aria-label', 'Click to lock personal annotations');
                    lockIcon.innerHTML = this.svg_unlocked;
                } else {
                    lockIcon.setAttribute('aria-label', 'Click to unlock personal annotations');
                    lockIcon.innerHTML = this.svg_locked;

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

                // Loop through each plugin for which the placeholder is shown
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

            headingContainer.appendChild(lockIcon);
        }
    }

    removeIcon() {
        if(this.lockIcon) {
            this.lockIcon.remove();
            this.lockIcon = null;
        }
    }

    addAnnotation(pluginDOMElement: Element) {
        const pluginNameDiv = pluginDOMElement.querySelector('.setting-item-name');
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

        const manifest = this.app.plugins.manifests[pluginId];

        const settingItemInfo = pluginDOMElement.querySelector('.setting-item-info');
        if (settingItemInfo) {
            const descriptionDiv = settingItemInfo.querySelector('.setting-item-description');
            if (descriptionDiv) {
                const commentDiv = descriptionDiv.querySelector('.plugin-comment');
                if (!commentDiv) {
                    const annotation_container = document.createElement('div');
                    annotation_container.className = 'plugin-comment';

                    new annotationControl(this,annotation_container,pluginId,pluginName);
                    
                    descriptionDiv.appendChild(annotation_container);                       
                }
            }
        }
        const controlDiv = pluginDOMElement.querySelector('.setting-item-control');
        if (controlDiv) {
            const GitHubDiv = document.createElement('div');
            GitHubDiv.classList.add('clickable-icon', 'extra-setting-button');
            GitHubDiv.setAttribute('aria-label', 'Open plugin\'s GitHub page');
            GitHubDiv.innerHTML = this.svg_github_light;

            // Get all elements with the class .clickable-icon inside controlDiv
            const clickableIcons = controlDiv.querySelectorAll('.clickable-icon');
            console.log(manifest);
            // Insert the new icon as the second last of all clickable icons
            if (clickableIcons.length > 0) {
                const lastIcon = clickableIcons[clickableIcons.length - 1];
                controlDiv.insertBefore(GitHubDiv, lastIcon);
            } else {
                // If no clickable icons are found, append it as the first child
                controlDiv.insertBefore(GitHubDiv, controlDiv.firstChild);
            }
        }
    }

    addAnnotations(tab: SettingTab) {
        const pluginsContainer = tab.containerEl.querySelector('.installed-plugins-container');
        if (!pluginsContainer) return;
        
        const pluginDOMElements = pluginsContainer.querySelectorAll('.setting-item');
        pluginDOMElements.forEach(pluginDOMElement => {
            this.addAnnotation(pluginDOMElement);
        });
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

        // Remove icons
        this.removeIcon();
    }

    getUninstalledPlugins(): PluginAnnotationDict {
        const installedPluginIds = new Set(Object.keys(this.app.plugins.manifests));
        const uninstalledPlugins: PluginAnnotationDict = {};

        for (const pluginId of this.sortedPluginIds) {
            if (!installedPluginIds.has(pluginId)) {
                uninstalledPlugins[pluginId] = this.settings.annotations[pluginId];
            }
        }
        return uninstalledPlugins;
    }
}

