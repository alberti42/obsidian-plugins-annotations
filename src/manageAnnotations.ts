// manageAnnotations.ts

import PluginsAnnotations from "main";
import { Platform, TFile } from "obsidian";
import { joinPaths, makePosixPathOScompatible, parseFilePath, showConfirmationDialog } from "utils";

export async function handleMarkdownFilePathChange(plugin: PluginsAnnotations, filepath: string): Promise<void> {
	const parsed_filepath = parseFilePath(filepath);

	if (parsed_filepath.ext !== '.md') {
		console.log('The filename extension must be .md');
		return;
	}

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
		const createFile = await showConfirmationDialog(plugin.app, 'Create File', message);
		if (!createFile) return;
		await plugin.app.vault.create(filepath, '');
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
			frag.appendText(' already exists. Do you want to overwrite it?');
		});
		
		const overwriteFile = await showConfirmationDialog(plugin.app, 'Overwrite File', message);
		if (!overwriteFile) return;
	}

	plugin.settings.markdown_file_path = filepath;
	plugin.saveSettings(plugin.settings);
	writeAnnotationsToFile(plugin, filepath);
}

export async function writeAnnotationsToFile(plugin: PluginsAnnotations, filePath: string) {
	if(!plugin.pluginNameToIdMap) return;

	const annotations = plugin.settings.annotations;
	
	try {
		let content = '';
		for (const pluginId in annotations) {
			
			console.log(pluginId);
			console.log(annotations[pluginId].anno);
			console.log(annotations[pluginId].name);
			console.log('---');
			content += `# ${annotations[pluginId].name}\n\n<!-- id: ${pluginId} -->\n<!-- BEGIN ANNOTATION -->\n${annotations[pluginId].anno}\n<!-- END ANNOTATION -->\n`;
		}

		let file = plugin.app.vault.getAbstractFileByPath(filePath);
		if (!file) {
			file = await plugin.app.vault.create(filePath, content);
		} else {
			await plugin.app.vault.modify(file as TFile, content);
		}
	} catch (error) {
		console.error('Failed to write annotations to file:', error);
	}
}
