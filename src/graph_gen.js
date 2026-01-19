// RDF Knowledge Graph Visualization using D3.js (based on rdf_visualization.html)
class Graph_Gen {
    constructor(_docURI, bnode_types, uimode) {
        this.docURI = _docURI;
        this.width = 800;
        this.height = 650;
        this.nodes = [];
        this.links = [];
        this.simulation = null;
        this.namespaceMap = null;
        this.theme = 'light';
    }

    // Initialize namespace map (assumes Namespace class is available)
    initNamespaces() {
        if (typeof Namespace !== 'undefined') {
            const ns = new Namespace();
            this.namespaceMap = new Map();
            Object.keys(ns.ns_list).forEach(prefix => {
                const uri = ns.ns_list[prefix];
                if (Array.isArray(uri)) {
                    uri.forEach(u => this.namespaceMap.set(u, prefix));
                } else {
                    this.namespaceMap.set(uri, prefix);
                }
            });
            Object.keys(ns.ns_list_colon).forEach(prefix => {
                this.namespaceMap.set(ns.ns_list_colon[prefix], prefix);
            });
        } else {
            this.namespaceMap = new Map();
        }
    }

    // Compact IRI to prefix:local format
    compactIri(iri) {
        if (!this.namespaceMap) this.initNamespaces();
        
        for (const [nsUri, prefix] of this.namespaceMap) {
            if (iri.startsWith(nsUri)) {
                const localPart = iri.slice(nsUri.length);
                return `${prefix}:${localPart}`;
            }
        }
        
        const hashIdx = iri.lastIndexOf("#");
        if (hashIdx >= 0 && hashIdx < iri.length - 1) return iri.slice(hashIdx + 1);
        const slashIdx = iri.lastIndexOf("/");
        if (slashIdx >= 0 && slashIdx < iri.length - 1) return iri.slice(slashIdx + 1);
        return iri;
    }

    // Determine group/category for IRI
    groupForIri(iri) {
        if (!this.namespaceMap) this.initNamespaces();
        
        // Try to match by namespace prefix
        for (const [nsUri, prefix] of this.namespaceMap) {
            if (iri.startsWith(nsUri)) {
                return prefix;
            }
        }
        
        // For local/relative IRIs, try to extract a meaningful group from the path
        try {
            const url = new URL(iri);
            const path = url.pathname;
            
            // Extract filename without extension (e.g., /data/people.ttl -> people)
            const lastSegment = path.split('/').filter(s => s).pop();
            if (lastSegment) {
                const filenameWithoutExt = lastSegment.replace(/\.(ttl|rdf|jsonld|xml|n3)$/i, '');
                if (filenameWithoutExt && filenameWithoutExt !== 'index') {
                    return filenameWithoutExt;
                }
            }
            
            // Use domain as group for different hosts
            if (url.host) {
                return url.host.replace(/^www\./, '').split('.')[0];
            }
        } catch (e) {
            // Not a valid URL, might be a relative IRI or blank node
        }
        
        // Fallback: generic resource
        return "resource";
    }

    // Build graph from n3_data structure
    buildGraphFromN3Data(n3_data, baseUrl) {
        const nodesById = new Map();
        const triples = [];

        const resolveRelativeIri = (iri, base) => {
            try {
                if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(iri)) return iri;
                return new URL(iri, base).toString();
            } catch {
                return iri;
            }
        };

        const upsertNode = (term, termType = 'iri') => {
            if (termType === 'literal') {
                if (!term) return null;
                const id = `literal:${term}`;
                if (!nodesById.has(id)) {
                    nodesById.set(id, {
                        id,
                        iri: null,
                        label: String(term).length > 48 ? String(term).slice(0, 45) + '…' : String(term),
                        group: 'literal',
                        size: 10,
                        shape: 'rect'
                    });
                }
                return nodesById.get(id);
            }

            // IRI node - handle empty string as document base
            const resolved = term ? resolveRelativeIri(term, baseUrl) : baseUrl;
            const id = `iri:${resolved}`;
            if (!nodesById.has(id)) {
                nodesById.set(id, {
                    id,
                    iri: resolved,
                    label: term ? this.compactIri(resolved) : '(document)',
                    group: this.groupForIri(resolved),
                    size: 12,
                    shape: 'circle'
                });
            }
            return nodesById.get(id);
        };

