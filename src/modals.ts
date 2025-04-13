import { App, Modal } from 'obsidian';
import { ConceptMapCreator } from './concept-maps';
import { ConceptMapperSettings } from './settings'; 

class ConceptMapperModal extends Modal {
    protected readonly getSettings: () => ConceptMapperSettings;

    constructor(app: App, getSettings: () => ConceptMapperSettings) {
        super(app);
        this.getSettings = getSettings;
    }

    onOpen() {
        // If animation of modals is enabled, add the class to the modal container element
        if (this.getSettings().animateModals) { 
            this.containerEl.addClass('concept-mapper-modal-animated');
        }
    }
}

export class StartConceptMapCreationModal extends ConceptMapperModal {
    private readonly conceptMapCreator: ConceptMapCreator;
    private topicInput: HTMLInputElement;
    private textInput: HTMLTextAreaElement;

	constructor(app: App, conceptMapCreator: ConceptMapCreator, getSettings: () => ConceptMapperSettings) {
		super(app, getSettings);
        this.conceptMapCreator = conceptMapCreator;
	}

	onOpen() {
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
        this.close();
        
        const topic = this.topicInput.value.trim();
        const text = this.textInput.value.trim();
        this.conceptMapCreator.createConceptMap(topic, text);
    }

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}