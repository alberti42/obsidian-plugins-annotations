// utils.ts

import { App, Modal, normalizePath } from "obsidian";
import * as path from "path";
import { ParsedPath } from "types";

export function parseFilePath(filePath: string): ParsedPath {
	filePath = normalizePath(filePath);
	const lastSlashIndex = filePath.lastIndexOf('/');

	const dir = lastSlashIndex !== -1 ? filePath.substring(0, lastSlashIndex) : '';
	const base = lastSlashIndex !== -1 ? filePath.substring(lastSlashIndex + 1) : filePath;
	const extIndex = base.lastIndexOf('.');
	const filename = extIndex !== -1 ? base.substring(0, extIndex) : base;
	const ext = extIndex !== -1 ? base.substring(extIndex) : '';

	return { dir, base, filename, ext, path: filePath };
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
