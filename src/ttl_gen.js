/*
 *  This file is part of the OpenLink Structured Data Sniffer
 *
 *  Copyright (C) 2015-2021 OpenLink Software
 *
 *  This project is free software; you can redistribute it and/or modify it
 *  under the terms of the GNU General Public License as published by the
 *  Free Software Foundation; only version 2 of the License, dated June 1991.
 *
 *  This program is distributed in the hope that it will be useful, but
 *  WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 *  General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License along
 *  with this program; if not, write to the Free Software Foundation, Inc.,
 *  51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 *
 */
  

class TTL_Gen {
  constructor(_docURI, for_query, bnode_types, skip_docpref, _add_base) {
    this.ns = new Namespace();
    this.docURI = _docURI;
    this.add_base = _add_base || true;

    this.skip_docpref = skip_docpref;

    this.docURI_pref = _docURI + '#';
    this.for_query = for_query;
    this.prefixes = {};
    this.use_prefixes = true;

    this.escape = /["\\\t\n\r\b\f\u0000-\u0019\ud800-\udbff]/;
    this.escapeAll = /["\\\t\n\r\b\f\u0000-\u0019]|[\ud800-\udbff][\udc00-\udfff]/g;
    this.escapeReplacements = { '\\': '\\\\', '"': '\\"', '\t': '\\t',
                           '\n': '\\n', '\r': '\\r', '\b': '\\b', '\f': '\\f' };
    this.escape3 = /["\ud800-\udbff]/;
    this.escapeAll3 = /[\ud800-\udbff][\udc00-\udfff]/g;

    this.test_esc = /[!'()*&?#$:@=;+.\/]/;
    this.bnode_types = bnode_types || {};
  }

  load(n_data) {
    let str = "";
    let triples = [];
    if (n_data != null && n_data.length !== undefined && n_data.length > 0) {

      // Rename bnodes based on rdf:type relation
      this.bnodes = {};
      for (let i = 0; i < n_data.length; i++) {
        let subj = n_data[i].s;
        let isBNode = false;

        if (this.is_VBNode(subj)) {
          this.bnodes[subj] = this.VBNode2BNode(subj);
          isBNode = true;
        } else if (this.is_BNode(subj)) {
          this.bnodes[subj] = this.pre(subj.substring(2));
          isBNode = true;
        }

        if (isBNode) {
          for (const [key, val] of Object.entries(n_data[i].props)) {
            if (key === this.ns.RDF_TYPE && val.length > 0) {
              let type_name = this.create_iri_for_type(val[0]);
              let id = this.bnode_types[type_name];

              if (id !== undefined) {
                id++;
              } else {
                id = 0;
              }

              this.bnodes[subj] = this.create_iri_for_type(val[0], id);
              this.bnode_types[type_name] = id;
            }
          }
        }
      }

      // Fill id_list
      for (let i = 0; i < n_data.length; i++) {
        let item = n_data[i];
        let subj = this.format_id(item.s);

        let props = [];
        props = props.concat(this.format_props(item.props, true));
        props = props.concat(this.format_props(item.props, false));

        for (let j = 0; j < props.length; j++) {
          str += `${subj} ${props[j]} .\n`;
          triples.push(`${subj} ${props[j]} .`);
        }
      }
    }

    if (this.for_query) {
      let pref = "";

      if (this.add_base) {
        pref += `base <${this.docURI}> \n`;
      }

      pref += "prefix : <#> \n";

      for(let key in this.prefixes) {
        pref += `prefix ${key}: <${this.prefixes[key]}> \n`;
      }

      return { pref, ttl: str, triples, prefixes: this.prefixes };
    } else {
      let pref = "";

      if (this.add_base) {
        pref += `@base <${this.docURI}> .\n`;
      }

      if (!this.skip_docpref) {
        pref += `@prefix : <#> .\n`;
      }

      for(let key in this.prefixes) {
        pref += `@prefix ${key}: <${this.prefixes[key]}> .\n`;
      }

      return `${pref}\n${str}`;
    }
  }

  format_props(props, only_rdf_type) {
    if (props === undefined) {
      return "";
    }

    let ret = [];
    for (const [key, val] of Object.entries(props)) {
      if ((only_rdf_type && key !== this.ns.RDF_TYPE) || (!only_rdf_type && key === this.ns.RDF_TYPE)) {
        continue;
      }

      let pred_str = this.format_id(key);

      for (let i = 0; i < val.length; i++) {
        ret.push(`${pred_str} ${this.format_obj(val[i])}`);
      }
    }
    return ret;
  }

  create_iri_for_type(obj, id) {
    let sid = (id && id > 0) ? '_' + id : '';
    if (obj.iri && !this.is_VBNode(obj.iri) && !this.is_BNode(obj.iri)) {
      let value = obj.iri;
      let pref = this.use_prefixes ? this.ns.has_known_ns(value) : null;
      if (pref != null) {
        let data = value.substring(pref.link.length);
        let len = data.length;
        if (data[len - 1] === "/") {
          data = data.substr(0, len - 1);
        }

        if (data.indexOf("/") !== -1) {
          let lst = data.split('/');
          data = lst.length > 0 ? lst[lst.length - 1] : "";
          if (!data) {
            data = "b";
          }
        }
        return fixedEncodeURIComponent(this.pre(decodeURIComponent(data) + sid));
      }
      else {
        let u;
        try {
          u = new URL(value);
        } catch (e) {
          return this.pre("b" + sid);
        }
        if (u.hash) {
          let hash = u.hash.endsWith('/') ? u.hash.substring(1, u.hash.length - 1) : u.hash.substring(1);
          return this.pre(hash + sid);
        } else {
          let lst = u.pathname.split('/');
          let data = lst.length > 0 ? lst[lst.length - 1] : "";
          if (!data) {
            data = "b";
          }

          return this.pre(data + sid);
        }
      }
    }
    else {
      return null;
    }
  }

  format_obj(obj) {
    let obj_str = "";
    if (obj.iri) {
      obj_str = this.format_id(obj.iri);
    }
    else {
      let v = obj.value;
      if (obj.type) {
        let pref = this.use_prefixes ? this.ns.has_known_ns(obj.type) : null;
        if (pref != null) {
          this.prefixes[pref.ns] = pref.link;
          obj_str = `${this.obj_value(v)}^^${this.pref_link(obj.type, pref)}`;
        }
        else {
          obj_str = `${this.obj_value(v)}^^<${obj.type}>`;
        }
      }
      else if (obj.lang) {
        obj_str = `${this.obj_value(v)}@${obj.lang}`;
      }
      else {
        obj_str = this.obj_value(v);
      }
    }
    return obj_str;
  }

  format_id(value) {
    if (this.is_VBNode(value)) {
      let s = this.bnodes[value];
      if (!s) {
        s = this.VBNode2BNode(value);
      }
      return this.skip_docpref ? `<${this.docURI_pref}${s}>`
                               : `:${s}`;
    }
    else if (this.is_BNode(value)) {
      let s = this.bnodes[value];
      if (!s) {
        s = this.pre(value.substring(2));
      }
      return this.skip_docpref ? `<${this.docURI_pref}${s}>`
                               : `:${s}`;
    }
    else {
      value = String(value);
      if (value.match(/^http(s)?:\/\//)) {
        let url;
        try {
          url = new URL(value);
        } catch (e) {
          return value;
        }
        value = url.href;
      }

      let pref = this.use_prefixes ? this.ns.has_known_ns(value) : null;
      if (pref != null) {
        this.prefixes[pref.ns] = pref.link;
        return this.pref_link(value, pref);
      } else {
        if (!this.skip_docpref && value.startsWith(this.docURI_pref)) {
          let id = this.pre(value.substring(this.docURI_pref.length));
          return `:${fixedEncodeURIComponent(decodeURIComponent(id))}`;
        }
        else {
          return `<${this.pre(value)}>`;
        }
      }
    }
  }

  check_link(val) {
    val = String(val);
    if (val.match(/^http(s)?:\/\//)) {
      let url;
      try {
        url = new URL(val);
      } catch (e) {
        return val;
      }
      url.hash = url.hash.replaceAll('/', '%2F');
      val = `<${this.pre(url.href)}>`;
    } else if (val.match(/^mailto:/)) {
      val = `<${this.pre(val)}>`;
    } else {
      val = `"${this.pre(val)}"`;
    }
    return val;
  }

  obj_value(val) {
    let qv = '"';

    val = String(val);

    if (val.indexOf("\n") !== -1 || val.indexOf("\r") !== -1) {
      qv = '"""';
      val = this.pre3(val);
      val = val.replace(/\\/g, '\\\\').replace(/\"/g, "\\\"");
    }
    else {
      val = this.pre(val);
    }

    return qv + val + qv;
  }

  pref_link(val, pref) {
    val = String(val);
    if (val.match(/^http(s)?:\/\//)) {
      let url;
      try {
        url = new URL(val);
      } catch (e) {
        return val;
      }
      val = url.href;
    }

    let data = val.substring(pref.link.length);

    if (data.endsWith("/")) {
      data = data.substring(0, data.length - 1);
    }

    if (data.indexOf("/") !== -1 || this.test_esc.test(data)) {
      return `<${this.pre(val)}>`;
    } else {
      return `${pref.ns}:${fixedEncodeURIComponent(this.pre(decodeURIComponent(data)))}`;
    }
  }

  pre(value) {
    function characterReplacer(character) {
      // Replace a single character by its escaped version
      let result = this.escapeReplacements[character];
      if (result === undefined) {
        // Replace a single character with its 4-bit unicode escape sequence
        if (character.length === 1) {
          result = character.charCodeAt(0).toString(16);
          result = '\\u0000'.substr(0, 6 - result.length) + result;
        }
        // Replace a surrogate pair with its 8-bit unicode escape sequence
        else {
          result = ((character.charCodeAt(0) - 0xD800) * 0x400 +
                     character.charCodeAt(1) + 0x2400).toString(16);
          result = '\\U00000000'.substr(0, 10 - result.length) + result;
        }
      }
      return result;
    }

    if (this.escape.test(value)) {
      value = value.replace(this.escapeAll, characterReplacer.bind(this));
    }

    return value;
  }

  pre3(value) {
    function characterReplacer(character) {
      if (character.length === 1) {
        let result = character.charCodeAt(0).toString(16);
        result = '\\u0000'.substr(0, 6 - result.length) + result;
      } else {
        let result = ((character.charCodeAt(0) - 0xD800) * 0x400 +
                       character.charCodeAt(1) + 0x2400).toString(16);
        result = '\\U00000000'.substr(0, 10 - result.length) + result;
      }
      return result;
    }

    if (this.escape3.test(value)) {
      value = value.replace(this.escapeAll3, characterReplacer.bind(this));
    }

    return value;
  }

  is_BNode(str) {
    return str.startsWith("_:");
  }

  is_VBNode(str) {
    return str.startsWith("nodeID://") || str.startsWith("nodeid://");
  }

  VBNode2BNode(str) {
    return "nodeID" + this.pre(str.substr(9));
  }
}
