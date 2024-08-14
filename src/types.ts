// types.ts

import { DEFAULT_SETTINGS } from "defaults";

export interface PluginAnnotation {
	name: string;  // extended name of the plugin
	desc: string;  // personal annontation
	type: AnnotationType;  // annotation type
}

export interface PluginAnnotationDict {
	[pluginId: string]: PluginAnnotation;
}

export interface PluginBackup {
    name: string;
    date: Date;
    settings: unknown;
}

export interface PluginsAnnotationsSettings {
	annotations: PluginAnnotationDict;
	plugins_annotations_uuid: string;
	hide_placeholders: boolean;
	delete_placeholder_string_on_insertion: boolean;
	label_mobile: string;
	label_desktop: string;
	label_placeholder: string;
	editable: boolean;
	automatic_remove: boolean;
	markdown_file_path: string;
	compatibility: string;
	backups: PluginBackup[];
}

type PluginsAnnotationsSettingsWithoutBackups = Omit<PluginsAnnotationsSettings, 'backups'>;

export function isPluginsAnnotationsSettings(s:unknown): s is PluginsAnnotationsSettings {
	if (typeof s !== 'object' || s === null) {
		return false;
	}
	return 'annotations' in s
		&& 'compatibility' in s && (s as PluginsAnnotationsSettings).compatibility === '1.5.0'
		&& 'plugins_annotations_uuid' in s
		&& (s as PluginsAnnotationsSettings).plugins_annotations_uuid === DEFAULT_SETTINGS.plugins_annotations_uuid;
}

export function isPluginAnnotation(anno:unknown): anno is PluginAnnotation {
	if (typeof anno !== 'object' || anno === null) {
		return false;
	}
	const obj = anno as Record<string, unknown>;

	const hasName = typeof obj.name === 'string';
	const hasDesc = typeof obj.desc === 'string';
	const hasType = typeof obj.type === 'string' && Object.values(AnnotationType).includes(obj.type as AnnotationType);

	return hasName && hasDesc && hasType;
}

// Function to render the annotation based on preamble
export function parseAnnotation(text: string): {annoType: AnnotationType, annoDesc: string} {
    const preambleRegex = /^(html|markdown|text):\s*/i;
    const match = text.match(preambleRegex);

    if (match) {
        const annoTypeString = match[1].toLowerCase();
        const sliced = text.slice(match[0].length).trim(); // Remove preamble and any leading/trailing whitespace
        
        switch (annoTypeString) {
            case 'html':
                return {annoType: AnnotationType.html, annoDesc: sliced};
            case 'markdown':
                return {annoType: AnnotationType.markdown, annoDesc: sliced};
            case 'text':
                return {annoType: AnnotationType.text, annoDesc: sliced};
        }
    }

    // Default case: treat as markdown
    return {annoType: AnnotationType.markdown, annoDesc: text.trim()};
}

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
