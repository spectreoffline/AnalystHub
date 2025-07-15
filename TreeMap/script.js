// Tree data - will be loaded from YAML file
let treeData = null;

// Function to load tree data from YAML file
async function loadTreeData() {
    try {
        console.log('Attempting to load tree-data.yaml...');
        const response = await fetch('tree-data.yaml');
        if (!response.ok) {
            throw new Error(`Failed to load YAML file: ${response.status}`);
        }
        const yamlText = await response.text();
        console.log('YAML text loaded, first 200 chars:', yamlText.substring(0, 200));
        const data = jsyaml.load(yamlText);
        console.log('YAML parsed successfully:', data);
        return data;
    } catch (error) {
        console.error('Error loading tree data:', error);
        throw error; // Re-throw error instead of falling back to hardcoded data
    }
}

// D3.js Tree Implementation
class TreeDiagram {
    constructor(data) {
        this.data = data;
        this.margin = { top: 50, right: 150, bottom: 50, left: 250 };
        this.width = 1200 - this.margin.left - this.margin.right;
        this.height = 600 - this.margin.top - this.margin.bottom;
        this.duration = 750;
        this.i = 0; // counter for node ids
        
        this.init();
    }

    init() {
        // Get full viewport dimensions
        this.width = window.innerWidth - this.margin.left - this.margin.right;
        this.height = window.innerHeight - this.margin.top - this.margin.bottom;

        // Create SVG
        this.svg = d3.select("#tree-svg")
            .attr("width", window.innerWidth)
            .attr("height", window.innerHeight);

        // Create main group
        this.g = this.svg.append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        // Create tree layout
        this.tree = d3.tree()
            .size([this.height, this.width]);

        // Create root node
        this.root = d3.hierarchy(this.data, d => d.children);
        this.root.x0 = this.height / 2;
        this.root.y0 = 0;

        // Collapse all children initially except first level
        this.root.children.forEach(d => this.collapse(d));

        this.update(this.root);

        // Handle window resize
        window.addEventListener('resize', () => {
            this.width = window.innerWidth - this.margin.left - this.margin.right;
            this.height = window.innerHeight - this.margin.top - this.margin.bottom;
            
            this.svg
                .attr("width", window.innerWidth)
                .attr("height", window.innerHeight);
            
            this.tree.size([this.height, this.width]);
            this.update(this.root);
        });
    }

    // Expand all nodes
    expandAll() {
        this.expandNode(this.root);
        this.update(this.root);
    }

    // Collapse all nodes including first level
    collapseAll() {
        // First, ensure root is expanded so we can collapse its children
        if (this.root._children) {
            this.root.children = this.root._children;
            this.root._children = null;
        }
        
        // Now collapse all children recursively
        if (this.root.children) {
            this.root.children.forEach(d => this.collapse(d));
            // Then collapse the root itself
            this.root._children = this.root.children;
            this.root.children = null;
        }
        
        this.update(this.root);
    }

    // Recursively expand a node and its children
    expandNode(d) {
        if (d._children) {
            d.children = d._children;
            d._children = null;
        }
        if (d.children) {
            d.children.forEach(child => this.expandNode(child));
        }
    }

    collapse(d) {
        if (d.children) {
            d._children = d.children;
            d._children.forEach(child => this.collapse(child));
            d.children = null;
        }
    }

