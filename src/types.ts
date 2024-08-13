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
}

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
export function parse_annotation(text: string): {type:AnnotationType,content:string} {
	const lines = text.split('\n');
	const preamble = lines[0].toLowerCase();
	const sliced = lines.slice(1).join('\n');
	
	// annotation_div.innerHTML = '';
	if (preamble.startsWith('html:')) {
		return {type: AnnotationType.html, content: sliced};
	} else if (preamble.startsWith('markdown:')) {
		return {type: AnnotationType.markdown, content: sliced};
	} else if (preamble.startsWith('text:')) {
		return {type: AnnotationType.text, content: sliced};
	} else {
		return {type: AnnotationType.markdown, content: text};
	}
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
