// annotationControl.ts

import PluginsAnnotations from "main";
import { MarkdownRenderer, Platform } from "obsidian";
import { AnnotationType, isPluginAnnotation, parseAnnotation } from "types";

export class annotationControl {
    private clickedLink: boolean;

    constructor(private plugin: PluginsAnnotations, private annotation_container:HTMLDivElement, private annotation_div:HTMLDivElement,pluginId:string,pluginName:string) {

        this.clickedLink = false;
        
        if(this.plugin.settings.editable) {
            annotation_div.contentEditable = 'true';
            annotation_div.classList.add('plugin-comment-annotation-editable');
        } else {
            annotation_div.contentEditable = 'false';
            annotation_div.classList.remove('plugin-comment-annotation-editable');
        }

        const placeholder = (this.plugin.settings.label_placeholder).replace(/\$\{plugin_name\}/g, pluginName);

        let isPlaceholder = this.plugin.settings.annotations[pluginId] ? false : true;
        let annotationDesc:string;
        let annoType:AnnotationType;
        
        if(!isPlaceholder && isPluginAnnotation(this.plugin.settings.annotations[pluginId])) {
            const annotation = this.plugin.settings.annotations[pluginId];
            annotationDesc = annotation.desc;
            annoType = annotation.type;
        } else {
            annotationDesc = placeholder.trim();
            annoType = AnnotationType.html;
        
            annotation_div.classList.add('plugin-comment-placeholder');
            if (this.plugin.settings.hide_placeholders) { // if it is a placeholder
                if(this.plugin.settings.editable) { // if fields can be edited, set the placeholder tag
                    annotation_container.classList.add('plugin-comment-placeholder');
                } else { // if fields cannot be edited, just simply hide placeholders
                    annotation_container.classList.add('plugin-comment-hidden');
                }
            }
        }

        // let clickedLinkObj = { status: false };

        // Initial render
        this.renderAnnotation(annotation_div,annoType,annotationDesc);

        // Handle mousedown event to check if a link was clicked
        let clickedLinkk = false;
        annotation_div.addEventListener('mousedown', (event:MouseEvent) => {
            console.log("MOUSE DOWN");
            if(!this.plugin.settings.editable) { return; }
            if (event.target && (event.target as HTMLElement).tagName === 'A') {
                clickedLinkk = true;
            } else {
                clickedLinkk = false;
            }
            console.log("CLICKED LINK:",clickedLinkk);
        });

        // Prevent click event propagation to parent
        annotation_div.addEventListener('click', (event:MouseEvent) => {
            console.log("CLICK EVENT");
            console.log(this.plugin.settings);
            if(this.plugin.settings.editable) {
                event.stopPropagation();
                console.log("EDITABLE");
                // the focus event will handle the rest
            } else {
                 return;
            }
        });

        // Remove placeholder class when user starts typing
        annotation_div.addEventListener('focus', (event:FocusEvent) => {
            console.log("FOCUS");
            if(!this.plugin.settings.editable) { return; }
            if (isPlaceholder) {
                if (this.plugin.settings.delete_placeholder_string_on_insertion) {
                    annotation_div.innerText = '';
                }
                annotation_div.classList.remove('plugin-comment-placeholder');
                if (this.plugin.settings.hide_placeholders) {
                    // we remove 'plugin-comment-placeholder' only when 'this.plugin.settings.hide_placeholders' is true
                    // when 'this.plugin.settings.hide_placeholders' is false, the class is not set and does not need to be removed.
                    annotation_container.classList.remove('plugin-comment-placeholder');
                }
                
                const text = annotation_div.innerText; // text without html markup
                annotation_div.innerText = text; // this removes all html markup for editing

                // Force a DOM reflow by reading the offsetHeight (or another property)
                annotation_div.offsetHeight;

                const range = document.createRange();
                range.selectNodeContents(annotation_div);
                const selection = window.getSelection();
                if (selection) {
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            } else {
                // Only update annotation_div.innerText if not clicking on a link
                if (!clickedLinkk) {
                    let preamble;
                    switch(annoType) {
                    case AnnotationType.html:
                        preamble = 'html:';
                        break;
                    case AnnotationType.markdown:
                        preamble = 'markdown:';
                        break;
                    case AnnotationType.text:
                        preamble = 'text:';
                        break;
                    default:
                        preamble = 'markdown:';
                    }

                    annotation_div.innerText = preamble + '\n' + annotationDesc;
                }
            }
        });

        // Save the comment on input change and update inputTriggered status
        annotation_div.addEventListener('input', (event: Event) => {
            if(!this.plugin.settings.editable) return;
            isPlaceholder = false;
        });

        // Add placeholder class back if no changes are made
        annotation_div.addEventListener('blur', (event:FocusEvent) => {
            if(!this.plugin.settings.editable) { return; }

            const {annoType: type, annoDesc: content} = parseAnnotation(annotation_div.innerText.trim());

            if (isPlaceholder || content === '') { // placeholder
                annotation_div.innerHTML = placeholder;
                delete this.plugin.settings.annotations[pluginId];
                annotation_div.classList.add('plugin-comment-placeholder');
                if (this.plugin.settings.hide_placeholders) {
                    annotation_container.classList.add('plugin-comment-placeholder');
                }
                isPlaceholder = true;
                annotationDesc = '';
                annoType = AnnotationType.html;
            } else {
                isPlaceholder = false;

                annotationDesc = content.trim();
                annoType = type;
                
                this.plugin.settings.annotations[pluginId] = {
                    desc: annotationDesc,
                    name: pluginName,
                    type: type,
                };
                annotation_div.classList.remove('plugin-comment-placeholder');

                this.renderAnnotation(annotation_div,type,content);
            }
            this.plugin.debouncedSaveAnnotations();
        });
    }

    async renderAnnotation(annotation_div: HTMLElement, annoType:AnnotationType, desc:string) {
        annotation_div.innerText = '';
        switch(annoType) {
            case AnnotationType.text: {
                const p = document.createElement('p');
                p.dir = 'auto';
                const label = this.create_label();
                if(label) {
                    p.appendChild(label);
                    p.appendText(desc);
                }
                else {
                    p.innerText = desc;
                }                   
                annotation_div.appendChild(p);
                break;
            }
            case AnnotationType.html: {
                const label = Platform.isMobile ? this.plugin.settings.label_mobile : this.plugin.settings.label_desktop;
                const desc_with_label = desc.replace(/\$\{label\}/g, label);
                annotation_div.innerHTML = desc_with_label;
                this.handleAnnotationLinks(annotation_div);
                break;
            }
            case AnnotationType.markdown: {
                const label = Platform.isMobile ? this.plugin.settings.label_mobile : this.plugin.settings.label_desktop;
                const desc_with_label = label + desc;
                await MarkdownRenderer.renderMarkdown(desc_with_label, annotation_div, '', this.plugin);
                this.handleAnnotationLinks(annotation_div);
                break;
            }
        }
    }
    
    create_label(): HTMLSpanElement | null {
        const label = Platform.isMobile ? this.plugin.settings.label_mobile : this.plugin.settings.label_desktop;
        if(label.trim() === "") {
            return null;
        } else {
            const span = document.createElement('span');
            span.innerHTML = label;
            span.classList.add('plugin-comment-label');
            return span;
        }
    }

    // Helper function to parse links and add click listeners
    handleAnnotationLinks(element: HTMLElement) {
        const links = element.querySelectorAll('a');
        links.forEach(link => {
            console.log(element);
            link.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const href = link.getAttribute('href');
                if (href) {
                    this.plugin.app.workspace.openLinkText(href, '', false);
                    this.plugin.app.setting.close(); // Close the settings pane when a link is clicked
                }
            });
        });
    }
}
