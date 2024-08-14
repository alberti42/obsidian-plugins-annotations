// defaults.ts

import { DEFAULT_SETTINGS } from 'defaults';
import { PluginsAnnotationsSettings_1_3_0, PluginsAnnotationsSettings_1_4_0 } from './types_legacy';

/* ===== Version 1.4.0 ===== */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { annotations:_, markdown_file_path:__, compatibility:___, backups:____, ...theRestingSettings_1_4_0} = DEFAULT_SETTINGS;


export const DEFAULT_SETTINGS_1_4_0: PluginsAnnotationsSettings_1_4_0 = {
	...theRestingSettings_1_4_0,
	annotations: {},
	plugins_annotations_uuid: 'B265C5B2-A6AD-4194-9E4C-C1327DB1EA18',
}


/* ===== Version 1.3.0 ===== */

export const DEFAULT_SETTINGS_1_3_0: PluginsAnnotationsSettings_1_3_0 = {
  ...DEFAULT_SETTINGS_1_4_0,
  annotations: {}, // Override the annotations property with the appropriate type
  plugins_annotations_uuid: 'FAA70013-38E9-4FDF-B06A-F899F6487C19', 
};