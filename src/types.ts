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
