// db.ts

import { Vault } from 'obsidian';

const DB_FILE = 'plugin-annotations.json';

import { join } from 'path';

let pluginId: string | null = null;

interface PluginAnnotation {
	[pluginId: string]: string;
}

function setPluginId(name: string) {
	pluginId = name;
}

function isNodeJsError(error: any): error is NodeJS.ErrnoException {
	return error && typeof error.code === 'string';
}

async function getDbFilePath(vault: Vault): Promise < string|null > {
	if(!pluginId) { return null; }
	
	const pluginFolder = vault.configDir;
	return join(pluginFolder,'plugins',pluginId,DB_FILE);
}

async function loadAnnotations(vault: Vault): Promise < PluginAnnotation > {
	const filePath = await getDbFilePath(vault);
	if(!filePath) {
		console.error('Could not load annotations. Failed to retrieve the path of the annotation file.');
		return {};
	}

	try {
		const file = await vault.adapter.read(filePath);
		return JSON.parse(file);
	} catch (error) {
		if (isNodeJsError(error) && error.code === 'ENOENT') {
			// File does not exist, return an empty object
			console.warn('Annotations file not found, loading empty annotations.');
			return {};
		} else {
			console.error('Failed to load annotations:', error);
			return {};
		}
	}
}

async function saveAnnotations(vault: Vault, annotations: PluginAnnotation): Promise < void > {
	const filePath = await getDbFilePath(vault);
	if(!filePath) {
		console.error('Could not save annotations. Failed to retrieve the path of the annotation file.');
		return;
	}
	
	try {
		const data = JSON.stringify(annotations, null, 2);
		await vault.adapter.write(filePath, data);
	} catch (error) {
		console.error('Failed to save annotations:', error);
	}
}

export { saveAnnotations, loadAnnotations, setPluginId }
