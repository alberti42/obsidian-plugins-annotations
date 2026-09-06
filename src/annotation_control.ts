// annotationControl.ts

import PluginsAnnotations from "main";
import { Component, MarkdownRenderer, Platform } from "obsidian";
import { isPluginAnnotation } from "types";
import { setSvgIcon } from "utils";

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

    // Owns the child components that MarkdownRenderer registers while rendering this
    // annotation. Passing the plugin instead would tie them to the plugin's lifetime,
    // so they would accumulate on every re-render — and renderAnnotation() runs on
    // every blur.
    private markdownComponent: Component | null = null;


    constructor(private plugin: PluginsAnnotations, private annotation_container:HTMLElement, private pluginId:string, private pluginName:string) {

        this.clickedLink = false;
        this.isPlaceholder = (Object.prototype.hasOwnProperty.call(this.plugin.settings.annotations, pluginId) && isPluginAnnotation(this.plugin.settings.annotations[pluginId])) ? false : true;
        this.label = Platform.isMobile ? this.plugin.settings.label_mobile : this.plugin.settings.label_desktop
        this.placeholder = (this.plugin.settings.label_placeholder).replace(/\$\{plugin_name\}/g, pluginName);

        // createDiv() appends to the container as it creates the element, so the
        // annotation no longer needs to be attached at the end of the constructor.
        this.annotation_div = annotation_container.createDiv({ cls: 'plugin-comment-annotation' });

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

        // Tracked by the plugin so it can release this control once its annotation
        // leaves the DOM, or when the plugin itself unloads.
        this.plugin.registerAnnotationControl(this);

        // Initial render
        void this.renderAnnotation();

        // Add listeners
        this.addEventListeners();
    }

    addEventListeners() {
        const linkInteractionHandler = (event: MouseEvent | TouchEvent) => {
            const target = event.target as HTMLElement | null;
            // Use closest('a') so clicks on nested elements (e.g., spans inside links) still register as link clicks.
            // This scenario is likely never occurring, but closest('a') keeps link detection reliable (just in case).
            if (target && target.closest('a')) {
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
                if (!this.clickedLink) {
                    // Explicitly focus to help mobile keyboards appear, especially on Android.
                    this.annotation_div.focus();
                }
            }
        });

        this.annotation_div.addEventListener('focus', (event:FocusEvent) => {
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
        this.annotation_div.addEventListener('blur', () => { void this.handleBlur(); });
    }

    // Handles the 'blur' event: re-applies the placeholder class if no changes were made,
    // then re-renders the annotation. Kept separate from the listener registration above
    // so the listener itself stays a plain, void-returning function.
    async handleBlur(): Promise<void> {
        this.plugin.annotationBeingEdited=false;

        if(!this.plugin.settings.editable) { return; }
        if(this.clickedLink) return;

        if (this.isPlaceholder) { // placeholder
            this.setPlaceholderClasses();
        } else {
            this.removePlaceholderClasses();
        }
        await this.renderAnnotation();
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
        window.requestAnimationFrame(() => {
            const range = activeDocument.createRange();
            range.selectNodeContents(this.annotation_div);
            const selection = getSelection();
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(range);
            }
        });
    }

    async renderAnnotation() {
        // Release whatever the previous render registered before starting a new one.
        this.unloadMarkdownComponent();
        const component = new Component();
        this.markdownComponent = component;
        component.load();

        this.annotation_div.innerText = '';
        let desc = '';
        if(this.isPlaceholder) {
            desc = this.placeholder;
        } else {
            desc = (this.label + this.annotationDesc).replace(/\$\{plugin_name\}/g, this.pluginName);
        }
        await MarkdownRenderer.render(this.plugin.app, desc, this.annotation_div, '', component);
        this.handleAnnotationLinks(this.annotation_div);
    }

    private unloadMarkdownComponent(): void {
        this.markdownComponent?.unload();
        this.markdownComponent = null;
    }

    // Set once the annotation has actually made it into the document.
    private wasAttached = false;

    // True once the annotation has been detached from the document — for instance
    // because the pane holding it was re-rendered — meaning this control is dead.
    // A control whose element has not been inserted yet is not "detached": the caller
    // appends it only after the constructor returns, so treating it as dead would
    // release a control that is about to become visible.
    get isDetached(): boolean {
        if (this.annotation_div.isConnected) {
            this.wasAttached = true;
            return false;
        }
        return this.wasAttached;
    }

    // Releases everything this control still holds. Safe to call more than once.
    unload(): void {
        this.unloadMarkdownComponent();
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
                    void this.plugin.app.workspace.openLinkText(href, '', false);
                    this.plugin.app.setting.close(); // Close the settings pane when a link is clicked
                }
            });
        });
    }

    addGitHubIcon(controlDiv:Element, repo:string, isDarkMode:boolean):HTMLDivElement | null {
        if (controlDiv) {
            // The global createDiv() builds a detached element, since this icon is
            // positioned with insertBefore() below rather than appended.
            const GitHubDiv = createDiv({ cls: ['clickable-icon', 'extra-setting-button', 'github-icon'] });
            GitHubDiv.setAttribute('aria-label', 'Open plugin\'s GitHub page');
            setSvgIcon(GitHubDiv, isDarkMode ? svg_github_dark : svg_github_light);

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
