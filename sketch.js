// Configuration object to store all constants and settings
const config = {
  cols: 120,
  rows: 20,
  pixelSize: 20,
  margin: 4,
  delay: 0,
  maxSubdivision: 4,
  bgColor: '#222222',
  colors: ['#B7B7B7', '#FF2020', '#0d0', '#2D2DFF'], // Default colors
  brightnessThresholds: [95, 60, 30, 10, 0],
  subdivisionLevels: [],
  toggles: [true, true, true, true], // Toggle states for all colors
  processingDirection: 'topToBottom', // Default processing direction,
  overlay: false,
  processingMode: false,
  processingIntensity: 0.1,
  processingSpeed: 20,
  regenerateOnRecord: true, // New configuration for regenerate on record
  recordDuration: 6, // Default duration for GIF recording in seconds
  recordOnDrop: false // New configuration for recording on image drop
};

// State management
const state = {
  img: null,
  lastUpdateTime: 0,
  pixelColors: [], // Stores the color index for each pixel
  canvas: null,
  ui: {
    colorPickers: [],
    toggleButtons: [],
    controls: null
  },
  recoloring: {
    active: false,
    targetColorIndex: null,
    targetToggleState: null,
    pixelsToUpdate: [], // Stores pixels to update for toggling off
    originalPixels: [] // Stores original pixels for each color
  },
  pixelOrder: [] // Stores the order of pixels for processing
};

// Initialize originalPixels
function initializeOriginalPixels() {
  state.recoloring.originalPixels = config.colors.map(() => []);
}

// Initialize pixel order based on processing direction
function initializePixelOrder() {
  state.pixelOrder = [];
  const centerX = floor(config.cols / 2);
  const centerY = floor(config.rows / 2);

  if (config.processingDirection === 'topToBottom') {
    // Top to bottom, left to right
    for (let x = 0; x < config.cols; x++) {
      for (let y = 0; y < config.rows; y++) {
        state.pixelOrder.push({ x, y });
      }
    }
  } else if (config.processingDirection === 'edgesToCenter') {
    // Edges to center (inverted)
    for (let y = 0; y < config.rows; y++) {
      for (let x = 0; x < config.cols; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = dx * dx + dy * dy; // Squared distance (no need for sqrt)
        state.pixelOrder.push({ x, y, distance });
      }
    }

    // Sort pixels by distance from the center (descending order)
    state.pixelOrder.sort((a, b) => b.distance - a.distance);
  } else if (config.processingDirection === 'centerToEdges') {
    // Center to edges (correct direction)
    for (let y = 0; y < config.rows; y++) {
      for (let x = 0; x < config.cols; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = dx * dx + dy * dy; // Squared distance (no need for sqrt)
        state.pixelOrder.push({ x, y, distance });
      }
    }

    // Sort pixels by distance from the center (ascending order)
    state.pixelOrder.sort((a, b) => a.distance - b.distance);
  } else {
    // Default left to right, top to bottom
    for (let y = 0; y < config.rows; y++) {
      for (let x = 0; x < config.cols; x++) {
        state.pixelOrder.push({ x, y });
      }
    }
  }
}

