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
    private annotation_div: HTMLDivElement;

    constructor(private plugin: PluginsAnnotations, private annotation_container:HTMLElement, private pluginId:string, private pluginName:string) {

        this.clickedLink = false;
        this.isPlaceholder = (this.plugin.settings.annotations.hasOwnProperty(pluginId) && isPluginAnnotation(this.plugin.settings.annotations[pluginId])) ? false : true;
        this.label = Platform.isMobile ? this.plugin.settings.label_mobile : this.plugin.settings.label_desktop
        this.placeholder = (this.plugin.settings.label_placeholder).replace(/\$\{plugin_name\}/g, pluginName);

        this.annotation_div = document.createElement('div');
        this.annotation_div.className = 'plugin-comment-annotation';
                
        // Configure editable state
        if(this.plugin.settings.editable) {
            this.annotation_div.contentEditable = 'true';
            this.annotation_div.classList.add('plugin-comment-annotation-editable');
        } else {
            this.annotation_div.contentEditable = 'false';
            this.annotation_div.classList.remove('plugin-comment-annotation-editable');
        }

        if(!this.isPlaceholder) {
            this.annotationDesc = this.plugin.settings.annotations[pluginId].desc;
        } else {
            this.annotationDesc = this.placeholder.trim();
            this.setPlaceholderClasses();
        }

        // Initial render
        this.renderAnnotation();

        // Add listeners
        this.addEventListeners();

        annotation_container.appendChild(this.annotation_div);
    }

    addEventListeners() {
        this.annotation_div.addEventListener('mousedown', (event:MouseEvent) => {
            if (event.target && (event.target as HTMLElement).tagName === 'A') {
                this.clickedLink = true;
            } else {
                this.clickedLink = false;
            }
        });

        // Prevent click event propagation to parent
        this.annotation_div.addEventListener('click', (event:MouseEvent) => {
            if(!this.plugin.settings.editable) { 
                return; 
            } else {
                event.stopPropagation();
            }
        });

        this.annotation_div.addEventListener('focus', (event:FocusEvent) => {
            if(this.clickedLink) return;

            if (this.isPlaceholder) {
                // If the user decided that the placeholder text needs to be cleared
                if (this.plugin.settings.delete_placeholder_string_on_insertion) {
                    this.annotation_div.innerText = '';
                } else {
                    // Remove HTML markups
                    const text = this.annotation_div.innerText; // text without html markup
                    this.annotation_div.innerText = text; // this removes all html markup for editing
                    // Force a DOM reflow by reading the offsetHeight (or another property)
                    // this.annotation_div.offsetHeight;
                }

                // Remove placeholder attributes when the div receives focus
                this.removePlaceholderClasses();

                // Select existing text
                this.selectExistingText();
            } else {
                // replaces the rendered content with the annotation containig template strings and Markdown links
                this.annotation_div.innerText = this.annotationDesc;
            }
        });

        this.annotation_div.addEventListener('input', (event: Event) => {
            // If the user starts typing, it removes the state of placeholder if this was set
            if(this.plugin.settings.editable) this.isPlaceholder = false;
        });

        // Add placeholder class back if no changes are made
        this.annotation_div.addEventListener('blur', (event:FocusEvent) => {
            if(!this.plugin.settings.editable) { return; }
            if(this.clickedLink) return;

            const content = this.annotation_div.innerText.trim();

            if (this.isPlaceholder || content === '') { // placeholder
                this.isPlaceholder = true;
                this.annotationDesc = '';
                this.plugin.removeAnnotation(this.pluginId);
                this.setPlaceholderClasses();
            } else {
                this.isPlaceholder = false;
                this.annotationDesc = content.trim();
                this.plugin.modifyAnnotation(this.pluginId, {
                    desc: this.annotationDesc,
                    name: this.pluginName,
                });
                this.removePlaceholderClasses();   
            }
            this.renderAnnotation();
            this.plugin.debouncedSaveAnnotations();
        });
    }

    setPlaceholderClasses() {
        this.annotation_div.classList.add('plugin-comment-placeholder');
        if (this.plugin.settings.hide_placeholders) { // if the user intends to hide placeholders
            if(this.plugin.settings.editable) { // if fields can be edited, set the placeholder tag to the container
                this.annotation_container.classList.add('plugin-comment-placeholder');
            } else { // if fields cannot be edited, just simply hide the container
                this.annotation_container.classList.add('plugin-comment-hidden');
            }
        }
    }

    removePlaceholderClasses() {
        this.annotation_div.classList.remove('plugin-comment-placeholder');
        if (this.plugin.settings.hide_placeholders) {
            // we remove 'plugin-comment-placeholder' only when 'this.plugin.settings.hide_placeholders' is true
            // when 'this.plugin.settings.hide_placeholders' is false, the class is not set and does not need to be removed.
            this.annotation_container.classList.remove('plugin-comment-placeholder');
        }
    }

    selectExistingText () {
        const range = document.createRange();
        range.selectNodeContents(this.annotation_div);
        const selection = window.getSelection();
        if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    async renderAnnotation() {
        this.annotation_div.innerText = '';
        let desc = '';
        if(this.isPlaceholder) {
            desc = this.placeholder;
        } else {
            desc = (this.label + this.annotationDesc).replace(/\$\{plugin_name\}/g, this.pluginName);
        }
        await MarkdownRenderer.renderMarkdown(desc, this.annotation_div, '', this.plugin);
        this.handleAnnotationLinks(this.annotation_div);
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
