// annotationControl.ts

import PluginsAnnotations from "main";
import { MarkdownRenderer, Platform } from "obsidian";
import { isPluginAnnotation } from "types";

export class annotationControl {
    private clickedLink: boolean;
    private isPlaceholder: boolean;
    private annotationDesc:string;
    private placeholder:string;
    private label:string;

    constructor(private plugin: PluginsAnnotations, annotation_container:HTMLDivElement, pluginId:string,private pluginName:string) {

        this.clickedLink = false;
        this.isPlaceholder = this.plugin.settings.annotations[pluginId] ? false : true;
        this.label = Platform.isMobile ? this.plugin.settings.label_mobile : this.plugin.settings.label_desktop

        /*const label_div = document.createElement('div');
        label_div.addEventListener('click', (event:MouseEvent) => {
            event.stopPropagation();
        });
        label_div.classList.add('plugin-comment-label')
        const label = Platform.isMobile ? this.plugin.settings.label_mobile : this.plugin.settings.label_desktop
        const tmp_div = document.createElement('div');
        this.renderAnnotation(tmp_div,label);

        // Get the first child of tmp_div (assumed to be a <p> element)
        const firstChild = tmp_div.firstElementChild;

        if (firstChild && firstChild.tagName === 'P') {
            // Move the content of the <p> element to label_div
            label_div.innerHTML = firstChild.innerHTML;

            // Optionally, you can remove the <p> from tmp_div if needed
            tmp_div.removeChild(firstChild);
        }*/

        const annotation_div = document.createElement('div');
        annotation_div.className = 'plugin-comment-annotation';
                
        if(this.plugin.settings.editable) {
            annotation_div.contentEditable = 'true';
            annotation_div.classList.add('plugin-comment-annotation-editable');
        } else {
            annotation_div.contentEditable = 'false';
            annotation_div.classList.remove('plugin-comment-annotation-editable');
        }

        this.placeholder = (this.plugin.settings.label_placeholder).replace(/\$\{plugin_name\}/g, pluginName);

        if(!this.isPlaceholder && isPluginAnnotation(this.plugin.settings.annotations[pluginId])) {
            const annotation = this.plugin.settings.annotations[pluginId];
            this.annotationDesc = annotation.desc;
        } else {
            this.annotationDesc = this.placeholder.trim();
                    
            annotation_div.classList.add('plugin-comment-placeholder');
            if (this.plugin.settings.hide_placeholders) { // if it is a placeholder
                if(this.plugin.settings.editable) { // if fields can be edited, set the placeholder tag
                    annotation_container.classList.add('plugin-comment-placeholder');
                } else { // if fields cannot be edited, just simply hide placeholders
                    annotation_container.classList.add('plugin-comment-hidden');
                }
            }
        }

        // Initial render
        this.renderAnnotation(annotation_div);

        annotation_div.addEventListener('mousedown', (event:MouseEvent) => {
            if (event.target && (event.target as HTMLElement).tagName === 'A') {
                this.clickedLink = true;
            } else {
                this.clickedLink = false;
            }
        });

        // Prevent click event propagation to parent
        annotation_div.addEventListener('click', (event:MouseEvent) => {
            if(!this.plugin.settings.editable) { 
                return; 
            } else {
                event.stopPropagation();
            }
        });

        annotation_div.addEventListener('focus', (event:FocusEvent) => {
            if(this.clickedLink) return;

            if (this.isPlaceholder) {
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
                annotation_div.innerText = this.annotationDesc; // this removes all html markup for editing
            }
        });

        // Save the comment on input change and update inputTriggered status
        annotation_div.addEventListener('input', (event: Event) => {
            if(!this.plugin.settings.editable) return;
            this.isPlaceholder = false;
        });

        // Add placeholder class back if no changes are made
        annotation_div.addEventListener('blur', (event:FocusEvent) => {
            if(!this.plugin.settings.editable) { return; }
            if(this.clickedLink) return;

            const content = annotation_div.innerText.trim();

            if (this.isPlaceholder || content === '') { // placeholder
                annotation_div.innerHTML = this.placeholder;
                delete this.plugin.settings.annotations[pluginId];
                annotation_div.classList.add('plugin-comment-placeholder');
                if (this.plugin.settings.hide_placeholders) {
                    annotation_container.classList.add('plugin-comment-placeholder');
                }
                this.isPlaceholder = true;
                this.annotationDesc = '';
            } else {
                this.isPlaceholder = false;

                this.annotationDesc = content.trim();
                
                this.plugin.settings.annotations[pluginId] = {
                    desc: this.annotationDesc,
                    name: pluginName,
                };
                annotation_div.classList.remove('plugin-comment-placeholder');

                this.renderAnnotation(annotation_div);
            }
            this.plugin.debouncedSaveAnnotations();
        });

        // annotation_container.appendChild(label_div);
        annotation_container.appendChild(annotation_div);
    }

    async renderAnnotation(div: HTMLElement) {
        div.innerText = '';
        const text = (this.label + this.annotationDesc).replace(/\$\{plugin_name\}/g, this.pluginName);
        await MarkdownRenderer.renderMarkdown(text, div, '', this.plugin);
        this.handleAnnotationLinks(div);
    }

    // Helper function to parse links and add click listeners
    handleAnnotationLinks(element: HTMLElement) {
        const links = element.querySelectorAll('a');
        links.forEach(link => {
            link.addEventListener('click', (event) => {
                this.clickedLink = true;

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
