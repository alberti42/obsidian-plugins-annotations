// utils.ts

import PluginsAnnotations from "main";
import { App, Modal, normalizePath, TAbstractFile, TFile, TFolder, Vault,
	AbstractInputSuggest, prepareFuzzySearch, SearchResult } from "obsidian";
import * as path from "path";
import { ParsedPath, PluginAnnotationDict } from "types";

export function parseFilePath(filePath: string): ParsedPath {
	filePath = normalizePath(filePath);
	const lastSlashIndex = filePath.lastIndexOf('/');

	const dir = lastSlashIndex !== -1 ? filePath.substring(0, lastSlashIndex) : '';
	const base = lastSlashIndex !== -1 ? filePath.substring(lastSlashIndex + 1) : filePath;
	const extIndex = base.lastIndexOf('.');
	const filename = extIndex !== -1 ? base.substring(0, extIndex) : base;
	const ext = extIndex !== -1 ? base.substring(extIndex) : '';

	return { dir: normalizePath(dir), base, filename, ext, path: filePath };
}

// Helper function to show a confirmation dialog
export function showConfirmationDialog(app: App, title: string, message: DocumentFragment | string): Promise<boolean> {
	return new Promise((resolve) => {
		const modal = new Modal(app);
		modal.titleEl.setText(title);

		if (typeof message === 'string') {
			modal.contentEl.setText(message);
		} else {
			modal.contentEl.appendChild(message);
		}

		const buttonContainer = modal.contentEl.createDiv({ cls: 'modal-button-container' });
		buttonContainer.createEl('button', { text: 'Yes', cls: 'mod-cta' }).addEventListener('click', () => {
			resolve(true);
			modal.close();
		});
		buttonContainer.createEl('button', { text: 'No' }).addEventListener('click', () => {
			resolve(false);
			modal.close();
		});

		modal.open();
	});
}

export function makePosixPathOScompatible(posixPath:string): string {
	return posixPath.split(path.posix.sep).join(path.sep);
}

// Joins multiple path segments into a single normalized path.
export function joinPaths(...paths: string[]): string {
	return paths.join('/');
}

export function isInstanceOfFolder(file: TAbstractFile): file is TFolder {
	return file instanceof TFolder;
}

export function isInstanceOfFile(file: TAbstractFile): file is TFile {
	return file instanceof TFile;
}

export function doesFolderExist(vault: Vault, relativePath: string): boolean {
	const file: TAbstractFile | null = vault.getAbstractFileByPath(relativePath);
	return !!file && isInstanceOfFolder(file);
}

export function doesFileExist(vault: Vault, relativePath: string): boolean {
	const file: TAbstractFile | null = vault.getAbstractFileByPath(relativePath);
	return !!file && isInstanceOfFile(file);
}

export async function createFolderIfNotExists(vault: Vault, folderPath: string) {
	if(doesFolderExist(vault,folderPath)) return;

	try {
		await vault.createFolder(folderPath);
	} catch (error) {
		throw new Error(`Failed to create folder at ${folderPath}: ${error}`);
	}
}

/* File suggestions */
export class FileSuggestion extends AbstractInputSuggest<TFile> {
	constructor(app: App, inputEl: HTMLInputElement, private files:TFile[], private onSelectCallback: (file: TFile) => void = (v: TFile) => {}) {
		super(app, inputEl);
	}

	doFuzzySearch(target: string, maxResults = 20, minScore = -2): TFile[] {
		if (!target || target.length < 2) return [];
		const fuzzy = prepareFuzzySearch(target);
		const matches: [TFile, SearchResult | null][] = this.files.map((c) => [c, fuzzy(c.path)]);
		// Filter out the null matches
		const validMatches = matches.filter(([, result]) => result !== null && result.score > minScore);
		// Sort the valid matches by score
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		validMatches.sort(([, a], [, b]) => b!.score - a!.score);
		return validMatches.map((c) => c[0]).slice(0, maxResults);
	}

	getSuggestions(inputStr: string): TFile[] {
		return this.doFuzzySearch(inputStr);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path);
	}

	selectSuggestion(selection: TFile, evt: MouseEvent | KeyboardEvent): void {
		this.onSelectCallback(selection);
		this.textInputEl.value = selection.path;
		
		// Create a custom event with additional data
		this.textInputEl.dispatchEvent(new Event('change'));
		this.textInputEl.setSelectionRange(0, 1)
		this.textInputEl.setSelectionRange(this.textInputEl.value.length,this.textInputEl.value.length)
		this.textInputEl.focus()
		this.close();
	}
}


/* Sorting plugins annotations by name */

// Function to sort PluginAnnotationDict based on the name field
export function sortPluginAnnotationsByName(annotations: PluginAnnotationDict): string[] {
	// Create an array of pairs [pluginId, name]
	const pluginArray = Object.entries(annotations).map(([pluginId, annotation]) => {
		return { pluginId, name: annotation.name };
	});

	// Sort the array based on the 'name' field
	pluginArray.sort((a, b) => a.name.localeCompare(b.name));

	return pluginArray.map(item => item.pluginId);
}