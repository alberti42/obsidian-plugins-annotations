// manageAnnotations.ts

import PluginsAnnotations from "main";
import { Platform, TFile } from "obsidian";
import { createFolderIfNotExists, getFileCaseInsensitive, joinPaths, makePosixPathOScompatible, parseFilePath, showConfirmationDialog } from "utils";
import { parse, SyntaxError } from "./peggy.mjs";
import { PluginAnnotationDict } from "types";

let isWriting = false;

export async function handleMarkdownFilePathChange(plugin: PluginsAnnotations, filepath: string): Promise<boolean> {
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
        if (!createFile) return false;
    } else {
        // File exists, ask user if they want to overwrite it

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

                    window.require('electron').remote.shell.showItemInFolder(makePosixPathOScompatible(joinPaths(plugin.getVaultPath(),filepath))); // Adjust as necessary
                });
            } else {
                frag.createEl('strong', {
                    text: base
                });
            }
            frag.appendText(' already exists. Do you want to replace the file with your personal annotations about the installed plugins? If you reply yes, the existing file is moved to the trash.');
        });
        
        const overwriteFile = await showConfirmationDialog(plugin.app, 'Overwrite file', message);
        if (!overwriteFile) return false;
        await plugin.app.vault.adapter.trashSystem(file.path);
    }
    return true;
}

export async function readAnnotationsFromMdFile(plugin: PluginsAnnotations): Promise<void> {
    if(isWriting) return;

    const filePath = plugin.settings.markdown_file_path;

    const file = plugin.app.vault.getFileByPath(filePath);

    if(!file) {
        // If the file does not exist but we have annotation in memory, write them down
        writeAnnotationsToMdFile(plugin);
        return;
    }

    try {
        const md_content = await plugin.app.vault.read(file);

        try {
            const md_content_parsed = parse(md_content) as PluginAnnotationDict;
            plugin.settings.annotations = md_content_parsed;
        } catch(error) {             
            if (error instanceof SyntaxError) {
                console.error("Syntax error:", error);
            } else {
                console.error("Unexpected error:", error);
            }
        }   
    } catch (error) {
        console.error('Failed to read annotations from file:', error);
        return;
    }
}

export async function writeAnnotationsToMdFile(plugin: PluginsAnnotations) {
    if(!plugin.pluginNameToIdMap) return;
    const filePath = plugin.settings.markdown_file_path;
    if(filePath === "") return;
    const annotations = plugin.settings.annotations;
    // if(Object.keys(annotations).length === 0) return;

    const header = 'Make changes only within the annotation blocks marked by <!-- BEGIN ANNOTATION --> and <!-- END ANNOTATION -->. Changes made anywhere else will be overwritten.\n'

    const content: string[] = [header];
    for (const pluginId in annotations) {
        content.push(`# ${annotations[pluginId].name}\n\n<!-- id: ${pluginId} -->\n<!-- type: ${annotations[pluginId].type} -->\n<!-- BEGIN ANNOTATION -->\n${annotations[pluginId].desc}\n<!-- END ANNOTATION -->\n`);
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
        } else {
            isWriting = true;
            await plugin.app.vault.modify(file as TFile, content_concatenated);
            isWriting = false;
        }
    } catch (error) {
        console.error('Failed to write Markdown file with annotations:', error);
        return;
    }
}
