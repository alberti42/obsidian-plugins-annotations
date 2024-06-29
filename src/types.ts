// types.ts

export interface PluginAnnotationDict {
	[pluginId: string]: string;
}

export interface PluginsAnnotationsSettings {
	annotations: PluginAnnotationDict;
	plugins_annotations_uuid: string;
	hide_placeholders: boolean;
	delete_placeholder_string_on_insertion: boolean;
	markdown_notes: boolean;
}