// UI Manager
class UIManager {
  static createControls() {
    state.ui.controls = createDiv('');
    state.ui.controls.class('controls-panel');
    state.ui.controls.style('position', 'absolute');
    state.ui.controls.style('top', '20px');
    state.ui.controls.style('right', '20px');
    state.ui.controls.style('background', 'white');
    state.ui.controls.style('padding', '20px');
    state.ui.controls.style('border-radius', '8px');
    state.ui.controls.style('box-shadow', '0 2px 10px rgba(0,0,0,0.1)');
    state.ui.controls.style('font-family', 'sans-serif');

    // Delay control
    this.createSlider('Animation Delay', 0, 500, config.delay, (value) => {
      config.delay = value;
    });

    // Maximum Subdivision control
    this.createSlider('Symbols:', 1, 5, config.maxSubdivision, (value) => {
      config.maxSubdivision = value;
    });

    // Brightness Thresholds control
    this.createSlider('Brightness Threshold', 0, 100, config.brightnessThresholds[0], (value) => {
      config.brightnessThresholds = [value, value * 0.6, value * 0.3, value * 0.1, 0];
    });

    // Background color
    this.createColorPicker('Background Color', config.bgColor, (value) => {
      config.bgColor = value;
    });

    // Color palette
    const paletteDiv = createDiv('');
    paletteDiv.parent(state.ui.controls);
    paletteDiv.style('margin-right', '2px');
    
    createDiv('Color Palette:').parent(paletteDiv);
    state.ui.colorPickers = config.colors.map((color, index) => {
      const picker = createColorPicker(color);
      picker.parent(paletteDiv);
      picker.style('margin-top', '6px');
      picker.input(() => {
        const newColor = picker.value();
        if (this.isValidHex(newColor)) {
          config.colors[index] = newColor;
        } else {
          console.warn(`Invalid HEX code: ${newColor}`);
        }
      });
      return picker;
    });

    // Toggle buttons for all colors
    const toggleDiv = createDiv('');
    toggleDiv.parent(state.ui.controls);
    toggleDiv.style('margin-top', '6px');
    

    state.ui.toggleButtons = config.colors.map((color, index) => {
      const toggleBtn = createButton(config.toggles[index] ? 'ON' : 'OFF');
      toggleBtn.parent(toggleDiv);
      toggleBtn.style('margin-right', '2px');
      toggleBtn.style('padding', '6px 14px');
      toggleBtn.style('background', config.toggles[index] ? 'black' : '#ff0000');
      toggleBtn.style('color', 'white');
      toggleBtn.style('border', 'none');
      toggleBtn.style('border-radius', '4px');
      toggleBtn.style('cursor', 'pointer');
      toggleBtn.mousePressed(() => {
        config.toggles[index] = !config.toggles[index];
        toggleBtn.html(config.toggles[index] ? 'ON' : 'OFF');
        toggleBtn.style('background', config.toggles[index] ? 'black' : '#ff0000');
        this.handleToggle(index, config.toggles[index]);
      });
      return toggleBtn;
    });


    // Add direction control
    this.createDirectionControl();
    
    // Add overlay checkbox
    const overlayContainer = createDiv('');
    overlayContainer.parent(state.ui.controls);
    overlayContainer.style('margin-bottom', '20px');

    const overlayCheck = createCheckbox('Overlay Mode', config.overlay);
    overlayCheck.parent(overlayContainer);
    overlayCheck.changed(() => {
      config.overlay = overlayCheck.checked();
    });
    
    
    const processingContainer = createDiv('');
    processingContainer.parent(state.ui.controls);
    processingContainer.style('margin-bottom', '20px');

    const processingCheck = createCheckbox('Processing Mode', config.processingMode);
    processingCheck.parent(processingContainer);
    processingCheck.changed(() => {
      config.processingMode = processingCheck.checked();
    });
    
    // In UIManager.createControls(), after processing checkbox
    this.createSlider('Processing Speed', 1, 60, config.processingSpeed, (value) => {
    config.processingSpeed = value;
    });

    this.createSlider('Processing Intensity', 1, 100, config.processingIntensity * 100, (value) => {
    config.processingIntensity = value / 100;
    });
    
     // Regenerate button
    const regenerateBtn = createButton('Regenerate');
    regenerateBtn.parent(state.ui.controls);
    regenerateBtn.style('margin-top', '10px');
    regenerateBtn.style('padding', '8px 16px');
    regenerateBtn.style('background', 'black');
    regenerateBtn.style('color', 'white');
    regenerateBtn.style('border', 'none');
    regenerateBtn.style('border-radius', '4px');
    regenerateBtn.style('cursor', 'pointer');
    regenerateBtn.mousePressed(() => {
      config.subdivisionLevels = Array(config.rows).fill()
        .map(() => Array(config.cols).fill(0));
    });

    // Recolor button
    const recolorBtn = createButton('Recolor');
    recolorBtn.parent(state.ui.controls);
    recolorBtn.style('margin-top', '10px');
    recolorBtn.style('margin-left', '6px');
    recolorBtn.style('padding', '8px 16px');
    recolorBtn.style('background', 'black');
    recolorBtn.style('color', 'white');
    recolorBtn.style('border', 'none');
    recolorBtn.style('border-radius', '4px');
    recolorBtn.style('cursor', 'pointer');
    recolorBtn.mousePressed(() => ColorManager.initializePixelColors());

    // Add Regenerate on Record checkbox
    const regenerateOnRecordContainer = createDiv('');
    regenerateOnRecordContainer.parent(state.ui.controls);
    regenerateOnRecordContainer.style('margin-bottom', '20px');

    const regenerateOnRecordCheck = createCheckbox('Regenerate on Record', config.regenerateOnRecord);
    regenerateOnRecordCheck.parent(regenerateOnRecordContainer);
    regenerateOnRecordCheck.changed(() => {
      config.regenerateOnRecord = regenerateOnRecordCheck.checked();
    });

    // Add Record Duration input field
    const recordDurationContainer = createDiv('');
    recordDurationContainer.parent(state.ui.controls);
    recordDurationContainer.style('margin-bottom', '20px');

    createSpan('Record Duration (seconds): ').parent(recordDurationContainer);
    const recordDurationInput = createInput(config.recordDuration.toString(), 'number');
    recordDurationInput.parent(recordDurationContainer);
    recordDurationInput.input(() => {
      const value = parseInt(recordDurationInput.value());
      if (!isNaN(value) && value > 0) {
        config.recordDuration = value;
      }
    });

    // Add Record on Drop checkbox
    const recordOnDropContainer = createDiv('');
    recordOnDropContainer.parent(state.ui.controls);
    recordOnDropContainer.style('margin-bottom', '20px');

    const recordOnDropCheck = createCheckbox('Record on Drop', config.recordOnDrop);
    recordOnDropCheck.parent(recordOnDropContainer);
    recordOnDropCheck.changed(() => {
      config.recordOnDrop = recordOnDropCheck.checked();
    });

    // Record GIF button
    const recordBtn = createButton('Record GIF');
    recordBtn.parent(state.ui.controls);
    recordBtn.style('margin-top', '10px');
    recordBtn.style('margin-left', '6px');
    recordBtn.style('padding', '8px 16px');
    recordBtn.style('background', '#ff0000');
    recordBtn.style('color', 'white');
    recordBtn.style('border', 'none');
    recordBtn.style('border-radius', '4px');
    recordBtn.style('cursor', 'pointer');
    recordBtn.mousePressed(() => {
      // Trigger regeneration before recording if the checkbox is checked
      if (config.regenerateOnRecord) {
        config.subdivisionLevels = Array(config.rows).fill()
          .map(() => Array(config.cols).fill(0));
      }
      recordGIF();
    });
  }

