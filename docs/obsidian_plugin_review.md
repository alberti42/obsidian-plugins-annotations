Extracted from: https://community.obsidian.md/plugins/plugins-annotations
Extracted on: 06.09.2026

# Passed (4)

Build verified against source.

Vault Read: Reads individual vault files via the Obsidian API (vault.read, vault.cachedRead)

Vault Write: Creates or modifies vault files via the Obsidian API (vault.modify, vault.create, etc.)

No vulnerable dependencies found.

# Disclosures (6)

Plugin might make requests to external domains
External network calls should be disclosed in the plugin README and only made with user knowledge.

    raw.githubusercontent.com

Number of network request calls
All network requests should be necessary and disclosed to users.

    1 network call

Code uses runtime base64 encode or decode calls
Runtime base64 decoding is sometimes used to hide API keys, URLs, or code payloads from static analysis.

    atob/btoa

Malware scan not available.
Obfuscation scan not available.
Network requests scan not available.

# Risks (9)

Unsafe assignment to innerHTML8

    src/annotation_control.ts:224
    src/main.ts:502
    src/main.ts:534
    src/main.ts:537
    src/main.ts:546
    src/main.ts:549
    src/settings_tab.ts:116
    src/settings_tab.ts:122

Plugin name must not include the word "Plugin"
The word "Plugin" in the name is redundant in the Obsidian plugin directory.

    manifest.json:3


# Warnings (98)

Use 'activeDocument' instead of 'document' for popout window compatibility.20

    src/annotation_control.ts:29
    src/annotation_control.ts:178
    src/annotation_control.ts:221
    src/main.ts:496
    src/main.ts:507
    src/main.ts:527
    src/main.ts:566
    src/main.ts:681
    src/main.ts:697
    src/settings_tab.ts:52
    src/settings_tab.ts:55
    src/settings_tab.ts:61
    src/settings_tab.ts:66
    src/settings_tab.ts:70
    src/settings_tab.ts:114
    src/settings_tab.ts:120
    src/settings_tab.ts:545
    src/utils.ts:239
    src/utils.ts:244
    src/utils.ts:249

Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler or be explicitly marked as ignored with the void operator.14

    src/annotation_control.ts:49
    src/annotation_control.ts:147
    src/annotation_control.ts:212
    src/main.ts:84
    src/main.ts:98
    src/main.ts:101
    src/main.ts:132
    src/main.ts:290
    src/main.ts:332
    src/main.ts:342
    src/main.ts:346
    src/main.ts:432
    src/manageAnnotations.ts:73
    src/settings_tab.ts:228

Sets styles directly instead of using CSS classes, setCssProps, or setCssStyles10

    obsidianmd/no-static-styles-assignment

    src/settings_tab.ts:157
    src/settings_tab.ts:194
    src/settings_tab.ts:205
    src/settings_tab.ts:212
    src/settings_tab.ts:258
    src/settings_tab.ts:261
    src/settings_tab.ts:501
    src/settings_tab.ts:585
    src/settings_tab.ts:674
    src/settings_tab.ts:680

Do not write to DOM directly using innerHTML/outerHTML property7

    src/annotation_control.ts:224
    src/main.ts:534
    src/main.ts:537
    src/main.ts:546
    src/main.ts:549
    src/settings_tab.ts:116
    src/settings_tab.ts:122

Promise returned in function argument where a void return was expected.6

    src/annotation_control.ts:86-115
    src/settings_tab.ts:225-230
    src/settings_tab.ts:232
    src/settings_tab.ts:236
    src/settings_tab.ts:636-654
    src/settings_tab.ts:657-677

Unexpected undescribed directive comment. Include descriptions to explain why the comment is necessary.6

    src/main.ts:166
    src/main.ts:414
    src/main.ts:445
    src/settings_tab.ts:534
    src/utils.ts:194
    src/utils.ts:278

Do not access Object.prototype method 'hasOwnProperty' from target object.5

    src/annotation_control.ts:25
    src/main.ts:403
    src/main.ts:454
    src/main.ts:479
    src/utils.ts:277

Use 'window.setTimeout()' instead of 'setTimeout()' for popout window compatibility.4

    src/utils.ts:121
    src/utils.ts:157
    src/utils.ts:248
    src/utils.ts:300

"defaults" should be replaced with native functionality. You can instead use Object.assign, or if deep clones are needed, use structuredClone.3

    src/main.ts:20
    src/settings_tab.ts:8
    src/types.ts:3

A method that is not declared with this: void may cause unintentional scoping of this when separated from its object. Consider using an arrow function or explicitly .bind()ing the method to avoid calling the method with an unintended this value. If a function does not access this, it can be annotated with this: void.3

    src/main.ts:79
    src/main.ts:81
    src/main.ts:761

This assertion is unnecessary since it does not change the type of the expression.3

    src/main.ts:146
    src/main.ts:157
    src/manageAnnotations.ts:134

Do not import Node.js builtin module "path"2

    src/main.ts:22
    src/utils.ts:5

Use '.instanceOf(HTMLElement)' instead of 'instanceof HTMLElement' for cross-window safe type checking.2

    src/main.ts:429
    src/settings_tab.ts:765

Use 'window.clearTimeout()' instead of 'clearTimeout()' for popout window compatibility.2

    src/utils.ts:120
    src/utils.ts:142

Manifest URL field is not reachable

    authorUrl

    manifest.json:8

"builtin-modules" should be replaced with an alternative package.

    package.json:19

Use 'window.requestAnimationFrame()' instead of 'requestAnimationFrame()' for popout window compatibility.

    src/annotation_control.ts:177

Use '.instanceOf(HTMLDivElement)' instead of 'instanceof HTMLDivElement' for cross-window safe type checking.

    src/main.ts:554

Unexpected use of 'fetch'. Use the built-in requestUrl function instead of fetch for network requests in Obsidian.

    src/main.ts:619

Avoid casting to 'TFile'. Use an 'instanceof TFile' check to safely narrow the type.

    src/manageAnnotations.ts:134

Promise-returning method provided where a void return was expected by extended/implemented type 'PluginSettingTab'.

    src/settings_tab.ts:26-483

Unexpected alert.

    src/settings_tab.ts:566

Expected the Promise rejection reason to be an Error.

    src/utils.ts:166

Avoid !important — override styles by increasing selector specificity or using CSS variables instead.

    styles/styles.css:33

README links to another repository with the same name
This usually means the README was not updated after forking or renaming the repository. All links should point to the correct repository.

    your-username/obsidian-plugins-annotations

# Other (5)

Missing GitHub artifact attestations for release assets2
Artifact attestations let users cryptographically verify the provenance of the release assets, proving they were built from the source repository.

    main.js
    styles.css

Vault Enumeration: Enumerates all files in the vault (vault.getFiles, getMarkdownFiles, etc.). Gives the plugin access to every file path in the vault.
renderMarkdown is deprecated. - use {@link MarkdownRenderer.render}

    src/annotation_control.ts:196

display is deprecated. Since 1.13.0. Use {@link getSettingDefinitions} instead.

    src/main.ts:346
