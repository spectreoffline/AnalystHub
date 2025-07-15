let treeData = null;

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
        throw error;
    }
}

class TreeDiagram {
    constructor(data) {
        this.data = data;
        this.margin = { top: 50, right: 50, bottom: 50, left: 125 };
        this.duration = 750;
        this.i = 0;
        
        this.init();
    }

    init() {
        this.width = window.innerWidth - this.margin.left - this.margin.right;
        this.height = window.innerHeight - this.margin.top - this.margin.bottom;

        this.svg = d3.select("#tree-svg")
            .attr("width", Math.max(window.innerWidth, 2000))
            .attr("height", Math.max(window.innerHeight, 1000));

        this.g = this.svg.append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        this.tree = d3.tree()
            .size([this.height, this.width])
            .separation(function(a, b) {
                return a.parent == b.parent ? 0.05 : 0.05;
            });

        this.root = d3.hierarchy(this.data, d => d.children);
        this.root.x0 = this.height / 2;
        this.root.y0 = 0;

        if (this.root.children && !this.root._children) {
            this.root._children = this.root.children.slice();
        }
        
        if (this.root.children) {
            this.root.children.forEach(d => this.collapse(d));
        }

        this.update(this.root);

        window.addEventListener('resize', () => {
            this.width = window.innerWidth - this.margin.left - this.margin.right;
            this.height = window.innerHeight - this.margin.top - this.margin.bottom;
            
            this.svg
                .attr("width", Math.max(window.innerWidth, 2000))
                .attr("height", Math.max(window.innerHeight, 1000));
            
            this.root.x0 = this.height / 2;
            this.update(this.root);
        });
    }

    collapseAll() {
        if (this.root._children) {
            this.root.children = this.root._children;
            this.root._children = null;
        }
        
        if (this.root.children) {
            this.root.children.forEach(d => this.collapse(d));
        }
        
        this.update(this.root);
    }

    collapse(d) {
        if (d.children) {
            d._children = d.children;
            d._children.forEach(child => this.collapse(child));
            d.children = null;
        }
    }

