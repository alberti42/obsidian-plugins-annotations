// defaults.ts

import { PluginsAnnotationsSettingsWithoutNames, PluginsAnnotationsSettings } from './types';

export const DEFAULT_SETTINGS: PluginsAnnotationsSettings = {
	annotations: {},
	plugins_annotations_uuid: 'B265C5B2-A6AD-4194-9E4C-C1327DB1EA18',
	hide_placeholders: false,
	delete_placeholder_string_on_insertion: false,
	label_mobile: '<b>Annotation:&nbsp;</b>',
	label_desktop: '<b>Personal annotation:&nbsp;</b>',
	label_placeholder : "<em>Add your personal comment about <strong>${plugin_name}</strong> here...</em>",
	editable: true,
	automatic_remove: false,
}

export const DEFAULT_SETTINGS_WITHOUT_NAMES: PluginsAnnotationsSettingsWithoutNames = {
  ...DEFAULT_SETTINGS,
  annotations: {}, // Override the annotations property with the appropriate type
  plugins_annotations_uuid: 'FAA70013-38E9-4FDF-B06A-F899F6487C19', 
};