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
    // Detect node type based on URI patterns (similar to rdf_visual.html)
    detectNodeType(iri) {
        const lowerIri = iri.toLowerCase();
        if (lowerIri.includes('person') || lowerIri.includes('people') || lowerIri.includes('foaf')) return 'person';
        if (lowerIri.includes('organization') || lowerIri.includes('org') || lowerIri.includes('company')) return 'organization';
        if (lowerIri.includes('place') || lowerIri.includes('location') || lowerIri.includes('geo')) return 'place';
        if (lowerIri.includes('concept') || lowerIri.includes('topic') || lowerIri.includes('category')) return 'concept';
        if (lowerIri.includes('event') || lowerIri.includes('meeting') || lowerIri.includes('conference')) return 'event';
        return 'resource';
    }

    // Deprecated: kept for backwards compatibility
    groupForIri(iri) {
        return this.detectNodeType(iri);
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
            <div id="${graphId}" class="rdf-graph-container" style="width:100%; height:${this.height}px; position:relative; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; background:linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);">
                <div class="graph-header" style="position:absolute; top:12px; left:12px; z-index:10; background:rgba(255,255,255,0.95); padding:10px 14px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.1); backdrop-filter:blur(8px);">
                    <div style="font-size:13px; font-weight:600; color:#1e293b; margin-bottom:2px;">RDF Knowledge Graph</div>
                    <div style="font-size:11px; color:#64748b;">Nodes: ${fullGraph.nodes.length} | Edges: ${fullGraph.links.length}</div>
                </div>
                <div class="graph-controls" style="position:absolute; top:12px; right:12px; z-index:10; display:flex; gap:8px;">
                    <button class="graph-fullscreen-btn" data-graph-id="${graphId}" style="padding:8px; background:rgba(255,255,255,0.95); border:1px solid #e2e8f0; border-radius:8px; cursor:pointer; font-size:12px; font-weight:500; color:#475569; transition:all 0.2s; backdrop-filter:blur(8px);" title="Fullscreen">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                        </svg>
                    </button>
                    <button class="graph-center-btn" data-graph-id="${graphId}" style="padding:8px; background:rgba(255,255,255,0.95); border:1px solid #e2e8f0; border-radius:8px; cursor:pointer; font-size:12px; font-weight:500; color:#475569; transition:all 0.2s; backdrop-filter:blur(8px);" title="Center graph">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M15 10l4.5-4.5M19.5 5.5h-4v-4M9 14l-4.5 4.5M4.5 18.5h4v4" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                    </button>
                    <button class="graph-theme-btn" data-graph-id="${graphId}" style="padding:8px; background:rgba(255,255,255,0.95); border:1px solid #e2e8f0; border-radius:8px; cursor:pointer; font-size:12px; font-weight:500; color:#475569; transition:all 0.2s; backdrop-filter:blur(8px);" title="Toggle theme">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.36-6.36-1.42 1.42M7.05 16.95l-1.42 1.42m0-11.84 1.42 1.42m11.31 11.31 1.42 1.42" />
                            <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
                        </svg>
                    </button>
                    <button class="graph-settings-btn" data-graph-id="${graphId}" style="padding:8px; background:rgba(255,255,255,0.95); border:1px solid #e2e8f0; border-radius:8px; cursor:pointer; font-size:12px; font-weight:500; color:#475569; transition:all 0.2s; backdrop-filter:blur(8px);" title="Graph settings">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z" />
                            <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                    </button>
                </div>
                <svg class="graph-svg" style="width:100%; height:100%; background:#f8fafc;"></svg>
                <div class="graph-settings-panel" style="display:flex; flex-flow:column; position:absolute; right:12px; top:55px; z-index:20; width:min(380px,calc(100% - 24px)); background:rgba(255,255,255,0.97); border:1px solid #e2e8f0; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.15); backdrop-filter:blur(12px); height:calc(100vh - 300px);">
                    <div class="settings-header" style="display:flex; align-items:center; justify-content:space-between; padding:14px 18px; border-bottom:1px solid #e2e8f0; cursor:move; background:linear-gradient(135deg, rgba(249,250,251,0.9) 0%, rgba(241,245,249,0.9) 100%); border-radius:12px 12px 0 0;">
                        <div style="font-size:14px; font-weight:600; color:#1e293b;">Graph Settings</div>
                        <button class="settings-close-btn" style="padding:4px; background:none; border:none; cursor:pointer; color:#64748b; border-radius:6px; transition:all 0.2s;" title="Close">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div class="settings-body" style="padding:18px; max-height:min(70vh,500px); overflow-y:auto;">
                        <!-- Physics -->
                        <div style="margin-bottom:16px;">
                            <div style="font-size:12px; font-weight:600; letter-spacing:0.05em; color:#64748b; margin-bottom:6px;">Physics Simulation</div>
                            <div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <label style="font-size:12px; color:#334155; font-weight:500;">Charge strength</label>
                                    <span class="charge-value" style="font-size:11px; color:#64748b; font-variant-numeric:tabular-nums; font-weight:600;">-450</span>
                                </div>
                                <input type="range" class="charge-slider" min="-1200" max="-50" step="10" value="-450" style="width:90%; height:6px; accent-color:#6366f1; cursor:pointer;">
                            </div>
                            <div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <label style="font-size:12px; color:#334155; font-weight:500;">Link distance</label>
                                    <span class="link-distance-value" style="font-size:11px; color:#64748b; font-variant-numeric:tabular-nums; font-weight:600;">140</span>
                                </div>
                                <input type="range" class="link-distance-slider" min="40" max="320" step="5" value="140" style="width:90%; height:6px; accent-color:#6366f1; cursor:pointer;">
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <label style="font-size:12px; color:#334155; font-weight:500;">Enable Physics</label>
                                <input type="checkbox" class="physics-toggle" checked style="width:16px; height:16px; cursor:pointer; accent-color:#6366f1;">
                            </div>
                        </div>
                        <!-- Predicate Display -->
                        <div style="margin-bottom:16px;">
                            <div style="font-size:12px; font-weight:600; letter-spacing:0.05em; color:#64748b; margin-bottom:6px;">Predicate Display</div>
                            <div style="display:flex; gap:12px;">
                                <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:12px; color:#334155; padding:2px">
                                    <input type="radio" name="predicate-display" value="icons" class="predicate-display-radio" checked style="width:16px; height:16px; cursor:pointer; accent-color:#6366f1;top:revert;left:revert;position:revert;">
                                    <span>Icons</span>
                                </label>
                                <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:12px; color:#334155; padding:2px">
                                    <input type="radio" name="predicate-display" value="labels" class="predicate-display-radio" style="width:16px; height:16px; cursor:pointer; accent-color:#6366f1;top:revert;left:revert;position:revert;">
                                    <span>Labels</span>
                                </label>
                            </div>
                        </div>
                        <!-- Filtering -->
                        <div style="margin-bottom:16px;">
                            <div style="font-size:12px; font-weight:600; letter-spacing:0.05em; color:#64748b; margin-bottom:6px;">Node Filtering</div>
                            <div class="filter-container" style="display:grid; grid-template-columns:repeat(2,1fr); gap:8px;"></div>
                        </div>
                        <!-- Predicate Filtering -->
                        <div style="margin-bottom:16px;">
                            <div style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none; margin-bottom:4px; padding:8px; border-radius:6px; transition:background 0.2s;" class="predicate-filter-toggle">
                                <span class="toggle-icon" style="font-size:16px; transition:transform 0.2s; transform:rotate(-90deg);">▼</span>
                                <div style="font-size:12px; font-weight:600; letter-spacing:0.05em; color:#64748b;">Predicate Filtering</div>
                            </div>
                            <div class="predicate-filter-content" style="max-height:0px; overflow:hidden; border:1px solid #e2e8f0; border-radius:8px; padding:0px; transition:all 0.3s ease; display:block; opacity:0; visibility:hidden; margin-bottom:-8px;">
                                <div style="font-size:11px; color:#64748b; margin-bottom:8px;">Select predicates to include in graph:</div>
                                <div style="display:flex; gap:8px; margin-bottom:8px;">
                                    <button class="select-all-predicates" style="flex:1; padding:6px 12px; font-size:11px; font-weight:500; background:#3b82f6; color:white; border:none; border-radius:6px; cursor:pointer; transition:all 0.2s;" title="Select all predicates">Select All</button>
                                    <button class="deselect-all-predicates" style="flex:1; padding:6px 12px; font-size:11px; font-weight:500; background:#f1f5f9; color:#334155; border:1px solid #e2e8f0; border-radius:6px; cursor:pointer; transition:all 0.2s;" title="Deselect all predicates">Deselect All</button>
                                </div>
                                <div class="predicate-checkboxes" style="display:grid; grid-template-columns:repeat(1,1fr);"></div>
                            </div>
                        </div>
                        <!-- Legend -->
                        <div style="margin-bottom:16px;">
                            <div style="font-size:12px; font-weight:600; letter-spacing:0.05em; color:#64748b; margin-bottom:14px;">Node Colors</div>
                            <div class="legend-container" style="display:grid; grid-template-columns:repeat(2,1fr); gap:8px;"></div>
                        </div>
                        <!-- Tips -->
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px;">
                            <div style="font-size:11px; font-weight:600; color:#1e293b; margin-bottom:8px;">💡 Tips</div>
                            <div style="font-size:11px; color:#475569; line-height:1.7;">
                                <div style="margin-bottom:4px;">• <strong>Mouse wheel</strong> to zoom. <strong>Drag background</strong> to pan.</div>
                                <div>• <strong>Click</strong> nodes/predicates to open IRIs in new tab.</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="graph-tooltip" style="position:fixed; display:none; z-index:50; pointer-events:none; max-width:400px; background:rgba(15,23,42,0.95); padding:12px 16px; border-radius:8px; box-shadow:0 10px 25px rgba(0,0,0,0.25); font-size:13px; color:white; border:1px solid rgba(255,255,255,0.15); backdrop-filter:blur(8px);"></div>
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

        // Node types with colors and icons (from rdf_visual.html)
        const nodeTypes = {
            'person': { color: '#3b82f6', icon: '👤' },
            'organization': { color: '#10b981', icon: '🏢' },
            'place': { color: '#ef4444', icon: '📍' },
            'concept': { color: '#8b5cf6', icon: '💭' },
            'event': { color: '#f59e0b', icon: '📅' },
            'literal': { color: '#06b6d4', icon: '📝' },
            'resource': { color: '#6b7280', icon: '🔗' }
        };

        const allGroups = Array.from(new Set(fullGraph.nodes.map(n => n.group))).sort();

        const colorForGroup = (g) => {
            return nodeTypes[g]?.color || nodeTypes['resource'].color;
        };

        // Setup SVG
        const defs = svg.append("defs");
        defs.append("marker")
            .attr("id", `arrow-${container.id}`)
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 25)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", "rgba(100,116,139,0.75)");

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
            tooltip.html(`<div style="font-weight:600; margin-bottom:4px;">${title}</div><div style="color:rgba(226,232,240,0.8); font-size:11px; word-break:break-all;">${sub}</div>`)
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
            .attr("stroke", "rgba(100,116,139,0.65)")
            .attr("stroke-width", 2)
            .attr("fill", "none")
            .attr("marker-end", `url(#arrow-${container.id})`)
            .style("opacity", 0.7)
            .style("cursor", "pointer")
            .on("mouseenter", function() {
                d3.select(this)
                    .attr("stroke", "#3b82f6")
                    .attr("stroke-width", 3)
                    .style("opacity", 1);
            })
            .on("mouseleave", function() {
                d3.select(this)
                    .attr("stroke", "rgba(100,116,139,0.65)")
                    .attr("stroke-width", 2)
                    .style("opacity", 0.7);
            });

        // Function to select icon for predicate
        const iconForPredicate = (label) => {
            const lowerLabel = label ? label.toLowerCase() : '';
            
            if (lowerLabel.includes('type') || lowerLabel === 'a') {
                return "🏷️";
            }
            if (lowerLabel.includes('name')) {
                return "👤";
            }
            if (lowerLabel.includes('label')) {
                return "📝";
            }
            if (lowerLabel.includes('knows')) {
                return "🤝";
            }
            if (lowerLabel.includes('memberof') || lowerLabel.includes('member')) {
                return "🏢";
            }
            if (lowerLabel.includes('located') || lowerLabel.includes('place')) {
                return "📍";
            }
            if (lowerLabel.includes('url') || lowerLabel.includes('link') || lowerLabel.includes('sameas')) {
                return "🔗";
            }
            if (lowerLabel.includes('created') || lowerLabel.includes('modified') || lowerLabel.includes('date')) {
                return "📅";
            }
            if (lowerLabel.includes('broader')) {
                return "⬆️";
            }
            if (lowerLabel.includes('narrower')) {
                return "⬇️";
            }
            
            // Fallback generic arrow
            return "➡️";
        };

        // Render predicate icons/labels (clickable)
        let iconSel = iconLayer.selectAll("g")
            .data(links, d => d.key)
            .join(
                enter => {
                    const g = enter.append("g")
                        .attr("class", "predicate-icon-group")
                        .style("cursor", "pointer");

                    // Background rectangle for label mode (initially hidden)
                    g.append("rect")
                        .attr("class", "predicate-background")
                        .attr("fill", "rgba(255,255,255,0.9)")
                        .attr("rx", 3)
                        .attr("ry", 3)
                        .style("display", "none")
                        .style("pointer-events", "none");

                    // Text element for icon or label (will be updated based on mode)
                    g.append("text")
                        .attr("class", "predicate-text")
                        .attr("text-anchor", "middle")
                        .attr("dy", "0.35em")
                        .attr("font-size", "16px")
                        .style("pointer-events", "none")
                        .style("user-select", "none")
                        .text(d => iconForPredicate(d.predicateLabel));

                    // Transparent hitbox for interactions (will be resized based on mode)
                    g.append("rect")
                        .attr("class", "predicate-hitbox")
                        .attr("x", -12)
                        .attr("y", -12)
                        .attr("width", 24)
                        .attr("height", 24)
                        .attr("fill", "transparent")
                        .style("cursor", "pointer")
                        .on("mouseenter", (event, d) => {
                            const iri = d.predicateIri || d.predicateLabel;
                            showTooltip(
                                d.predicateLabel || 'Predicate',
                                iri,
                                event.clientX,
                                event.clientY
                            );
                            simulation.stop();
                        })
                        .on("mousemove", (event) => {
                            tooltip.style("left", `${event.clientX + 12}px`)
                                .style("top", `${event.clientY + 12}px`);
                        })
                        .on("mouseleave", (event, d) => {
                            hideTooltip();
                            const physicsToggle = container.querySelector('.physics-toggle');
                            if (physicsToggle && physicsToggle.checked) {
                                simulation.alpha(0.1).restart();
                            }
                        })
                        .on("click", (event, d) => {
                            event.stopPropagation();
                            if (d.predicateIri) {
                                window.open(d.predicateIri, "_blank", "noopener");
                            }
                        });

                    return g;
                }
            );

        const nodeLabel = (n) => {
            // Truncate labels longer than 20 characters to first 17 chars + "..."
            const base = n.label || (n.iri ? n.iri : n.id);
            return base.length > 20 ? base.slice(0, 17) + "..." : base;
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
                // Highlight connected nodes and links
                const connectedIds = new Set();
                links.forEach(link => {
                    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                    if (sourceId === d.id) connectedIds.add(targetId);
                    if (targetId === d.id) connectedIds.add(sourceId);
                });
                
                // Dim non-connected nodes
                nodeSel.style("opacity", n => 
                    n.id === d.id || connectedIds.has(n.id) ? 1 : 0.2
                );
                
                // Dim non-connected links
                linkSel.style("opacity", l => {
                    const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
                    const targetId = typeof l.target === 'object' ? l.target.id : l.target;
                    return sourceId === d.id || targetId === d.id ? 1 : 0.1;
                });
                
                // Also dim predicate icons
                iconSel.style("opacity", l => {
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
                iconSel.style("opacity", 1);
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

        // Add shapes to nodes with glow effect and enhanced styling
        nodeSel.each(function(d) {
            const g = d3.select(this);
            g.selectAll("*").remove(); // Clear any existing elements
            
            // Add glow ring for circles (behind main shape)
            if (d.shape !== 'rect') {
                g.append("circle")
                    .attr("r", d.size + 4)
                    .attr("fill", colorForGroup(d.group))
                    .attr("opacity", 0.15)
                    .attr("class", "glow-ring");
            }
            
            if (d.shape === 'rect') {
                // Rectangular nodes for literals with rounded corners
                g.append("rect")
                    .attr("x", -d.size * 2)
                    .attr("y", -d.size)
                    .attr("width", d.size * 4)
                    .attr("height", d.size * 2)
                    .attr("rx", 4)
                    .attr("fill", colorForGroup(d.group))
                    .attr("stroke", "rgba(255,255,255,0.9)")
                    .attr("stroke-width", 2)
                    .attr("opacity", 0.95)
                    .style("filter", "drop-shadow(0px 2px 6px rgba(0,0,0,0.2))");
            } else {
                // Circular nodes for resources with enhanced stroke
                g.append("circle")
                    .attr("r", d.size)
                    .attr("fill", colorForGroup(d.group))
                    .attr("stroke", d._pinned ? "rgba(239,68,68,0.9)" : "rgba(255,255,255,0.9)")
                    .attr("stroke-width", d._pinned ? 3 : 2)
                    .attr("opacity", 0.95)
                    .style("filter", "drop-shadow(0px 2px 6px rgba(0,0,0,0.2))");
            }
            
            // Node label with improved styling
            g.append("text")
                .attr("x", d.shape === 'rect' ? 0 : d.size + 10)
                .attr("y", d.shape === 'rect' ? 0 : 5)
                .attr("text-anchor", d.shape === 'rect' ? "middle" : "start")
                .attr("fill", d.shape === 'rect' ? "rgba(15,23,42,0.95)" : "rgba(15,23,42,0.9)")
                .attr("font-size", d.group === 'literal' ? 10 : (d.size > 15 ? 13 : 12))
                .attr("font-weight", d.size > 15 ? 600 : 500)
                .style("text-shadow", "0px 1px 3px rgba(255,255,255,0.9), 0px 0px 1px rgba(255,255,255,0.9)")
                .style("pointer-events", "none")
                .text(nodeLabel(d));
        });

        // Simulation tick with smooth animations
        simulation.on("tick", () => {
            // Update link paths with smooth curves
            linkSel.attr("d", d => {
                const sx = d.source.x;
                const sy = d.source.y;
                const tx = d.target.x;
                const ty = d.target.y;
                return `M${sx},${sy}L${tx},${ty}`;
            });

            // Position predicate icons/labels at link midpoints with rotation for labels
            iconSel.attr("transform", d => {
                const mx = (d.source.x + d.target.x) / 2;
                const my = (d.source.y + d.target.y) / 2;
                
                // Calculate angle for text rotation along the line
                const dx = d.target.x - d.source.x;
                const dy = d.target.y - d.source.y;
                let angle = Math.atan2(dy, dx) * 180 / Math.PI;
                
                // Keep text readable (don't flip upside down)
                if (angle > 90 || angle < -90) {
                    angle += 180;
                }
                
                // Check if we're in label mode
                const labelMode = container.querySelector('.predicate-display-radio[value="labels"]:checked');
                
                if (labelMode) {
                    return `translate(${mx},${my}) rotate(${angle})`;
                } else {
                    return `translate(${mx},${my})`;
                }
            });

            // Update node positions
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
                linkSel.attr("stroke", isDark ? "rgba(100,116,139,0.75)" : "rgba(100,116,139,0.65)");
                defs.select("marker path").attr("fill", isDark ? "rgba(100,116,139,0.85)" : "rgba(100,116,139,0.75)");
                
                // Update node text color
                nodeSel.selectAll("text").attr("fill", isDark ? "rgba(226,232,240,0.95)" : "rgba(15,23,42,0.9)");
                
                // Update node strokes
                nodeSel.selectAll("circle:not(.glow-ring)").attr("stroke", d => 
                    d._pinned ? "rgba(239,68,68,0.9)" : (isDark ? "rgba(100,116,139,0.75)" : "rgba(255,255,255,0.9)")
                );
                nodeSel.selectAll("rect").attr("stroke", isDark ? "rgba(100,116,139,0.75)" : "rgba(255,255,255,0.9)");
                
                // Update icon backgrounds
                iconSel.selectAll("circle").attr("fill", isDark ? "rgba(30,41,59,0.95)" : "rgba(255,255,255,0.98)");
            });
        }

        // Settings panel
        const settingsBtn = container.querySelector('.graph-settings-btn');
        const settingsPanel = container.querySelector('.graph-settings-panel');
        const settingsCloseBtn = container.querySelector('.settings-close-btn');
        
        // Add hover effects to all control buttons
        const allControlBtns = container.querySelectorAll('.graph-fullscreen-btn, .graph-center-btn, .graph-theme-btn, .graph-settings-btn');
        allControlBtns.forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'rgba(255,255,255,1)';
                btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                btn.style.transform = 'translateY(-1px)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'rgba(255,255,255,0.95)';
                btn.style.boxShadow = 'none';
                btn.style.transform = 'translateY(0)';
            });
        });
        
        if (settingsBtn && settingsPanel) {
            settingsBtn.addEventListener('click', () => {
                settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
            });
        }
        
        if (settingsCloseBtn && settingsPanel) {
            settingsCloseBtn.addEventListener('mouseenter', () => {
                settingsCloseBtn.style.background = 'rgba(239,68,68,0.1)';
                settingsCloseBtn.style.color = '#ef4444';
            });
            settingsCloseBtn.addEventListener('mouseleave', () => {
                settingsCloseBtn.style.background = 'none';
                settingsCloseBtn.style.color = '#64748b';
            });
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

        // Physics toggle
        const physicsToggle = container.querySelector('.physics-toggle');
        if (physicsToggle) {
            physicsToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    simulation.alpha(0.3).restart();
                } else {
                    simulation.stop();
                }
            });
        }

        // Predicate display mode toggle
        const predicateDisplayRadios = container.querySelectorAll('.predicate-display-radio');
        if (predicateDisplayRadios.length > 0) {
            // Initialize: set default checked state explicitly
            const iconsRadio = container.querySelector('.predicate-display-radio[value="icons"]');
            if (iconsRadio) {
                iconsRadio.checked = true;
            }
            
            predicateDisplayRadios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    const mode = e.target.value; // 'icons' or 'labels'
                    
                    iconSel.each(function(d) {
                        const g = d3.select(this);
                        const textEl = g.select('.predicate-text');
                        const bgEl = g.select('.predicate-background');
                        const hitboxEl = g.select('.predicate-hitbox');
                        
                        if (mode === 'labels') {
                            // Show label instead of icon with smaller font
                            textEl.text(d.predicateLabel)
                                .attr("font-size", "7px")
                                .attr("font-weight", "500")
                                .style("fill", "#475569");
                            
                            // Get text bounding box and show background
                            const bbox = textEl.node().getBBox();
                            const padding = 3;
                            
                            bgEl
                                .attr("x", bbox.x - padding)
                                .attr("y", bbox.y - padding)
                                .attr("width", bbox.width + padding * 2)
                                .attr("height", bbox.height + padding * 2)
                                .style("display", null);
                            
                            // Adjust hitbox size for text
                            hitboxEl
                                .attr("x", bbox.x - padding)
                                .attr("y", bbox.y - padding)
                                .attr("width", bbox.width + padding * 2)
                                .attr("height", bbox.height + padding * 2);
                        } else {
                            // Show icon (default)
                            textEl.text(iconForPredicate(d.predicateLabel))
                                .attr("font-size", "16px")
                                .attr("font-weight", "normal")
                                .style("fill", null);
                            
                            // Hide background
                            bgEl.style("display", "none");
                            
                            // Reset hitbox to icon size
                            hitboxEl
                                .attr("x", -12)
                                .attr("y", -12)
                                .attr("width", 24)
                                .attr("height", 24);
                        }
                    });
                    
                    // Trigger transform update to apply rotation for labels
                    simulation.alpha(0).restart();
                    setTimeout(() => simulation.stop(), 100);
                });
            });
        }

        // Build filter checkboxes (faceted filtering by group)
        const filterContainer = container.querySelector('.filter-container');
        if (filterContainer) {
            const hiddenGroups = new Set();
            
            allGroups.forEach(group => {
                const wrapper = document.createElement('div');
                wrapper.style.cssText = 'display:flex; align-items:center; padding:0px 0px; background:rgba(255,255,255,0.9); transition:all 0.2s;';
                
                const label = document.createElement('label');
                label.style.cssText = 'display:flex; align-items:center; padding: 2px 4px; gap:8px; cursor:pointer; flex:1;';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = true;
                checkbox.style.cssText = 'width:16px; height:16px; cursor:pointer; accent-color:#3b82f6; border-radius:4px; flex-shrink:0;';
                
                const textWrapper = document.createElement('span');
                textWrapper.style.cssText = 'display:flex; align-items:center; gap:7px; font-size:11px; color:rgba(15,23,42,0.9); font-weight:500;';
                const groupIcon = nodeTypes[group]?.icon || '🔗';
                textWrapper.innerHTML = `
                    <span style="font-size:14px; flex-shrink:0;">${groupIcon}</span>
                    <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${group}</span>
                `;
                
                label.appendChild(checkbox);
                label.appendChild(textWrapper);
                wrapper.appendChild(label);
                
                // Add hover effect
                wrapper.addEventListener('mouseenter', () => {
                    wrapper.style.background = 'rgba(249,250,251,1)';
                    wrapper.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                    wrapper.style.transform = 'translateY(-1px)';
                });
                wrapper.addEventListener('mouseleave', () => {
                    wrapper.style.background = 'rgba(255,255,255,0.9)';
                    wrapper.style.boxShadow = 'none';
                    wrapper.style.transform = 'translateY(0)';
                });
                
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        hiddenGroups.delete(group);
                    } else {
                        hiddenGroups.add(group);
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
                    iconSel.style('display', d => {
                        const source = nodes.find(n => n.id === d.source.id || n.id === d.source);
                        const target = nodes.find(n => n.id === d.target.id || n.id === d.target);
                        if (hiddenGroups.has(source?.group) || hiddenGroups.has(target?.group)) {
                            return 'none';
                        }
                        return null;
                    });
                });
                
                filterContainer.appendChild(wrapper);
            });
        }
        
        // Build predicate filter checkboxes
        const predicateCheckboxesContainer = container.querySelector('.predicate-checkboxes');
        if (predicateCheckboxesContainer) {
            const hiddenPredicates = new Set();
            
            // Extract unique predicates from links
            const uniquePredicates = [];
            const predicateMap = new Map();
            
            fullGraph.links.forEach(link => {
                const predicateLabel = link.predicateLabel || link.predicateIri;
                if (!predicateMap.has(predicateLabel)) {
                    predicateMap.set(predicateLabel, {
                        label: predicateLabel,
                        iri: link.predicateIri,
                        count: 1
                    });
                } else {
                    predicateMap.get(predicateLabel).count++;
                }
            });
            
            // Convert to array and sort by count (descending)
            predicateMap.forEach(predicate => uniquePredicates.push(predicate));
            uniquePredicates.sort((a, b) => b.count - a.count);
            
            // Create checkboxes for each predicate
            uniquePredicates.forEach(predicate => {
                const wrapper = document.createElement('div');
                wrapper.style.cssText = 'display:flex; align-items:center; background:rgba(255,255,255,0.9); border-radius:6px; transition:all 0.2s;';
                
                const label = document.createElement('label');
                label.style.cssText = 'display:flex; align-items:center; padding: 6px; gap:8px; cursor:pointer; flex:1;';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = true;
                checkbox.style.cssText = 'width:16px; height:16px; cursor:pointer; accent-color:#3b82f6; border-radius:4px; flex-shrink:0;';
                checkbox.dataset.predicateIri = predicate.iri;
                checkbox.dataset.predicateLabel = predicate.label;
                
                const textWrapper = document.createElement('span');
                textWrapper.style.cssText = 'display:flex; align-items:center; gap:8px; font-size:11px; color:rgba(15,23,42,0.9); font-weight:500;';
                
                const iconSpan = document.createElement('span');
                iconSpan.style.cssText = 'font-size:14px; flex-shrink:0;';
                iconSpan.textContent = iconForPredicate(predicate.label);
                
                const labelSpan = document.createElement('span');
                labelSpan.style.cssText = 'overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;';
                labelSpan.textContent = predicate.label;
                
                const countSpan = document.createElement('span');
                countSpan.style.cssText = 'font-size:10px; color:#64748b; font-weight:600; background:#f1f5f9; padding:1px 6px; border-radius:4px;';
                countSpan.textContent = predicate.count;
                
                textWrapper.appendChild(iconSpan);
                textWrapper.appendChild(labelSpan);
                textWrapper.appendChild(countSpan);
                
                label.appendChild(checkbox);
                label.appendChild(textWrapper);
                wrapper.appendChild(label);
                
                // Add hover effect
                wrapper.addEventListener('mouseenter', () => {
                    wrapper.style.background = 'rgba(249,250,251,1)';
                    wrapper.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                    wrapper.style.transform = 'translateY(-1px)';
                });
                wrapper.addEventListener('mouseleave', () => {
                    wrapper.style.background = 'rgba(255,255,255,0.9)';
                    wrapper.style.boxShadow = 'none';
                    wrapper.style.transform = 'translateY(0)';
                });
                
                // Add click handler for predicate label to open IRI
                labelSpan.style.cursor = 'pointer';
                labelSpan.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (predicate.iri) {
                        window.open(predicate.iri, "_blank", "noopener");
                    }
                });
                
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        hiddenPredicates.delete(predicate.label);
                    } else {
                        hiddenPredicates.add(predicate.label);
                    }
                    
                    // Update visibility based on predicate filtering
                    linkSel.style('display', d => {
                        const predicateLabel = d.predicateLabel || d.predicateIri;
                        if (hiddenPredicates.has(predicateLabel)) {
                            return 'none';
                        }
                        return null;
                    });
                    
                    iconSel.style('display', d => {
                        const predicateLabel = d.predicateLabel || d.predicateIri;
                        if (hiddenPredicates.has(predicateLabel)) {
                            return 'none';
                        }
                        return null;
                    });
                    
                    // Also hide nodes that have no visible connections
                    const visibleNodeIds = new Set();
                    linkSel.filter(d => {
                        const predicateLabel = d.predicateLabel || d.predicateIri;
                        return !hiddenPredicates.has(predicateLabel);
                    }).each(d => {
                        const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
                        const targetId = typeof d.target === 'object' ? d.target.id : d.target;
                        visibleNodeIds.add(sourceId);
                        visibleNodeIds.add(targetId);
                    });
                    
                    nodeSel.style('display', d => visibleNodeIds.has(d.id) ? null : 'none');
                });
                
                predicateCheckboxesContainer.appendChild(wrapper);
            });
            
            // Add event handlers for Select All and Deselect All buttons
            const selectAllBtn = container.querySelector('.select-all-predicates');
            const deselectAllBtn = container.querySelector('.deselect-all-predicates');
            const predicateCheckboxes = container.querySelectorAll('.predicate-checkboxes input[type="checkbox"]');
            
            if (selectAllBtn && predicateCheckboxes.length > 0) {
                selectAllBtn.addEventListener('click', () => {
                    predicateCheckboxes.forEach(checkbox => {
                        checkbox.checked = true;
                    });
                    
                    // Reset hidden predicates set
                    hiddenPredicates.clear();
                    
                    // Show all elements
                    linkSel.style('display', null);
                    iconSel.style('display', null);
                    nodeSel.style('display', null);
                });
            }
            
            if (deselectAllBtn && predicateCheckboxes.length > 0) {
                deselectAllBtn.addEventListener('click', () => {
                    predicateCheckboxes.forEach(checkbox => {
                        checkbox.checked = false;
                    });
                    
                    // Add all predicates to hidden set
                    predicateCheckboxes.forEach(checkbox => {
                        hiddenPredicates.add(checkbox.dataset.predicateLabel);
                    });
                    
                    // Hide all links and icons
                    linkSel.style('display', 'none');
                    iconSel.style('display', 'none');
                    nodeSel.style('display', 'none');
                });
            }
            
            // Add toggle functionality for Predicate Filtering section
            const toggleButton = container.querySelector('.predicate-filter-toggle');
            const toggleIcon = container.querySelector('.predicate-filter-toggle .toggle-icon');
            const filterContent = container.querySelector('.predicate-filter-content');
            
            if (toggleButton && filterContent) {
                // Initialize toggle state (collapsed by default)
                let isExpanded = false;
                
                // Get the actual height of content when expanded
                const getContentHeight = () => {
                    filterContent.style.maxHeight = 'none';
                    filterContent.style.visibility = 'visible';
                    const height = filterContent.scrollHeight;
                    return height;
                };
                
                const contentHeight = getContentHeight();
                
                // Reset to collapsed state
                filterContent.style.maxHeight = '0px';
                filterContent.style.visibility = 'hidden';
                filterContent.style.opacity = '0';
                filterContent.style.overflow = 'hidden';
                filterContent.style.marginBottom = '-8px';
                filterContent.style.padding = '0px';
                
                toggleButton.addEventListener('click', () => {
                    isExpanded = !isExpanded;
                    
                    if (isExpanded) {
                        // Expand
                        filterContent.style.maxHeight = contentHeight + 'px';
                        filterContent.style.visibility = 'visible';
                        filterContent.style.opacity = '1';
                        filterContent.style.marginBottom = '0px';
                        filterContent.style.overflow = 'visible';
                        filterContent.style.padding = '8px';
                        toggleIcon.style.transform = 'rotate(0deg)';
                    } else {
                        // Collapse
                        filterContent.style.maxHeight = '0px';
                        filterContent.style.opacity = '0';
                        filterContent.style.visibility = 'hidden';
                        filterContent.style.overflow = 'hidden';
                        filterContent.style.marginBottom = '-8px';
                        filterContent.style.padding = '0px';
                        toggleIcon.style.transform = 'rotate(-90deg)';
                    }
                });
                
                // Add hover effect to toggle button
                toggleButton.addEventListener('mouseenter', () => {
                    toggleButton.style.background = 'rgba(226,232,240,0.5)';
                });
                toggleButton.addEventListener('mouseleave', () => {
                    toggleButton.style.background = 'transparent';
                });
            }
        }

        // Build legend
        const legendContainer = container.querySelector('.legend-container');
        if (legendContainer) {
            allGroups.forEach(group => {
                const chip = document.createElement('div');
                chip.className = 'legend-chip';
                chip.style.cssText = 'display:flex; align-items:center; gap:7px; padding:7px 11px; border:1px solid rgba(226,232,240,0.8); border-radius:7px; background:rgba(255,255,255,0.9); font-size:11px; color:rgba(15,23,42,0.9); font-weight:500;';
                const groupIcon = nodeTypes[group]?.icon || '🔗';
                chip.innerHTML = `
                    <span style="width:11px; height:11px; border-radius:50%; background:${colorForGroup(group)}; box-shadow:0 0 0 2px rgba(255,255,255,0.5);"></span>
                    <span style="font-size:14px;">${groupIcon}</span>
                    <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${group}</span>
                `;
                legendContainer.appendChild(chip);
            });
        }

        // Initial zoom with smooth animation (reduced to fit ~90% of graph in viewport)
        svg.call(zoom.transform, d3.zoomIdentity.scale(0.65));
    }
}