  static createSlider(label, min, max, defaultValue, onChange) {
    const container = createDiv('');
    container.parent(state.ui.controls);
    container.style('margin', '10px 0');
    
    createSpan(label + ': ').parent(container);
    const slider = createSlider(min, max, defaultValue);
    slider.parent(container);
    slider.input(() => onChange(slider.value()));
    
    const valueSpan = createSpan(defaultValue);
    valueSpan.parent(container);
    valueSpan.style('margin-left', '10px');
    
    slider.input(() => {
      const value = slider.value();
      valueSpan.html(value);
      onChange(value);
    });
  }

  static createColorPicker(label, defaultColor, onChange) {
    const container = createDiv('');
    container.parent(state.ui.controls);
    container.style('margin', '10px 0');
    
    createSpan(label + ': ').parent(container);
    const picker = createColorPicker(defaultColor);
    picker.parent(container);
    picker.input(() => {
      const newColor = picker.value();
      if (this.isValidHex(newColor)) {
        onChange(newColor);
      } else {
        console.warn(`Invalid HEX code: ${newColor}`);
      }
    });
  }

  static createDirectionControl() {
    const container = createDiv('');
    container.parent(state.ui.controls);
    container.style('margin', '10px 0');
    
    createSpan('Processing Direction: ').parent(container);
    const directionSelect = createSelect();
    directionSelect.parent(container);
        directionSelect.option('Top to Bottom', 'topToBottom');
    directionSelect.option('Left to Right', 'leftToRight');
    directionSelect.option('Edges to Center', 'edgesToCenter');
    directionSelect.option('Center to Edges', 'centerToEdges');
    directionSelect.changed(() => {
      config.processingDirection = directionSelect.value();
      initializePixelOrder(); // Reinitialize the pixel order
    });
  }