        for (const entry of n3_data) {
            const subjectIri = entry.s;
            const subjectNode = upsertNode(subjectIri, 'iri');
            
            if (!entry.props) continue;

            for (const [predicateIri, propValues] of Object.entries(entry.props)) {
                for (const obj of propValues) {
                    let objectNode = null;
                    let predicate = null;

                    if (obj.iri) {
                        objectNode = upsertNode(obj.iri, 'iri');
                    } else if (obj.value !== undefined) {
                        objectNode = upsertNode(obj.value, 'literal');
                    } else {
                        continue;
                    }

                    predicate = {
                        type: 'iri',
                        value: predicateIri,
                        display: this.compactIri(predicateIri),
                    };

                    triples.push({
                        subject: { type: 'iri', value: subjectIri, display: this.compactIri(subjectIri) },
                        predicate,
                        object: obj.iri 
                            ? { type: 'iri', value: obj.iri, display: this.compactIri(obj.iri) }
                            : { type: 'literal', value: obj.value, display: String(obj.value) },
                    });
                }
            }
        }

        const links = [];
        for (const t of triples) {
            const s = upsertNode(t.subject.value, 'iri');
            const o = t.object.type === 'iri' ? upsertNode(t.object.value, 'iri') : upsertNode(t.object.value, 'literal');
            const p = t.predicate;
            if (!s || !o || !p) continue;

            const pIri = resolveRelativeIri(p.value, baseUrl);
            const pLabel = p.display || p.value;
            links.push({
                source: s.id,
                target: o.id,
                predicateIri: pIri,
                predicateLabel: pLabel,
                predicateQname: p.display,
                key: `${s.id}__${pIri}__${o.id}`,
            });
        }

        // Calculate node importance based on connectivity
        const nodeDegree = new Map();
        for (const link of links) {
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            nodeDegree.set(sourceId, (nodeDegree.get(sourceId) || 0) + 1);
            nodeDegree.set(targetId, (nodeDegree.get(targetId) || 0) + 1);
        }

        // Identify important nodes (classes/types that are referenced by rdf:type)
        const typeTargets = new Set(
            triples
                .filter((t) => t.predicate.display === 'rdf:type' || t.predicate.value.endsWith('#type'))
                .filter((t) => t.object.type === 'iri')
                .map((t) => resolveRelativeIri(t.object.value, baseUrl))
        );

        // Set node sizes based on importance
        for (const n of nodesById.values()) {
            if (n.group === 'literal') {
                // Literals are always small
                n.size = 8;
            } else if (n.label === '(document)') {
                // Document node is important
                n.size = 20;
            } else if (n.iri && typeTargets.has(n.iri)) {
                // Classes/Types referenced by rdf:type are important
                n.size = 18;
            } else {
                // Scale by connectivity: more connected nodes are larger
                const degree = nodeDegree.get(n.id) || 0;
                if (degree >= 10) {
                    n.size = 16; // Highly connected
                } else if (degree >= 5) {
                    n.size = 14; // Well connected
                } else {
                    n.size = 12; // Normal
                }
            }
        }

