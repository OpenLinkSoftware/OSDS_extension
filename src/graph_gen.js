class Graph_Block extends DataBlock {
    constructor(_baseURL, _text, _n3data) {
        super(_baseURL, _text);
        this.n3data = _n3data;
    }

    async to_html(bnode_types, start_id) {
        var html = null;
        var error = [];

        try {
            console.log('[OSDS Graph] to_html called with data:', this.n3data ? this.n3data.length : 0, 'items');
            if (this.n3data) {
                html = new Graph_Gen(this.baseURL, bnode_types).load(this.n3data);
                console.log('[OSDS Graph] Generated HTML length:', html ? html.length : 0);
            }
            return { start_id: 0, html, error };
        } catch (ex) {
            console.error('[OSDS Graph] Error:', ex);
            error.push(ex.toString());
            return { start_id: 0, html: null, error };
        }
    }
}

class Graph_Gen {
    constructor(_docURI, bnode_types, uimode) {
        this.docURI = _docURI;
        this.width = 800;
        this.height = 600;
        this.nodes = [];
        this.links = [];
        this.simulation = null;
    }

    load(n_data, start_id = 0, _base) {
        if (!n_data || n_data.length === 0) return "";

        // 1. Build Graph Data
        const nodeMap = new Map();
        const links = [];

        function getNode(id) {
            if (!nodeMap.has(id)) {
                nodeMap.set(id, { id: id, x: Math.random() * 800, y: Math.random() * 600, vx: 0, vy: 0 });
            }
            return nodeMap.get(id);
        }

        n_data.forEach(triple => {
            if (!triple || !triple.s) return;
            const source = getNode(triple.s);

            if (triple.props) {
                Object.entries(triple.props).forEach(([pred, objs]) => {
                    if (!objs || !Array.isArray(objs)) return;
                    objs.forEach(obj => {
                        if (!obj) return;
                        let targetId = obj.iri ? obj.iri : (obj.value || '');
                        // Truncate long literals
                        if (!obj.iri && targetId && targetId.length > 20) targetId = targetId.substring(0, 20) + "...";
                        if (!targetId) return;

                        const target = getNode(targetId);
                        links.push({ source: source, target: target, label: pred });
                    });
                });
            }
        });

        this.nodes = Array.from(nodeMap.values());
        this.links = links;

        // 2. Generate HTML container
        // We return a container with a canvas and a script to initialize the graph
        // Since we can't easily pass the object instance to the HTML string, we'll attach the data to the window or handle it differently.
        // Better approach for this extension: Return a placeholder div, and let panel.js call a render method.
        // However, the current architecture expects `load` to return HTML string.
        // So we will return a canvas and inline script (if CSP allows) or just the canvas and rely on panel.js to trigger the render.

        // To fit into the existing flow, I'll return a container ID. The actual rendering will need to be triggered separately or I can embed a small script if allowed.
        // Given CSP 'unsafe-inline' is allowed for scripts in manifest (checked earlier), I can try embedding a small init script, 
        // BUT `panel.js` is cleaner.

        // Let's generate a unique ID for this graph
        const graphId = "graph_" + Math.floor(Math.random() * 10000);

        // We'll store the graph data globally so the renderer can pick it up, or we can try to render immediately if the canvas exists.
        // Since `load` returns a string that gets inserted into innerHTML, the canvas won't exist yet.

        // Workaround: We will return the HTML for the canvas, and we'll attach a listener or use a global registry.
        if (!window.osdsGraphs) window.osdsGraphs = {};
        window.osdsGraphs[graphId] = this;

        return `
      <div class="graph-container" style="width:100%; height:600px; border:1px solid #ccc; position:relative;">
        <canvas id="${graphId}" width="${this.width}" height="${this.height}" style="background:white; cursor:move;"></canvas>
        <div style="position:absolute; top:10px; left:10px; background:rgba(255,255,255,0.8); padding:5px;">
          Nodes: ${this.nodes.length}, Edges: ${this.links.length} <br>
          <button class="graph-layout-btn" data-graph-id="${graphId}">Re-layout</button>
        </div>
      </div>
    `;
    }

