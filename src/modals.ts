import { App, Modal } from 'obsidian';
import { ConceptMapCreator } from './concept-maps';

export class StartConceptMapCreationModal extends Modal {
    private readonly conceptMapCreator: ConceptMapCreator;
    private topicInput: HTMLInputElement;
    private textInput: HTMLTextAreaElement;

	constructor(app: App, conceptMapCreator: ConceptMapCreator) {
		super(app);
        this.conceptMapCreator = conceptMapCreator;
	}

	onOpen() {
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