        return { nodes: Array.from(nodesById.values()), links };
    }

    load(n_data, start_id = 0, _base) {
        if (!n_data || n_data.length === 0) return "";

        this.initNamespaces();

        const baseUrl = _base || window.location.href;
        const fullGraph = this.buildGraphFromN3Data(n_data, baseUrl);

        if (fullGraph.nodes.length === 0 || fullGraph.links.length === 0) {
            return `<div style="padding:20px; color:#d97706; background:#fef3c7; border:1px solid #fbbf24; border-radius:8px;">
                <strong>No graph data</strong><br>
                The parser returned 0 nodes or 0 links.
            </div>`;
        }

        const graphId = "graph_" + Math.floor(Math.random() * 10000);
        
        if (!window.osdsGraphs) window.osdsGraphs = {};
        window.osdsGraphs[graphId] = {
            data: fullGraph,
            baseUrl: baseUrl,
            generator: this
        };

        return `
            <div id="${graphId}" class="rdf-graph-container" style="width:100%; height:${this.height}px; position:relative; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
                <div class="graph-header" style="position:absolute; top:10px; left:10px; z-index:10; background:rgba(255,255,255,0.9); padding:8px 12px; border-radius:6px; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                    <div style="font-size:12px; font-weight:600; color:#1e293b;">RDF Knowledge Graph</div>
                    <div style="font-size:11px; color:#64748b;">Nodes: ${fullGraph.nodes.length} | Edges: ${fullGraph.links.length}</div>
                </div>
                <div class="graph-controls" style="position:absolute; top:10px; right:10px; z-index:10; display:flex; gap:6px;">
                    <button class="graph-fullscreen-btn" data-graph-id="${graphId}" style="padding:6px 12px; background:rgba(255,255,255,0.9); border:1px solid #e2e8f0; border-radius:6px; cursor:pointer; font-size:11px; font-weight:500; color:#475569;" title="Fullscreen">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                        </svg>
                    </button>
                    <button class="graph-center-btn" data-graph-id="${graphId}" style="padding:6px 12px; background:rgba(255,255,255,0.9); border:1px solid #e2e8f0; border-radius:6px; cursor:pointer; font-size:11px; font-weight:500; color:#475569;" title="Center graph">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M15 10l4.5-4.5M19.5 5.5h-4v-4M9 14l-4.5 4.5M4.5 18.5h4v4" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                    </button>
                    <button class="graph-theme-btn" data-graph-id="${graphId}" style="padding:6px 12px; background:rgba(255,255,255,0.9); border:1px solid #e2e8f0; border-radius:6px; cursor:pointer; font-size:11px; font-weight:500; color:#475569;" title="Toggle theme">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.36-6.36-1.42 1.42M7.05 16.95l-1.42 1.42m0-11.84 1.42 1.42m11.31 11.31 1.42 1.42" />
                            <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
                        </svg>
                    </button>
                    <button class="graph-settings-btn" data-graph-id="${graphId}" style="padding:6px 12px; background:rgba(255,255,255,0.9); border:1px solid #e2e8f0; border-radius:6px; cursor:pointer; font-size:11px; font-weight:500; color:#475569;" title="Graph settings">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z" />
                            <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                    </button>
                </div>
                <svg class="graph-svg" style="width:100%; height:100%; background:#f8fafc;"></svg>
                <div class="graph-settings-panel" style="display:none; position:absolute; right:10px; top:60px; z-index:20; width:min(380px,calc(100% - 20px)); background:rgba(255,255,255,0.95); border:1px solid #e2e8f0; border-radius:12px; box-shadow:0 10px 25px -12px rgba(0,0,0,0.35); backdrop-filter:blur(8px);">
                    <div class="settings-header" style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid #e2e8f0; cursor:move;">
                        <div style="font-size:13px; font-weight:600; color:#1e293b;">Graph Settings</div>
                        <button class="settings-close-btn" style="padding:4px; background:none; border:none; cursor:pointer; color:#64748b; border-radius:6px;" title="Close">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div class="settings-body" style="padding:16px; max-height:min(70vh,500px); overflow-y:auto;">
                        <!-- Physics -->
                        <div style="margin-bottom:20px;">
                            <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#64748b; margin-bottom:12px;">Physics</div>
                            <div style="margin-bottom:12px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                    <label style="font-size:12px; color:#334155;">Charge strength</label>
                                    <span class="charge-value" style="font-size:11px; color:#64748b; font-variant-numeric:tabular-nums;">-450</span>
                                </div>
                                <input type="range" class="charge-slider" min="-1200" max="-50" step="10" value="-450" style="width:95%; accent-color:#818cf8;">
                            </div>
                            <div>
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                    <label style="font-size:12px; color:#334155;">Link distance</label>
                                    <span class="link-distance-value" style="font-size:11px; color:#64748b; font-variant-numeric:tabular-nums;">140</span>
                                </div>
                                <input type="range" class="link-distance-slider" min="40" max="320" step="5" value="140" style="width:95%; accent-color:#818cf8;">
                            </div>
                        </div>
                        <!-- Filtering -->
                        <div style="margin-bottom:20px;">
                            <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#64748b; margin-bottom:12px;">Faceted Filtering</div>
                            <div class="filter-container" style="display:grid; grid-template-columns:repeat(2,1fr); gap:8px;"></div>
                        </div>
                        <!-- Legend -->
                        <div style="margin-bottom:16px;">
                            <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#64748b; margin-bottom:12px;">Color Legend</div>
                            <div class="legend-container" style="display:grid; grid-template-columns:repeat(2,1fr); gap:8px;"></div>
                        </div>
                        <!-- Tips -->
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:6px 12px; box-sizing:border-box; overflow:hidden;">
                            <div style="font-size:11px; font-weight:600; color:#1e293b; margin:0 0 8px 0;">Tips</div>
                            <div style="font-size:11px; color:#475569; line-height:1.6;">
                                <div style="margin:0 0 4px 0;">• Drag a node to pin it. Double-click to release.</div>
                                <div style="margin:0 0 4px 0;">• Mouse wheel to zoom. Drag background to pan.</div>
                                <div style="margin:0;">• Click nodes to open IRIs in new tab.</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="graph-tooltip" style="position:fixed; display:none; z-index:50; pointer-events:none; max-width:400px; background:rgba(255,255,255,0.95); padding:8px 12px; border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.15); font-size:11px; color:#1e293b;"></div>
            </div>
        `;
    }

    init(containerId) {
        
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('[Graph_Gen] Container not found:', containerId);
            return;
        }

        const graphData = window.osdsGraphs && window.osdsGraphs[containerId];
        if (!graphData) {
            console.error('[Graph_Gen] Graph data not found for:', containerId);
            return;
        }

        this.renderD3Graph(container, graphData.data, graphData.baseUrl);
    }

    renderD3Graph(container, fullGraph, baseUrl) {
        if (typeof d3 === 'undefined') {
            console.error('[Graph_Gen] D3.js not loaded!');
            container.innerHTML = '<div style="padding:20px; color:#dc2626;">D3.js library required for graph visualization</div>';
            return;
        }

        const svg = d3.select(container).select('svg.graph-svg');
        const tooltip = d3.select(container).select('.graph-tooltip');
        
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        // Clear any existing SVG content
        svg.selectAll('*').remove();

        // Color palette for groups
        const defaultColors = [
            "#a78bfa", "#22c55e", "#60a5fa", "#f59e0b", "#34d399",
            "#f472b6", "#fb7185", "#f97316", "#38bdf8", "#cbd5e1",
            "#eab308", "#a3e635", "#06b6d4", "#ec4899", "#8b5cf6"
        ];

        const allGroups = Array.from(new Set(fullGraph.nodes.map(n => n.group))).sort();
        const groupColor = new Map();
        let colorIndex = 0;
        allGroups.forEach(g => {
            groupColor.set(g, defaultColors[colorIndex % defaultColors.length]);
            colorIndex++;
        });

        const colorForGroup = (g) => groupColor.get(g) || "#94a3b8";

        // Setup SVG
        const defs = svg.append("defs");
        defs.append("marker")
            .attr("id", `arrow-${container.id}`)
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 25)
            .attr("refY", 0)
            .attr("markerWidth", 4)
            .attr("markerHeight", 4)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", "rgba(148,163,184,0.8)");

        const gRoot = svg.append("g");

        // Zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.2, 4])
            .on("zoom", (event) => {
                gRoot.attr("transform", event.transform);
            });

        svg.call(zoom);

        // Simulation
        let nodes = fullGraph.nodes.map(d => ({ ...d }));
        let links = fullGraph.links.map(d => ({ ...d }));
        
        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links)
                .id(d => d.id)
                .distance(d => {
                    const source = nodes.find(n => n.id === d.source.id || n.id === d.source);
                    const target = nodes.find(n => n.id === d.target.id || n.id === d.target);
                    if (source?.group === 'literal' || target?.group === 'literal') {
                        return 80;
                    }
                    return 140;
                })
                .strength(0.9)
            )
            .force("charge", d3.forceManyBody().strength(d => -450 * (d.size / 13)))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collision", d3.forceCollide().radius(d => d.size + 12).iterations(3))
            .force("x", d3.forceX(width / 2).strength(0.05))
            .force("y", d3.forceY(height / 2).strength(0.05))
            .alphaDecay(0.015);

        // Layers
        const linkLayer = gRoot.append("g").attr("class", "links");
        const iconLayer = gRoot.append("g").attr("class", "predicate-icons");
        const nodeLayer = gRoot.append("g").attr("class", "nodes");

        // Tooltip functions (must be declared before use)
        const showTooltip = (title, sub, x, y) => {
            tooltip.html(`<div style="font-weight:600;">${title}</div><div style="color:#64748b; margin-top:2px;">${sub}</div>`)
                .style("display", "block")
                .style("left", `${x + 12}px`)
                .style("top", `${y + 12}px`);
        };

        const hideTooltip = () => {
            tooltip.style("display", "none");
        };

        // Render links with hover effects
        let linkSel = linkLayer.selectAll("path")
            .data(links, d => d.key)
            .join("path")
            .attr("stroke", "rgba(226,232,240,0.55)")
            .attr("stroke-width", 1.5)
            .attr("fill", "none")
            .attr("marker-end", `url(#arrow-${container.id})`)
            .style("opacity", 0.7)
            .on("mouseenter", function() {
                d3.select(this)
                    .attr("stroke-width", 2.5)
                    .style("opacity", 1);
            })
            .on("mouseleave", function() {
                d3.select(this)
                    .attr("stroke-width", 1.5)
                    .style("opacity", 0.7);
            });

        // Function to select icon for predicate
        const iconForPredicate = (label) => {
            const lowerLabel = label ? label.toLowerCase() : '';
            
            if (lowerLabel.includes('name')) {
                return "M12 2a5 5 0 0 1 5 5c0 2-1.2 3.7-2.9 4.5A7 7 0 0 1 19 19v3H5v-3a7 7 0 0 1 4.9-7.5A5 5 0 0 1 12 2Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z";
            }
            if (lowerLabel.includes('label')) {
                return "M4 4h16v2H4V4zm0 6h16v2H4v-2zm0 6h10v2H4v-2z";
            }
            if (lowerLabel.includes('type')) {
                return "M12 3l8 5v8l-8 5-8-5V8l8-5Zm0 2.2L6 8v8l6 3.8L18 16V8l-6-2.8Z";
            }
            if (lowerLabel.includes('url') || lowerLabel.includes('link')) {
                return "M10.6 13.4a1 1 0 0 0 0 1.2l.2.2a3 3 0 0 0 4.2 0l3.6-3.6a3 3 0 0 0 0-4.2l-.2-.2a3 3 0 0 0-4.2 0l-1 1 1.4 1.4 1-1a1 1 0 0 1 1.4 0l.2.2a1 1 0 0 1 0 1.4L13.8 13a1 1 0 0 1-1.4 0l-.2-.2a1 1 0 0 0-1.6.6Z";
            }
            
            // Fallback generic link icon
            return "M10.6 13.4a1 1 0 0 0 0 1.2l.2.2a3 3 0 0 0 4.2 0l3.6-3.6a3 3 0 0 0 0-4.2l-.2-.2a3 3 0 0 0-4.2 0l-1 1 1.4 1.4 1-1a1 1 0 0 1 1.4 0l.2.2a1 1 0 0 1 0 1.4L13.8 13a1 1 0 0 1-1.4 0l-.2-.2a1 1 0 0 0-1.6.6ZM13.4 10.6a1 1 0 0 0 0-1.2l-.2-.2a3 3 0 0 0-4.2 0L5.4 12.8a3 3 0 0 0 0 4.2l.2.2a3 3 0 0 0 4.2 0l1-1-1.4-1.4-1 1a1 1 0 0 1-1.4 0l-.2-.2a1 1 0 0 1 0-1.4L10.2 11a1 1 0 0 1 1.4 0l.2.2a1 1 0 0 0 1.6-.6Z";
        };

        // Render predicate icons (clickable)
        let iconSel = iconLayer.selectAll("a")
            .data(links, d => d.key)
            .join(
                enter => {
                    const a = enter.append("a")
                        .attr("target", "_blank")
                        .attr("rel", "noopener")
                        .style("cursor", "pointer")
                        .on("mouseenter", (event, d) => {
                            const iri = d.predicateIri || d.predicateLabel;
                            showTooltip(
                                d.predicateLabel || 'Predicate',
                                iri,
                                event.clientX,
                                event.clientY
                            );
                        })
                        .on("mousemove", (event) => {
                            tooltip.style("left", `${event.clientX + 12}px`)
                                .style("top", `${event.clientY + 12}px`);
                        })
                        .on("mouseleave", hideTooltip);

                    a.append("circle")
                        .attr("r", 10)
                        .attr("fill", "rgba(255,255,255,0.95)")
                        .attr("stroke", "rgba(15,23,42,0.25)")
                        .attr("stroke-width", 1);

                    a.append("path")
                        .attr("d", d => iconForPredicate(d.predicateLabel))
                        .attr("transform", "translate(-6,-6) scale(0.5)")
                        .attr("fill", "rgba(15,23,42,0.65)");

                    return a;
                }
            )
            .attr("href", d => d.predicateIri || "#");

        const nodeLabel = (n) => {
            if (n.group === "literal") {
                return n.label.length > 48 ? n.label.slice(0, 45) + "…" : n.label;
            }
            const base = n.label || (n.iri ? n.iri : n.id);
            return base.length > 30 ? base.slice(0, 27) + "…" : base;
        };

        // Render nodes with enhanced effects
        let nodeSel = nodeLayer.selectAll("g")
            .data(nodes, d => d.id)
            .join(
                enter => {
                    const g = enter.append("g")
                        .attr("class", "node")
                        .style("opacity", 0);
                    
                    // Smooth fade-in animation
                    g.transition()
                        .duration(600)
                        .style("opacity", 1);
                    
                    return g;
                }
            )
            .style("cursor", d => d.iri ? "pointer" : "default")
            .on("click", (event, d) => {
                if (event.defaultPrevented) return;
                if (d.iri) window.open(d.iri, "_blank", "noopener");
            })
            .on("mouseenter", (event, d) => {
                // Highlight connected nodes
                const connectedIds = new Set();
                links.forEach(link => {
                    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                    if (sourceId === d.id) connectedIds.add(targetId);
                    if (targetId === d.id) connectedIds.add(sourceId);
                });
                
                nodeSel.style("opacity", n => 
                    n.id === d.id || connectedIds.has(n.id) ? 1 : 0.2
                );
                
                linkSel.style("opacity", l => {
                    const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
                    const targetId = typeof l.target === 'object' ? l.target.id : l.target;
                    return sourceId === d.id || targetId === d.id ? 1 : 0.1;
                });
                
                showTooltip(
                    d.group === "literal" ? "Literal" : d.label,
                    d.iri ? d.iri : d.label,
                    event.clientX,
                    event.clientY
                );
            })
            .on("mousemove", (event) => {
                tooltip.style("left", `${event.clientX + 12}px`)
                    .style("top", `${event.clientY + 12}px`);
            })
            .on("mouseleave", () => {
                // Restore opacity
                nodeSel.style("opacity", 1);
                linkSel.style("opacity", 0.7);
                hideTooltip();
            })
            .on("dblclick", (event, d) => {
                d.fx = null;
                d.fy = null;
                d._pinned = false;
                simulation.alpha(0.25).restart();
            })
            .call(d3.drag()
                .on("start", (event, d) => {
                    if (!event.active) simulation.alphaTarget(0.25).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                    d._pinned = true;
                })
                .on("drag", (event, d) => {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on("end", (event) => {
                    if (!event.active) simulation.alphaTarget(0);
                })
            );

        // Add shapes to nodes with glow effect
        nodeSel.each(function(d) {
            const g = d3.select(this);
            
            // Glow ring for circles (behind main shape)
            if (d.shape !== 'rect') {
                g.append("circle")
                    .attr("r", d.size + 4)
                    .attr("fill", colorForGroup(d.group))
                    .attr("opacity", 0.15)
                    .attr("class", "glow-ring");
            }
            
            if (d.shape === 'rect') {
                g.append("rect")
                    .attr("x", -d.size * 2)
                    .attr("y", -d.size)
                    .attr("width", d.size * 4)
                    .attr("height", d.size * 2)
                    .attr("rx", 3)
                    .attr("fill", colorForGroup(d.group))
                    .attr("stroke", "rgba(226,232,240,0.55)")
                    .attr("stroke-width", 1.5)
                    .attr("opacity", 0.9);
            } else {
                g.append("circle")
                    .attr("r", d.size)
                    .attr("fill", colorForGroup(d.group))
                    .attr("stroke", d._pinned ? "rgba(255,215,0,0.9)" : "rgba(226,232,240,0.55)")
                    .attr("stroke-width", d._pinned ? 3 : 1.5)
                    .attr("opacity", 0.95)
                    .style("filter", "drop-shadow(0px 2px 4px rgba(0,0,0,0.15))");
            }
            
            g.append("text")
                .attr("x", d.size + 8)
                .attr("y", 4)
                .attr("fill", "rgba(15,23,42,0.85)")
                .attr("font-size", d.group === 'literal' ? 10 : 12)
                .attr("font-weight", d.size > 15 ? 600 : 500)
                .style("text-shadow", "0px 1px 2px rgba(255,255,255,0.8)")
                .text(nodeLabel(d));
        });

        // Simulation tick
        simulation.on("tick", () => {
            linkSel.attr("d", d => {
                const sx = d.source.x;
                const sy = d.source.y;
                const tx = d.target.x;
                const ty = d.target.y;
                return `M${sx},${sy}L${tx},${ty}`;
            });

            // Position predicate icons at link midpoints
            iconSel.attr("transform", d => {
                const mx = (d.source.x + d.target.x) / 2;
                const my = (d.source.y + d.target.y) / 2;
                return `translate(${mx},${my})`;
            });

            nodeSel.attr("transform", d => `translate(${d.x},${d.y})`);
        });

        // Controls
        const fullscreenBtn = container.querySelector('.graph-fullscreen-btn');
        if (fullscreenBtn) {
            let isExpanded = false;
            let originalStyle = null;
            
            const expandContainer = () => {
                // Save original styles
                originalStyle = {
                    position: container.style.position || '',
                    width: container.style.width || '',
                    height: container.style.height || '',
                    top: container.style.top || '',
                    left: container.style.left || '',
                    right: container.style.right || '',
                    bottom: container.style.bottom || '',
                    zIndex: container.style.zIndex || '',
                    borderRadius: container.style.borderRadius || '',
                    border: container.style.border || '',
                    overflow: container.style.overflow || ''
                };
                
                // Apply fullscreen styles
                container.style.position = 'fixed';
                container.style.top = '0';
                container.style.left = '0';
                container.style.right = '0';
                container.style.bottom = '0';
                container.style.width = '100vw';
                container.style.height = '100vh';
                container.style.zIndex = '2147483647';
                container.style.borderRadius = '0';
                container.style.border = 'none';
                container.style.overflow = 'hidden';
                
                isExpanded = true;
                fullscreenBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </svg>`;
                fullscreenBtn.title = "Exit fullscreen";
                
                // Hide settings panel if open
                const settingsPanel = container.querySelector('.graph-settings-panel');
                if (settingsPanel && settingsPanel.style.display === 'block') {
                    settingsPanel.style.display = 'none';
                }
                
                // Force reflow before recalculation
                void container.offsetHeight;
                
                // Recalculate graph dimensions with multiple attempts
                const recalculate = (attempt = 1) => {
                    const newWidth = container.clientWidth;
                    const newHeight = container.clientHeight;
                    
                    if ((newWidth < 100 || newHeight < 100) && attempt < 5) {
                        // Dimensions not yet updated, retry
                        setTimeout(() => recalculate(attempt + 1), 100);
                        return;
                    }
                    
                    if (newWidth > 100 && newHeight > 100) {
                        simulation.force("center", d3.forceCenter(newWidth / 2, newHeight / 2));
                        simulation.force("x", d3.forceX(newWidth / 2).strength(0.05));
                        simulation.force("y", d3.forceY(newHeight / 2).strength(0.05));
                        simulation.alpha(0.5).restart();
                    } else {
                        console.warn('[Graph_Gen] Failed to get valid dimensions after', attempt, 'attempts');
                    }
                };
                
                recalculate();
            };
            
            const collapseContainer = () => {
                if (originalStyle) {
                    Object.keys(originalStyle).forEach(key => {
                        container.style[key] = originalStyle[key];
                    });
                }
                
                isExpanded = false;
                fullscreenBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>`;
                fullscreenBtn.title = "Fullscreen";
                
                // Force reflow
                void container.offsetHeight;
                
                // Recalculate dimensions
                setTimeout(() => {
                    const newWidth = container.clientWidth;
                    const newHeight = container.clientHeight;
                    simulation.force("center", d3.forceCenter(newWidth / 2, newHeight / 2));
                    simulation.force("x", d3.forceX(newWidth / 2).strength(0.05));
                    simulation.force("y", d3.forceY(newHeight / 2).strength(0.05));
                    simulation.alpha(0.3).restart();
                }, 100);
            };
            
            fullscreenBtn.addEventListener('click', () => {
                if (!isExpanded) {
                    // Try native fullscreen first with timeout fallback
                    let fullscreenResolved = false;
                    
                    if (container.requestFullscreen && typeof container.requestFullscreen === 'function') {
                        try {
                            const result = container.requestFullscreen();
                            
                            if (result && typeof result.then === 'function') {
                                // Set timeout: if Promise doesn't resolve in 500ms, use CSS fallback
                                const timeoutId = setTimeout(() => {
                                    if (!fullscreenResolved) {
                                        expandContainer();
                                    }
                                }, 200);
                                
                                result
                                    .then(() => {
                                        fullscreenResolved = true;
                                        clearTimeout(timeoutId);
                                        isExpanded = true;
                                        fullscreenBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                                        </svg>`;
                                        fullscreenBtn.title = "Exit fullscreen";
                                        
                                        // Recalculate for native fullscreen
                                        setTimeout(() => {
                                            const newWidth = container.clientWidth;
                                            const newHeight = container.clientHeight;
                                            simulation.force("center", d3.forceCenter(newWidth / 2, newHeight / 2));
                                            simulation.force("x", d3.forceX(newWidth / 2).strength(0.05));
                                            simulation.force("y", d3.forceY(newHeight / 2).strength(0.05));
                                            simulation.alpha(0.5).restart();
                                        }, 100);
                                    })
                                    .catch((err) => {
                                        fullscreenResolved = true;
                                        clearTimeout(timeoutId);
                                        expandContainer();
                                    });
                            } else {
                                expandContainer();
                            }
                        } catch (err) {
                            console.log('[Graph_Gen] requestFullscreen threw error:', err.message);
                            expandContainer();
                        }
                    } else {
                        expandContainer();
                    }
                } else {
                    if (document.fullscreenElement === container) {
                        document.exitFullscreen();
                    } else {
                        collapseContainer();
                    }
                }
            });
            
            // Update button icon when fullscreen changes (for native fullscreen)
            document.addEventListener('fullscreenchange', () => {
                if (document.fullscreenElement === container) {
                    isExpanded = true;
                    fullscreenBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                    </svg>`;
                    fullscreenBtn.title = "Exit fullscreen";
                } else if (isExpanded && document.fullscreenElement !== container) {
                    collapseContainer();
                }
            });
        }

        const centerBtn = container.querySelector('.graph-center-btn');
        if (centerBtn) {
            centerBtn.addEventListener('click', () => {
                svg.transition()
                    .duration(750)
                    .call(zoom.transform, d3.zoomIdentity);
                simulation.alpha(0.3).restart();
            });
        }

        const themeBtn = container.querySelector('.graph-theme-btn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                this.theme = this.theme === 'light' ? 'dark' : 'light';
                const isDark = this.theme === 'dark';
                
                svg.style("background", isDark ? "#0f172a" : "#f8fafc");
                linkSel.attr("stroke", isDark ? "rgba(100,116,139,0.65)" : "rgba(226,232,240,0.55)");
                defs.select("marker path").attr("fill", isDark ? "rgba(100,116,139,0.75)" : "rgba(226,232,240,0.65)");
                nodeSel.selectAll("text").attr("fill", isDark ? "rgba(226,232,240,0.9)" : "rgba(15,23,42,0.85)");
                nodeSel.selectAll("circle:not(.glow-ring)").attr("stroke", d => d._pinned ? "rgba(255,215,0,0.9)" : (isDark ? "rgba(100,116,139,0.65)" : "rgba(226,232,240,0.55)"));
                nodeSel.selectAll("rect").attr("stroke", isDark ? "rgba(100,116,139,0.65)" : "rgba(226,232,240,0.55)");
            });
        }

        // Settings panel
        const settingsBtn = container.querySelector('.graph-settings-btn');
        const settingsPanel = container.querySelector('.graph-settings-panel');
        const settingsCloseBtn = container.querySelector('.settings-close-btn');
        
        if (settingsBtn && settingsPanel) {
            settingsBtn.addEventListener('click', () => {
                settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
            });
        }
        
        if (settingsCloseBtn && settingsPanel) {
            settingsCloseBtn.addEventListener('click', () => {
                settingsPanel.style.display = 'none';
            });
        }

        // Settings controls
        const chargeSlider = container.querySelector('.charge-slider');
        const chargeValue = container.querySelector('.charge-value');
        const linkDistanceSlider = container.querySelector('.link-distance-slider');
        const linkDistanceValue = container.querySelector('.link-distance-value');

        if (chargeSlider && chargeValue) {
            chargeSlider.addEventListener('input', (e) => {
                const val = +e.target.value;
                chargeValue.textContent = val;
                simulation.force("charge", d3.forceManyBody().strength(d => val * (d.size / 13)));
                simulation.alpha(0.3).restart();
            });
        }

        if (linkDistanceSlider && linkDistanceValue) {
            linkDistanceSlider.addEventListener('input', (e) => {
                const val = +e.target.value;
                linkDistanceValue.textContent = val;
                simulation.force("link", d3.forceLink(links)
                    .id(d => d.id)
                    .distance(d => {
                        const source = nodes.find(n => n.id === d.source.id || n.id === d.source);
                        const target = nodes.find(n => n.id === d.target.id || n.id === d.target);
                        if (source?.group === 'literal' || target?.group === 'literal') {
                            return val * 0.6; // Shorter for literals
                        }
                        return val;
                    })
                    .strength(0.9)
                );
                simulation.alpha(0.3).restart();
            });
        }

        // Build filter chips (faceted filtering by group)
        const filterContainer = container.querySelector('.filter-container');
        if (filterContainer) {
            const hiddenGroups = new Set();
            
            allGroups.forEach(group => {
                const chip = document.createElement('button');
                chip.className = 'filter-chip';
                chip.style.cssText = 'display:flex; align-items:center; gap:6px; padding:6px 10px; border:1px solid rgba(15,23,42,0.12); border-radius:6px; background:rgba(255,255,255,0.75); font-size:11px; color:rgba(15,23,42,0.88); cursor:pointer; transition:all 0.15s;';
                chip.innerHTML = `
                    <span style="width:10px; height:10px; border-radius:50%; background:${colorForGroup(group)};"></span>
                    <span style="flex:1; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${group}</span>
                `;
                
                chip.addEventListener('click', () => {
                    if (hiddenGroups.has(group)) {
                        hiddenGroups.delete(group);
                        chip.style.opacity = '1';
                    } else {
                        hiddenGroups.add(group);
                        chip.style.opacity = '0.35';
                    }
                    
                    // Update visibility
                    nodeSel.style('display', d => hiddenGroups.has(d.group) ? 'none' : null);
                    linkSel.style('display', d => {
                        const source = nodes.find(n => n.id === d.source.id || n.id === d.source);
                        const target = nodes.find(n => n.id === d.target.id || n.id === d.target);
                        if (hiddenGroups.has(source?.group) || hiddenGroups.has(target?.group)) {
                            return 'none';
                        }
                        return null;
                    });
                });
                
                filterContainer.appendChild(chip);
            });
        }

        // Build legend
        const legendContainer = container.querySelector('.legend-container');
        if (legendContainer) {
            allGroups.forEach(group => {
                const chip = document.createElement('div');
                chip.className = 'legend-chip';
                chip.style.cssText = 'display:flex; align-items:center; gap:6px; padding:6px 10px; border:1px solid rgba(15,23,42,0.12); border-radius:6px; background:rgba(255,255,255,0.75); font-size:11px; color:rgba(15,23,42,0.88);';
                chip.innerHTML = `
                    <span style="width:10px; height:10px; border-radius:50%; background:${colorForGroup(group)};"></span>
                    <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${group}</span>
                `;
                legendContainer.appendChild(chip);
            });
        }

        // Initial zoom
        svg.call(zoom.transform, d3.zoomIdentity.scale(0.95));
    }
}
