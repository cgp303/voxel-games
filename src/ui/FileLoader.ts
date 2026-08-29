import { VoxParser, ParsedVoxModel } from '../voxel/VoxParser';

export class FileLoader {
    private fileInput: HTMLInputElement;
    private statusElement: HTMLDivElement;
    private onFileSelected: (parsedModel: ParsedVoxModel) => void;

    constructor(onFileSelected: (parsedModel: ParsedVoxModel) => void) {
        this.onFileSelected = onFileSelected;

        // Create file input
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = '.vox';
        this.fileInput.style.display = 'none';
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        document.body.appendChild(this.fileInput);

        // Create UI container
        const uiContainer = document.createElement('div');
        uiContainer.id = 'ui-container';
        uiContainer.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      background: rgba(0, 0, 0, 0.7);
      padding: 20px;
      border-radius: 8px;
      font-family: monospace;
      color: #00ff00;
      z-index: 100;
    `;

        // Create load button
        const loadButton = document.createElement('button');
        loadButton.textContent = '📂 Load .vox File';
        loadButton.style.cssText = `
      background: #004400;
      color: #00ff00;
      border: 2px solid #00ff00;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      font-family: monospace;
      font-size: 14px;
      margin-bottom: 10px;
      width: 100%;
    `;
        loadButton.addEventListener('click', () => this.fileInput.click());
        loadButton.addEventListener('mouseover', () => {
            loadButton.style.background = '#006600';
            loadButton.style.boxShadow = '0 0 10px #00ff00';
        });
        loadButton.addEventListener('mouseout', () => {
            loadButton.style.background = '#004400';
            loadButton.style.boxShadow = 'none';
        });

        // Create status display
        this.statusElement = document.createElement('div');
        this.statusElement.style.cssText = `
      font-size: 12px;
      line-height: 1.6;
      color: #00aa00;
    `;
        this.statusElement.innerHTML = 'Ready to load .vox file<br>';

        uiContainer.appendChild(loadButton);
        uiContainer.appendChild(this.statusElement);
        document.body.appendChild(uiContainer);
    }

    private async handleFileSelect(event: Event) {
        const target = event.target as HTMLInputElement;
        const files = target.files;

        if (!files || files.length === 0) {
            return;
        }

        const file = files[0];
        this.setStatus(`Loading ${file.name}...`);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const parsedModel = await VoxParser.parseVoxFile(arrayBuffer);

            this.setStatus(
                `✓ Loaded: ${file.name}<br>` +
                `Voxels: ${parsedModel.voxels.length}<br>` +
                `Size: ${parsedModel.size.x}×${parsedModel.size.y}×${parsedModel.size.z}`,
            );

            this.onFileSelected(parsedModel);
        } catch (error) {
            this.setStatus(`✗ Error loading file: ${error instanceof Error ? error.message : 'Unknown error'}`);
            console.error('Error loading VOX file:', error);
        }
    }

    private setStatus(message: string) {
        this.statusElement.innerHTML = message;
    }
}
