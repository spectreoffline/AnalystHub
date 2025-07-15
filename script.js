class MindmapViewer {
    constructor() {
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.minScale = 0.5;
        this.maxScale = 5;
        this.scaleStep = 0.2;

        this.initializeElements();
        this.bindEvents();
        this.centerMindmap();
    }

    initializeElements() {
        this.container = document.getElementById('mindmapContainer');
        this.wrapper = document.getElementById('mindmapWrapper');
        this.svgElement = document.getElementById('mindmapSvg');
        this.zoomInBtn = document.getElementById('zoomIn');
        this.zoomOutBtn = document.getElementById('zoomOut');
        this.resetBtn = document.getElementById('resetView');
        this.zoomLevelDisplay = document.getElementById('zoomLevel');
    }

    bindEvents() {
        // Zoom button events
        this.zoomInBtn.addEventListener('click', () => this.zoomIn());
        this.zoomOutBtn.addEventListener('click', () => this.zoomOut());
        this.resetBtn.addEventListener('click', () => this.resetView());

        // Mouse wheel zoom
        this.container.addEventListener('wheel', (e) => this.handleWheel(e));

        // Drag events
        this.container.addEventListener('mousedown', (e) => this.startDrag(e));
        this.container.addEventListener('mousemove', (e) => this.drag(e));
        this.container.addEventListener('mouseup', () => this.endDrag());
        this.container.addEventListener('mouseleave', () => this.endDrag());

        // Touch events for mobile
        this.container.addEventListener('touchstart', (e) => this.startDrag(e));
        this.container.addEventListener('touchmove', (e) => this.drag(e));
        this.container.addEventListener('touchend', () => this.endDrag());

        // Prevent context menu on right click
        this.container.addEventListener('contextmenu', (e) => e.preventDefault());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    centerMindmap() {
        // Wait for SVG to load, then center it
        this.svgElement.addEventListener('load', () => {
            setTimeout(() => this.resetView(), 100);
        });
        
        // Fallback if already loaded
        setTimeout(() => this.resetView(), 500);
    }

    zoomIn() {
        this.setScale(this.scale + this.scaleStep);
    }

    zoomOut() {
        this.setScale(this.scale - this.scaleStep);
    }

    setScale(newScale) {
        this.scale = Math.max(this.minScale, Math.min(this.maxScale, newScale));
        this.constrainToBounds();
        this.updateTransform();
        this.updateZoomDisplay();
    }

    resetView() {
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.constrainToBounds();
        this.updateTransform();
        this.updateZoomDisplay();
    }

    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -this.scaleStep : this.scaleStep;
        
        // Get mouse position relative to container
        const rect = this.container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Calculate zoom center
        const containerCenterX = rect.width / 2;
        const containerCenterY = rect.height / 2;
        
        // Adjust translation to zoom towards mouse position
        const offsetX = (mouseX - containerCenterX) * 0.1;
        const offsetY = (mouseY - containerCenterY) * 0.1;
        
        this.translateX -= offsetX * (delta > 0 ? 1 : -1);
        this.translateY -= offsetY * (delta > 0 ? 1 : -1);
        
        this.setScale(this.scale + delta);
    }

    startDrag(e) {
        this.isDragging = true;
        this.container.classList.add('dragging');
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        this.lastX = clientX;
        this.lastY = clientY;
        
        // Disable smooth transition during drag
        this.wrapper.style.transition = 'none';
        
        e.preventDefault();
    }

    drag(e) {
        if (!this.isDragging) return;
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const deltaX = clientX - this.lastX;
        const deltaY = clientY - this.lastY;
        
        this.translateX += deltaX;
        this.translateY += deltaY;
        
        this.constrainToBounds();
        
        this.lastX = clientX;
        this.lastY = clientY;
        
        this.updateTransform();
        
        e.preventDefault();
    }

    endDrag() {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        this.container.classList.remove('dragging');
        
        // Re-enable smooth transition
        this.wrapper.style.transition = 'transform 0.3s ease';
    }

    handleKeyboard(e) {
        switch(e.key) {
            case '+':
            case '=':
                e.preventDefault();
                this.zoomIn();
                break;
            case '-':
                e.preventDefault();
                this.zoomOut();
                break;
            case '0':
                e.preventDefault();
                this.resetView();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.translateX += 50;
                this.constrainToBounds();
                this.updateTransform();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.translateX -= 50;
                this.constrainToBounds();
                this.updateTransform();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.translateY += 50;
                this.constrainToBounds();
                this.updateTransform();
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.translateY -= 50;
                this.constrainToBounds();
                this.updateTransform();
                break;
        }
    }

    constrainToBounds() {
        try {
            // Get container dimensions
            const containerRect = this.container.getBoundingClientRect();
            const containerWidth = containerRect.width;
            const containerHeight = containerRect.height;
            
            // Basic validation
            if (!containerWidth || !containerHeight) {
                return; // Skip if container not ready
            }
            
            // Get SVG dimensions - try multiple approaches
            let svgWidth = 800; // Default fallback
            let svgHeight = 600; // Default fallback
            
            try {
                // Try to get from contentDocument first
                if (this.svgElement.contentDocument) {
                    const svgDoc = this.svgElement.contentDocument;
                    const svgRoot = svgDoc.documentElement;
                    
                    if (svgRoot) {
                        const viewBox = svgRoot.getAttribute('viewBox');
                        if (viewBox) {
                            const [x, y, width, height] = viewBox.split(' ').map(Number);
                            if (width && height) {
                                svgWidth = width;
                                svgHeight = height;
                            }
                        } else {
                            const w = parseFloat(svgRoot.getAttribute('width'));
                            const h = parseFloat(svgRoot.getAttribute('height'));
                            if (w && h) {
                                svgWidth = w;
                                svgHeight = h;
                            }
                        }
                    }
                }
                
                // Fallback: try to get from the object element's computed style
                if (svgWidth === 800 && svgHeight === 600) {
                    const objRect = this.svgElement.getBoundingClientRect();
                    if (objRect.width > 0 && objRect.height > 0) {
                        svgWidth = objRect.width;
                        svgHeight = objRect.height;
                    }
                }
            } catch (e) {
                // Use defaults if there's any error
                console.warn('Could not get SVG dimensions, using defaults:', e);
            }
            
            // Calculate scaled dimensions
            const scaledWidth = svgWidth * this.scale;
            const scaledHeight = svgHeight * this.scale;
            
            // Validate scaled dimensions
            if (!scaledWidth || !scaledHeight) {
                return; // Skip if invalid dimensions
            }
            
            // Calculate boundaries with generous limits
            const margin = 100; // Minimum amount of image that must remain visible
            
            // For X axis (horizontal)
            let maxTranslateX, minTranslateX;
            if (scaledWidth > containerWidth) {
                // Image is wider than container - allow full navigation
                const halfExcess = (scaledWidth - containerWidth) / 2;
                maxTranslateX = halfExcess + margin; // Can move right to see left edge
                minTranslateX = -halfExcess - margin; // Can move left to see right edge
            } else {
                // Image is smaller than container - allow some movement around center
                const allowedMovement = 200;
                maxTranslateX = allowedMovement;
                minTranslateX = -allowedMovement;
            }
            
            // For Y axis (vertical)
            let maxTranslateY, minTranslateY;
            if (scaledHeight > containerHeight) {
                // Image is taller than container - allow full navigation
                const halfExcess = (scaledHeight - containerHeight) / 2;
                maxTranslateY = halfExcess + margin; // Can move down to see top edge
                minTranslateY = -halfExcess - margin; // Can move up to see bottom edge
            } else {
                // Image is smaller than container - allow some movement around center
                const allowedMovement = 200;
                maxTranslateY = allowedMovement;
                minTranslateY = -allowedMovement;
            }
            
            // Constrain translation with validation
            if (isFinite(minTranslateX) && isFinite(maxTranslateX)) {
                this.translateX = Math.max(minTranslateX, Math.min(maxTranslateX, this.translateX));
            }
            if (isFinite(minTranslateY) && isFinite(maxTranslateY)) {
                this.translateY = Math.max(minTranslateY, Math.min(maxTranslateY, this.translateY));
            }
            
        } catch (e) {
            // If anything goes wrong, just don't constrain
            console.warn('Error in constrainToBounds, skipping constraints:', e);
        }
    }

    updateTransform() {
        const transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
        this.wrapper.style.transform = transform;
    }

    updateZoomDisplay() {
        const percentage = Math.round(this.scale * 100);
        this.zoomLevelDisplay.textContent = `${percentage}%`;
    }
}

// Initialize the mindmap viewer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MindmapViewer();
});

// Add instructions overlay
document.addEventListener('DOMContentLoaded', () => {
    const instructions = document.createElement('div');
    instructions.className = 'instructions';
    instructions.innerHTML = `
        <h4>Controls:</h4>
        <ul>
            <li>Click and drag to pan</li>
            <li>Mouse wheel to zoom</li>
            <li>+ / - buttons to zoom</li>
            <li>Reset button to center</li>
            <li>Keyboard: +/- to zoom, arrows to pan, 0 to reset</li>
        </ul>
    `;
    document.body.appendChild(instructions);
    
    // Hide instructions after 5 seconds
    setTimeout(() => {
        instructions.style.opacity = '0';
        instructions.style.transition = 'opacity 1s ease';
        setTimeout(() => instructions.remove(), 1000);
    }, 5000);
}); 