    update(source) {
        // Compute the new tree layout
        const treeData = this.tree(this.root);
        const nodes = treeData.descendants();
        const links = treeData.descendants().slice(1);

        // Normalize for fixed-depth
        nodes.forEach(d => d.y = d.depth * 180);

        // Update the nodes
        const node = this.g.selectAll('g.node')
            .data(nodes, d => d.id || (d.id = ++this.i));

        // Enter any new nodes at the parent's previous position
        const nodeEnter = node.enter().append('g')
            .attr('class', d => {
                let classes = 'node';
                if (d.depth === 0) classes += ' root';
                if (d.children || d._children || d.data.children.length > 0) classes += ' expandable';
                if (d._children) classes += ' collapsed';
                return classes;
            })
            .attr('transform', d => `translate(${source.y0},${source.x0})`)
            .on('click', (event, d) => this.click(event, d));

        // Add white background rectangles for text (to appear above lines)
        nodeEnter.append('rect')
            .attr('class', 'text-background')
            .attr('fill', 'white')
            .attr('stroke', 'none')
            .attr('rx', 2)
            .attr('ry', 2)
            .style('opacity', 0.9);

        // Add labels for the nodes
        nodeEnter.append('text')
            .attr('dy', '0em')
            .attr('x', 0)
            .attr('text-anchor', 'middle')
            .each(function(d) {
                const text = d3.select(this);
                const name = d.data.name;
                
                // Handle line breaking for long text (especially root node)
                if (name.length > 20) {
                    const words = name.split(' ');
                    const lineHeight = 1.1; // ems
                    let lineNumber = 0;
                    
                    text.text(null);
                    
                    let tspan = text.append('tspan')
                        .attr('x', 0)
                        .attr('dy', lineNumber * lineHeight + 'em');
                    
                    let line = [];
                    words.forEach(word => {
                        line.push(word);
                        tspan.text(line.join(' '));
                        
                        if (tspan.node().getComputedTextLength() > 150) {
                            line.pop();
                            tspan.text(line.join(' '));
                            line = [word];
                            tspan = text.append('tspan')
                                .attr('x', 0)
                                .attr('dy', ++lineNumber * lineHeight + 'em')
                                .text(word);
                        }
                    });
                } else {
                    text.text(name);
                }
            })
            .style('fill-opacity', 1e-6);

        // Add expandable indicator (+/-) for nodes with children
        nodeEnter.append('text')
            .attr('class', 'expandable-indicator')
            .attr('dy', '0em')
            .attr('x', 0)
            .attr('text-anchor', 'start')
            .text(d => {
                if (d.children || d._children || d.data.children.length > 0) {
                    return d._children ? '+' : '-';
                }
                return '';
            })
            .style('fill-opacity', 1e-6);

        // Update
        const nodeUpdate = nodeEnter.merge(node);

        // Update node classes
        nodeUpdate.attr('class', d => {
            let classes = 'node';
            if (d.depth === 0) classes += ' root';
            if (d.children || d._children || d.data.children.length > 0) classes += ' expandable';
            if (d._children) classes += ' collapsed';
            return classes;
        });

        // Transition nodes to their new position
        nodeUpdate.transition()
            .duration(this.duration)
            .ease(d3.easeCircleOut)
            .attr('transform', d => `translate(${d.y},${d.x})`);

        nodeUpdate.select('text')
            .transition()
            .duration(this.duration)
            .ease(d3.easeCircleOut)
            .style('fill-opacity', 1);

        nodeUpdate.select('.expandable-indicator')
            .transition()
            .duration(this.duration)
            .ease(d3.easeCircleOut)
            .style('fill-opacity', d => {
                if (d.children || d._children || d.data.children.length > 0) {
                    return 1;
                }
                return 0;
            })
            .text(d => {
                if (d.children || d._children || d.data.children.length > 0) {
                    return d._children ? '+' : '-';
                }
                return '';
            })
            .attr('x', function(d) {
                const textElement = d3.select(this.parentNode).select('text').node();
                if (textElement && (d.children || d._children || d.data.children.length > 0)) {
                    const bbox = textElement.getBBox();
                    // Position indicator to create equal spacing: left padding = right padding
                    // Box width = bbox.width + 8 + 20, so indicator should be at bbox.width/2 + 12
                    return bbox.width / 2 + 12;
                }
                return 0;
            });

        // Update text background rectangles (no animation to prevent bounce)
        nodeUpdate.select('.text-background')
            .attr('x', function(d) {
                const textElement = d3.select(this.parentNode).select('text').node();
                if (textElement) {
                    const bbox = textElement.getBBox();
                    return bbox.x - 4;
                }
                return -25;
            })
            .attr('y', function(d) {
                const textElement = d3.select(this.parentNode).select('text').node();
                if (textElement) {
                    const bbox = textElement.getBBox();
                    return bbox.y - 2;
                }
                return -12;
            })
            .attr('width', function(d) {
                const textElement = d3.select(this.parentNode).select('text').node();
                if (textElement) {
                    const bbox = textElement.getBBox();
                    let width = bbox.width + 8;
                    // Add space for indicator if present
                    if (d.children || d._children || d.data.children.length > 0) {
                        width += 20; // Extra space for + or - indicator
                    }
                    return width;
                }
                return 50;
            })
            .attr('height', function(d) {
                const textElement = d3.select(this.parentNode).select('text').node();
                if (textElement) {
                    const bbox = textElement.getBBox();
                    return bbox.height + 4;
                }
                return 20;
            });

        // Remove any exiting nodes
        const nodeExit = node.exit().transition()
            .duration(this.duration)
            .ease(d3.easeCircleIn)
            .attr('transform', d => `translate(${source.y},${source.x})`)
            .remove();

        // On exit reduce the opacity of text labels
        nodeExit.select('text')
            .style('fill-opacity', 1e-6);

        // On exit reduce the opacity of text backgrounds
        nodeExit.select('.text-background')
            .style('opacity', 1e-6);

        // Update the links
        const link = this.g.selectAll('path.link')
            .data(links, d => d.id);

        // Enter any new links at the parent's previous position
        link.enter().insert('path', 'g')
            .attr('class', 'link')
            .attr('d', d => {
                const o = { x: source.x0, y: source.y0 };
                return this.diagonal(o, o);
            })
            .transition()
            .duration(this.duration)
            .ease(d3.easeCircleOut)
            .attr('d', d => this.diagonal(d, d.parent));

        // Transition existing links to their new position
        link.transition()
            .duration(this.duration)
            .ease(d3.easeCircleOut)
            .attr('d', d => this.diagonal(d, d.parent));

        // Remove any exiting links - animate back to parent position
        link.exit().transition()
            .duration(this.duration)
            .ease(d3.easeCircleIn)
            .attr('d', d => {
                const o = { x: source.x, y: source.y };
                return this.diagonal(o, o);
            })
            .remove();

        // Store the old positions for transition
        nodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    diagonal(s, d) {
        const path = `M ${s.y} ${s.x}
                      C ${(s.y + d.y) / 2} ${s.x},
                        ${(s.y + d.y) / 2} ${d.x},
                        ${d.y} ${d.x}`;
        return path;
    }

    click(event, d) {
        // Check if this is a double-click for expansion/collapse
        if (event.detail === 2) {
            // Double-click: expand/collapse node
            if (d.children) {
                d._children = d.children;
                d.children = null;
            } else {
                d.children = d._children;
                d._children = null;
            }
            this.update(d);
        } else {
            // Single click: show popup
            this.showNodePopup(d);
        }
    }

    showNodePopup(node) {
        const popup = new NodePopup();
        popup.show(node);
    }

    // Method to add new nodes dynamically
    addNode(parentNode, nodeName) {
        if (!parentNode.data.children) {
            parentNode.data.children = [];
        }
        
        const newNode = {
            name: nodeName,
            children: []
        };
        
        parentNode.data.children.push(newNode);
        
        // If the parent was collapsed, expand it to show the new node
        if (parentNode._children) {
            parentNode.children = parentNode._children;
            parentNode._children = null;
        }
        
        // Refresh the tree
        this.root = d3.hierarchy(this.data, d => d.children);
        this.update(parentNode);
    }
}

// Node Popup Control
class NodePopup {
    constructor() {
        this.overlay = document.getElementById('popup-overlay');
        this.title = document.getElementById('popup-title');
        this.description = document.getElementById('popup-description');
        this.closeBtn = document.getElementById('popup-close');
        
        this.init();
    }

