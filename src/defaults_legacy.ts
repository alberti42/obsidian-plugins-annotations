// defaults.ts

import { AnnotationType_1_5_0, PluginsAnnotationsSettings_1_3_0, PluginsAnnotationsSettings_1_4_0, PluginsAnnotationsSettings_1_5_0, PluginsAnnotationsSettings_1_6_0 } from './types_legacy';

export const DEFAULT_SETTINGS_1_6_0: PluginsAnnotationsSettings_1_6_0 = {
    annotations: {
        "plugins-annotations": {
            "name": "Plugins Annotations",
            "desc": "Allows writing annotations (just like this one) about the community plugins installed in the vault.",
        }
    },
    plugins_annotations_uuid: 'BC56AB7B-A46F-4ACF-9BA1-3A4461F74C79',
    hide_placeholders: false,
    delete_placeholder_string_on_insertion: false,
    label_mobile: '<b>Annotation:&nbsp;</b>',
    label_desktop: '<b>Personal annotation:&nbsp;</b>',
    label_placeholder : "<em>Add your personal comment about <strong>${plugin_name}</strong> here...</em>",
    editable: true,
    automatic_remove: false,
    markdown_file_path: '',
    backups: [],
    compatibility: '1.6.0',
}

/* ===== Version 1.5.0 ===== */

export const DEFAULT_SETTINGS_1_5_0: PluginsAnnotationsSettings_1_5_0 = {
    "annotations": {
        "plugins-annotations": {
            "name": "Plugins Annotations",
            "desc": "Allows writing annotations (just like this one) about the community plugins installed in the vault.",
            "type": AnnotationType_1_5_0.markdown
        }
    },
    "plugins_annotations_uuid": "BC56AB7B-A46F-4ACF-9BA1-3A4461F74C79",
    "hide_placeholders": false,
    "delete_placeholder_string_on_insertion": false,
    "label_mobile": "<b>Annotation:&nbsp;</b>",
    "label_desktop": "<b>Personal annotation:&nbsp;</b>",
    "label_placeholder": "<em>Add your personal comment about <strong>${plugin_name}</strong> here...</em>",
    "editable": true,
    "automatic_remove": false,
    "markdown_file_path": "",
    "backups": [],
    "compatibility": "1.5.0"
}

/* ===== Version 1.4.0 ===== */

export const DEFAULT_SETTINGS_1_4_0: PluginsAnnotationsSettings_1_4_0 = {
    "plugins_annotations_uuid": "B265C5B2-A6AD-4194-9E4C-C1327DB1EA18",
    "hide_placeholders": false,
    "delete_placeholder_string_on_insertion": false,
    "label_mobile": "<b>Annotation:&nbsp;</b>",
    "label_desktop": "<b>Personal annotation:&nbsp;</b>",
    "label_placeholder": "<em>Add your personal comment about <strong>${plugin_name}</strong> here...</em>",
    "editable": true,
    "automatic_remove": false,
    "annotations": {}
}

/* ===== Version 1.3.0 ===== */

export const DEFAULT_SETTINGS_1_3_0: PluginsAnnotationsSettings_1_3_0 = {
    "plugins_annotations_uuid": "FAA70013-38E9-4FDF-B06A-F899F6487C19",
    "hide_placeholders": false,
    "delete_placeholder_string_on_insertion": false,
    "label_mobile": "<b>Annotation:&nbsp;</b>",
    "label_desktop": "<b>Personal annotation:&nbsp;</b>",
    "label_placeholder": "<em>Add your personal comment about <strong>${plugin_name}</strong> here...</em>",
    "editable": true,
    "automatic_remove": false,
    "annotations": {}
}