  static isValidHex(color) {
    return /^#([0-9A-F]{3}){1,2}$/i.test(color);
  }

  static handleToggle(targetColorIndex, targetToggleState) {
    if (targetToggleState) {
      // Toggling back on: Restore original pixels for this color
      state.recoloring.originalPixels[targetColorIndex].forEach(({ x, y }) => {
        state.pixelColors[y][x] = targetColorIndex;
      });
    } else {
      // Toggling off: Start recoloring pixels one by one
      state.recoloring.active = true;
      state.recoloring.targetColorIndex = targetColorIndex;
      state.recoloring.targetToggleState = targetToggleState;
      state.recoloring.pixelsToUpdate = [];

      // Collect all pixels of the target color and store their coordinates
      for (let y = 0; y < config.rows; y++) {
        for (let x = 0; x < config.cols; x++) {
          if (state.pixelColors[y][x] === targetColorIndex) {
            state.recoloring.pixelsToUpdate.push({ x, y });
            state.recoloring.originalPixels[targetColorIndex].push({ x, y });
          }
        }
      }

      // Shuffle the pixels to update randomly
      state.recoloring.pixelsToUpdate = state.recoloring.pixelsToUpdate.sort(() => Math.random() - 0.5);
    }
  }

  static handleRecoloring() {
    if (!state.recoloring.active || state.recoloring.pixelsToUpdate.length === 0) return;

    // Update 10 pixels per frame for faster performance
    for (let i = 0; i < 10; i++) {
      if (state.recoloring.pixelsToUpdate.length === 0) break;

      const { x, y } = state.recoloring.pixelsToUpdate.pop();
      if (state.recoloring.targetColorIndex === 0) {
        // For the first color, toggle to background color
        state.pixelColors[y][x] = -1; // -1 represents background color
      } else {
        // For other colors, toggle to color 1
        state.pixelColors[y][x] = 0;
      }
    }

    // Stop recoloring if all pixels are updated
    if (state.recoloring.pixelsToUpdate.length === 0) {
      state.recoloring.active = false;
    }
  }

static resizeImage() {
  if (!state.img) return;

  // Calculate new dimensions based on pixelSize and aspect ratio
  const aspectRatio = state.img.width / state.img.height;
  const newCols = floor(width / config.pixelSize);
  const newRows = floor(newCols / aspectRatio);

  // Resize the image without smoothing
  const resizedImg = createImage(newCols, newRows);
  resizedImg.copy(
    state.img,
    0, 0, state.img.width, state.img.height,
    0, 0, newCols, newRows
  );
  resizedImg.loadPixels();
  state.img = resizedImg;

  // Only reset grids if overlay is disabled or if grids don't exist
  if (!config.overlay || !config.subdivisionLevels.length) {
    config.cols = newCols;
    config.rows = newRows;
    config.subdivisionLevels = Array(newRows).fill()
      .map(() => Array(newCols).fill(0));
    state.pixelColors = Array(newRows).fill()
      .map(() => Array(newCols).fill(0));
    ColorManager.initializePixelColors();
  }

  // Resize the canvas
  resizeCanvas(newCols * config.pixelSize, newRows * config.pixelSize);

  // Initialize pixel order after resizing
  initializePixelOrder();
}
  
}

