class DataLinks {
  constructor(_tab, _tabName, _baseURL, _links, _block, hdr, hdr_alter, cb_start, cb_error, cb_success)
  {
    this.tab = _tab;
    this.tabName = _tabName;
    this.baseURL = _baseURL;
    this.links = _links;
    this.hdr = hdr;
    this.hdr_alter = hdr_alter;
    this.block = _block;
    this._loaded = false;
    this.cb_start = cb_start;
    this.cb_error = cb_error;
    this.cb_success = cb_success;
  }

  async _Fetch(url, type)
  {
   var hdr = this.hdr_alter[type] ? this.hdr_alter[type] : this.hdr;

    try {
      var options = {
            headers: {
              'Accept': hdr,
              'Cache-control': 'no-cache'
            },
          };

      var rc = await fetchWithTimeout(url, options, 30000)
      if (rc.ok) {
        var data = await rc.text();
        return {data, error: null};
      } else {
        return {data:null, error: "Could not load data from: "+url+"\nError: "+rc.status+" "+rc.statusText};
      }
    } catch(e) {
      return {data: null, error: "Could not load data from: "+url+"\nError: "+e};
    }
  }

  loaded()
  {
    return this._loaded;
  }


  async loadData(bnode_types, start_id)
  {
    var textData = [];
    var rc;
    var errors = [];
    var err_msg = "";

    if (this.cb_start)
      this.cb_start(this.tab);

    for(var url in this.links) {
      var type = this.links[url];
      for(var i=0; i < 3; i++) {
        rc = await this._Fetch(url, type);
        if (!rc.error)
          break;
      }

      if (rc.error)
        errors.push(rc.error);
      else
        textData.push(rc.data);
    }

    if (textData.length > 0)
      this.block.add_data(textData);

    if (errors.length > 0) {
      err_msg = "#L#"+errors.join("\n\n");
      showInfo(err_msg);
      if (this.cb_error)
        this.cb_error(this.tab, err_msg);
    }

    var rc = await this.block.to_html({}, start_id)

    this._loaded = true;

    if (this.cb_success) {
      if (err_msg.length > 0)
        rc.error.push(err_msg);

      this.cb_success(this.tab, this.tabName, rc);
    }

    return true;
  }

}


class RSS_Links extends DataLinks {
  constructor(_tab, _tabName, _baseURL, _links, cb_start, cb_error, cb_success)
  {
    var hdr = 'application/rss+xml, application/rdf+xml;q=0.8, application/atom+xml;q=0.6, application/xml;q=0.4, text/xml;q=0.4';
    var block = new RSS_Block(_baseURL, [], false);
    super(_tab, _tabName, _baseURL, _links, block, hdr, {}, cb_start, cb_error, cb_success);
  }
}


class Atom_Links extends DataLinks {
  constructor(_tab, _tabName, _baseURL, _links, cb_start, cb_error, cb_success)
  {
    var hdr = 'application/atom+xml, application/rdf+xml;q=0.8, application/rss+xml;q=0.6, application/xml;q=0.4, text/xml;q=0.4'
    var block = new RSS_Block(_baseURL, [], true);
    super(_tab, _tabName, _baseURL, _links, block, hdr, {}, cb_start, cb_error, cb_success);
  }
}


class JSONLD_Links extends DataLinks {
  constructor(_tab, _tabName, _baseURL, _links, _block, cb_start, cb_error, cb_success)
  {
    var hdr_alter = {};
    hdr_alter['application/activity+json'] = 'application/activity+json';
    var hdr = 'application/ld+json;q=1.0,text/plain;q=0.5,text/html;q=0.5,*/*;q=0.1';
    super(_tab, _tabName, _baseURL, _links, _block, hdr, hdr_alter, cb_start, cb_error, cb_success);
  }
}

class RDF_Links extends DataLinks {
  constructor(_tab, _tabName, _baseURL, _links, _block, cb_start, cb_error, cb_success)
  {
    var hdr = 'application/rdf+xml;q=1.0,text/plain;q=0.5,text/html;q=0.5,*/*;q=0.1';
    super(_tab, _tabName, _baseURL, _links, _block, hdr, {}, cb_start, cb_error, cb_success);
  }
}

