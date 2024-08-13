// types_legacy.ts

import { DEFAULT_SETTINGS_1_3_0, DEFAULT_SETTINGS_1_4_0 } from "defaults_legacy";
import { AnnotationType, PluginAnnotation, PluginsAnnotationsSettings } from "types";

/* VERSION 1.4 */

export interface PluginAnnotation_1_4_0 extends Omit<PluginAnnotation, 'type' | 'desc'> {
	anno: string;  // personal annontation
}

export type PluginAnnotationDict_1_4_0 = {
	[pluginId: string]: PluginAnnotation_1_4_0;
}

// Extend the original interface and override the annotations property
export interface PluginsAnnotationsSettings_1_4_0 extends Omit<PluginsAnnotationsSettings, 'annotations' | 'markdown_file_path' | 'compatibility'> {
	annotations: PluginAnnotationDict_1_4_0;
}

export function isSettingsFormat_1_4_0(s:unknown): s is PluginsAnnotationsSettings_1_4_0 {
	if (typeof s !== 'object' || s === null) {
		return false;
	}
	return 'annotations' in s
		&& 'plugins_annotations_uuid' in s
		&& (s as PluginsAnnotationsSettings_1_4_0).plugins_annotations_uuid === DEFAULT_SETTINGS_1_4_0.plugins_annotations_uuid;
}

// Function to render the annotation based on preamble
export function parse_annotation_1_4_0(text: string): {type:AnnotationType,content:string} {
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
		return {type: AnnotationType.text, content: text};
	}
}

/* VERSION 1.3 */

// For backward compatibility only with version 1.3.0 'FAA70013-38E9-4FDF-B06A-F899F6487C19'
export function isPluginAnnotationDictFormat_1_3_0(d: unknown): d is PluginAnnotationDict_1_3_0 {
	if (typeof d !== 'object' || d === null) {
		return false;
	}
	return Object.values(d).every(value => typeof value === 'string');
}

export interface PluginAnnotationDict_1_3_0 {
	[pluginId: string]: string;
}

// Extend the original interface and override the annotations property
export interface PluginsAnnotationsSettings_1_3_0 extends Omit<PluginsAnnotationsSettings_1_4_0, 'annotations'> {
  annotations: PluginAnnotationDict_1_3_0;
}

export function isSettingsFormat_1_3_0(s:unknown): s is PluginsAnnotationsSettings_1_3_0 {
	if (typeof s !== 'object' || s === null) {
		return false;
	}

	return 'annotations' in s
		&& 'plugins_annotations_uuid' in s
		&& (s as PluginsAnnotationsSettings_1_3_0).plugins_annotations_uuid === DEFAULT_SETTINGS_1_3_0.plugins_annotations_uuid;
}

/* VERSION 1.0 */

// For backward compatibility only with very first version 1.0 (no UUID assigned)
// In this version, no options were provided, just the list of annotations.
export type PluginsAnnotationsSettings_1_0_0 = string[];
