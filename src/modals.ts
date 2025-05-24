import { App, Modal, Notice } from 'obsidian';
import { ConceptMapCreator } from './concept-maps';
import { SmartCanvasSettings } from './settings'; 

class SmartCanvasModal extends Modal {
    protected readonly getSettings: () => SmartCanvasSettings;

    constructor(app: App, getSettings: () => SmartCanvasSettings) {
        super(app);
        this.getSettings = getSettings;
    }

    onOpen() {
        // If animation of modals is enabled, add the class to the modal container element
        if (this.getSettings().animateModals) { 
            this.containerEl.addClass('smart-canvas-modal-animated');
        }
    }
}

export class StartConceptMapCreationModal extends SmartCanvasModal {
    private readonly conceptMapCreator: ConceptMapCreator;
    private topicInput: HTMLInputElement;
    private textInput: HTMLTextAreaElement;

	constructor(app: App, conceptMapCreator: ConceptMapCreator, getSettings: () => SmartCanvasSettings) {
		super(app, getSettings);
        this.conceptMapCreator = conceptMapCreator;
	}

	async onOpen() {
        super.onOpen(); 

        const {contentEl} = this;
        const StartCreationContainer = contentEl.createDiv({ cls: 'start-concept-map-creation-container' });

        // Topic input field
        const topicContainer = StartCreationContainer.createDiv({ cls: 'start-concept-map-creation-topic-container' });
        topicContainer.createEl('label', { text: 'Topic:' });
        this.topicInput = topicContainer.createEl('input', { 
            type: 'text',
            attr: { placeholder: 'Enter the topic' }
        });

        // Text input field
        const textContainer = StartCreationContainer.createDiv({ cls: 'start-concept-map-creation-text-container' });
        textContainer.createEl('label', { text: 'Text:' });
        this.textInput = textContainer.createEl('textarea', {
            attr: { 
                placeholder: 'Enter the text',
                rows: '5'
            }
        });

        const startCreationButton = StartCreationContainer.createEl('button', { text: 'Start creation' });
        startCreationButton.onclick = () => this.handleStartCreation();
    }

    private async handleStartCreation() {
        const topic = this.topicInput.value.trim();

        if (!topic) {
            new Notice('Topic cannot be empty.');
            this.topicInput.addClass('input-error'); 
            setTimeout(() => this.topicInput.removeClass('input-error'), 1000);
            return; 
        }

        this.close();
        
        const text = this.textInput.value.trim();

        // Create a container for the loading indicator
        const loadingContainer = document.createElement('div');
        loadingContainer.className = 'concept-map-loading-container';
        loadingContainer.innerHTML = `
            <div class="concept-map-loading-spinner"></div>
            <div class="concept-map-loading-text">Concept map is being generated. This may take a few minutes.</div>
        `;
        document.body.appendChild(loadingContainer);
        
        try {
            await this.conceptMapCreator.createConceptMap(topic, text);
            loadingContainer.remove();
            new Notice('Concept map has been successfully generated');
        } catch (error) {
            loadingContainer.remove();
            new Notice(`An error occurred while creating the concept map. Please try again.`);
        }
    }

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}