class TTL_Links extends DataLinks {
  constructor(_tab, _tabName, _baseURL, _links, _block, cb_start, cb_error, cb_success)
  {
    var hdr = 'text/turtle,text/n3;q=1.0,text/plain;q=0.5,text/html;q=0.5,*/*;q=0.1';
    super(_tab, _tabName, _baseURL, _links, _block, hdr, {}, cb_start, cb_error, cb_success);
  }
}



class DataBlock {
  constructor(_baseURL, _text, add_namespaces)
  {
    this.fmt = 'ttl';
    this.baseURL = _baseURL;
    this.text = _text ? _text : [];
    this.content_type = "text/turtle;charset=utf-8";
    this.start_id = 0;
    this.add_namespaces = add_namespaces;
  }

  add_data(_text)
  {
    if (_text)
      this.text = this.text.concat(_text);
  }

  add_nano(_nano_data)
  {
    if (_nano_data && _nano_data.length > 0) 
      this.text = this.text.concat(_nano_data);
  }

  async to_html(bnode_types, start_id) 
  {
    var html = null;
    var error = [];

    try {
      if (this.text && this.text.length > 0) {
        var handler = new Handle_Turtle(start_id, false, false, bnode_types);
        if (this.add_namespaces) {
          var ns = new Namespace();
          handler.ns_pref = ns.get_ns_desc();
          handler.ns_pref_size = ns.get_ns_size();
        }
        var ret = await handler.parse(this.text, this.baseURL);

        if (ret.errors.length>0)
          error = error.concat(ret.errors);

        html = ret.data;
        this.start_id = handler.start_id;
      }

      return {start_id:this.start_id, html, error};

    } catch(ex) {
      error.push(ex.toString());
      return {start_id:0, html:null, error};
    }
  }

  async to_ttl(for_query) 
  {
    return {txt: this.text, error: ""};
  }

  async to_rdf()
  {
    var conv = new Convert_Turtle();
    var text_data = await conv.to_rdf(this.text, [], this.baseURL);
    return this.out_from(false, text_data, conv.skipped_error);
  }

  async to_jsonld()
  {
    var conv = new Convert_Turtle();
    var text_data = await conv.to_jsonld(this.text, [], this.baseURL);
    return this.out_from(false, text_data, conv.skipped_error);
  }


  async to_json()
  {
    return {txt: this.text, error: ""};
  }


  out_from(for_query, data, error)
  {
    var rc = {txt:"", error:""};
    var outdata = [];
    var errors = [];

    if (data) {
      if ($.isArray(data))
        outdata = outdata.concat(data);
      else
        outdata.push(data);
    }

    if (error) {
      if ($.isArray(error))
        errors = errors.concat(error);
      else
        errors.push("\n"+error);
    }

    if (for_query) {
      rc.txt = outdata;
    } else {
      for(var i=0; i < outdata.length; i++)
        rc.txt += outdata[i]+"\n\n";
    }

    rc.error = errors.join("\n\n");

    return rc;

  }
}



class DataBlock_Prepare extends DataBlock {
  constructor(_baseURL, _text)
  {
    super(_baseURL, _text);
  }

  async _prepare_ttl()
  {
    return {ttl:this.text, error:[]};
  }

  async to_html(bnode_types, start_id) 
  {
    var html = null;
    var error = [];

    try {
      if (this.text && this.text.length > 0) {
        var v = await this._prepare_ttl();

        if (v.error.length > 0)
          error = error.concat(v.error);

        var handler = new Handle_Turtle(start_id, false, false, bnode_types);
        var ret = await handler.parse(v.ttl, this.baseURL);

        if (ret.errors.length>0)
          error = error.concat(ret.errors);

        html = ret.data;
        this.start_id = handler.start_id;
      }

      return {start_id:this.start_id, html, error};

    } catch(ex) {
      error.push(ex.toString());
      return {start_id:0, html:null, error};
    }
  }

