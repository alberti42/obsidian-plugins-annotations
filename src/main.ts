// main.ts

import {
    Plugin,
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
import { CommunityPluginInfo, CommunityPluginInfoDict, isPluginAnnotation, isPluginsAnnotationsSettings, PluginAnnotation, PluginAnnotationDict, PluginBackup, PluginsAnnotationsSettings } from './types';
import { PluginAnnotationDict_1_4_0, PluginsAnnotationsSettings_1_4_0, PluginsAnnotationsSettings_1_3_0, isPluginAnnotationDictFormat_1_3_0, isSettingsFormat_1_3_0, isSettingsFormat_1_4_0, parseAnnotation_1_4_0, PluginsAnnotationsSettings_1_5_0, PluginAnnotationDict_1_5_0, isPluginsAnnotationsSettings_1_5_0, PluginsAnnotationsSettings_1_6_0, isPluginsAnnotationsSettings_1_6_0, } from 'types_legacy'
import { DEFAULT_SETTINGS_1_3_0, DEFAULT_SETTINGS_1_4_0, DEFAULT_SETTINGS_1_5_0, DEFAULT_SETTINGS_1_6_0 } from './defaults_legacy';
import { DEFAULT_SETTINGS } from 'defaults';
import { PluginsAnnotationsSettingTab } from 'settings_tab'
import * as path from 'path';
import { readAnnotationsFromMdFile, writeAnnotationsToMdFile } from 'manageAnnotations';
import { backupSettings, debounceFactoryWithWaitMechanism, delay, sortAnnotations } from 'utils';
import { AnnotationControl } from 'annotation_control';

import { svg_locked, svg_unlocked, svg_github_dark, svg_github_light } from "graphics";
    
export default class PluginsAnnotations extends Plugin {
    settings: PluginsAnnotationsSettings = structuredClone(DEFAULT_SETTINGS);
    pluginNameToIdMap: Record<string,string> = {};
    pluginIdToNameMap: Record<string,string> = {};
    sortedPluginIds: string[] = [];

    private lockIcon: HTMLDivElement | null = null;

    private communityPluginTab: SettingTab | undefined = undefined;
    private vaultPath: string | null = null;

    private community_plugins = {} as CommunityPluginInfoDict;

    private handleThemeChange: ((event: MediaQueryListEvent) => void) | null = null;
    private colorSchemeMedia: MediaQueryList | null = null;

     // Declare class methods that will be initialized in the constructor
    debouncedSaveAnnotations: (callback?: () => void) => void;
    waitForSaveToComplete: () => Promise<void>;

    private communityPluginSettingTabPatched = false;

    private listGitHubIcons:HTMLDivElement[] = [];

    annotationBeingEdited = false;

    constructor(app:App, manifest:PluginManifest) {
        super(app, manifest);

        // Set up debounced saving functions
        const timeout_debounced_saving_ms = 200;
        const { debouncedFct, waitFnc } = debounceFactoryWithWaitMechanism(
            async (callback: () => void = (): void => {}) => {
                await this.saveSettings();
                if(callback) callback();
            }, timeout_debounced_saving_ms);
        this.debouncedSaveAnnotations = debouncedFct;
        this.waitForSaveToComplete = waitFnc;

        this.onLayoutReady = this.onLayoutReady.bind(this);
        this.onModifiedFile = this.onModifiedFile.bind(this);
    }

    async onload() {
        // console.log('Loading Plugins Annotations');

        // Add settings tab. It avoids loading the setting at this stage
        // because the cache about the files in the vault is not created yet.
        this.addSettingTab(new PluginsAnnotationsSettingTab(this.app, this));
        
        this.app.workspace.onLayoutReady(this.onLayoutReady);

        this.app.vault.on('modify',this.onModifiedFile);

        // Call this function in your plugin initialization or where appropriate
        this.loadCommunityPluginsJson();
    }

    async onModifiedFile(modifiedFile: TAbstractFile){
        if(this.settings.markdown_file_path !== '') {
            if (modifiedFile.path === this.settings.markdown_file_path) {
                if(!this.annotationBeingEdited) {
                    // Read new annotations
                    await readAnnotationsFromMdFile(this);

                    // Sort the plugins by name
                    this.sortPluginAnnotationsByName();

                    // Save the imported annotations to data.json
                    this.saveDataJson();

                    // Update the community plugin pane if this is currently open
                    this.updateCommunityPluginPaneIfOpened();
                }

            }
        }
    }

    async onLayoutReady() {
        // Load settings
        const loadSettingsPromise = this.loadSettings();
        
        // Load the big json file containing the GitHub address of all community plugins
        const loadCommunityPluginsJsonPromise = this.loadCommunityPluginsJson();

        // Store a reference to the community plugin tab
        this.communityPluginTab = this.app.setting.settingTabs.find((tab:SettingTab):boolean => tab.id === "community-plugins");

        // Patch the rendering function of the community plugin preference pane
        if(this.communityPluginTab) this.patchCommunityPluginSettingTab(this.communityPluginTab);

        // Monkey-patch functions to detect when community plugins are installed and uninstalled.
        this.hookOnInstallAndUninstallPlugins();

        // Detect color scheme
        this.colorSchemeMedia = matchMedia('(prefers-color-scheme: dark)');

        // Install listener to theme changes
        if(this.communityPluginTab && this.communityPluginTab.containerEl) this.listenForThemeChange(this.communityPluginTab.containerEl);

        // Update the community plugin pane if this is currently open
        this.updateCommunityPluginPaneIfOpened([loadSettingsPromise,loadCommunityPluginsJsonPromise]);
    }

    /* Load settings for different versions */
    async importSettings(data: unknown): Promise<boolean> {

        const importBackups: PluginBackup[] = [];

        // Set to true when the settings are updated to the new format
        let wasUpdated = false;
        
        // Nested function to handle different versions of settings
        const getSettingsFromData = async (data: unknown): Promise<unknown> => {
            if (isPluginsAnnotationsSettings(data)) {
                return data as PluginsAnnotationsSettings;
            } else if (isPluginsAnnotationsSettings_1_6_0(data)) {
                // Make a backup
                await backupSettings('Settings before upgrade from 1.5 to 1.6',data,importBackups);
                await delay(10); // add a small delay to shift the timestamp of the backup

                const settings: PluginsAnnotationsSettings = {
                    ...data,
                    "compatibility":"1.7.0",
                    show_github_icons:DEFAULT_SETTINGS.show_github_icons
                };
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
                const default_new_settings = DEFAULT_SETTINGS_1_6_0;
                const newSettings: PluginsAnnotationsSettings_1_6_0 = {
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

        return wasUpdated;
    }

    async loadSettings(data?: unknown): Promise<void> {
        // Function loading settings. If `data` is provided, then it is a restore operations.

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

        const wasUpdated = await this.importSettings(data);

        const saveData = (isRestoreOperation || wasUpdated) ? true : false;
        if(saveData) { // if it requires to store the new settings, the .md file will be overwritten
            await this.saveSettings();
        } else { // otherwise read from the md file
            if(this.settings.markdown_file_path!=='') {
                await readAnnotationsFromMdFile(this);
            }
        }

        // Sort the plugins by name
        this.sortPluginAnnotationsByName();
    }

    async updateCommunityPluginPaneIfOpened(promises?:Promise<void>[]) {
        // Check whether the community plugin pane is active, and if so apply show the personal annotations right away
        const activeTab = this.app.setting.activeTab;
        if (activeTab && activeTab.id === 'community-plugins') {
            if(promises) await Promise.all(promises);
            // This approach is not elegant, where we first remove all customizations and then add them again 
            // with the new settings. However, it is very fast, and it is called very rarely, only when the user
            // changes the configuration from an external editor or through the synchronization engine, and the
            // user has the preference pane open at the same time.
            this.removeCommentsFromTab();
            this.removeGitHubIcons();
            this.removeLockIcon();
            if(this.communityPluginTab && this.communityPluginTab.containerEl) this.addLockIcon(this.communityPluginTab.containerEl);
            this.addAnnotations();
        }
    }

    onExternalSettingsChange() {
        // Load settings
        const loadSettingsPromise = this.loadSettings();

        // Update the community plugin pane if this is currently open
        this.updateCommunityPluginPaneIfOpened([loadSettingsPromise]);
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

    async saveDataJson() {
       try {
            await this.saveData(this.settings);
        } catch (error) {
            console.error('Failed to save annotations:', error);
        }
    }

    async saveSettings() {
        // Save the data to data.json file
        await this.saveDataJson();

        // Save annotations to the md file
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

    patchCommunityPluginSettingTab(tab:SettingTab) {
        if(this.communityPluginSettingTabPatched) return;

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        // Monkey patch for uninstallPlugin
        const removeMonkeyPatchForRender = around(tab, {
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
                        if(containerEl && containerEl.lastElementChild) self.addAnnotation(containerEl.lastElementChild);
                };
            },
            // Patch for `render` method
            render: (next: (
                    isInitialRender: boolean
                ) => void) => {

                return function (this: SettingTab, isInitialRender: boolean): void {
                    self.listGitHubIcons = [];

                    // Call the original `render` function
                    next.call(this, isInitialRender);
                    self.addLockIcon(this.containerEl);
                };
            }
        });

        // Register the patch to ensure it gets cleaned up
        this.register(removeMonkeyPatchForRender);

        this.communityPluginSettingTabPatched = true;
    }

    hookOnInstallAndUninstallPlugins() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

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
            installPlugin: (next: (repo: string, version: string, manifest: PluginManifest) => Promise<void>) => {
                return async function (this: Plugins, repo: string, version: string, manifest: PluginManifest): Promise<void> {
                    await next.call(this, repo, version, manifest);
                    self.pluginNameToIdMap[manifest.name] = manifest.id;
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

    listenForThemeChange(tabContainer: HTMLElement) {
        // If listener is already install, we can directly return
        if(this.handleThemeChange) return;

        // Check if the color scheme was detected
        if (this.colorSchemeMedia===null) {
            console.warn("Color scheme could not be determined.");
            return;
        }

        // Create the event listener with the correct signature
        this.handleThemeChange = (event: MediaQueryListEvent): void => {
            const pluginsContainer = tabContainer.querySelector('.installed-plugins-container');

            const isDarkMode = event.matches;  // true means dark mode is active
            
            if (pluginsContainer) {
                const githubIcons = pluginsContainer.querySelectorAll(
                    'div.setting-item > div.setting-item-control > div.github-icon'
                );
                
                // Iterate over each github icon and set the appropriate SVG
                githubIcons.forEach((icon) => {
                    if (isDarkMode) {
                        icon.innerHTML = svg_github_dark;
                    } else {
                        icon.innerHTML = svg_github_light;
                    }
                });
            }
        }

        // Add an event listener for changes to the appearance mode
        this.colorSchemeMedia.addEventListener("change", this.handleThemeChange);    
    }

    async addLockIcon(containerEl: HTMLElement) {
        // Add new icon to the existing icons container
        const headingContainer = containerEl.querySelector('.setting-item-heading .setting-item-control');
        if (headingContainer) {
            
            this.lockIcon = document.createElement('div');

            const lockIcon = this.lockIcon;
            lockIcon.classList.add('clickable-icon', 'extra-setting-button');
            
            if(this.settings.editable) {
                lockIcon.setAttribute('aria-label', 'Click to lock personal annotations');
                lockIcon.innerHTML = svg_unlocked;
            } else {
                lockIcon.setAttribute('aria-label', 'Click to be able to edit personal annotations');
                lockIcon.innerHTML = svg_locked;
            }

            lockIcon.addEventListener('click', (event:MouseEvent) => {
                this.settings.editable = !this.settings.editable;
                
                this.debouncedSaveAnnotations();
                if(this.settings.editable) {
                    lockIcon.setAttribute('aria-label', 'Click to lock personal annotations');
                    lockIcon.innerHTML = svg_unlocked;
                } else {
                    lockIcon.setAttribute('aria-label', 'Click to unlock personal annotations');
                    lockIcon.innerHTML = svg_locked;

                }
                const plugins = containerEl.querySelectorAll('.plugin-comment-annotation');
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

    removeLockIcon() {
        if(this.lockIcon) {
            this.lockIcon.remove();
            this.lockIcon = null;
        }
    }

    removeGitHubIcons() {
        this.listGitHubIcons.forEach((iconEl:Element) => {
            iconEl.remove();
        })
    }

    async loadCommunityPluginsJson() {
        // If the user decided not to show the GitHub icons, then avoid running this function
        if(!this.settings.show_github_icons) return;

        // If it was already loaded, we just return without fetching a new json
        if(Object.keys(this.community_plugins).length>0) return;

        try {
            // Fetch the JSON data from the URL
            const response = await fetch('https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json');

            // Check if the response is OK (status code 200-299)
            if (!response.ok) {
                // throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
                return;
            }

            // Parse the JSON data
            const pluginsData = (await response.json()) as CommunityPluginInfo[];

            this.community_plugins = pluginsData.reduce((acc:CommunityPluginInfoDict, plugin:CommunityPluginInfo) => {
                acc[plugin.id] = plugin;
                return acc;
                }, {} as CommunityPluginInfoDict);

        } catch (error) {
            console.error('Error loading community plugins JSON:', error);            
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

        const settingItemInfo = pluginDOMElement.querySelector('.setting-item-info');
        if (settingItemInfo) {
            const descriptionDiv = settingItemInfo.querySelector('.setting-item-description');
            if (descriptionDiv) {
                const commentDiv = descriptionDiv.querySelector('.plugin-comment');
                if (!commentDiv) {
                    const annotation_container = document.createElement('div');
                    annotation_container.className = 'plugin-comment';

                    const annotationControl = new AnnotationControl(this,annotation_container,pluginId,pluginName);
                    
                    descriptionDiv.appendChild(annotation_container);                       

                    if(this.settings.show_github_icons) {
                        // Get the repository of the plugin
                        const community_plugins = this.community_plugins[pluginId];
                        const repo = community_plugins ? community_plugins.repo : undefined;
                        if (repo) {
                            const controlDiv = pluginDOMElement.querySelector('.setting-item-control');
                            if(controlDiv) {
                                if(this.colorSchemeMedia) {
                                    const isDarkMode = this.colorSchemeMedia.matches;
                                    const gitHubIcon = annotationControl.addGitHubIcon(controlDiv,repo, isDarkMode);
                                    if(gitHubIcon) this.listGitHubIcons.push(gitHubIcon);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    addAnnotations() {
        if(this.communityPluginTab===undefined) {
            console.warn("Annotations could not be added because the community plugin pane was not detected.")
            return;
        }

        const pluginsContainer = this.communityPluginTab.containerEl.querySelector('.installed-plugins-container');
        if (!pluginsContainer) {
            console.warn("Annotations could not be added because installed-plugins-container was not detected.")
            return;
        }
        
        const pluginDOMElements = pluginsContainer.querySelectorAll('.setting-item');
        pluginDOMElements.forEach(pluginDOMElement => {
            this.addAnnotation(pluginDOMElement);
        });
    }

    removeCommentsFromTab() {
        if (this.communityPluginTab) {
            const commentElements = this.communityPluginTab.containerEl.querySelectorAll('.plugin-comment');
            commentElements.forEach(element => {
                element.remove();
            });
        }
    }

    removeHandleThemeChangeListener() {
        // Remove listeners
        if (this.handleThemeChange) {
            if (this.colorSchemeMedia) {
                this.colorSchemeMedia.removeEventListener("change", this.handleThemeChange);
            }
        }
    }

    onunload() {
        // console.log('Unloading Plugins Annotations');

        // Remove all comments
        this.removeCommentsFromTab();

        // Remove icons
        this.removeLockIcon();

        // Remove listner to theme change
        this.removeHandleThemeChangeListener();

        // Unregister other event listeners
        this.app.vault.off('modify',this.onModifiedFile);

        // Remove GitHub icons
        this.removeGitHubIcons();
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

