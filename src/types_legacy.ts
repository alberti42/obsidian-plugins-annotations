// types_legacy.ts

import { DEFAULT_SETTINGS_1_3_0, DEFAULT_SETTINGS_1_4_0, DEFAULT_SETTINGS_1_5_0, DEFAULT_SETTINGS_1_6_0 } from "defaults_legacy";
import { PluginAnnotation, PluginAnnotationDict, PluginBackup } from "types";

/* VERSION 1.6 */

export interface PluginsAnnotationsSettings_1_6_0 {
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
    compatibility: "1.6.0";
    backups: PluginBackup[];
}

export function isPluginsAnnotationsSettings_1_6_0(s:unknown): s is PluginsAnnotationsSettings_1_6_0 {
    if (typeof s !== 'object' || s === null) {
        return false;
    }
    return 'annotations' in s
        && 'compatibility' in s && (s as PluginsAnnotationsSettings_1_6_0).compatibility === '1.6.0'
        && 'plugins_annotations_uuid' in s
        && (s as PluginsAnnotationsSettings_1_6_0).plugins_annotations_uuid === DEFAULT_SETTINGS_1_6_0.plugins_annotations_uuid;
}

/* VERSION 1.5 */

export interface PluginAnnotation_1_5_0 extends PluginAnnotation {
    type: AnnotationType_1_5_0;  // annotation type
}

export interface PluginAnnotationDict_1_5_0 {
    [pluginId: string]: PluginAnnotation_1_5_0;
}

export interface PluginsAnnotationsSettings_1_5_0 extends Omit<PluginsAnnotationsSettings_1_6_0, 'annotations' | 'compatibility' >{
    annotations: PluginAnnotationDict_1_5_0;
    compatibility: "1.5.0";
}

export function isPluginsAnnotationsSettings_1_5_0(s:unknown): s is PluginsAnnotationsSettings_1_5_0 {
    if (typeof s !== 'object' || s === null) {
        return false;
    }
    return 'annotations' in s
        && 'compatibility' in s && (s as PluginsAnnotationsSettings_1_5_0).compatibility === '1.5.0'
        && 'plugins_annotations_uuid' in s
        && (s as PluginsAnnotationsSettings_1_5_0).plugins_annotations_uuid === DEFAULT_SETTINGS_1_5_0.plugins_annotations_uuid;
}

export function isPluginAnnotation_1_5_0(anno:unknown): anno is PluginAnnotation_1_5_0 {
    if (typeof anno !== 'object' || anno === null) {
        return false;
    }
    const obj = anno as Record<string, unknown>;

    const hasName = typeof obj.name === 'string';
    const hasDesc = typeof obj.desc === 'string';
    const hasType = typeof obj.type === 'string' && Object.values(AnnotationType_1_5_0).includes(obj.type as AnnotationType_1_5_0);

    return hasName && hasDesc && hasType;
}


// Function to render the annotation based on preamble
export function parseAnnotation_1_5_0(text: string): {annoType: AnnotationType_1_5_0, annoDesc: string} {
    const preambleRegex = /^(html|markdown|text):\s*/i;
    const match = text.match(preambleRegex);

    if (match) {
        const annoTypeString = match[1].toLowerCase();
        const sliced = text.slice(match[0].length).trim(); // Remove preamble and any leading/trailing whitespace
        
        switch (annoTypeString) {
            case 'html':
                return {annoType: AnnotationType_1_5_0.html, annoDesc: sliced};
            case 'markdown':
                return {annoType: AnnotationType_1_5_0.markdown, annoDesc: sliced};
            case 'text':
                return {annoType: AnnotationType_1_5_0.text, annoDesc: sliced};
        }
    }

    // Default case: treat as markdown
    return {annoType: AnnotationType_1_5_0.markdown, annoDesc: text.trim()};
}

export enum AnnotationType_1_5_0 {
    text = 'text',
    html = 'html',
    markdown = 'markdown',
}

/* VERSION 1.4 */

export interface PluginAnnotation_1_4_0 extends Omit<PluginAnnotation_1_5_0, 'type' | 'desc'> {
    anno: string;  // personal annontation
}

export type PluginAnnotationDict_1_4_0 = {
    [pluginId: string]: PluginAnnotation_1_4_0;
}

// Extend the original interface and override the annotations property
export interface PluginsAnnotationsSettings_1_4_0 extends Omit<PluginsAnnotationsSettings_1_5_0, 'annotations' | 'markdown_file_path' | 'compatibility' | 'backups' > {
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
export function parseAnnotation_1_4_0(text: string): {type:AnnotationType_1_5_0,content:string} {
    const lines = text.split('\n');
    const preamble = lines[0].toLowerCase();
    const sliced = lines.slice(1).join('\n');
    
    // annotation_div.innerHTML = '';
    if (preamble.startsWith('html:')) {
        return {type: AnnotationType_1_5_0.html, content: sliced};
    } else if (preamble.startsWith('markdown:')) {
        return {type: AnnotationType_1_5_0.markdown, content: sliced.replace(/\$\{label\}/g, '')};
    } else if (preamble.startsWith('text:')) {
        return {type: AnnotationType_1_5_0.text, content: sliced};
    } else {
        return {type: AnnotationType_1_5_0.text, content: text};
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
