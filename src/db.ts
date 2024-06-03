// db.ts

import { Vault } from 'obsidian';

let annotationFilePath: string | null = null;

interface PluginAnnotation {
	[pluginId: string]: string;
}

function setAnnotationFilePath(path: string) {
	annotationFilePath = path;
}


function isNodeJsError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && 'code' in error;
}

async function loadAnnotations(vault: Vault): Promise < PluginAnnotation > {
	if (!annotationFilePath) {
		console.error('Could not load annotations. Failed to retrieve the path of the annotation file.');
		return {};
	}

	try {
		const file = await vault.adapter.read(annotationFilePath);
		return JSON.parse(file);
	} catch (error) {
		if (isNodeJsError(error) && error.code === 'ENOENT') {
			// File does not exist, return an empty object
			// console.warn('Annotations file not found, loading empty annotations.');
			return {};
		} else {
			// Failed, return an empty object
			console.error('Failed to load annotations:', error);
			return {};
		}
	}
}

async function saveAnnotations(vault: Vault, annotations: PluginAnnotation): Promise < void > {
	if (!annotationFilePath) {
		console.error('Could not save annotations. Failed to retrieve the path of the annotation file.');
		return;
	}

	try {
		const data = JSON.stringify(annotations, null, 2);
		await vault.adapter.write(annotationFilePath, data);
	} catch (error) {
		console.error('Failed to save annotations:', error);
	}
}

export { saveAnnotations, loadAnnotations, setAnnotationFilePath }
