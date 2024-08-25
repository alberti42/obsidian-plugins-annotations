// utils.ts

import { App, Modal, normalizePath, TAbstractFile, TFile, TFolder, Vault,
    AbstractInputSuggest, prepareFuzzySearch, SearchResult } from "obsidian";
import * as path from "path";
import { ParsedPath, PluginAnnotationDict, PluginBackup } from "types";

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
        const modal = new class extends Modal {
            resolveState: boolean;

            constructor(app:App) {
                super(app);
                this.resolveState = false;
            }
            onClose() {
                resolve(this.resolveState); // Resolve the promise as 'false' when the modal is closed without explicit confirmation
            }
        }(app);

        modal.titleEl.setText(title);

        if (typeof message === 'string') {
            modal.contentEl.setText(message);
        } else {
            modal.contentEl.appendChild(message);
        }

        const buttonContainer = modal.contentEl.createDiv({ cls: 'modal-button-container' });
        buttonContainer.createEl('button', { text: 'Yes', cls: 'mod-cta' }).addEventListener('click', () => {
            modal.resolveState = true;
            modal.close();
        });
        buttonContainer.createEl('button', { text: 'No' }).addEventListener('click', () => {
            modal.resolveState = false;
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

export async function getFileCaseInsensitive(vault: Vault, filePath: string): Promise<TFile | null> {
    // Check if the file exists (case-insensitive check)
    const fileExists = await vault.adapter.exists(filePath);
    
    if (!fileExists) {
        return null; // File does not exist
    }

    // Iterate over all files and find the one with a case-insensitive match
    const normalizedFilePath = filePath.toLowerCase();

    for (const file of vault.getFiles()) {
        if (file.path.toLowerCase() === normalizedFilePath) {
            return file; // Return the matched TFile object with the correct case
        }
    }

    return null; // No matching file found, this shouldn't happen if exists() returned true
}

export async function createFolderIfNotExists(vault: Vault, folderPath: string) {
    if(doesFolderExist(vault,folderPath)) return;

    try {
        await vault.createFolder(folderPath);
    } catch (error) {
        throw new Error(`Failed to create folder at ${folderPath}: ${error}`);
    }
}

// Utility to debounce rebuilds
export function debounceFactory<F extends (...args: unknown[]) => unknown>(func: F, wait: number) {
    let timeout: ReturnType<typeof setTimeout>;

    return (...args: Parameters<F>): void => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

export function debounceFactoryWithWaitMechanism<F extends (...args: never[]) => void | Promise<void>>(func: F, wait: number) {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let promise: Promise<void> | null = null;
    let resolvePromise: (() => void) | null = null;

    return {
        // Function to wait for the completion of the current debounced call (if any)
        waitFnc: async (): Promise<void> => {
            while (promise) {
                await promise;  // Await the current promise
            }
        },

        // The debounced function itself
        debouncedFct: (...args: Parameters<F>): void => {
            // Clear the previous timeout to cancel any pending execution
            if (timeout) {
                clearTimeout(timeout);
            }

            // Store the previous resolvePromise to reject it after the new promise is created
            const previousResolvePromise = resolvePromise;

            // Create a new promise for the current execution
            promise = new Promise<void>((resolve, reject) => {
                // Set the new resolvePromise function
                resolvePromise = () => {
                    resolve();  // Resolve to indicate that the previous execution was cancelled
                };

                // Schedule the function to run after the debounce delay
                timeout = setTimeout(async () => {
                    try {
                        await func(...args);  // Execute the debounced function
                        resolve();  // Resolve the promise once the function is done
                    } catch (error) {
                        reject(error);  // Reject the promise if the function throws an error
                    }

                    // Clear the stored promise and resolve function after execution
                    promise = null;
                    resolvePromise = null;
                }, wait);
            });

            // After the new promise is created, resolve the previous one
            if (previousResolvePromise) {
                previousResolvePromise();  // Resolve the previous promise to indicate cancellation
            }
        }
    };
}

/* File suggestions */
export class FileSuggestion extends AbstractInputSuggest<TFile> {
    private files:TFile[] = [];

    constructor(app: App, inputEl: HTMLInputElement, private onSelectCallback: (file: TFile) => void = (v: TFile) => {}) {
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

    setSuggestions(files:TFile[]) {
        this.files = files;
    }
}

/* Download json settings */

export function downloadJson(data: unknown, filename = 'data.json') {
    if (typeof data !== 'object' || data === null) {
        return false;
    }

    // Step  Convert data to JSON string
    const jsonStr = JSON.stringify(data, null, 2); // Pretty print with 2-space indentation

    // Step 2: Create a Blob from the JSON string
    const blob = new Blob([jsonStr], { type: 'application/json' });

    // Step 3: Create a download link and trigger the download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;

    // Append the anchor to the body (required for Firefox)
    document.body.appendChild(a);
    a.click();

    // Clean up
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 0);
}

/* Sorting annotations */

export function sortAnnotations(annotations: PluginAnnotationDict): string[] {
    // Create an array of pairs [pluginId, name]
    const pluginArray = Object.entries(annotations).map(([pluginId, annotation]) => {
        return { pluginId, name: annotation.name };
    });
    
    // Sort the array based on the 'name' field
    pluginArray.sort((a, b) => a.name.localeCompare(b.name));
    
    return pluginArray.map(item => item.pluginId);
}

/* Backups */

export async function backupSettings(backupName: string, toBeBackedUp: unknown, destBackups: PluginBackup[]) {
    // Ensure settings is an object
    if (typeof toBeBackedUp !== 'object' || toBeBackedUp === null) return;

    let settingsWithoutBackup;

    // Remove the backups field from the settings to be backed up
    if (toBeBackedUp.hasOwnProperty('backups')) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { backups: _, ...rest } = toBeBackedUp as { backups: unknown };
        settingsWithoutBackup = rest;
    } else {
        settingsWithoutBackup = toBeBackedUp;
    }

    // Deep copy
    const deepCopiedSettings = structuredClone(settingsWithoutBackup);

    // Add the deep-copy of the settings to the beginning of the array
    // See: https://stackoverflow.com/a/8073687/4216175
    destBackups.unshift({
        name: backupName,
        date: new Date(),
        settings: deepCopiedSettings
    });
}

/* Misc functions */

export function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

