// types.ts

export interface PluginAnnotationDict {
	[pluginId: string]: string;
}

export interface PluginsAnnotationsSettings {
	annotations: PluginAnnotationDict;
	plugins_annotations_uuid: string;
	hide_placeholders: boolean;
	delete_placeholder_string_on_insertion: boolean;
	label_mobile: string;
	label_desktop: string;
	editable: boolean;
}

export enum AnnotationType {
	text,
	html,
	markdown,
}
