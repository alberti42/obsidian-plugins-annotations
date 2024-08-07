// types.ts

import { DEFAULT_SETTINGS, DEFAULT_SETTINGS_WITHOUT_NAMES } from './defaults';

export interface PluginAnnotation {
	name: string;  // extended name of the plugin
	anno: string;  // personal annontation
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
}

export function isPluginsAnnotationsSettings(s:unknown): s is PluginsAnnotationsSettings {
	if (typeof s !== 'object' || s === null) {
		return false;
	}
	return 'annotations' in s
		&& 'plugins_annotations_uuid' in s
		&& (s as PluginsAnnotationsSettings).plugins_annotations_uuid === DEFAULT_SETTINGS.plugins_annotations_uuid;
}

export enum AnnotationType {
	text,
	html,
	markdown,
}

// For backward compatibility only with version 'FAA70013-38E9-4FDF-B06A-F899F6487C19'
export function isPluginAnnotationDictWithoutNames(d: unknown): d is PluginAnnotationDictWithoutNames {
	if (typeof d !== 'object' || d === null) {
		return false;
	}
	return Object.values(d).every(value => typeof value === 'string');
}

export interface PluginAnnotationDictWithoutNames {
	[pluginId: string]: string;
}
// Extend the original interface and override the annotations property
export interface PluginsAnnotationsSettingsWithoutNames extends Omit<PluginsAnnotationsSettings, 'annotations'> {
  annotations: PluginAnnotationDictWithoutNames;
}

export function isPluginsAnnotationsSettingsWithoutNames(s:unknown): s is PluginsAnnotationsSettingsWithoutNames {
	if (typeof s !== 'object' || s === null) {
		return false;
	}

	return 'annotations' in s
		&& 'plugins_annotations_uuid' in s
		&& (s as PluginsAnnotationsSettingsWithoutNames).plugins_annotations_uuid === DEFAULT_SETTINGS_WITHOUT_NAMES.plugins_annotations_uuid;
}

export interface ParsedPath {
	dir: string,
	base: string,
	filename: string,
	ext: string,
	path: string
}

// For backward compatibility only with very first version (no UUID assigned)
export type PluginsAnnotationsSettingsWithoutOptions = string[];