    init() {
        // Close popup when clicking the close button
        this.closeBtn.addEventListener('click', () => {
            this.hide();
        });

        // Close popup when clicking outside the content
        this.overlay.addEventListener('click', (event) => {
            if (event.target === this.overlay) {
                this.hide();
            }
        });

        // Close popup when pressing Escape key
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.overlay.classList.contains('active')) {
                this.hide();
            }
        });
    }

    show(node) {
        // Set popup content
        this.title.textContent = node.data.name;
        
        // Generate description based on node properties
        let description = `Node: ${node.data.name}`;
        if (node.depth > 0) {
            description += `<br>Depth: ${node.depth}`;
        }
        if (node.children || node._children) {
            const childCount = node.children ? node.children.length : node._children.length;
            description += `<br>Child nodes: ${childCount}`;
        }
        if (node.parent) {
            description += `<br>Parent: ${node.parent.data.name}`;
        }
        
        // Add any additional information from the node data
        if (node.data.description) {
            description += `<br><br>${node.data.description}`;
        }
        
        this.description.innerHTML = description;
        
        // Show popup and apply blur
        this.overlay.classList.add('active');
        document.body.classList.add('popup-active');
        
        // Focus on close button for accessibility
        setTimeout(() => {
            this.closeBtn.focus();
        }, 100);
    }

    hide() {
        this.overlay.classList.remove('active');
        document.body.classList.remove('popup-active');
    }
}

