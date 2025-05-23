import { App, PluginSettingTab, Setting } from 'obsidian';
import ConceptMapper from './main';

export class ConceptMapperSettingTab extends PluginSettingTab {
	plugin: ConceptMapper;

	constructor(app: App, plugin: ConceptMapper) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
        const {containerEl} = this;
        containerEl.empty();

        this.addAppearanceSettings(containerEl);
        this.addLayoutSettings(containerEl);
    }

    private addAppearanceSettings(containerEl: HTMLElement) {
		new Setting(containerEl).setName('Appearance').setHeading();

        new Setting(containerEl)
        .setName('Animate modals')
        .setDesc('Enable fade-in animation for plugin modals.')
        .addToggle(toggle => toggle
            .setValue(this.plugin.settings.animateModals)
            .onChange(async (value) => {
                this.plugin.settings.animateModals = value;
                await this.plugin.saveSettings();
            }));


        new Setting(containerEl)
            .setName('Fixed path labels size')
            .setDesc('When enabled, path labels will not scale when zooming the canvas, preventing text on them from being cut off (otherwise at certain zoom levels, edge length may become insufficient to fit the entire text')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.fixedPathLabels)
                .onChange(async (value) => {
                    this.plugin.settings.fixedPathLabels = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateFixedPathLabelsClass();
                })
            );

        new Setting(containerEl)
            .setName('Colored nodes')
            .setDesc('When enabled, nodes will be colored according to how many connections they are away from the central node.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.coloredNodes)
                .onChange(async (value) => {
                    this.plugin.settings.coloredNodes = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Colored edges')
            .setDesc('When enabled, edges will be colored blue.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.coloredEdges)
                .onChange(async (value) => {
                    this.plugin.settings.coloredEdges = value;
                    await this.plugin.saveSettings();
                })
            );
	}

    private addLayoutSettings(containerEl: HTMLElement) {
        new Setting(containerEl).setName('Layout').setHeading();

        new Setting(containerEl).setName('Best layout selection')
            .setDesc('When enabled, the best concept map layout will be selected from multiple generated ones. Turn it off for faster creation with one iteration.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.bestLayoutSelection)
                .onChange(async (value) => {
                    this.plugin.settings.bestLayoutSelection = value;
                    await this.plugin.saveSettings();
                })
            );
            
        new Setting(containerEl).setName('Multiple layout algorithms')
            .setDesc('When enabled, three different layout algorithms will be used. You can switch between them using the "Change Layout" command.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.multipleLayoutAlgorithms)
                .onChange(async (value) => {
                    this.plugin.settings.multipleLayoutAlgorithms = value;
                    await this.plugin.saveSettings();
                })
            );
    }
}