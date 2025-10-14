// annotationControl.ts

import PluginsAnnotations from "main";
import { MarkdownRenderer, Platform } from "obsidian";
import { isPluginAnnotation } from "types";

const github_prefix = "https://github.com/";

import { svg_github_dark, svg_github_light } from "graphics";
        
export class AnnotationControl {
    // static addGitHubIcon(controlDiv: Element) {
    //     throw new Error('Method not implemented.');
    // }
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
        const linkInteractionHandler = (event: MouseEvent | TouchEvent) => {
            if (event.target && (event.target as HTMLElement).tagName === 'A') {
                this.clickedLink = true;
            } else {
                this.clickedLink = false;
            }
        };

        this.annotation_div.addEventListener('mousedown', linkInteractionHandler);
        this.annotation_div.addEventListener('touchstart', linkInteractionHandler, { passive: true });


        // Prevent click event propagation to parent
        this.annotation_div.addEventListener('click', (event:MouseEvent) => {
            if(!this.plugin.settings.editable) { 
                return; 
            } else {
                event.stopPropagation();
                // Explicitly focus to help mobile keyboards appear, especially on Android.
                this.annotation_div.focus();
            }
        });

        this.annotation_div.addEventListener('focus', async (event:FocusEvent) => {
            if(this.clickedLink) return;

            this.plugin.annotationBeingEdited=true;

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

                // Select existing text
                this.selectExistingText();
            }
        });

        this.annotation_div.addEventListener('input', (event: Event) => {
            const content = this.annotation_div.innerText.trim();

            if (content === '') { // placeholder
                this.isPlaceholder = true;
                this.annotationDesc = '';
                this.plugin.removeAnnotation(this.pluginId);
            } else {
                this.isPlaceholder = false;
                this.annotationDesc = content.trim();
                this.plugin.modifyAnnotation(this.pluginId, {
                    desc: this.annotationDesc,
                    name: this.pluginName,
                });
            }
            this.plugin.debouncedSaveAnnotations();
        });

        // Add placeholder class back if no changes are made
        this.annotation_div.addEventListener('blur', (event:FocusEvent) => {
            this.plugin.annotationBeingEdited=false;
            
            if(!this.plugin.settings.editable) { return; }
            if(this.clickedLink) return;

            if (this.isPlaceholder) { // placeholder
                this.setPlaceholderClasses();
            } else {
                this.removePlaceholderClasses();   
            }
            this.renderAnnotation();
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
        // Ensure the DOM is updated before selecting the text
        // requestAnimationFrame ensures that the browser has completed the 
        // DOM updates and layout recalculations before running your selection code.
        // It ensures that all DOM manipulations are fully processed before the next paint,
        // even though the callback is executed before that repaint occurs. 
        requestAnimationFrame(() => {
            const range = document.createRange();
            range.selectNodeContents(this.annotation_div);
            const selection = getSelection();
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(range);
            }
        });
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

    addGitHubIcon(controlDiv:Element, repo:string, isDarkMode:boolean):HTMLDivElement | null {
        if (controlDiv) {
            const GitHubDiv = document.createElement('div');
            GitHubDiv.classList.add('clickable-icon', 'extra-setting-button', 'github-icon');
            GitHubDiv.setAttribute('aria-label', 'Open plugin\'s GitHub page');
            GitHubDiv.innerHTML = isDarkMode ? svg_github_dark : svg_github_light;

            // Add click listener to open the repo URL
            GitHubDiv.addEventListener('click', () => {
                // Use Obsidian's native method to open external links
                window.open(github_prefix + repo, '_blank');
            });

            // Get all elements with the class .clickable-icon inside controlDiv
            const clickableIcons = controlDiv.querySelectorAll('.clickable-icon');

            // Insert the new icon as the second last of all clickable icons
            if (clickableIcons.length > 0) {
                const lastIcon = clickableIcons[clickableIcons.length - 1];
                controlDiv.insertBefore(GitHubDiv, lastIcon);
            } else {
                // If no clickable icons are found, append it as the first child
                controlDiv.insertBefore(GitHubDiv, controlDiv.firstChild);
            }
            return GitHubDiv;
        }
        return null;
    }
}
