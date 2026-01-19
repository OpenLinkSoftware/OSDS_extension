class Spreadsheet_Block extends DataBlock {
    constructor(_baseURL, _text, _n3data) {
        super(_baseURL, _text);
        this.n3data = _n3data;
    }

    async to_html(bnode_types, start_id) {
        var html = null;
        var error = [];

        try {
            console.log('[OSDS Spreadsheet] to_html called with data:', this.n3data ? this.n3data.length : 0, 'items');
            if (this.n3data) {
                html = new Spreadsheet_Gen(this.baseURL, bnode_types).load(this.n3data);
                console.log('[OSDS Spreadsheet] Generated HTML length:', html ? html.length : 0);
            }
            return { start_id: 0, html, error };
        } catch (ex) {
            console.error('[OSDS Spreadsheet] Error:', ex);
            error.push(ex.toString());
            return { start_id: 0, html: null, error };
        }
    }
}

class Spreadsheet_Gen {
    constructor(_docURI, bnode_types, uimode) {
        this.ns = new Namespace();
        this.uimode = uimode || "ui-eav";
        this.docURI = _docURI;
        this.bnode_types = bnode_types || {};
    }

    load(n_data, start_id = 0, _base) {
        if (_base) {
            this.docURI = _base;
        }

        if (!n_data || n_data.length === 0) {
            return "";
        }

        // 1. Group entities by rdf:type
        const typeGroups = {};
        const untypedEntities = [];

        for (let i = 0; i < n_data.length; i++) {
            const item = n_data[i];
            if (!item) continue;
            let entityType = null;

            if (item.props && item.props[this.ns.RDF_TYPE]) {
                const types = item.props[this.ns.RDF_TYPE];
                if (Array.isArray(types) && types.length > 0 && types[0] && types[0].iri) {
                    entityType = types[0].iri;
                }
            }

            if (entityType) {
                if (!typeGroups[entityType]) {
                    typeGroups[entityType] = [];
                }
                typeGroups[entityType].push(item);
            } else {
                untypedEntities.push(item);
            }
        }

        let html = "";

        // 2. Generate table for each group
        for (const [typeIri, entities] of Object.entries(typeGroups)) {
            html += this.generateTableForType(typeIri, entities);
        }

        if (untypedEntities.length > 0) {
            html += this.generateTableForType("Untyped Entities", untypedEntities, true);
        }

        return html;
    }

    generateTableForType(typeIri, entities, isUntyped = false) {
        // Collect all unique predicates (columns)
        const predicates = new Set();
        entities.forEach(entity => {
            if (entity.props) {
                Object.keys(entity.props).forEach(pred => {
                    if (pred !== this.ns.RDF_TYPE) { // Exclude rdf:type from columns as it's the grouping key
                        predicates.add(pred);
                    }
                });
            }
        });

        const sortedPredicates = Array.from(predicates).sort();
        const typeLabel = isUntyped ? typeIri : this.iri2html(typeIri);
        const tableId = 'table_' + Math.random().toString(36).substr(2, 9);

        let tableHtml = `
      <div class="spreadsheet-container">
        <h3>Type: ${typeLabel} (${entities.length})</h3>
        <table id="${tableId}" class="docdata table spreadsheet sortable">
          <thead>
            <tr>
              <th class="sortable-header" data-column="subject">Subject <span class="sort-indicator"></span></th>
              ${sortedPredicates.map((pred, idx) => `<th class="sortable-header" data-column="${idx}">${this.iri2html(pred)} <span class="sort-indicator"></span></th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;

        entities.forEach(entity => {
            tableHtml += `<tr>`;

            // Subject Column
            tableHtml += `<td data-value="${this.escapeHtml(entity.s)}">${this.formatValue(entity.s)}</td>`;

            // Predicate Columns
            sortedPredicates.forEach(pred => {
                const values = entity.props ? entity.props[pred] : null;
                if (values && Array.isArray(values) && values.length > 0) {
                    const cellContent = values.map(val => val ? this.formatObject(val) : '').join('<br>');
                    const firstVal = values[0] || {};
                    const sortValue = firstVal.iri || firstVal.value || '';
                    tableHtml += `<td data-value="${this.escapeHtml(sortValue)}">${cellContent}</td>`;
                } else {
                    tableHtml += `<td data-value=""></td>`;
                }
            });

            tableHtml += `</tr>`;
        });

        tableHtml += `
          </tbody>
        </table>
        <script>
          (function() {
            const table = document.getElementById('${tableId}');
            if (!table) return;
            
            const headers = table.querySelectorAll('.sortable-header');
            let currentSort = { column: null, ascending: true };
            
            headers.forEach(header => {
              header.style.cursor = 'pointer';
              header.style.userSelect = 'none';
              
              header.addEventListener('click', function() {
                const column = this.dataset.column;
                const tbody = table.querySelector('tbody');
                const rows = Array.from(tbody.querySelectorAll('tr'));
                
                // Toggle sort direction if same column
                if (currentSort.column === column) {
                  currentSort.ascending = !currentSort.ascending;
                } else {
                  currentSort.column = column;
                  currentSort.ascending = true;
                }
                
                // Get column index
                const columnIndex = column === 'subject' ? 0 : parseInt(column) + 1;
                
                // Sort rows
                rows.sort((a, b) => {
                  const aVal = a.cells[columnIndex].dataset.value || '';
                  const bVal = b.cells[columnIndex].dataset.value || '';
                  
                  const comparison = aVal.localeCompare(bVal);
                  return currentSort.ascending ? comparison : -comparison;
                });
                
                // Reappend rows
                rows.forEach(row => tbody.appendChild(row));
                
                // Update indicators
                headers.forEach(h => {
                  const indicator = h.querySelector('.sort-indicator');
                  if (h === header) {
                    indicator.textContent = currentSort.ascending ? ' ▲' : ' ▼';
                  } else {
                    indicator.textContent = '';
                  }
                });
              });
            });
          })();
        </script>
      </div>
      <hr/>
    `;

        return tableHtml;
    }

    formatObject(obj) {
        if (!obj) return "";
        if (obj.iri) {
            return this.formatValue(obj.iri);
        } else if (obj.value) {
            let val = obj.value;
            if (obj.lang) {
                val += `@${obj.lang}`;
            }
            return this.escapeHtml(val);
        }
        return "";
    }

    escapeHtml(text) {
        if (typeof text !== 'string') return '';
        return text.replace(/&/g, "&amp;")
                   .replace(/</g, "&lt;")
                   .replace(/>/g, "&gt;")
                   .replace(/"/g, "&quot;")
                   .replace(/'/g, "&#039;");
    }

    formatValue(val) {
        // Simple IRI formatting
        if (val.startsWith("http")) {
            return `<a href="${val}" target="_blank">${val}</a>`;
        }
        return val;
    }

    iri2html(iri) {
        // Simplified version of iri2html from html_gen.js
        // Try to use prefixes if available
        const pref = this.ns.has_known_ns(iri);
        if (pref) {
            const local = iri.substring(pref.link.length);
            return `${pref.ns}:${local}`;
        }

        // Fallback to last part of URI
        try {
            const u = new URL(iri);
            if (u.hash) return u.hash.substring(1);
            const parts = u.pathname.split('/');
            return parts[parts.length - 1] || iri;
        } catch (e) {
            return iri;
        }
    }
}