    init(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        // Resize to container
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width || 800;
        this.canvas.height = rect.height || 600;
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        this.startSimulation();

        // Basic Dragging
        let isDragging = false;
        let draggedNode = null;

        this.canvas.onmousedown = (e) => {
            const pos = this.getMousePos(e);
            draggedNode = this.findNode(pos.x, pos.y);
            if (draggedNode) {
                isDragging = true;
                draggedNode.fx = draggedNode.x;
                draggedNode.fy = draggedNode.y;
            }
        };

        this.canvas.onmousemove = (e) => {
            if (isDragging && draggedNode) {
                const pos = this.getMousePos(e);
                draggedNode.fx = pos.x;
                draggedNode.fy = pos.y;
            }
        };

        this.canvas.onmouseup = () => {
            if (isDragging && draggedNode) {
                isDragging = false;
                draggedNode.fx = null;
                draggedNode.fy = null;
                draggedNode = null;
            }
        };
    }

    getMousePos(evt) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
        };
    }

    findNode(x, y) {
        return this.nodes.find(n => {
            const dx = x - n.x;
            const dy = y - n.y;
            return dx * dx + dy * dy < 100; // Radius 10
        });
    }

    startSimulation() {
        if (this.simulation) cancelAnimationFrame(this.simulation);

        const alpha = 1;
        const decay = 0.95;
        let currentAlpha = alpha;

        const step = () => {
            if (currentAlpha < 0.01) return;

            // Forces
            // 1. Repulsion
            for (let i = 0; i < this.nodes.length; i++) {
                for (let j = i + 1; j < this.nodes.length; j++) {
                    const a = this.nodes[i];
                    const b = this.nodes[j];
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const force = (5000 / (dist * dist)) * currentAlpha;
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;

                    a.vx -= fx;
                    a.vy -= fy;
                    b.vx += fx;
                    b.vy += fy;
                }
            }

            // 2. Attraction (Springs)
            this.links.forEach(link => {
                const dx = link.target.x - link.source.x;
                const dy = link.target.y - link.source.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = (dist - 100) * 0.05 * currentAlpha; // Rest length 100
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;

                link.source.vx += fx;
                link.source.vy += fy;
                link.target.vx -= fx;
                link.target.vy -= fy;
            });

            // 3. Center Gravity
            this.nodes.forEach(node => {
                const dx = this.width / 2 - node.x;
                const dy = this.height / 2 - node.y;
                node.vx += dx * 0.01 * currentAlpha;
                node.vy += dy * 0.01 * currentAlpha;

                // Apply Velocity
                if (node.fx === null || node.fx === undefined) {
                    node.x += node.vx;
                    node.y += node.vy;
                    node.vx *= 0.6; // Friction
                    node.vy *= 0.6;
                } else {
                    node.x = node.fx;
                    node.y = node.fy;
                    node.vx = 0;
                    node.vy = 0;
                }
            });

            currentAlpha *= decay;
            this.draw();
            this.simulation = requestAnimationFrame(step);
        };

        step();
    }

    draw() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw Edges
        this.ctx.strokeStyle = "#999";
        this.ctx.beginPath();
        this.links.forEach(link => {
            this.ctx.moveTo(link.source.x, link.source.y);
            this.ctx.lineTo(link.target.x, link.target.y);
        });
        this.ctx.stroke();

        // Draw Nodes
        this.nodes.forEach(node => {
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI);
            this.ctx.fillStyle = "#1976D2";
            this.ctx.fill();

            // Label
            this.ctx.fillStyle = "#333";
            this.ctx.font = "10px Arial";
            let label = node.id;
            // Simple label cleanup
            if (label.startsWith("http")) {
                try { label = new URL(label).pathname.split('/').pop() || label; } catch (e) { }
            }
            this.ctx.fillText(label, node.x + 8, node.y + 3);
        });
    }
}