// Color utilities
class ColorManager {
  static getRandomColorIndex() {
    const rand = random();
    if (rand < 0.7) {
      return 0; // Default color index
    }
    return floor(random(1, config.colors.length)); // Random color index
  }

  static initializePixelColors() {
    state.pixelColors = Array(config.rows).fill().map(() => 
      Array(config.cols).fill().map(() => this.getRandomColorIndex())
    );
    initializeOriginalPixels(); // Reset original pixels
  }
}

// Pixel drawing utilities
class PixelDrawer {
  static drawPixelState(x, y, level, colorIndex) {
    const { pixelSize, margin, bgColor } = config;
    const color = colorIndex === -1 ? bgColor : config.colors[colorIndex]; // Use background color if index is -1
    
    switch(level) {
      case 0:
        fill(bgColor);
        rect(x, y, pixelSize, pixelSize);
        break;
        
      case 1:
        fill(color);
        rect(x + margin, y + margin, pixelSize - 2 * margin, pixelSize - 2 * margin);
        fill(bgColor);
        rect(x + (pixelSize/12) * 5, y, (pixelSize/12) * 2, pixelSize);
        break;
        // fill(bgColor);
        // rect(x, y, pixelSize, pixelSize);
        // fill(color);
        // const positions4 = [[0.25, 0.25], [0.75, 0.75], [0.25, 0.75], [0.75, 0.25]];
        // positions4.forEach(([px, py]) => {
        //   ellipse(
        //     x + pixelSize * px,
        //     y + pixelSize * py,
        //     pixelSize / 2 - margin,
        //     pixelSize / 2 - margin
        //   );
        // });
        // break;
        
      case 2:
        fill(color);
        rect(x, y, pixelSize, pixelSize);
        break;
        // fill(bgColor);
        // rect(x, y, pixelSize, pixelSize);
        // fill(color);
        // const positions3 = [[0.25, 0.25], [0.75, 0.75], [0.25, 0.75], [0.75, 0.25]];
        // positions3.forEach(([px, py]) => {
        //   ellipse(
        //     x + pixelSize * px,
        //     y + pixelSize * py,
        //     pixelSize / 2 - margin,
        //     pixelSize / 2 - margin
        //   );
        // });
        // break;
        
        
      case 3:
        fill(bgColor);
        rect(x, y, pixelSize, pixelSize);
        fill(color);
        ellipse(x + pixelSize * 0.5, y + pixelSize * 0.5, pixelSize - margin, pixelSize - margin);
        break;
        //        fill(bgColor);
        // rect(x, y, pixelSize, pixelSize);
        // fill('#404347');
        // const positions = [[0.25, 0.25], [0.75, 0.75], [0.25, 0.75], [0.75, 0.25]];
        // positions.forEach(([px, py]) => {
        //   ellipse(
        //     x + pixelSize * px,
        //     y + pixelSize * py,
        //     pixelSize / 2 - margin,
        //     pixelSize / 2 - margin
        //   );
        // });
        // break;
        
      case 4:
        fill(bgColor);
        rect(x, y, pixelSize, pixelSize);
        fill('#404347');
        const positions2 = [[0.25, 0.25], [0.75, 0.75], [0.25, 0.75], [0.75, 0.25]];
        positions2.forEach(([px, py]) => {
          ellipse(
            x + pixelSize * px,
            y + pixelSize * py,
            pixelSize / 2 - margin,
            pixelSize / 2 - margin
          );
        });
        break;
        //  fill(color);
        // rect(x + margin, y + margin, pixelSize - 2 * margin, pixelSize - 2 * margin);
        // fill(bgColor);
        // rect(x + (pixelSize/12) * 5, y, (pixelSize/12) * 2, pixelSize);
        // break;
    }
  }
}