    update(source) {
        const tempTree = d3.tree()
            .size([this.height, this.width])
            .separation(function(a, b) {
                return a.parent == b.parent ? 0.05 : 0.05;
            });
        const tempTreeData = tempTree(this.root);
        const tempNodes = tempTreeData.descendants();
        
        tempNodes.forEach(d => d.y = d.depth * 180);
         
        const minX = Math.min(...tempNodes.map(d => d.x));
        const maxX = Math.max(...tempNodes.map(d => d.x));
        const minY = Math.min(...tempNodes.map(d => d.y));
        const maxY = Math.max(...tempNodes.map(d => d.y));
         
        const actualWidth = maxY - minY + 300;
        const actualHeight = maxX - minX + 100;
        
        const svgWidth = Math.max(window.innerWidth, actualWidth + this.margin.left + this.margin.right);
        const svgHeight = Math.max(window.innerHeight, actualHeight + this.margin.top + this.margin.bottom);
        
        this.svg
            .attr("width", svgWidth)
            .attr("height", svgHeight);
        
        this.tree.size([actualHeight, actualWidth])
            .separation(function(a, b) {
                return a.parent == b.parent ? 0.05 : 0.05;
            });
        
        const treeData = this.tree(this.root);
        const nodes = treeData.descendants();
        const links = treeData.descendants().slice(1);

        nodes.forEach(d => d.y = d.depth * 180);
        
        const rootNode = nodes.find(d => d.depth === 0);
        const rootX = rootNode ? rootNode.x : 0;
        
        nodes.forEach(d => {
            if (d.depth > 0) {
                const distanceFromRoot = d.x - rootX;
                d.x = rootX + (distanceFromRoot * 0.5);
            }
        });
          
        if (nodes.length > 0) {
            const currentMinX = Math.min(...nodes.map(d => d.x));
            const currentMinY = Math.min(...nodes.map(d => d.y));
             
            nodes.forEach(d => {
                d.x = d.x - currentMinX + 50;
                d.y = d.y - currentMinY + 50;
            });
        }

        const node = this.g.selectAll('g.node')
            .data(nodes, d => d.id || (d.id = ++this.i));

        const nodeEnter = node.enter().append('g')
            .attr('class', d => {
                let classes = 'node';
                if (d.depth === 0) classes += ' root';
                if (d.children || d._children || (d.data.children && d.data.children.length > 0)) classes += ' expandable';
                if (d._children) classes += ' collapsed';
                return classes;
            })
            .attr('transform', d => `translate(${source.y0},${source.x0})`);

        nodeEnter.filter(d => {
            const hasChildren = d.children || d._children || (d.data.children && d.data.children.length > 0);
            return hasChildren;
        })
            .append('circle')
            .attr('class', 'node-dot')
            .attr('r', 6)
            .attr('cx', 0)
            .attr('cy', 20)
            .style('fill', d => d._children ? '#fff' : '#4a90e2')
            .style('stroke', '#4a90e2')
            .style('stroke-width', 2)
            .style('cursor', 'pointer')
            .style('opacity', 1)
            .on('click', (event, d) => this.clickDot(event, d));

        nodeEnter.append('rect')
            .attr('class', 'text-background')
            .attr('fill', 'white')
            .attr('stroke', 'none')
            .attr('rx', 2)
            .attr('ry', 2)
            .style('opacity', 0.9);

        nodeEnter.append('text')
            .attr('dy', '0em')
            .attr('x', d => {
                const isExpandable = d.children || d._children || (d.data.children && d.data.children.length > 0);
                return isExpandable ? 0 : 0;
            })
            .attr('text-anchor', d => {
                const isExpandable = d.children || d._children || (d.data.children && d.data.children.length > 0);
                return isExpandable ? 'start' : 'middle';
            })
            .style('cursor', 'pointer')
            .on('click', (event, d) => this.clickText(event, d))
            .each(function(d) {
                const text = d3.select(this);
                const name = d.data.name;
                
                if (name.length > 60) {
                    const words = name.split(' ');
                    const lineHeight = 1.1;
                    let lineNumber = 0;
                    
                    text.text(null);
                    
                    const isExpandable = d.children || d._children || (d.data.children && d.data.children.length > 0);
                    const xPos = isExpandable ? 0 : 0;
                    let tspan = text.append('tspan')
                        .attr('x', xPos)
                        .attr('dy', lineNumber * lineHeight + 'em');
                    
                    let line = [];
                    words.forEach(word => {
                        line.push(word);
                        tspan.text(line.join(' '));
                        
                        if (tspan.node().getComputedTextLength() > 300) {
                            line.pop();
                            tspan.text(line.join(' '));
                            line = [word];
                            tspan = text.append('tspan')
                                .attr('x', xPos)
                                .attr('dy', ++lineNumber * lineHeight + 'em')
                                .text(word);
                        }
                    });
                } else {
                    text.text(name);
                }
            })
            .style('fill-opacity', 1e-6);

        const nodeUpdate = nodeEnter.merge(node);

        nodeUpdate.attr('class', d => {
            let classes = 'node';
            if (d.depth === 0) classes += ' root';
            if (d.children || d._children || (d.data.children && d.data.children.length > 0)) classes += ' expandable';
            if (d._children) classes += ' collapsed';
            return classes;
        });

        nodeUpdate.transition()
            .duration(this.duration)
            .ease(d3.easeCircleOut)
            .attr('transform', d => `translate(${d.y},${d.x})`);

        nodeUpdate.select('text')
            .transition()
            .duration(this.duration)
            .ease(d3.easeCircleOut)
            .style('fill-opacity', 1);

        nodeUpdate.select('.node-dot')
            .transition()
            .duration(this.duration)
            .ease(d3.easeCircleOut)
            .style('fill', d => d._children ? '#fff' : '#4a90e2')
            .style('opacity', 1);

        nodeUpdate.select('.text-background')
            .attr('x', function(d) {
                const textElement = d3.select(this.parentNode).select('text').node();
                if (textElement) {
                    const bbox = textElement.getBBox();
                    return bbox.x - 4;
                }
                const isExpandable = d.children || d._children || (d.data.children && d.data.children.length > 0);
                return isExpandable ? 6 : -25;
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
                    return bbox.width + 8;
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

        const nodeExit = node.exit().transition()
            .duration(this.duration)
            .ease(d3.easeCircleIn)
            .attr('transform', d => `translate(${source.y},${source.x})`)
            .remove();

        nodeExit.select('text')
            .style('fill-opacity', 1e-6);

        nodeExit.select('.text-background')
            .style('opacity', 1e-6);

        nodeExit.select('.node-dot')
            .style('opacity', 1e-6);

        const link = this.g.selectAll('path.link')
            .data(links, d => d.id);

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

        link.transition()
            .duration(this.duration)
            .ease(d3.easeCircleOut)
            .attr('d', d => this.diagonal(d, d.parent));

        link.exit().transition()
            .duration(this.duration)
            .ease(d3.easeCircleIn)
            .attr('d', d => {
                const o = { x: source.x, y: source.y };
                return this.diagonal(o, o);
            })
            .remove();

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

    clickDot(event, d) {
        event.stopPropagation();
        
        if (d.children || d._children || (d.data.children && d.data.children.length > 0)) {
            if (d.children) {
                d._children = d.children;
                d.children = null;
            } else {
                d.children = d._children;
                d._children = null;
            }
            this.update(d);
        }
    }

    clickText(event, d) {
        event.stopPropagation();
        this.showNodePopup(d);
    }

    showNodePopup(node) {
        const popup = new NodePopup();
        popup.show(node);
    }
}

class NodePopup {
    constructor() {
        this.overlay = document.getElementById('popup-overlay');
        this.title = document.getElementById('popup-title');
        this.description = document.getElementById('popup-description');
        this.closeBtn = document.getElementById('popup-close');
        
        this.init();
    }

    init() {
        this.closeBtn.addEventListener('click', () => {
            this.hide();
        });

        this.overlay.addEventListener('click', (event) => {
            if (event.target === this.overlay) {
                this.hide();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.overlay.classList.contains('active')) {
                this.hide();
            }
        });
    }

    show(node) {
        this.title.textContent = node.data.name;
        
        let description = '';
        
        if (node.data.description) {
            description = node.data.description;
        } else {
            description = 'No description available for this node.';
        }
        
        this.description.innerHTML = description;
        
        this.overlay.classList.add('active');
        document.body.classList.add('popup-active');
        
        setTimeout(() => {
            this.closeBtn.focus();
        }, 100);
    }

    hide() {
        this.overlay.classList.remove('active');
        document.body.classList.remove('popup-active');
    }
}

document.addEventListener('DOMContentLoaded', async function() {
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
        treeData = await loadTreeData();
        
        const tree = new TreeDiagram(treeData);
        
        document.getElementById('collapseAll').addEventListener('click', () => {
            tree.collapseAll();
        });
        
        const darkModeToggle = document.getElementById('darkModeToggle');
        const body = document.body;
        
        darkModeToggle.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            
            if (body.classList.contains('dark-mode')) {
                darkModeToggle.textContent = 'Light Mode';
            } else {
                darkModeToggle.textContent = 'Dark Mode';
            }
        });
        
        document.body.removeChild(loadingDiv);
        
    } catch (error) {
        console.error('Failed to initialize tree:', error);
        loadingDiv.innerHTML = '<p>Error loading tree data. Please check that tree-data.yaml exists and is properly formatted.</p>';
        loadingDiv.style.color = 'red';
    }
}); 
