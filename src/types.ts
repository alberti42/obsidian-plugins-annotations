// types.ts

export interface PluginAnnotationDict {
	[pluginId: string]: string;
}

export interface HTMLDivElementWithInput extends HTMLDivElement {
	inputTriggered: boolean;
}