// Image processing
class ImageProcessor {
 static handleFile(file) {
  if (file.type === 'image') {
    loadImage(file.data, (loadedImage) => {
      state.img = loadedImage;
      UIManager.resizeImage(); // Resize the image and canvas
      initializePixelOrder(); // Initialize pixel order after image is loaded

      // Trigger recording if "Record on Drop" is enabled
      if (config.recordOnDrop) {
        recordGIF();
      }
    });
  }
}

  static getTargetSubdivision(brightnessValue) {
    const { brightnessThresholds } = config;
    for (let i = 0; i < brightnessThresholds.length; i++) {
      if (brightnessValue > brightnessThresholds[i]) {
        return config.maxSubdivision - i;
      }
    }
    return 0;
  }
}

function setup() {
  pixelDensity(1); // Ensure crisp pixel edges
  frameRate(20);
  state.canvas = createCanvas(config.cols * config.pixelSize, config.rows * config.pixelSize);
  state.canvas.style('display', 'block');
  state.canvas.style('margin', '20px auto');
  noStroke();
  
  state.canvas.drop(ImageProcessor.handleFile);
  
  config.subdivisionLevels = Array(config.rows).fill()
    .map(() => Array(config.cols).fill(0));
  ColorManager.initializePixelColors();
  state.lastUpdateTime = millis();
  
  UIManager.createControls();
  
  // Initialize pixel order for the default processing direction
  initializePixelOrder();
  
  background(200);
  fill(config.bgColor);
  textAlign(CENTER, CENTER);
  textSize(20);
  text('Drag and drop an image here', width/2, height/2);
}

function draw() {
  if (!state.img) return;
  background(config.bgColor);
  
  // Handle recoloring
  UIManager.handleRecoloring();

// Processing mode animation
if (config.processingMode && frameCount % config.processingSpeed === 0) {
  // Collect all non-background pixels, excluding subdivision levels 3 and 4
  let activePixels = [];
  for (let y = 0; y < config.rows; y++) {
    for (let x = 0; x < config.cols; x++) {
      // Check if pixel is non-background AND has subdivision level 1 or 2
      if (state.pixelColors[y][x] > 0 && 
          (config.subdivisionLevels[y][x] === 1 || 
           config.subdivisionLevels[y][x] === 2)) {
        activePixels.push({x, y});
      }
    }
  }
  
  // Calculate how many pixels to update this frame
  const pixelsToUpdate = Math.max(1, Math.floor(activePixels.length * config.processingIntensity));
  
  // Randomly select and update pixels
  for (let i = 0; i < pixelsToUpdate; i++) {
    if (activePixels.length === 0) break;
    
    // Pick and remove a random pixel from the array
    const randomIndex = floor(random(activePixels.length));
    const {x, y} = activePixels.splice(randomIndex, 1)[0];
    
    // Update its subdivision and color
    config.subdivisionLevels[y][x] = floor(random(1, 3));
    state.pixelColors[y][x] = floor(random(1, config.colors.length));
  }
}

  for (const { x, y } of state.pixelOrder) {
    const pixelX = x * config.pixelSize;
    const pixelY = y * config.pixelSize;
    
    if (!config.processingMode) {  // Only do normal image processing if not in processing mode
      const imgColor = state.img.get(x, y);
      const brightnessValue = brightness(imgColor);
      const targetSubdivision = ImageProcessor.getTargetSubdivision(brightnessValue);
      
      if (config.subdivisionLevels[y][x] !== targetSubdivision && 
          millis() - state.lastUpdateTime > config.delay) {
        config.subdivisionLevels[y][x] += 
          (targetSubdivision > config.subdivisionLevels[y][x]) ? 1 : -1;
        state.lastUpdateTime = millis();
      }
    }
    
    PixelDrawer.drawPixelState(
      pixelX,
      pixelY,
      config.subdivisionLevels[y][x],
      state.pixelColors[y][x]
    );
  }
}

function recordGIF() {
  saveGif('fortytwo.gif', config.recordDuration, { 
    units: 'seconds',
    notificationDuration: 1,
    notificationID: 'customProgressBar'
  });
}