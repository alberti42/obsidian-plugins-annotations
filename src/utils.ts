// utils.ts

import { normalizePath } from "obsidian";
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