  async to_ttl(for_query) 
  {
    var v = await this._prepare_ttl();
    return this.out_from(for_query, v.ttl, v.error);
  }

  async to_rdf()
  {
    var v = await this._prepare_ttl();

    var conv = new Convert_Turtle();
    var text_data = await conv.to_rdf(v.ttl, null, this.baseURL);

    if (v.error)
      conv.skipped_error = conv.skipped_error.concat(v.error);

    return this.out_from(false, text_data, conv.skipped_error);
  }

  async to_jsonld()
  {
    var v = await this._prepare_ttl();

    var conv = new Convert_Turtle();
    var text_data = await conv.to_jsonld(v.ttl, null, this.baseURL);

    if (v.error)
      conv.skipped_error = conv.skipped_error.concat(v.error);

    return this.out_from(false, text_data, conv.skipped_error);
  }

}


class Markdown_Block extends DataBlock {
  constructor(_baseURL, _text)
  {
    super(_baseURL, _text);
    this.fmt = '.md';

    const self = this;
    this.md = markdownit({
      html:         false,
      xhtmlOut:     true,
      breaks:       true,
      langPrefix:   'language-',  // CSS language prefix for fenced blocks. Can be
                              // useful for external highlighters.
      linkify:      true,        // Autoconvert URL-like text to links

      typographer:  true,

  // Double + single quotes replacement pairs, when typographer enabled,
  // and smartquotes on. Could be either a String or an Array.
  //
  // For example, you can use '«»„“' for Russian, '„“‚‘' for German,
  // and ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] for French (including nbsp).
      quotes: '“”‘’',

      highlight: function (str, lang) {
         if (lang && hljs.getLanguage(lang)) {
           try {
             return '<pre class="hljs"><code>' +
                     hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
                   '</code></pre>';
           } catch (__) {}
         }

         return '<pre class="hljs"><code>' + self.md.utils.escapeHtml(str) + '</code></pre>';
       }
     });
  }


  async to_html(bnode_types, start_id)
  {
    var html = [];
    var error = [];
    try {
      for(const v of this.text)
        html.push('<div>'+DOMPurify.sanitize(this.md.render(v))+'</div>');

      return {start_id:this.start_id, html:html.join('\n'), error};

    } catch(ex) {
      error.push(ex.toString());
      return {start_id:0, html:null, error};
    }
  }

  async to_ttl(for_query) 
  {
    return {txt: "", error: ""};
  }

  async to_rdf()
  {
    return {txt: "", error: ""};
  }

  async to_jsonld()
  {
    return {txt: "", error: ""};
  }


  async to_json()
  {
    return {txt: "", error: ""};
  }
}



class RSS_Block extends DataBlock_Prepare {
  constructor(_baseURL, _text, is_atom)
  {
    super(_baseURL, _text);
    this.is_atom = is_atom;
  }


  async _prepare_ttl()
  {
    var conv = new Convert_RSS(this.is_atom);
    var rc = await conv.to_ttl(this.text, this.baseURL);
    return {ttl:rc.ttl, error: rc.error};
  }

  copy()
  {
    return new RSS_Block(this.baseURL, this.text.slice(), this.is_atom);
  }
}


class TTL_Block extends DataBlock {
  constructor(_baseURL, _text, add_namespaces)
  {
    super(_baseURL, _text, add_namespaces);
    this.text_nano = [];
    this.text_nano_curly = [];
  }

  async add_nano(_nano_data)
  {
    if (_nano_data && _nano_data.length > 0) {
      var fix = new Fix_Nano();
      var output = await fix.parse(_nano_data);

      if (output && output.length > 0)
        this.text_nano = this.text_nano.concat(output);
    }
  }

  async add_nano_curly(_nano_data)
  {
    if (_nano_data && _nano_data.length > 0) {
      var fix = new Fix_Nano();
      var output = await fix.parse(_nano_data);

      if (output && output.length > 0)
        this.text_nano_curly = this.text_nano_curly.concat(output);
    }
  }

