// defaults.ts

import { PluginsAnnotationsSettings } from './types';

export const DEFAULT_SETTINGS: PluginsAnnotationsSettings = {
	annotations: {},
	plugins_annotations_uuid: 'BC56AB7B-A46F-4ACF-9BA1-3A4461F74C79',
	hide_placeholders: false,
	delete_placeholder_string_on_insertion: false,
	label_mobile: '<b>Annotation:&nbsp;</b>',
	label_desktop: '<b>Personal annotation:&nbsp;</b>',
	label_placeholder : "<em>Add your personal comment about <strong>${plugin_name}</strong> here...</em>",
	editable: true,
	automatic_remove: false,
	markdown_file_path: '',
	compatibility: '1.5.0',
}