// Tree Motion Controls
class TreeMotionControls {
    constructor(tree) {
        this.tree = tree;
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.isDragging = false;
        this.dragStarted = false;
        this.lastX = 0;
        this.lastY = 0;
        this.minScale = 0.5;
        this.maxScale = 3;
        this.scaleStep = 0.1;

        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        this.container = document.getElementById('tree-container');
        this.wrapper = document.getElementById('tree-wrapper');
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
        this.container.addEventListener('mouseup', (e) => this.endDrag(e));
        this.container.addEventListener('mouseleave', () => this.endDrag());

        // Touch events for mobile
        this.container.addEventListener('touchstart', (e) => this.startDrag(e));
        this.container.addEventListener('touchmove', (e) => this.drag(e));
        this.container.addEventListener('touchend', (e) => this.endDrag(e));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
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
        this.updateTransform();
        this.updateZoomDisplay();
    }

    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -this.scaleStep : this.scaleStep;
        this.setScale(this.scale + delta);
    }

    startDrag(e) {
        // Only start drag if not clicking on a node
        if (e.target.closest('.node')) {
            return;
        }

        this.isDragging = true;
        this.dragStarted = false;
        this.container.classList.add('dragging');
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        this.lastX = clientX;
        this.lastY = clientY;
        
        this.wrapper.style.transition = 'none';
        
        e.preventDefault();
    }

    drag(e) {
        if (!this.isDragging) return;
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const deltaX = clientX - this.lastX;
        const deltaY = clientY - this.lastY;
        
        // Mark drag as started if we've moved enough
        if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
            this.dragStarted = true;
        }
        
        this.translateX += deltaX;
        this.translateY += deltaY;
        
        this.constrainToBounds();
        
        this.lastX = clientX;
        this.lastY = clientY;
        
        this.updateTransform();
        
        e.preventDefault();
    }

    endDrag(e) {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        this.container.classList.remove('dragging');
        
        this.wrapper.style.transition = 'transform 0.3s ease';
        
        // Prevent click event if we were dragging
        if (this.dragStarted && e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        this.dragStarted = false;
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
            
            // Get SVG dimensions (use viewport dimensions as reasonable estimate)
            const svgWidth = window.innerWidth;
            const svgHeight = window.innerHeight;
            
            // Calculate scaled dimensions
            const scaledWidth = svgWidth * this.scale;
            const scaledHeight = svgHeight * this.scale;
            
            // Calculate boundaries - allow some off-screen movement but prevent complete disappearance
            const margin = 200; // Minimum amount of tree that must remain visible
            
            // For X axis (horizontal)
            let maxTranslateX, minTranslateX;
            if (scaledWidth > containerWidth) {
                // Tree is wider than container - allow navigation but keep some visible
                const halfExcess = (scaledWidth - containerWidth) / 2;
                maxTranslateX = halfExcess + margin;
                minTranslateX = -halfExcess - margin;
            } else {
                // Tree is smaller than container - allow some movement around center
                const allowedMovement = 300;
                maxTranslateX = allowedMovement;
                minTranslateX = -allowedMovement;
            }
            
            // For Y axis (vertical)
            let maxTranslateY, minTranslateY;
            if (scaledHeight > containerHeight) {
                // Tree is taller than container - allow navigation but keep some visible
                const halfExcess = (scaledHeight - containerHeight) / 2;
                maxTranslateY = halfExcess + margin;
                minTranslateY = -halfExcess - margin;
            } else {
                // Tree is smaller than container - allow some movement around center
                const allowedMovement = 300;
                maxTranslateY = allowedMovement;
                minTranslateY = -allowedMovement;
            }
            
            // Constrain translation
            if (isFinite(minTranslateX) && isFinite(maxTranslateX)) {
                this.translateX = Math.max(minTranslateX, Math.min(maxTranslateX, this.translateX));
            }
            if (isFinite(minTranslateY) && isFinite(maxTranslateY)) {
                this.translateY = Math.max(minTranslateY, Math.min(maxTranslateY, this.translateY));
            }
            
        } catch (e) {
            // If anything goes wrong, just don't constrain
            console.warn('Error in constrainToBounds:', e);
        }
    }
}

// Initialize the tree when the page loads
document.addEventListener('DOMContentLoaded', async function() {
    // Show loading message
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading';
    loadingDiv.innerHTML = '<p>Loading tree data...</p>';
    loadingDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 1001;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;
    document.body.appendChild(loadingDiv);
    
    try {
        // Load tree data from YAML file
        treeData = await loadTreeData();
        
        // Initialize the tree with loaded data
        const tree = new TreeDiagram(treeData);
        const motionControls = new TreeMotionControls(tree);
        
        // Connect expand/collapse all buttons
        document.getElementById('expandAll').addEventListener('click', () => {
            tree.expandAll();
        });
        
        document.getElementById('collapseAll').addEventListener('click', () => {
            tree.collapseAll();
        });
        
        // Dark mode toggle functionality
        const darkModeToggle = document.getElementById('darkModeToggle');
        const body = document.body;
        
        darkModeToggle.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            
            // Update button text
            if (body.classList.contains('dark-mode')) {
                darkModeToggle.textContent = 'Light Mode';
            } else {
                darkModeToggle.textContent = 'Dark Mode';
            }
        });
        
        // Right-click context menu removed to prevent users from modifying nodes
        
        // Remove loading message
        document.body.removeChild(loadingDiv);
        
    } catch (error) {
        console.error('Failed to initialize tree:', error);
        loadingDiv.innerHTML = '<p>Error loading tree data. Please check that tree-data.yaml exists and is properly formatted.</p>';
        loadingDiv.style.color = 'red';
    }
});

// Export for potential external use
window.TreeDiagram = TreeDiagram;
window.TreeMotionControls = TreeMotionControls;
window.loadTreeData = loadTreeData; 
