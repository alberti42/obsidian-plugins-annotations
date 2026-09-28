// manageAnnotations.ts

import PluginsAnnotations from "main";
import { Platform, TFile } from "obsidian";
import { createFolderIfNotExists, getFileCaseInsensitive, joinPaths, makePosixPathOScompatible, parseFilePath, showChoiceDialog, showConfirmationDialog } from "utils";
import { parse, SyntaxError } from "./peggy.mjs";
import { PluginAnnotationDict } from "types";

let isWriting = false;

// What to do with the Markdown file the user selected: 'import' reads the annotations
// from the existing file, 'write' writes the current annotations to it.
export type MarkdownFileAction = 'import' | 'write';

// Asks the user how to use the selected Markdown file; resolves to null if they cancel.
export async function handleMarkdownFilePathChange(plugin: PluginsAnnotations, filepath: string): Promise<MarkdownFileAction | null> {
    const file = plugin.app.vault.getAbstractFileByPath(filepath);

    const {base} = parseFilePath(filepath);

    if (!file) {
        const message = createFragment((frag) => {
            frag.appendText('The file ');

            frag.createEl('strong', {
                text: base
            });

            frag.appendText(' does not exist. Do you want to create it?');
        });

        // File doesn't exist, ask user if they want to create it
        const createFile = await showConfirmationDialog(plugin.app, 'Create file', message);
        if (!createFile) return null;
        return 'write';
    } else {
        // File exists, ask user whether to import the annotations from it or overwrite it

        const {base} = parseFilePath(filepath);
        
        const message = createFragment((frag) => {
            frag.appendText('The file ');

            if (Platform.isDesktopApp) {
                const fileLink = frag.createEl('a', {
                    text: base,
                    href: '#',
                });
                fileLink.addEventListener('click', (e) => {
                    e.preventDefault(); // Prevent the default anchor behavior
                    // Open the folder in the system's default file explorer

                    // `window.require` is untyped, so describe just the sliver of the
                    // Electron API used here rather than calling through `any`.
                    const electron = window.require('electron') as {
                        remote: { shell: { showItemInFolder(fullPath: string): void } };
                    };
                    electron.remote.shell.showItemInFolder(makePosixPathOScompatible(joinPaths(plugin.getVaultPath(),filepath)));
                });
            } else {
                frag.createEl('strong', {
                    text: base
                });
            }
            frag.appendText(' already exists. Do you want to import your personal annotations from this file, or replace the file with your current annotations? Importing replaces all your current annotations with those in the file. If you choose to replace the file, the existing file is moved to the trash.');
        });

        const choice = await showChoiceDialog(plugin.app, 'File already exists', message, ['Import', 'Replace', 'Cancel']);
        if (choice === 'Import') return 'import';
        if (choice !== 'Replace') return null;
        await plugin.app.vault.adapter.trashSystem(file.path);
        return 'write';
    }
}

// Returns true if the annotations were read from the file, false if the file could
// not be read or parsed.
export async function readAnnotationsFromMdFile(plugin: PluginsAnnotations): Promise<boolean> {
    if(isWriting) return false;

    const filePath = plugin.settings.markdown_file_path;

    const file = plugin.app.vault.getFileByPath(filePath);

    if(!file) {
        // If the file does not exist but we have annotation in memory, write them down
        await writeAnnotationsToMdFile(plugin);
        return false;
    }

    try {
        const md_content = await plugin.app.vault.read(file);

        try {
            const md_content_parsed = parse(md_content) as PluginAnnotationDict;
            plugin.settings.annotations = md_content_parsed;
            return true;
        } catch(error) {             
            if (error instanceof SyntaxError) {
                console.error("Syntax error:", error);
            } else {
                console.error("Unexpected error:", error);
            }
            return false;
        }   
    } catch (error) {
        console.error('Failed to read annotations from file:', error);
        return false;
    }
}

export async function writeAnnotationsToMdFile(plugin: PluginsAnnotations) {
    if(!plugin.pluginNameToIdMap) return;
    const filePath = plugin.settings.markdown_file_path;
    if(filePath === "") return;
    const annotations = plugin.settings.annotations;
    // if(Object.keys(annotations).length === 0) return;

    const header = 'Make changes only within the annotation blocks marked by `<!-- BEGIN ANNOTATION -->` and `<!-- END ANNOTATION -->`. Changes made anywhere else will be overwritten.\n'

    const content: string[] = [header];
    for (const pluginId of plugin.sortedPluginIds) {
        content.push(`# ${annotations[pluginId].name}\n\n<!-- id: ${pluginId} -->\n<!-- BEGIN ANNOTATION -->\n${annotations[pluginId].desc}\n<!-- END ANNOTATION -->\n`);
    }
    const content_concatenated = content.join('\n');

    try {
        let file = await getFileCaseInsensitive(plugin.app.vault,filePath);
        
        if (file!==null && file.path !== filePath) {
            // remove the existing file, whose name is written with different case 
            // the md file will be recreated with the correct name
            await plugin.app.vault.adapter.remove(file.path);
            file = null;
        }

        if (!file) {
            try {
                const {dir} = parseFilePath(filePath);
                await createFolderIfNotExists(plugin.app.vault,dir);
            } catch (error) {
                console.error('Failed to create folder for Markdown file with annotations:', error);
                return;
            }
            isWriting = true;
            file = await plugin.app.vault.create(filePath, content_concatenated);
            isWriting = false;
        } else if (file instanceof TFile) {
            isWriting = true;
            await plugin.app.vault.modify(file, content_concatenated);
            isWriting = false;
        }
    } catch (error) {
        console.error('Failed to write Markdown file with annotations:', error);
        return;
    }
}
