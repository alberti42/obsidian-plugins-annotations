// types.ts

import { DEFAULT_SETTINGS_1_4_0 } from './defaults_legacy';

// type: AnnotationType; // type of annotation

export enum AnnotationType {
	text = 'text',
	html = 'html',
	markdown = 'markdown',
}

export interface ParsedPath {
	dir: string,
	base: string,
	filename: string,
	ext: string,
	path: string
}
