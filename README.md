# Obsidian Smart Canvas

This is a plugin for Obsidian that builds a concept map on a given topic using text provided by the user or Wikipedia article.


## Table of Contents

- [Features](#features)
- [How to Use](#how-to-use)
  - [Installation](#installation)
  - [Generating a Concept Map](#generating-a-concept-map)
- [Feedback and Suggestions](#feedback-and-suggestions)

---

## Features

*   **Automatic map generation**. Create concept maps based on the text and topic you provide.
*   **Wikipedia integration**. Use articles from Wikipedia as a text source.
*   **Obsidian Canvas visualization**. Maps are displayed directly in Canvas, seamlessly integrating into your workspace.
*   **Multiple visualization options**. Generate three map visualizations with different layout algorithms and choose the most suitable one.
*   **Interactivity**. Display additional information (e.g., concept description, relation context) when hovering over map nodes or connections.
*   **Simple interface**. Intuitive modal window for data input.

There are some examples of generated concept maps in the `/examples` folder of the repository.

## How to Use

### Installation

1. Install the **BRAT** plugin from the Obsidian Community Plugins store if you haven't already.
2. Open Obsidian Settings → Community Plugins → BRAT.
3. Click "Add Beta Plugin" and enter the following URL:
   ```
   https://github.com/dsaperov/obsidian-smart-canvas
   ```
4. Click "Add Plugin" and wait for the installation to complete.
5. Enable the plugin in Settings → Community Plugins.

### Generating a Concept Map

1.  After installation and activation of the plugin, open an empty Canvas note.
2.  Find plugin's icon on the Obsidian sidebar.
3.  Click the icon to open the data input modal window.
4.  In the opened window (see the picture below), specify:
    *   **Concept map topic** – The key theme around which the map will be built.
    *   **Text for analysis** – Source textual material.
    *   **Alternative** – You can leave `Text` field empty and paste the name of a Wikipedia article (currently supports only Russian) as a `Topic`. The plugin will use the content of the article as the source text.
5.  Click `Start creation` button.
6.  Generation **may take some time**, depending on the text volume and topic complexity (generally, not more than 5 minutes).
7.  Generated map will be displayed on the active Canvas note.

![demo](demo.gif)


**Important**: The plugin requires an active internet connection to work, as it interacts with an external backend service for map generation.

## Feedback and suggestions

We welcome your feedback, bug reports, and suggestions for plugin improvements! Please [create Issues](https://github.com/dsaperov/obsidian-smart-canvas/issues/new) if you encounter any problems or have ideas for new features.