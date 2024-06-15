// db.ts

import { Vault } from 'obsidian';

import PluginsAnnotations from './main';

import { PluginAnnotationDict } from './types';

let plugin: PluginsAnnotations | null = null;

function setPluginObj(p: PluginsAnnotations) {
	plugin = p;
}

async function loadAnnotations(vault: Vault): Promise < PluginAnnotationDict > {
	if(!plugin)	{
		return {};
	}

	return Object.assign({}, {}, await plugin.loadData());
}

async function saveAnnotations(vault: Vault, annotationsDict: PluginAnnotationDict): Promise < void > {
	if (plugin) {
		try {
			plugin.saveData(annotationsDict);
		} catch (error) {
			console.error('Failed to save annotations:', error);
		}
	}
}

export { saveAnnotations, loadAnnotations, setPluginObj }