  async to_html(bnode_types, start_id) 
  {
    var rc = await super.to_html(bnode_types, start_id);
    
    var html = rc.html;
    var error = rc.error;

    start_id = rc.start_id;

    try {
      if (this.text_nano && this.text_nano.length > 0) {
        var handler = new Handle_Turtle(start_id, false, false, bnode_types);
        var ret = await handler.parse_nano(this.text_nano, this.baseURL);

        if (ret.errors.length>0)
          error = error.concat(ret.errors);

        this.text_nano = ret.text;

        if (html)
          html += ret.data;
        else
          html = ret.data;

        this.start_id = handler.start_id;
      }

      if (this.text_nano_curly && this.text_nano_curly.length > 0) {
        var handler = new Handle_Turtle(start_id, false, false, bnode_types);
        var ret = await handler.parse_nano_curly(this.text_nano_curly, this.baseURL);

        this.text_nano = ret.text;
        this.text_nano_curly = [];

        if (html)
          html += ret.data;
        else
          html = ret.data;

        this.start_id = handler.start_id;
      }

      return {start_id: this.start_id, html, error};

    } catch(ex) {
      error.push(ex.toString());
      return {start_id, html, error};
    }
  }

  async to_ttl(for_query) 
  {
    var s = [];
    var error = [];

    if (this.text)
      s = this.text;

    if (this.text_nano) {
      if (for_query) {
        var handler = new Handle_Turtle(0, true, false);
        var ret = await handler.parse_nano(this.text_nano, this.baseURL);
        if (ret.errors.length>0)
          error = ret.errors;

        s = s.concat(ret.data);
      } 
      else {
        s = s.concat(this.text_nano);
      }
    }

    return this.out_from(for_query, s, error);
  }

  async to_rdf()
  {
    var conv = new Convert_Turtle();
    var text_data = await conv.to_rdf(this.text, this.text_nano, this.baseURL);
    return this.out_from(false, text_data, conv.skipped_error);
  }

  async to_jsonld()
  {
    var conv = new Convert_Turtle();
    var text_data = await conv.to_jsonld(this.text, this.text_nano, this.baseURL);
    return this.out_from(false, text_data, conv.skipped_error);
  }
}


class JSONLD_Block extends DataBlock {
  constructor(_baseURL, _text)
  {
    super(_baseURL, _text);
    this.fmt = "jsonld";
    this.content_type = "application/ld+json;charset=utf-8";
  }


  async to_html(bnode_types, start_id) 
  {
    var html = null;
    var error = [];

    try {
      if (this.text && this.text.length > 0) {
        var handler = new Handle_JSONLD();
        var ret = await handler.parse(this.text, this.baseURL, bnode_types);

        if (ret.errors.length>0)
          error = error.concat(ret.errors);

        html = ret.data;
        this.start_id = handler.start_id;
      }

      return {start_id: this.start_id, html, error};

    } catch(ex) {
      error.push(ex.toString());
      return {start_id:0, html:null, error};
    }
  }

  async to_ttl(for_query) 
  {
    var conv = new Convert_JSONLD();
    var text_data = await conv.to_ttl(this.text, this.baseURL);
    return this.out_from(for_query, text_data, conv.skipped_error);
  }

  async to_rdf()
  {
    var conv = new Convert_JSONLD();
    var text_data = await conv.to_rdf(this.text, this.baseURL);
    return this.out_from(false, text_data, conv.skipped_error);
  }

  async to_jsonld()
  {
    return {txt: this.text, error: ""};
  }
}


class RDF_Block extends DataBlock {
  constructor(_baseURL, _text)
  {
    super(_baseURL, _text);
    this.fmt = "rdf";
    this.content_type = "application/rdf+xml;charset=utf-8";
  }

  async to_html(bnode_types, start_id) 
  {
    var html = null;
    var error = [];

    try {
      if (this.text && this.text.length > 0) {
        var handler = new Handle_RDF_XML();
        var ret = await handler.parse(this.text, this.baseURL, bnode_types);

        if (ret.errors.length>0)
          error = error.concat(ret.errors);

        html = ret.data;
        this.start_id = handler.start_id;
      }

      return {start_id: this.start_id, html, error};

    } catch(ex) {
      error.push(ex.toString());
      return {start_id:0, html:null, error};
    }
  }

