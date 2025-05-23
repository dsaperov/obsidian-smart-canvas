import { App, Notice, Plugin, PluginManifest } from 'obsidian';
import { CENTRAL_NODE_COLOR, OPTIMIZATION_MODE } from './config';
import { CanvasHelper } from './canvas';
import { ConceptMapCreator } from './concept-maps';
import { StartConceptMapCreationModal } from './modals';
import { DEFAULT_SETTINGS, SmartCanvasSettings } from './settings';
import { SmartCanvasSettingTab } from './settings-tab';
import { hexToRgb } from './utils';

export default class SmartCanvas extends Plugin {
	settings: SmartCanvasSettings;
    private readonly canvasHelper: CanvasHelper;
    private readonly conceptMapCreator: ConceptMapCreator;

    constructor(app: App, manifest: PluginManifest) {
        super(app, manifest);
        this.canvasHelper = new CanvasHelper(app);
        this.conceptMapCreator = new ConceptMapCreator(this.canvasHelper, () => this.settings);
    }

    updateFixedPathLabelsClass(): void {
        if (this.settings.fixedPathLabels) {
            document.body.classList.add('smart-canvas-fixed-path-labels');
        } else {
            document.body.classList.remove('smart-canvas-fixed-path-labels');
        }
    }

	async onload() {
		await this.loadSettings();
        this.setCssVariables();
        this.updateFixedPathLabelsClass();
        this.registerFileOpenEventListener();
        this.addStartConceptMapCreationRibbonIcon();
		this.addSettingTab(new SmartCanvasSettingTab(this.app, this));

        // Add commands
        this.addStartConceptMapCreationCommand();
        this.addSwitchLayoutCommand();
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

    private setCssVariables(): void {
        document.documentElement.style.setProperty('--central-node-color-rgb', hexToRgb(CENTRAL_NODE_COLOR));
    }

    // Method to register event listener for canvas note open to add classes to elements and attach tooltips with explanations
    private registerFileOpenEventListener(): void {
        this.registerEvent(
            this.app.workspace.on('file-open', (file) => {
                if (file && file.extension === 'canvas') {
                    setTimeout(() => {
                        this.canvasHelper.applyClasses();
                        this.canvasHelper.attachExplanationsWhenReady();
                    }, 100);
                }
            })
        );
    }

    private addStartConceptMapCreationRibbonIcon(): void {
        this.addRibbonIcon('network', 'Smart Canvas', async (evt: MouseEvent) => {
            this.openStartConceptMapCreationModal();
        });
    }

    private addStartConceptMapCreationCommand() {
        this.addCommand({
            id: 'start-concept-map-creation',
            name: 'Start concept map creation',
            checkCallback: (checking: boolean) => {
                // Command is available only for canvas files
                const activeFileIsCanvas = this.canvasHelper.activeFileIsCanvas();
                if (!activeFileIsCanvas) { return false; }
                
                if (!checking) { // If it is not just a check, execute the command
                    const isModalOpened = this.openStartConceptMapCreationModal(true);
                    if (!isModalOpened) { return false; }
                }
                return true;
            }
        });
    }

    private openStartConceptMapCreationModal(checkedForCanvas: boolean = false): boolean {
        // If not sure that canvas file is open, check the active file
        if (!checkedForCanvas) {
            // Modal requires canvas file to be opened
            if (!this.canvasHelper.activeFileIsCanvas()) {
                new Notice('Please open a canvas file first');
                return false;
            }
        }
 
        const canvas = this.canvasHelper.getCurrentCanvas();
        const nodes = canvas.nodes;

        // If canvas is not empty, show the notification
        if (nodes && nodes.size > 0) {
            new Notice('Canvas should be empty to start a concept map creation');
            return false;
        }

        // Open the modal
        new StartConceptMapCreationModal(this.app, this.conceptMapCreator, () => this.settings).open();
        return true;
    }

    private addSwitchLayoutCommand() {
        this.addCommand({
            id: 'switch-layout',
            name: 'Switch the concept map layout',
            checkCallback: (checking: boolean) => {
                // Command is available only for canvas files
                const activeFileIsCanvas = this.canvasHelper.activeFileIsCanvas();
                if (!activeFileIsCanvas) { return false; }

                // Multiple layouts should be available for current canvas
                const activeFile = this.app.workspace.getActiveFile();
                const hasMultipleLayouts = this.conceptMapCreator.multipleLayoutAreAvailable(activeFile!);
                if (!hasMultipleLayouts) { return false; }

                if (!checking) {
                    // Switch the layout
                    this.conceptMapCreator.switchLayout();
                }
                return true;

            }     
        });
    }
}