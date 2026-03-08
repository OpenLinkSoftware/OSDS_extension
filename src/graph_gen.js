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

    normalizeEntityTypeLabel(typeIri) {
        const compact = this.compactIri(typeIri);
        const local = compact.includes(':') ? compact.split(':').pop() : compact;
        const decoded = local.replace(/[_-]+/g, ' ');
        const spaced = decoded
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/\s+/g, ' ')
            .trim();

        if (!spaced) {
            return compact || 'Resource';
        }

        return spaced
            .split(' ')
            .map(part => part ? part.charAt(0).toUpperCase() + part.slice(1) : part)
            .join(' ');
    }

    scoreEntityType(typeIri) {
        const compact = this.compactIri(typeIri).toLowerCase();
        const genericTypes = new Set([
            'rdf:resource',
            'rdfs:resource',
            'rdfs:class',
            'owl:class',
            'owl:thing',
            'owl:namedindividual',
            'schema:thing',
            'skos:concept',
            'foaf:agent'
        ]);

        if (genericTypes.has(compact)) {
            return -10;
        }

        if (compact.startsWith('schema:') || compact.startsWith('foaf:') || compact.startsWith('dbo:') || compact.startsWith('wikidata:') || compact.startsWith('wd:')) {
            return 10;
        }

        return 0;
    }

    facetLabelForGroup(group) {
        const labels = {
            person: 'Person',
            organization: 'Organization',
            place: 'Place',
            concept: 'Concept',
            event: 'Event',
            literal: 'Literal',
            resource: 'Resource'
        };

        return labels[group] || 'Resource';
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
                        literalValue: String(term),
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

        const typeAssignments = new Map();
        for (const t of triples) {
            const isTypeTriple = t.predicate.display === 'rdf:type' || t.predicate.value.endsWith('#type');
            if (!isTypeTriple || t.object.type !== 'iri') continue;

            const subjectIri = resolveRelativeIri(t.subject.value, baseUrl);
            const objectIri = resolveRelativeIri(t.object.value, baseUrl);
            if (!typeAssignments.has(subjectIri)) {
                typeAssignments.set(subjectIri, []);
            }
            typeAssignments.get(subjectIri).push(objectIri);
        }

        // Set node sizes based on importance
        for (const n of nodesById.values()) {
            const assignedTypes = n.iri ? (typeAssignments.get(n.iri) || []) : [];
            let primaryType = null;

            if (assignedTypes.length > 0) {
                primaryType = assignedTypes
                    .slice()
                    .sort((a, b) => this.scoreEntityType(b) - this.scoreEntityType(a))[0];
            }

            n.entityTypeIri = primaryType;
            n.baseFilterType = this.facetLabelForGroup(n.group);
            n.filterType = primaryType ? this.normalizeEntityTypeLabel(primaryType) : this.facetLabelForGroup(n.group);

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
                    <button class="graph-sparql-btn" data-graph-id="${graphId}" style="padding:8px; background:rgba(255,255,255,0.95); border:1px solid #e2e8f0; border-radius:8px; cursor:pointer; font-size:12px; font-weight:500; color:#475569; transition:all 0.2s; backdrop-filter:blur(8px);" title="SPARQL CONSTRUCT of current selection">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 6h16M4 10h16M4 14h8M4 18h8"/>
                            <path d="M16 16l2 2-2 2M20 16l-2 2 2 2"/>
                        </svg>
                    </button>
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
                <svg class="graph-svg" style="width:100%; height:100%; background:#081122;"></svg>
                <div class="graph-settings-panel" style="display:none; flex-flow:column; position:absolute; right:12px; top:55px; z-index:20; width:min(380px,calc(100% - 24px)); background:rgba(255,255,255,0.97); border:1px solid #e2e8f0; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.15); backdrop-filter:blur(12px); height:calc(100vh - 300px);">
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
                        <!-- Edge Filtering -->
                        <div style="margin-bottom:16px;">
                            <div style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none; margin-bottom:4px; padding:8px; border-radius:6px; transition:background 0.2s;" class="edge-filter-toggle">
                                <span class="toggle-icon" style="font-size:14px; transition:transform 0.2s; transform:rotate(-90deg);">▶</span>
                                <div style="font-size:12px; font-weight:600; letter-spacing:0.05em; color:#64748b;">Edge Filtering</div>
                            </div>
                            <div class="edge-filter-content" style="max-height:0px; overflow:hidden; border:1px solid #e2e8f0; border-radius:8px; padding:0px; transition:all 0.3s ease; display:block; opacity:0; visibility:hidden;">
                                <div style="font-size:11px; color:#64748b; margin-bottom:8px; padding:12px 12px 0;">Select edges to include in graph:</div>
                                <div style="display:flex; gap:8px; margin-bottom:8px; padding:0 12px;">
                                    <button class="select-all-predicates" style="flex:1; padding:6px 12px; font-size:11px; font-weight:500; background:#3b82f6; color:white; border:none; border-radius:6px; cursor:pointer; transition:all 0.2s;" title="Select all predicates">Select All</button>
                                    <button class="deselect-all-predicates" style="flex:1; padding:6px 12px; font-size:11px; font-weight:500; background:#f1f5f9; color:#334155; border:1px solid #e2e8f0; border-radius:6px; cursor:pointer; transition:all 0.2s;" title="Deselect all predicates">Deselect All</button>
                                </div>
                                <div class="predicate-checkboxes" style="display:grid; grid-template-columns:repeat(1,1fr); padding:0 12px 12px;"></div>
                            </div>
                        </div>
                        <!-- Node Filtering -->
                        <div style="margin-bottom:16px;">
                            <div style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none; margin-bottom:4px; padding:8px; border-radius:6px; transition:background 0.2s;" class="node-filter-toggle">
                                <span class="toggle-icon" style="font-size:14px; transition:transform 0.2s; transform:rotate(-90deg);">▶</span>
                                <div style="font-size:12px; font-weight:600; letter-spacing:0.05em; color:#64748b;">Node Filtering</div>
                            </div>
                            <div class="node-filter-content" style="max-height:0px; overflow:hidden; border:1px solid #e2e8f0; border-radius:8px; padding:0px; transition:all 0.3s ease; display:block; opacity:0; visibility:hidden; background:rgba(255,255,255,0.98);">
                                <div style="font-size:11px; color:#64748b; margin-bottom:8px; padding:12px 12px 0;">Use the chips below to include or hide semantic types in the graph. Each chip inherits the color shown in the legend.</div>
                                <div style="display:flex; gap:8px; margin-bottom:8px; padding:0 12px;">
                                    <button class="select-all-nodes" style="flex:1; padding:6px 12px; font-size:11px; font-weight:500; background:#3b82f6; color:white; border:none; border-radius:6px; cursor:pointer; transition:all 0.2s;" title="Select all node types">Select All</button>
                                    <button class="deselect-all-nodes" style="flex:1; padding:6px 12px; font-size:11px; font-weight:500; background:#f1f5f9; color:#334155; border:1px solid #e2e8f0; border-radius:6px; cursor:pointer; transition:all 0.2s;" title="Deselect all node types">Deselect All</button>
                                </div>
                                <div class="filter-container" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:10px; max-height:260px; overflow-y:auto; padding:0 12px 12px;"></div>
                            </div>
                        </div>
                        <!-- Literal Text Filtering -->
                        <div style="margin-bottom:16px;">
                            <div style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none; margin-bottom:4px; padding:8px; border-radius:6px; transition:background 0.2s;" class="literal-filter-toggle">
                                <span class="toggle-icon" style="font-size:14px; transition:transform 0.2s; transform:rotate(-90deg);">▶</span>
                                <div style="font-size:12px; font-weight:600; letter-spacing:0.05em; color:#64748b;">Literal Text Filtering</div>
                            </div>
                            <div class="literal-filter-content" style="max-height:0px; overflow:hidden; border:1px solid #e2e8f0; border-radius:8px; padding:0px; transition:all 0.3s ease; display:block; opacity:0; visibility:hidden; background:rgba(255,255,255,0.98);">
                                <div style="font-size:11px; color:#64748b; margin-bottom:8px; padding:12px 12px 0;">Show only literal relationship values containing this text:</div>
                                <div style="display:flex; gap:8px; align-items:center; padding:0 12px 8px;">
                                    <input type="text" class="literal-text-input" placeholder="Filter literal values" style="flex:1; padding:8px 10px; font-size:12px; color:#0f172a; background:#fff; border:1px solid #cbd5e1; border-radius:6px; outline:none;">
                                    <button class="clear-literal-filter" style="padding:8px 10px; font-size:11px; font-weight:500; background:#f1f5f9; color:#334155; border:1px solid #e2e8f0; border-radius:6px; cursor:pointer; transition:all 0.2s;">Clear</button>
                                </div>
                                <div class="literal-filter-status" style="font-size:10px; color:#64748b; padding:0 12px 12px;">No literal text filter applied.</div>
                            </div>
                        </div>
                        <!-- Resolver Preference -->
                        <div style="margin-bottom:16px;">
                            <div style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none; margin-bottom:4px; padding:8px; border-radius:6px; transition:background 0.2s;" class="resolver-filter-toggle">
                                <span class="toggle-icon" style="font-size:14px; transition:transform 0.2s; transform:rotate(-90deg);">▶</span>
                                <div style="font-size:12px; font-weight:600; letter-spacing:0.05em; color:#64748b;">Resolver Preference</div>
                            </div>
                        <div class="resolver-filter-content" style="max-height:0px; overflow:hidden; border:1px solid #e2e8f0; border-radius:8px; padding:0px; transition:all 0.3s ease; display:block; opacity:0; visibility:hidden; background:rgba(255,255,255,0.98);">
                                <div style="font-size:11px; color:#64748b; margin-bottom:8px; padding:12px 12px 0;">Choose how IRIs open from the graph:</div>
                                <div class="resolver-options" style="display:flex; flex-direction:column; gap:6px; padding:0 12px 8px;">
                                    <label class="resolver-option" data-value="none" style="cursor:pointer; display:flex; align-items:center; justify-content:space-between; border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; transition:all 0.15s; background:rgba(255,255,255,0);">
                                        <span style="font-size:12px; color:#1e293b;">None</span>
                                        <input type="radio" name="graph-resolver-preference" value="none" class="resolver-pref-radio" style="accent-color:#6366f1;">
                                    </label>
                                    <label class="resolver-option" data-value="uriburner" style="cursor:pointer; display:flex; align-items:center; justify-content:space-between; border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; transition:all 0.15s; background:rgba(255,255,255,0);">
                                        <span style="font-size:12px; color:#1e293b;">https://linkeddata.uriburner.com/describe/?url=&#123;uri&#125;</span>
                                        <input type="radio" name="graph-resolver-preference" value="uriburner" class="resolver-pref-radio" style="accent-color:#6366f1;">
                                    </label>
                                    <label class="resolver-option" data-value="other" style="cursor:pointer; display:flex; align-items:center; justify-content:space-between; border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; transition:all 0.15s; background:rgba(255,255,255,0);">
                                        <span style="font-size:12px; color:#1e293b;">Other</span>
                                        <input type="radio" name="graph-resolver-preference" value="other" class="resolver-pref-radio" style="accent-color:#6366f1;">
                                    </label>
                                </div>
                                <div style="padding:0 12px 8px;">
                                    <input type="text" class="resolver-pattern-input" placeholder="https://example.org/resolve?target={uri}" style="display:none; width:100%; padding:8px 10px; font-size:12px; color:#0f172a; background:#fff; border:1px solid #cbd5e1; border-radius:6px; outline:none;">
                                </div>
                                <div class="resolver-status" style="font-size:10px; color:#64748b; padding:0 12px 12px;">IRIs currently open directly.</div>
                            </div>
                        </div>
                        <div style="margin-bottom:16px;">
                            <div style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none; margin-bottom:4px; padding:8px; border-radius:6px; transition:background 0.2s;" class="arrow-style-toggle">
                                <span class="toggle-icon" style="font-size:14px; transition:transform 0.2s; transform:rotate(-90deg);">▶</span>
                                <div style="font-size:12px; font-weight:600; letter-spacing:0.05em; color:#64748b;">Arrow Style</div>
                            </div>
                            <div class="arrow-style-content" style="max-height:0px; overflow:hidden; border:1px solid #e2e8f0; border-radius:8px; padding:0px; transition:all 0.3s ease; display:block; opacity:0; visibility:hidden; background:rgba(255,255,255,0.98);">
                                <div style="font-size:11px; color:#64748b; margin-bottom:8px; padding:12px 12px 0;">Choose how to merge reciprocal predicates:</div>
                                <div class="arrow-style-options" style="padding:0 12px 8px; display:flex; flex-direction:column; gap:6px;">
                                    <label class="arrow-style-option" data-value="dual" style="cursor:pointer; display:flex; align-items:center; justify-content:space-between; border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; transition:all 0.15s;">
                                        <div>
                                            <div style="font-size:12px; font-weight:600; color:#1e293b;">Dual arrows</div>
                                            <div style="font-size:11px; color:#475569;">Render every triple individually.</div>
                                        </div>
                                        <input type="radio" name="graph-arrow-style" value="dual" class="arrow-style-radio" style="accent-color:#6366f1;">
                                    </label>
                                    <label class="arrow-style-option" data-value="single" style="cursor:pointer; display:flex; align-items:center; justify-content:space-between; border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; transition:all 0.15s;">
                                        <div>
                                            <div style="font-size:12px; font-weight:600; color:#1e293b;">Single arrow</div>
                                            <div style="font-size:11px; color:#475569;">Merge mutual predicates into one connector.</div>
                                        </div>
                                        <input type="radio" name="graph-arrow-style" value="single" class="arrow-style-radio" style="accent-color:#6366f1;">
                                    </label>
                                </div>
                                <div class="arrow-style-status" style="font-size:10px; color:#64748b; padding:0 12px 12px;">Dual arrows are active.</div>
                            </div>
                        </div>
                        <!-- Legend -->
                        <div style="margin-bottom:16px;">
                            <div style="font-size:12px; font-weight:600; letter-spacing:0.05em; color:#64748b; margin-bottom:6px;">Node Colors By Type</div>
                            <div style="font-size:11px; color:#475569; margin-bottom:10px;">Tap a chip to toggle that type (colors stay consistent with the graph).</div>
                            <div class="legend-container" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:8px;"></div>
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
        const facetPalette = [
            '#2563eb', '#0f766e', '#dc2626', '#7c3aed', '#ea580c', '#0891b2',
            '#16a34a', '#c026d3', '#ca8a04', '#4f46e5', '#db2777', '#059669'
        ];
        const hashString = (value) => {
            let hash = 0;
            const input = String(value || '');
            for (let i = 0; i < input.length; i++) {
                hash = ((hash << 5) - hash) + input.charCodeAt(i);
                hash |= 0;
            }
            return Math.abs(hash);
        };

        const colorForGroup = (g) => {
            return nodeTypes[g]?.color || nodeTypes['resource'].color;
        };
        const themeStyles = {
            dark: {
                background: '#081122',
                link: 'rgba(148,163,184,0.58)',
                linkHover: 'rgba(125,211,252,0.95)',
                arrow: 'rgba(148,163,184,0.85)',
                nodeLabel: '#f1f5f9',
                nodeLabelHalo: 'rgba(5,10,18,0.98)',
                literalLabel: '#f4fcff',
                nodeStroke: 'rgba(226,232,240,0.74)',
                pinnedStroke: 'rgba(251,113,133,0.95)',
                literalStroke: 'rgba(226,232,240,0.6)',
                iconText: '#e2e8f0',
                labelBadgeFill: 'rgba(15,23,42,0.92)',
                labelBadgeStroke: 'rgba(148,163,184,0.35)',
                labelBadgeText: '#f8fafc',
                controlBackground: 'rgba(255,255,255,0.95)',
                controlHoverBackground: 'rgba(255,255,255,1)'
            },
            light: {
                background: '#f8fafc',
                link: 'rgba(100,116,139,0.62)',
                linkHover: '#2563eb',
                arrow: 'rgba(100,116,139,0.75)',
                nodeLabel: 'rgba(15,23,42,0.92)',
                nodeLabelHalo: 'rgba(255,255,255,0.96)',
                literalLabel: 'rgba(15,23,42,0.94)',
                nodeStroke: 'rgba(255,255,255,0.92)',
                pinnedStroke: 'rgba(239,68,68,0.9)',
                literalStroke: 'rgba(255,255,255,0.92)',
                iconText: '#334155',
                labelBadgeFill: 'rgba(255,255,255,0.98)',
                labelBadgeStroke: 'rgba(203,213,225,0.9)',
                labelBadgeText: '#334155',
                controlBackground: 'rgba(255,255,255,0.95)',
                controlHoverBackground: 'rgba(255,255,255,1)'
            }
        };
        const getThemeStyle = () => themeStyles[this.theme === 'dark' ? 'dark' : 'light'];

        // Setup SVG
        const defs = svg.append("defs");
        defs.append("linearGradient")
            .attr("id", `graph-bg-gradient-${container.id}`)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "100%")
            .selectAll("stop")
            .data([
                { offset: "0%", color: "#081122" },
                { offset: "52%", color: "#0b1630" },
                { offset: "100%", color: "#111f3f" }
            ])
            .join("stop")
            .attr("offset", d => d.offset)
            .attr("stop-color", d => d.color);
        defs.append("radialGradient")
            .attr("id", `graph-vignette-${container.id}`)
            .attr("cx", "50%")
            .attr("cy", "50%")
            .attr("r", "75%")
            .selectAll("stop")
            .data([
                { offset: "0%", color: "rgba(15,23,42,0)" },
                { offset: "100%", color: "rgba(2,6,23,0.55)" }
            ])
            .join("stop")
            .attr("offset", d => d.offset)
            .attr("stop-color", d => d.color);
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

        const backgroundLayer = svg.append("g").attr("class", "graph-background");
        backgroundLayer.append("rect")
            .attr("class", "graph-surface")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", width)
            .attr("height", height)
            .attr("fill", `url(#graph-bg-gradient-${container.id})`);
        backgroundLayer.append("circle")
            .attr("class", "graph-aura")
            .attr("cx", width * 0.18)
            .attr("cy", height * 0.28)
            .attr("r", Math.max(width, height) * 0.26)
            .attr("fill", "rgba(34,197,94,0.08)");
        backgroundLayer.append("circle")
            .attr("class", "graph-aura")
            .attr("cx", width * 0.82)
            .attr("cy", height * 0.22)
            .attr("r", Math.max(width, height) * 0.22)
            .attr("fill", "rgba(59,130,246,0.09)");
        backgroundLayer.append("circle")
            .attr("class", "graph-aura")
            .attr("cx", width * 0.66)
            .attr("cy", height * 0.84)
            .attr("r", Math.max(width, height) * 0.2)
            .attr("fill", "rgba(168,85,247,0.07)");
        backgroundLayer.append("rect")
            .attr("class", "graph-vignette")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", width)
            .attr("height", height)
            .attr("fill", `url(#graph-vignette-${container.id})`);

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
        const nodeLookup = new Map(nodes.map(node => [node.id, node]));
        const connectedNodeIds = new Set();

        links.forEach(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            connectedNodeIds.add(sourceId);
            connectedNodeIds.add(targetId);
        });
        const predicateLabelForLink = (link) => link.predicateLabel || link.predicateIri || 'predicate';
        const linkPairs = new Map();
        links.forEach(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            const predicate = predicateLabelForLink(link);
            const directKey = `${predicate}|${sourceId}|${targetId}`;
            const reverseKey = `${predicate}|${targetId}|${sourceId}`;
            if (linkPairs.has(reverseKey)) {
                const partner = linkPairs.get(reverseKey);
                partner.hasMutual = true;
                partner.hideInSingleMode = false;
                link.hasMutual = true;
                link.hideInSingleMode = true;
                link.pairKey = reverseKey;
                partner.pairKey = reverseKey;
            } else {
                linkPairs.set(directKey, link);
                link.hasMutual = false;
                link.hideInSingleMode = false;
                link.pairKey = directKey;
            }
        });
        
        const hiddenNodeFacets = new Set();
        const hiddenPredicates = new Set();
        const effectiveNodeFacetById = new Map();
        let currentNodeFacets = [];
        let literalTextFilter = '';
        const literalFocusNodeIds = new Set();
        const literalFocusLinkKeys = new Set();
        const visibleEdgeKeys = new Set();
        const resolverPreferenceKey = 'osds.graph.resolverPreference';
        const resolverPatternKey = 'osds.graph.resolverPattern';
        const arrowStyleKey = 'osds.graph.arrowStyle';
        let resolverPreference = window.localStorage.getItem(resolverPreferenceKey) || 'none';
        let customResolverPattern = window.localStorage.getItem(resolverPatternKey) || '';
        let arrowStyle = window.localStorage.getItem(arrowStyleKey) || 'dual';

        const getNodeById = (nodeRef) => {
            const nodeId = typeof nodeRef === 'object' ? nodeRef.id : nodeRef;
            return nodeLookup.get(nodeId);
        };
        const buildResolvedUri = (uri) => {
            if (!uri) {
                return uri;
            }

            let pattern = '';
            if (resolverPreference === 'uriburner') {
                pattern = 'https://linkeddata.uriburner.com/describe/?url={uri}';
            } else if (resolverPreference === 'other') {
                pattern = customResolverPattern;
            }

            if (!pattern || !pattern.includes('{uri}')) {
                return uri;
            }

            return pattern.replaceAll('{uri}', encodeURIComponent(uri));
        };
        const openGraphUri = (uri) => {
            if (!uri) {
                return;
            }
            window.open(buildResolvedUri(uri), "_blank", "noopener");
        };

        const getLinkEndpoints = (link) => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            return { sourceId, targetId };
        };

        const getLinkKey = (link) => {
            const { sourceId, targetId } = getLinkEndpoints(link);
            const predicate = link.predicateLabel || link.predicateIri || 'predicate';
            return link.key || link.pairKey || `${predicate}|${sourceId}|${targetId}`;
        };

        const recomputeLiteralFocus = () => {
            literalFocusNodeIds.clear();
            literalFocusLinkKeys.clear();
            const filterValue = normalizedLiteralFilter();
            if (!filterValue) {
                return;
            }

            // Phase 1: direct focus — IRI nodes immediately connected to matching literals
            links.forEach(link => {
                const { sourceId, targetId } = getLinkEndpoints(link);
                const sourceNode = getNodeById(sourceId);
                const targetNode = getNodeById(targetId);
                const sourceMatches = sourceNode?.group === 'literal' && literalNodeMatchesFilter(sourceNode);
                const targetMatches = targetNode?.group === 'literal' && literalNodeMatchesFilter(targetNode);

                if (sourceMatches || targetMatches) {
                    literalFocusNodeIds.add(sourceId);
                    literalFocusNodeIds.add(targetId);
                    literalFocusLinkKeys.add(getLinkKey(link));
                }
            });

            // Phase 2: backward-only BFS — expand to IRI nodes that POINT TO already-focused
            // IRI nodes (parent/container nodes in the RDF hierarchy).
            // Finds FAQ pages containing focused questions, questions having focused answers, etc.
            // Does NOT expand forward (children/siblings), so hub nodes like schema:Article
            // do not pull in the entire connected graph.
            // Terminates naturally at root nodes (nothing points to them).
            let frontier = new Set(
                [...literalFocusNodeIds].filter(id => getNodeById(id)?.group !== 'literal')
            );
            while (frontier.size > 0) {
                const next = new Set();
                links.forEach(link => {
                    const { sourceId, targetId } = getLinkEndpoints(link);
                    const sourceNode = getNodeById(sourceId);
                    const targetNode = getNodeById(targetId);
                    if (sourceNode?.group === 'literal' || targetNode?.group === 'literal') return;
                    // Backward only: source points TO a focused target → add source
                    if (frontier.has(targetId) && !literalFocusNodeIds.has(sourceId)) {
                        literalFocusNodeIds.add(sourceId);
                        next.add(sourceId);
                    }
                });
                frontier = next;
            }
        };

        const isEdgeForcedVisibleByLiteral = (link) => literalFocusLinkKeys.has(getLinkKey(link));

        const recomputeVisibleEdgeKeys = () => {
            visibleEdgeKeys.clear();
            const hasLiteralFilter = !!normalizedLiteralFilter();
            links.forEach(link => {
                if (arrowStyle === 'single' && link.hideInSingleMode) return;
                if (hasLiteralFilter) {
                    const { sourceId, targetId } = getLinkEndpoints(link);
                    const sourceNode = getNodeById(sourceId);
                    const targetNode = getNodeById(targetId);
                    const bothFocusedIri = sourceNode?.group !== 'literal'
                        && targetNode?.group !== 'literal'
                        && literalFocusNodeIds.has(sourceId)
                        && literalFocusNodeIds.has(targetId);
                    if (!isEdgeForcedVisibleByLiteral(link) && !bothFocusedIri) return;
                }
                if (isEdgeVisibleBySelection(link)) {
                    visibleEdgeKeys.add(getLinkKey(link));
                }
            });
        };

        const linkIsVisibleInGraph = (link) => visibleEdgeKeys.has(getLinkKey(link));

        const normalizedLiteralFilter = () => literalTextFilter.trim().toLowerCase();
        const literalNodeMatchesFilter = (node) => {
            if (!node || node.group !== 'literal') {
                return true;
            }

            const filterValue = normalizedLiteralFilter();
            if (!filterValue) {
                return true;
            }

            const literalValue = String(node.literalValue || node.label || '').toLowerCase();
            return literalValue.includes(filterValue);
        };

        const isTypePredicate = (link) => {
            const predicateLabel = link.predicateLabel || '';
            const predicateIri = link.predicateIri || '';
            return predicateLabel === 'rdf:type'
                || predicateLabel === 'a'
                || predicateIri.endsWith('#type')
                || predicateIri.endsWith('/type');
        };

        const isPredicateVisible = (link) => !hiddenPredicates.has(link.predicateLabel || link.predicateIri);
        const isEdgeVisibleBySelection = (link) => isPredicateVisible(link) || isEdgeForcedVisibleByLiteral(link);
        const nodeIsReachableFromSelectedEdges = (nodeId) => links.some(link => {
            if (!linkIsVisibleInGraph(link)) {
                return false;
            }
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            return sourceId === nodeId || targetId === nodeId;
        });
        const nodeIsReachableFromVisibleEdges = nodeIsReachableFromSelectedEdges;
        const getActiveNodeFacet = (node) => {
            if (!node) {
                return null;
            }

            const baseFacet = node.baseFilterType || this.facetLabelForGroup(node.group);
            const visibleTypes = [];

            links.forEach(link => {
                if (!isTypePredicate(link) || !linkIsVisibleInGraph(link)) {
                    return;
                }

                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                if (sourceId !== node.id) {
                    return;
                }

                const target = getNodeById(link.target);
                if (!target || !target.iri) {
                    return;
                }

                visibleTypes.push({
                    iri: target.iri,
                    label: this.normalizeEntityTypeLabel(target.iri),
                    score: this.scoreEntityType(target.iri)
                });
            });

            if (visibleTypes.length === 0) {
                return {
                    label: baseFacet,
                    group: node.group,
                    typeIri: null
                };
            }

            visibleTypes.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
            return {
                label: visibleTypes[0].label,
                group: node.group,
                typeIri: visibleTypes[0].iri
            };
        };

        const colorForFacet = (facet) => {
            if (!facet) {
                return colorForGroup('resource');
            }
            const key = typeof facet === 'string' ? facet : facet.label;
            const hue = hashString(key) % 360;
            const saturation = 60 + (hashString(key + 'sat') % 20); // 60-79
            const lightness = facet.group === 'literal' ? 55 : 48;
            return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        };

        const recomputeNodeFacetState = () => {
            effectiveNodeFacetById.clear();
            const facetMap = new Map();

            nodes.forEach(node => {
                const facet = getActiveNodeFacet(node);
                effectiveNodeFacetById.set(node.id, facet);

                if (!literalNodeMatchesFilter(node)) {
                    return;
                }

                const hasVisibleEdge = nodeIsReachableFromVisibleEdges(node.id);
                const isStandalone = !connectedNodeIds.has(node.id);
                if (!hasVisibleEdge && !isStandalone) {
                    return;
                }

                if (!facetMap.has(facet.label)) {
                    facetMap.set(facet.label, {
                        label: facet.label,
                        count: 0,
                        group: facet.group,
                        color: colorForFacet(facet)
                    });
                }

                const entry = facetMap.get(facet.label);
                entry.count++;
                if (entry.group === 'resource' && facet.group !== 'resource') {
                    entry.group = facet.group;
                }
            });

            currentNodeFacets = Array.from(facetMap.values())
                .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

            hiddenNodeFacets.forEach(label => {
                if (!facetMap.has(label)) {
                    hiddenNodeFacets.delete(label);
                }
            });
        };

        const getCurrentFacetForNode = (node) => effectiveNodeFacetById.get(node.id) || {
            label: node.baseFilterType || this.facetLabelForGroup(node.group),
            group: node.group,
            typeIri: null
        };

        const isNodeVisible = (node) => {
            if (!literalNodeMatchesFilter(node) && !literalFocusNodeIds.has(node.id)) {
                return false;
            }

            if (literalFocusNodeIds.has(node.id)) {
                return true;
            }

            return !hiddenNodeFacets.has(getCurrentFacetForNode(node).label);
        };
        const isLinkVisible = (link) => {
            const source = getNodeById(link.source);
            const target = getNodeById(link.target);
            return !!source && !!target && isNodeVisible(source) && isNodeVisible(target) && linkIsVisibleInGraph(link);
        };

        const applyVisibilityFilters = () => {
            recomputeLiteralFocus();
            recomputeVisibleEdgeKeys();
            recomputeNodeFacetState();
            const connectedVisibleNodes = new Set();

            // Build connected set from edges where the source node passes the facet filter.
            // Both endpoints are added so that target nodes (e.g. class nodes like schema:FAQPage)
            // remain visible even when their own facet is not in the selected set.
            links.forEach(link => {
                if (!linkIsVisibleInGraph(link)) {
                    return;
                }
                const { sourceId, targetId } = getLinkEndpoints(link);
                const source = getNodeById(sourceId);
                if (source && isNodeVisible(source)) {
                    connectedVisibleNodes.add(sourceId);
                    connectedVisibleNodes.add(targetId);
                }
            });

            nodeSel.style('display', d => {
                const nodeVisible = isNodeVisible(d);
                const hasVisibleConnection = connectedVisibleNodes.has(d.id);
                const isStandalone = !connectedNodeIds.has(d.id);

                // Hide if not visible by facet AND not reachable from a visible-facet source
                if (!nodeVisible && !hasVisibleConnection) {
                    return 'none';
                }
                // Visible-by-facet nodes still need a connection (or be standalone)
                if (nodeVisible && !hasVisibleConnection && !isStandalone && !literalFocusNodeIds.has(d.id)) {
                    return 'none';
                }

                return null;
            });

            // Hide an edge if its source node is hidden by the facet filter.
            // Targets (e.g. class nodes) are allowed to be invisible by facet —
            // they render because they are reachable from a visible source.
            const isLinkVisibleForDisplay = (link) => {
                const source = getNodeById(link.source);
                return !!source && isNodeVisible(source) && linkIsVisibleInGraph(link);
            };
            linkSel.style('display', d => isLinkVisibleForDisplay(d) ? null : 'none');
            iconSel.style('display', d => isLinkVisibleForDisplay(d) ? null : 'none');
            refreshNodeFilterUI();
            refreshLegendUI();
            refreshLiteralFilterUI();
            refreshNodeColors();
        };
        
        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links)
                .id(d => d.id)
                .distance(d => {
                    const source = getNodeById(d.source);
                    const target = getNodeById(d.target);
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
            .attr("stroke", getThemeStyle().link)
            .attr("stroke-width", 1.7)
            .attr("fill", "none")
            .attr("marker-end", `url(#arrow-${container.id})`)
            .style("opacity", 0.82)
            .style("cursor", "pointer")
            .on("mouseenter", function() {
                d3.select(this)
                    .attr("stroke", getThemeStyle().linkHover)
                    .attr("stroke-width", 2.8)
                    .style("opacity", 1);
            })
            .on("mouseleave", function() {
                d3.select(this)
                    .attr("stroke", getThemeStyle().link)
                    .attr("stroke-width", 1.7)
                    .style("opacity", 0.82);
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
                        .attr("fill", getThemeStyle().labelBadgeFill)
                        .attr("stroke", getThemeStyle().labelBadgeStroke)
                        .attr("stroke-width", 1)
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
                        .attr("fill", getThemeStyle().iconText)
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
                                openGraphUri(d.predicateIri);
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
                if (d.iri) openGraphUri(d.iri);
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
                linkSel.style("opacity", 0.82);
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
                    .attr("r", d.size + 5)
                    .attr("fill", colorForGroup(d.group))
                    .attr("opacity", d.group === 'literal' ? 0.08 : 0.22)
                    .attr("class", "glow-ring");
            }
            
            if (d.shape === 'rect') {
                // Rectangular nodes for literals with rounded corners
                g.append("rect")
                    .attr("class", "node-shape")
                    .attr("x", -d.size * 2)
                    .attr("y", -d.size)
                    .attr("width", d.size * 4)
                    .attr("height", d.size * 2)
                    .attr("rx", 4)
                    .attr("fill", colorForGroup(d.group))
                    .attr("fill-opacity", this.theme === 'dark' ? 0.2 : 0.9)
                    .attr("stroke", getThemeStyle().literalStroke)
                    .attr("stroke-width", 1.4)
                    .style("filter", "drop-shadow(0px 10px 18px rgba(2,6,23,0.32))");
            } else {
                // Circular nodes for resources with enhanced stroke
                g.append("circle")
                    .attr("class", "node-shape")
                    .attr("r", d.size)
                    .attr("fill", colorForGroup(d.group))
                    .attr("fill-opacity", 0.96)
                    .attr("stroke", d._pinned ? getThemeStyle().pinnedStroke : getThemeStyle().nodeStroke)
                    .attr("stroke-width", d._pinned ? 2.8 : 1.8)
                    .style("filter", "drop-shadow(0px 10px 18px rgba(2,6,23,0.28))");
            }
            
            // Node label with improved styling
            g.append("text")
                .attr("class", "node-label")
                .attr("x", d.shape === 'rect' ? 0 : d.size + 10)
                .attr("y", d.shape === 'rect' ? 0 : 5)
                .attr("text-anchor", d.shape === 'rect' ? "middle" : "start")
                .attr("fill", d.group === 'literal' ? getThemeStyle().literalLabel : getThemeStyle().nodeLabel)
                .attr("font-size", d.group === 'literal' ? 10.5 : (d.size > 15 ? 13.5 : 12.5))
                .attr("font-weight", d.size > 15 ? 700 : 600)
                .attr("stroke", getThemeStyle().nodeLabelHalo)
                .attr("stroke-width", d.group === 'literal' ? 3.4 : 3.1)
                .attr("stroke-linejoin", "round")
                .attr("paint-order", "stroke")
                .style("letter-spacing", "0.01em")
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

        const applyGraphTheme = () => {
            const isDark = this.theme === 'dark';
            const theme = getThemeStyle();

            svg.style("background", theme.background);
            backgroundLayer.select('.graph-surface')
                .attr('fill', isDark ? `url(#graph-bg-gradient-${container.id})` : '#f8fafc');
            backgroundLayer.selectAll('.graph-aura')
                .style('display', isDark ? null : 'none');
            backgroundLayer.select('.graph-vignette')
                .style('display', isDark ? null : 'none');

            defs.select("marker path").attr("fill", theme.arrow);
            linkSel.attr("stroke", theme.link).style("opacity", 0.82);

            nodeSel.selectAll('.node-label')
                .attr('fill', d => d.group === 'literal' ? theme.literalLabel : theme.nodeLabel)
                .attr('stroke', theme.nodeLabelHalo);
            nodeSel.selectAll('circle.node-shape')
                .attr("stroke", d => d._pinned ? theme.pinnedStroke : theme.nodeStroke);
            nodeSel.selectAll('rect.node-shape')
                .attr("stroke", theme.literalStroke)
                .attr("fill-opacity", isDark ? 0.2 : 0.9);
            nodeSel.selectAll('.glow-ring')
                .attr('opacity', d => isDark ? (d.group === 'literal' ? 0.08 : 0.22) : (d.group === 'literal' ? 0.08 : 0.15));

            iconSel.selectAll('.predicate-background')
                .attr('fill', theme.labelBadgeFill)
                .attr('stroke', theme.labelBadgeStroke);
            iconSel.selectAll('.predicate-text')
                .attr('fill', function() {
                    const size = d3.select(this).attr('font-size');
                    return size === '16px' ? theme.iconText : theme.labelBadgeText;
                });
        };

        // Controls
        const fullscreenBtn = container.querySelector('.graph-fullscreen-btn');
        if (fullscreenBtn) {
            if (Browser.is_safari)
                fullscreenBtn.style.display = 'none';
            
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
                applyGraphTheme();
            });
        }

        // SPARQL CONSTRUCT panel
        const sparqlBtn = container.querySelector('.graph-sparql-btn');
        if (sparqlBtn) {
            const buildSparqlConstruct = () => {
                const visibleLinks = links.filter(link => {
                    const source = getNodeById(link.source);
                    return !!source && isNodeVisible(source) && linkIsVisibleInGraph(link);
                });
                if (visibleLinks.length === 0) return null;

                const usedPrefixes = new Map();
                const iriTerm = (iri) => {
                    if (!iri) return null;
                    if (!this.namespaceMap) this.initNamespaces();
                    for (const [nsUri, prefix] of this.namespaceMap) {
                        if (iri.startsWith(nsUri)) {
                            const local = iri.slice(nsUri.length);
                            if (/^[a-zA-Z_][a-zA-Z0-9_\-]*$/.test(local)) {
                                usedPrefixes.set(prefix, nsUri);
                                return `${prefix}:${local}`;
                            }
                        }
                    }
                    return `<${iri}>`;
                };
                const literalTerm = (value) => {
                    const v = String(value);
                    const escaped = v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
                    return `"${escaped}"`;
                };

                const tripleLines = visibleLinks.map(link => {
                    const { sourceId, targetId } = getLinkEndpoints(link);
                    const sourceNode = getNodeById(sourceId);
                    const targetNode = getNodeById(targetId);
                    const s = iriTerm(sourceNode?.iri || sourceId);
                    const p = iriTerm(link.predicateIri);
                    const o = targetNode?.group === 'literal'
                        ? literalTerm(targetNode.id)
                        : iriTerm(targetNode?.iri || targetId);
                    if (!s || !p || !o) return null;
                    return `  ${s} ${p} ${o} .`;
                }).filter(Boolean);

                if (tripleLines.length === 0) return null;

                const prefixLines = Array.from(usedPrefixes.entries())
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([prefix, uri]) => `PREFIX ${prefix}: <${uri}>`);

                const parts = [];
                if (prefixLines.length > 0) { parts.push(...prefixLines); parts.push(''); }
                parts.push('CONSTRUCT {'); parts.push(...tripleLines); parts.push('}');
                parts.push('WHERE {'); parts.push(...tripleLines); parts.push('}');
                return parts.join('\n');
            };

            sparqlBtn.addEventListener('click', () => {
                // Remove any existing SPARQL modal
                const existing = container.querySelector('.graph-sparql-modal');
                if (existing) { existing.remove(); return; }

                const query = buildSparqlConstruct();
                const theme = getThemeStyle();
                const modal = document.createElement('div');
                modal.className = 'graph-sparql-modal';
                modal.style.cssText = `position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); z-index:50; width:min(560px,90%); max-height:80%; display:flex; flex-direction:column; background:${theme.labelBadgeFill}; border:1px solid ${theme.labelBadgeStroke}; border-radius:12px; box-shadow:0 20px 60px rgba(0,0,0,0.3); overflow:hidden;`;

                const header = document.createElement('div');
                header.style.cssText = `display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid ${theme.labelBadgeStroke}; flex-shrink:0;`;
                header.innerHTML = `<span style="font-size:13px; font-weight:600; color:${theme.labelBadgeText};">SPARQL CONSTRUCT — current selection</span>`;

                const closeBtn = document.createElement('button');
                closeBtn.textContent = '✕';
                closeBtn.style.cssText = `background:none; border:none; cursor:pointer; font-size:14px; color:${theme.iconText}; padding:2px 6px; border-radius:4px;`;
                closeBtn.addEventListener('click', () => modal.remove());
                header.appendChild(closeBtn);

                const body = document.createElement('div');
                body.style.cssText = 'padding:12px 16px; overflow:auto; flex:1;';

                const queryText = query || '# No visible triples match the current selection.';
                const textarea = document.createElement('textarea');
                textarea.readOnly = true;
                textarea.value = queryText;
                textarea.style.cssText = `width:100%; min-height:240px; font-family:monospace; font-size:12px; line-height:1.5; background:${theme.background}; color:${theme.labelBadgeText}; border:1px solid ${theme.labelBadgeStroke}; border-radius:6px; padding:10px; resize:vertical; box-sizing:border-box; outline:none;`;
                body.appendChild(textarea);

                const footer = document.createElement('div');
                footer.style.cssText = `display:flex; justify-content:flex-end; gap:8px; padding:10px 16px; border-top:1px solid ${theme.labelBadgeStroke}; flex-shrink:0;`;
                const copyBtn = document.createElement('button');
                copyBtn.textContent = 'Copy';
                copyBtn.style.cssText = `padding:6px 14px; background:#3b82f6; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:12px; font-weight:500;`;
                copyBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(queryText).then(() => {
                        copyBtn.textContent = 'Copied!';
                        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
                    }).catch(() => { textarea.select(); document.execCommand('copy'); });
                });
                footer.appendChild(copyBtn);

                modal.appendChild(header);
                modal.appendChild(body);
                modal.appendChild(footer);
                container.appendChild(modal);
            });
        }

        // Settings panel
        const settingsBtn = container.querySelector('.graph-settings-btn');
        const settingsPanel = container.querySelector('.graph-settings-panel');
        const settingsCloseBtn = container.querySelector('.settings-close-btn');

        // Add hover effects to all control buttons
        const allControlBtns = container.querySelectorAll('.graph-sparql-btn, .graph-fullscreen-btn, .graph-center-btn, .graph-theme-btn, .graph-settings-btn');
        allControlBtns.forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.background = getThemeStyle().controlHoverBackground;
                btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                btn.style.transform = 'translateY(-1px)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = getThemeStyle().controlBackground;
                btn.style.boxShadow = 'none';
                btn.style.transform = 'translateY(0)';
            });
        });
        
        if (settingsBtn && settingsPanel) {
            settingsBtn.addEventListener('click', () => {
                const isVisible = settingsPanel.style.display !== 'none';
                settingsPanel.style.display = isVisible ? 'none' : 'flex';
                if (!isVisible) {
                    requestAnimationFrame(() => {
                        container.querySelectorAll('.filter-section-toggle').forEach(toggle => {
                            toggle.dispatchEvent(new CustomEvent('filter:refresh'));
                        });
                    });
                }
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
                        const source = getNodeById(d.source);
                        const target = getNodeById(d.target);
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
                                .attr("font-size", "8px")
                                .attr("font-weight", "600")
                                .attr("fill", getThemeStyle().labelBadgeText);
                            
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
                                .attr("fill", getThemeStyle().iconText);
                            
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

        const initializeCollapsibleFilter = (toggleSelector, contentSelector, initiallyExpanded = true) => {
            const toggleButton = container.querySelector(toggleSelector);
            const toggleIcon = container.querySelector(`${toggleSelector} .toggle-icon`);
            const filterContent = container.querySelector(contentSelector);

            if (!toggleButton || !filterContent) {
                return;
            }

            let isExpanded = initiallyExpanded;
            toggleButton.classList.add('filter-section-toggle');

            const getContentHeight = () => {
                const originalMaxHeight = filterContent.style.maxHeight;
                const originalVisibility = filterContent.style.visibility;
                const originalDisplay = filterContent.style.display;

                filterContent.style.maxHeight = 'none';
                filterContent.style.visibility = 'hidden';
                filterContent.style.display = 'block';

                const height = filterContent.scrollHeight;

                filterContent.style.maxHeight = originalMaxHeight;
                filterContent.style.visibility = originalVisibility;
                filterContent.style.display = originalDisplay;

                return height;
            };

            const syncState = () => {
                if (isExpanded) {
                    const height = getContentHeight();
                    filterContent.style.display = 'block';
                    filterContent.style.visibility = 'visible';
                    filterContent.style.maxHeight = height + 'px';
                    filterContent.style.opacity = '1';
                    filterContent.style.overflow = 'hidden';
                    if (toggleIcon) {
                        toggleIcon.style.transform = 'rotate(0deg)';
                    }
                    setTimeout(() => {
                        if (isExpanded) {
                            filterContent.style.overflow = 'auto';
                        }
                    }, 300);
                } else {
                    filterContent.style.maxHeight = '0px';
                    filterContent.style.opacity = '0';
                    filterContent.style.overflow = 'hidden';
                    if (toggleIcon) {
                        toggleIcon.style.transform = 'rotate(-90deg)';
                    }

                    setTimeout(() => {
                        if (!isExpanded) {
                            filterContent.style.visibility = 'hidden';
                        }
                    }, 300);
                }
            };

            syncState();

            toggleButton.addEventListener('click', () => {
                isExpanded = !isExpanded;
                syncState();
            });

            toggleButton.addEventListener('filter:refresh', () => {
                if (isExpanded) {
                    syncState();
                }
            });

            toggleButton.addEventListener('mouseenter', () => {
                toggleButton.style.background = 'rgba(226,232,240,0.5)';
            });
            toggleButton.addEventListener('mouseleave', () => {
                toggleButton.style.background = 'transparent';
            });
        };

        const filterContainer = container.querySelector('.filter-container');
        const legendContainer = container.querySelector('.legend-container');

        const createInteractiveFacetChip = (facet, compact = false) => {
            const chip = document.createElement('button');
            const isHidden = hiddenNodeFacets.has(facet.label);
            chip.type = 'button';
            chip.className = compact ? 'legend-chip' : 'node-filter-chip';
            chip.dataset.nodeFacet = facet.label;
            chip.style.cssText = [
                'display:flex',
                'align-items:center',
                'gap:7px',
                compact ? 'padding:7px 11px' : 'padding:6px 8px',
                'width:100%',
                'border-radius:7px',
                `border:1px solid ${isHidden ? 'rgba(203,213,225,0.95)' : 'rgba(191,219,254,0.95)'}`,
                `background:${isHidden ? 'rgba(248,250,252,0.88)' : 'rgba(255,255,255,0.98)'}`,
                `opacity:${isHidden ? '0.65' : '1'}`,
                'font-size:11px',
                'color:rgba(15,23,42,0.92)',
                'font-weight:500',
                'cursor:pointer',
                'transition:all 0.2s',
                compact ? '' : 'text-align:left'
            ].filter(Boolean).join(';');

            chip.innerHTML = `
                <span style="width:11px; height:11px; border-radius:50%; background:${facet.color}; box-shadow:0 0 0 2px rgba(255,255,255,0.75); flex-shrink:0;"></span>
                <span style="font-size:14px; flex-shrink:0;">${nodeTypes[facet.group]?.icon || '🔗'}</span>
                <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${facet.label}</span>
                <span style="font-size:10px; color:#64748b; font-weight:600; background:#f1f5f9; padding:1px 6px; border-radius:4px;">${facet.count}</span>
            `;

            chip.addEventListener('mouseenter', () => {
                chip.style.transform = 'translateY(-1px)';
                chip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
            });
            chip.addEventListener('mouseleave', () => {
                chip.style.transform = 'translateY(0)';
                chip.style.boxShadow = 'none';
            });
            chip.addEventListener('click', () => {
                if (hiddenNodeFacets.has(facet.label)) {
                    hiddenNodeFacets.delete(facet.label);
                } else {
                    hiddenNodeFacets.add(facet.label);
                }
                applyVisibilityFilters();
            });

            return chip;
        };

        const refreshNodeFilterUI = () => {
            if (!filterContainer) {
                return;
            }

            filterContainer.innerHTML = '';
            currentNodeFacets.forEach(facet => {
                const wrapper = document.createElement('div');
                wrapper.style.cssText = 'display:flex; align-items:center; background:transparent; border-radius:6px;';

                const label = document.createElement('label');
                label.style.cssText = 'display:flex; align-items:center; padding:0; gap:8px; cursor:pointer; flex:1;';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = !hiddenNodeFacets.has(facet.label);
                checkbox.style.cssText = 'width:16px; height:16px; cursor:pointer; accent-color:#3b82f6; border-radius:4px; flex-shrink:0;';
                checkbox.dataset.nodeFacet = facet.label;

                const chip = createInteractiveFacetChip(facet, false);
                chip.style.width = 'calc(100% - 24px)';
                chip.addEventListener('click', (event) => {
                    event.preventDefault();
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                });

                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        hiddenNodeFacets.delete(facet.label);
                    } else {
                        hiddenNodeFacets.add(facet.label);
                    }
                    applyVisibilityFilters();
                });

                label.appendChild(checkbox);
                label.appendChild(chip);
                wrapper.appendChild(label);
                filterContainer.appendChild(wrapper);
            });
        };

        const refreshLegendUI = () => {
            if (!legendContainer) {
                return;
            }

            legendContainer.innerHTML = '';
            currentNodeFacets.forEach(facet => {
                legendContainer.appendChild(createInteractiveFacetChip(facet, true));
            });
        };

        const refreshNodeColors = () => {
            if (!nodeSel) {
                return;
            }

            nodeSel.each(function(d) {
                const g = d3.select(this);
                const facet = getCurrentFacetForNode(d);
                const fillColor = colorForFacet(facet);

                g.select('.glow-ring')
                    .attr('fill', fillColor);
                g.selectAll('circle:not(.glow-ring)')
                    .attr('fill', fillColor);
                g.select('rect')
                    .attr('fill', fillColor);
            });
        };

        const literalFilterInput = container.querySelector('.literal-text-input');
        const literalFilterStatus = container.querySelector('.literal-filter-status');
        const clearLiteralFilterBtn = container.querySelector('.clear-literal-filter');
        const resolverStatus = container.querySelector('.resolver-status');
        const resolverPatternInput = container.querySelector('.resolver-pattern-input');
        const resolverPrefRadios = container.querySelectorAll('.resolver-pref-radio');
        const resolverOptionLabels = container.querySelectorAll('.resolver-option');

        const refreshLiteralFilterUI = () => {
            if (!literalFilterStatus || !literalFilterInput || !clearLiteralFilterBtn) {
                return;
            }

            literalFilterInput.value = literalTextFilter;
            clearLiteralFilterBtn.disabled = !literalTextFilter;
            clearLiteralFilterBtn.style.opacity = literalTextFilter ? '1' : '0.6';
            clearLiteralFilterBtn.style.cursor = literalTextFilter ? 'pointer' : 'default';

            const visibleLiteralCount = nodes.filter(node => node.group === 'literal' && literalNodeMatchesFilter(node) && nodeIsReachableFromVisibleEdges(node.id)).length;
            const totalLiteralCount = nodes.filter(node => node.group === 'literal' && nodeIsReachableFromSelectedEdges(node.id)).length;

            if (!literalTextFilter) {
                literalFilterStatus.textContent = totalLiteralCount > 0
                    ? `Showing all ${totalLiteralCount} literal values in the current graph.`
                    : 'No literal values are currently visible in the graph.';
                return;
            }

            literalFilterStatus.textContent = `Showing ${visibleLiteralCount} of ${totalLiteralCount} literal values matching "${literalTextFilter}".`;
        };
        const refreshResolverUI = () => {
            if (!resolverStatus || !resolverPatternInput || resolverPrefRadios.length === 0) {
                return;
            }

            resolverPrefRadios.forEach(radio => {
                radio.checked = radio.value === resolverPreference;
            });

            resolverPatternInput.value = customResolverPattern;
            resolverPatternInput.style.display = resolverPreference === 'other' ? 'block' : 'none';

            if (resolverPreference === 'none') {
                resolverStatus.textContent = 'IRIs currently open directly.';
            } else if (resolverPreference === 'uriburner') {
                resolverStatus.textContent = 'IRIs will open through the built-in Linked Data resolver.';
            } else if (customResolverPattern && customResolverPattern.includes('{uri}')) {
                resolverStatus.textContent = `IRIs will open using the custom resolver pattern.`;
            } else {
                resolverStatus.textContent = 'Enter a custom pattern containing {uri}.';
            }
            markResolverSelection();
        };
        const markResolverSelection = () => {
            resolverOptionLabels.forEach(label => {
                const optionValue = label.dataset.value;
                const isSelected = optionValue === resolverPreference;
                label.style.borderColor = isSelected ? '#3b82f6' : '#e2e8f0';
                label.style.background = isSelected ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0)';
                label.style.boxShadow = isSelected ? '0 8px 24px rgba(59,130,246,0.25)' : 'none';
                label.style.fontWeight = isSelected ? '600' : '500';
            });
        };

        const selectAllNodesBtn = container.querySelector('.select-all-nodes');
        const deselectAllNodesBtn = container.querySelector('.deselect-all-nodes');

        if (selectAllNodesBtn) {
            selectAllNodesBtn.addEventListener('click', () => {
                hiddenNodeFacets.clear();
                applyVisibilityFilters();
            });
        }

        if (literalFilterInput) {
            let literalFilterDebounce = null;
            literalFilterInput.addEventListener('input', (event) => {
                const nextValue = event.target.value;
                window.clearTimeout(literalFilterDebounce);
                literalFilterDebounce = window.setTimeout(() => {
                    literalTextFilter = nextValue;
                    applyVisibilityFilters();
                }, 150);
            });
            literalFilterInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    literalTextFilter = event.target.value;
                    window.clearTimeout(literalFilterDebounce);
                    applyVisibilityFilters();
                }
            });
        }

        if (clearLiteralFilterBtn) {
            clearLiteralFilterBtn.addEventListener('click', () => {
                if (!literalTextFilter) {
                    return;
                }
                literalTextFilter = '';
                if (literalFilterInput) {
                    literalFilterInput.value = '';
                }
                applyVisibilityFilters();
            });
        }

        if (resolverPrefRadios.length > 0) {
            resolverPrefRadios.forEach(radio => {
                radio.addEventListener('change', () => {
                    resolverPreference = radio.value;
                    window.localStorage.setItem(resolverPreferenceKey, resolverPreference);
                    refreshResolverUI();
                });
            });
        }

        if (resolverPatternInput) {
            resolverPatternInput.addEventListener('input', (event) => {
                customResolverPattern = event.target.value.trim();
                window.localStorage.setItem(resolverPatternKey, customResolverPattern);
                refreshResolverUI();
            });
        }

        const arrowStyleRadios = container.querySelectorAll('.arrow-style-radio');
        const arrowStyleOptionLabels = container.querySelectorAll('.arrow-style-option');
        const arrowStyleStatus = container.querySelector('.arrow-style-status');
        const refreshArrowStyleUI = () => {
            arrowStyleRadios.forEach(radio => {
                radio.checked = radio.value === arrowStyle;
            });
            arrowStyleOptionLabels.forEach(label => {
                const isSelected = label.dataset.value === arrowStyle;
                label.style.borderColor = isSelected ? '#3b82f6' : '#e2e8f0';
                label.style.background = isSelected ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0)';
                label.style.boxShadow = isSelected ? '0 8px 24px rgba(59,130,246,0.25)' : 'none';
            });
            if (arrowStyleStatus) {
                arrowStyleStatus.textContent = arrowStyle === 'single'
                    ? 'Mutual predicates are merged into one connector.'
                    : 'Dual arrows are active.';
            }
        };
        if (arrowStyleRadios.length > 0) {
            arrowStyleRadios.forEach(radio => {
                radio.addEventListener('change', () => {
                    arrowStyle = radio.value;
                    window.localStorage.setItem(arrowStyleKey, arrowStyle);
                    refreshArrowStyleUI();
                    applyVisibilityFilters();
                });
            });
        }

        if (deselectAllNodesBtn) {
            deselectAllNodesBtn.addEventListener('click', () => {
                currentNodeFacets.forEach(facet => {
                    hiddenNodeFacets.add(facet.label);
                });
                applyVisibilityFilters();
            });
        }
        
        // Build predicate filter checkboxes
        const predicateCheckboxesContainer = container.querySelector('.predicate-checkboxes');
        if (predicateCheckboxesContainer) {
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
                        openGraphUri(predicate.iri);
                    }
                });
                
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        hiddenPredicates.delete(predicate.label);
                    } else {
                        hiddenPredicates.add(predicate.label);
                    }

                    applyVisibilityFilters();
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
                    
                    hiddenPredicates.clear();
                    applyVisibilityFilters();
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

                    applyVisibilityFilters();
                });
            }
        }

        initializeCollapsibleFilter('.node-filter-toggle', '.node-filter-content', false);
        initializeCollapsibleFilter('.edge-filter-toggle', '.edge-filter-content', false);
        initializeCollapsibleFilter('.literal-filter-toggle', '.literal-filter-content', false);
        initializeCollapsibleFilter('.resolver-filter-toggle', '.resolver-filter-content', false);
        refreshResolverUI();
        refreshArrowStyleUI();
        applyGraphTheme();
        applyVisibilityFilters();

        // Initial zoom with smooth animation (reduced to fit ~90% of graph in viewport)
        svg.call(zoom.transform, d3.zoomIdentity.scale(0.65));
    }
}