  async to_ttl(for_query) 
  {
    var conv = new Convert_RDF_XML();
    var text_data = await conv.to_ttl(this.text, this.baseURL);
    return this.out_from(for_query, text_data, conv.skipped_error);
  }

  async to_rdf()
  {
    return {txt: this.text, error: ""};
  }

  async to_jsonld()
  {
    var conv = new Convert_RDF_XML();
    var text_data = await conv.to_jsonld(this.text, this.baseURL);
    return this.out_from(false, text_data, conv.skipped_error);
  }
}


class JSON_Block extends DataBlock_Prepare {
  constructor(_baseURL, _text)
  {
    super(_baseURL, _text);
    this.fmt = "json";
    this.content_type = "application/json;charset=utf-8";
  }


  async _prepare_ttl()
  {
    var conv = new Convert_JSON();
    var rc = conv.to_ttl(this.text, this.baseURL);
    this.text = rc.json_text;
    return {ttl:rc.ttl, error: rc.error};
  }


  async to_json()
  {
    return {txt: this.text, error: ""};
  }
}


class JSONL_Block extends DataBlock_Prepare {
  constructor(_baseURL, _text)
  {
    super(_baseURL, _text);
    this.fmt = "json";
    this.content_type = "application/json;charset=utf-8";
  }


  async _prepare_ttl()
  {
    var conv = new Convert_JSONL();
    var rc = conv.to_ttl(this.text, this.baseURL);
    this.text = rc.json_text;
    return {ttl:rc.ttl, error: rc.error};
  }


  async to_json()
  {
    return {txt: this.text, error: ""};
  }
}


class CSV_Block extends DataBlock_Prepare {
  constructor(_baseURL, _text)
  {
    super(_baseURL, _text);
  }


  async _prepare_ttl()
  {
    var conv = new Convert_CSV();
    var rc = conv.to_ttl(this.text, this.baseURL);
    return {ttl:rc.ttl, error: rc.error};
  }
}


class RDFa_Block extends DataBlock_Prepare {
  constructor(_baseURL, _text, _n3data)
  {
    super(_baseURL, [_text]);
    this.n3data = _n3data;
  }

  async _prepare_ttl()
  {
    var handler = new Convert_Turtle();
    var ttl_data = await handler.fix_ttl(this.text, this.baseURL);
    return {ttl: ttl_data, error: handler.skipped_error};
  }

  async to_html(bnode_types, start_id) 
  {
    var html = null;
    var error = [];

    try {
      if (this.n3data) {
        var handler = new Handle_RDFa();
        var ret = await handler.parse(this.n3data, this.baseURL, bnode_types);

        if (ret.errors.length>0)
          error = error.concat(ret.errors);

        html = ret.data;
      }

      return {start_id:0, html, error};

    } catch(ex) {
      error.push(ex.toString());
      return {start_id:0, html:null, error};
    }
  }

}



class Microdata_Block extends DataBlock_Prepare {
  constructor(_baseURL, _text, _n3data)
  {
    super(_baseURL, _text);
    this.n3data = _n3data;
  }

  async _prepare_ttl()
  {
    var data = JSON.parse(this.text[0]);
    var handler = new Handle_Microdata(true);
    var rc = await handler.parse(data, this.baseURL);
    return {ttl: [rc.data], error: rc.errors};
  }


  async to_html(bnode_types, start_id) 
  {
    var html = null;
    var error = [];

    try {
      if (this.n3data) {
        var handler = new Handle_Microdata();
        var ret = await handler.parse(this.n3data, this.baseURL, bnode_types);

        if (ret.errors.length>0)
          error = error.concat(ret.errors);

        html = ret.data;
      }

      return {start_id:0, html, error};

    } catch(ex) {
      error.push(ex.toString());
      return {start_id:0, html:null, error};
    }
  }

}




