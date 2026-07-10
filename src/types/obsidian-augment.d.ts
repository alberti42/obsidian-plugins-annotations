// obsidian-augment.d.ts

import 'obsidian';

declare module "obsidian" {
    interface App {
        internalPlugins: InternalPlugins;
        plugins: Plugins;
        setting: Setting;
    }
    interface Plugin {
        _loaded: boolean;
    }
    interface PluginSettingTab {
        name: string;
    }
    interface SettingTab {
        id: string;
        name: string;
        navEl: HTMLElement;
		// Per-plugin row renderer of the community-plugins tab (Obsidian >= 1.13):
		// `setting` is the row's Setting component (exposes `settingEl`), `manifest` its plugin manifest.
		renderInstalledPlugin(setting: Setting, manifest: PluginManifest): void;
    }
    interface Setting {
        onOpen(): void;
        onClose(): void;

        openTabById(id: string): void;
        openTab(tab: SettingTab): void;

        closeActiveTab(tab: SettingTab): void;

        isPluginSettingTab(tab: SettingTab): boolean;
        addSettingTab(tab: SettingTab): void;
        removeSettingTab(tab: SettingTab): void;

        activeTab: SettingTab;
        lastTabId: string;

        pluginTabs: PluginSettingTab[];
        settingTabs: SettingTab[];

        tabContentContainer: HTMLDivElement;
        tabHeadersEl: HTMLDivElement;

        close(): void;
    }
    
    interface Plugins {
        manifests: Record<string, PluginManifest>;
        plugins: Record<string, Plugin>;
        getPlugin(id: string): Plugin;
        uninstallPlugin(pluginId: string): Promise<void>;
        installPlugin(repo: string, version: string, manifest: PluginManifest): Promise<void>
    }
    
    interface InternalPlugins {
        plugins: Record<string, Plugin>;
        getPluginById(id: string): Plugin;
    }

    interface AbstractInputSuggest<T> extends PopoverSuggest<T> {
        textInputEl: HTMLInputElement;
    }

}
