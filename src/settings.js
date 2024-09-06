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

class Settings {
  constructor(data) {
//    this.def_import_url = "https://linkeddata.uriburner.com/describe/?url={url}&sponger:get=add";
    this.def_import_url = "https://linkeddata.uriburner.com/describe/?url={url}";
    this.def_import_srv = "describe-ssl";
//  this.def_rww_edit_url = "http://linkeddata.uriburner.com/rdf-editor/#/editor?newDocument=true&statement:entity={url}&view=statements";
    this.def_rww_edit_url = "https://linkeddata.uriburner.com/rdf-editor/#/editor?data={data}&view=statements";

    this.def_sparql_url = "https://linkeddata.uriburner.com/sparql/?query={query}&format=text%2Fx-html%2Btr";
    this.def_sparql_cmd = "select";
    this.def_sparql_qry_spo = "DEFINE get:soft \"soft\" \n"+
                              "SELECT (SAMPLE(?s) AS ?SubjectID) \n"+
                              "       (COUNT(*) AS ?count) \n"+
                              "       (?o AS ?SubjectTypeID) \n"+
                              "FROM <{url}> \n"+
                              "WHERE { \n"+
                              "        ?s a ?o . \n"+
                              "        FILTER (CONTAINS(STR(?o),'schema')) \n"+
                              "      } \n"+
                              "GROUP BY ?o \n"+
                              "ORDER BY DESC (?count) \n"+
                              "LIMIT 50 ";
    
    this.def_sparql_qry_eav = "DEFINE get:soft \"soft\" \n"+
                              "SELECT (SAMPLE(?s) AS ?EntityID) \n"+
                              "       (COUNT(*) AS ?count) \n"+
                              "       (?o AS ?EntityTypeID) \n"+
                              "FROM <{url}> \n"+
                              "WHERE { \n"+
                              "        ?s a ?o . \n"+
                              "        FILTER (CONTAINS(STR(?o),'schema')) \n"+
                              "      } \n"+
                              "GROUP BY ?o \n"+
                              "ORDER BY DESC (?count) \n"+
                              "LIMIT 50 ";


    this.def_super_links_timeout = 30000000;
    this.def_super_links_retries = 3;
    this.def_super_links_retries_timeout = 2;

    this.def_super_links_query = ''
  +'DEFINE get:soft "soft" \n'
  +'prefix oplattr: <http://www.openlinksw.com/schema/attribution#> \n'
  +'prefix schema: <http://schema.org/>  \n'
  +'select distinct  \n'
  +'       # sample(?extract) as ?sample  \n'
  +'       ?extract ?extractLabel  \n'
  +'       ?entityType bif:regexp_substr("[^/#]+$", ?entityType, 0) as ?entityTypeLabel  \n'
  +'       ?p as ?association ?associationLabel  \n'
  +'       ?provider ?providerLabel  \n'
  +'where  \n'
  +'{   \n'
  +'graph <{url}>   \n'
  +'  {     \n'
  +'    ?source ?p ?extract.     \n'
  +'    ?extract \n'
  +'      a ?entityType ;    \n'
  +'      oplattr:providedBy ?provider ;   \n'
  +'      (rdfs:label | schema:name | foaf:name | schema:headline) ?extractLabel .   \n'
  +'    optional { ?provider foaf:name | schema:name ?providerLabel } . \n'
  +'    filter (?p in ( skos:related, schema:about, schema:mentions))   \n'
  +'    filter (!contains(str(?entityType),"Tag"))   \n'
  +'  }   \n'
  +'  ## Obtain relation (statement predicate) labels   \n'
  +'  optional \n'
  +'  { \n'
  +'    { \n'
  +'      graph <http://www.w3.org/2004/02/skos/core>  \n'
  +'      {  \n'
  +'        ?p rdfs:label | schema:name ?associationLabel .  \n'
  +'      }   \n'
  +'    } \n'
  +'    union \n'
  +'    { \n'
  +'      graph <http://schema.org/>  \n'
  +'      {  \n'
  +'        ?p rdfs:label | schema:name ?associationLabel .  \n'
  +'      }   \n'
  +'    } \n'
  +'    #filter (lang(?associationLabel) = "{lang}")   \n'
  +'  } \n'
  +'} \n'
  +'order by ?extractLabel ?entityType \n';


    this.def_prompt_query_turtle = ''
  +'Disregard any previous instructions. \n'
  +'Using a code-block, generate a representation of this information in RDF-Turtle using schema.org terms, relative hash-based hyperlinks for subject and object denotation.\n'
  +'"""\n'
  +'{selected_text}\n'
  +'"""\n\n';

//    this.def_prompt_query_jsonld = ''
//  +'Disregard any previous instructions. \n'
//  +'Using a code-block, generate a representation of this information in JSON-LD using schema.org terms, setting @base to {page_url} and expanding @context accordingly. Note, I don\'t want any HTML tags included in the output. \n'
//  +'"""\n'
//  +'{selected_text}\n'
//  +'"""\n\n';

    this.def_prompt_query_jsonld = ''
  +'Disregard any previous instructions. \n'
  +'Using a code-block, generate a comprehensive representation of this information in JSON-LD using valid schema.org terms, setting @base to {page_url} and expanding @context accordingly. Note the following. \n'
  +'1. Use @vocab properly. \n'
  +'2. I don\'t want any HTML tags included in the output. \n'
  +'"""\n'
  +'{selected_text}\n'
  +'"""\n\n';

    this.def_prompt_srv = 'openai';
    this.def_prompt_inject = ''+
`{ 
  "openai": {
    "name": "OpenAI Chat", 
    "url": "https://chatgpt.com/",
    "location.startsWith": "https://chatgpt.com",
    "prompt.selector": "#prompt-textarea",
    "prompt.css.removeClass": "resize-none",
    "prompt.css.addClass": "resize"
  },

  "uriburner": {
    "name": "OpenLink Data Twingler", 
    "url": "https://linkeddata.uriburner.com/chat",
    "location.startsWith": "https://linkeddata.uriburner.com/chat",
    "prompt.selector": "textarea.message_input",
    "prompt_in_new_window": true
  },

  "assist": {
    "name": "OpenLink Personal Assistant", 
    "url": "https://linkeddata.uriburner.com/assist",
    "location.startsWith": "https://linkeddata.uriburner.com/assist",
    "prompt.selector": "textarea.message_input",
    "prompt_in_new_window": true
  },

  "assist-mental": {
    "name": "OpenLink Personal Assistant-Metal", 
    "url": "https://linkeddata.uriburner.com/assist-metal",
    "location.startsWith": "https://linkeddata.uriburner.com/assist-metal",
    "prompt.selector": "textarea#user-input",
    "prompt_in_new_window": false
  },

  "opal_qa": {
    "name": "OPAL Chat (net-qa)", 
    "url": "https://netid-qa.openlinksw.com:8443/chat",
    "location.startsWith": "https://netid-qa.openlinksw.com:8443/chat",
    "prompt.selector": "textarea.message_input",
    "prompt_in_new_window": true
  },

  "ms_copilot":{
    "name": "MS Copilot", 
    "url": "https://copilot.microsoft.com",
    "location.startsWith": "https://copilot.microsoft.com",
    "prompt.selector": ["cib-serp","#shadow-root", "cib-action-bar#cib-action-bar-main","#shadow-root",
                        "cib-text-input","#shadow-root", "textarea#searchbox"]
  },

  "meta":{
    "name": "Meta AI", 
    "url": "https://www.meta.ai",
    "location.startsWith": "https://www.meta.ai",
    "prompt.selector": "textarea"
  },

  "perplexity_labs": {
    "name": "Perplexity Labs", 
    "url": "https://labs.perplexity.ai/",
    "location.startsWith": "https://labs.perplexity.ai",
    "prompt.selector": "main textarea"
  },

  "perplexity": {
    "name": "Perplexity", 
    "url": "https://www.perplexity.ai/",
    "location.startsWith": "https://www.perplexity.ai",
    "prompt.selector": "main textarea"
  },

  "huggingface": {
    "name": "HuggingChat", 
    "url": "https://huggingface.co/chat",
    "location.startsWith": "https://huggingface.co/chat",
    "prompt.selector": "div#app textarea"
  },

  "claude": {
    "name": "Claude Chat", 
    "url": "https://claude.ai/chat",
    "location.startsWith": "https://claude.ai/chat",
    "prompt.selector": "fieldset div.ProseMirror[contenteditable=true][enterkeyhint=enter]"
  },

  "gemini": {
    "name":"Google Gemini",
    "url": "https://gemini.google.com/",
    "location.startsWith": "https://gemini.google.com/app",
    "prompt.selector": "chat-app main rich-textarea  div.textarea[contenteditable=true]"
  },

  "mistral": {
    "name":"Mistral Chat",
    "url": "https://chat.mistral.ai/chat/",
    "location.startsWith": "https://chat.mistral.ai/chat",
    "prompt.selector": "textarea"
  },
  
  "you": {
    "name":"You Chat",
    "url": "https://you.com",
    "location.startsWith": "https://you.com",
    "prompt.selector": "textarea#search-input-textarea"
  }
  
}
`;     

    this._data = (data!== undefined && data!==null) ? data:null;
  }

  async getSparqlQueryDefault(mode)
  {
    if (mode===null)
      mode = await this.getValue("ext.osds.uiterm.mode");

    if (mode === "ui-eav")
      return this.def_sparql_qry_eav;
    else
      return this.def_sparql_qry_spo;
  }


  async _syncAll()
  {
    if (!Browser.is_safari) {
      for(var i=0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        var val = localStorage.getItem(key);
        if (key.startsWith('ext.'))
          await this._setItem(key, val);
      }
    }
  }


  async _getItem0(id)
  {
    if (Browser.is_ff) {
      return Browser.api.storage.local.get(id);
    }
    else 
      return new Promise((resolve, reject) => {
         Browser.api.storage.local.get(id, (rec) => {
           resolve(rec);
         });
        
      })
  }

  async _getItem(id)
  {
    if (!Browser.is_safari) {
      var rec = await this._getItem0('data_moved');
      if (!rec['data_moved']) {
        await this._syncAll();
        await this._setItem('data_moved','1');
      }
    }

    var rec = await this._getItem0(id);
    return rec[id];
  }

  async _setItem(id, val)
  {
    var rec = {};
    rec[id] = val;
    if (Browser.is_ff)
      return Browser.api.storage.local.set(rec);
    else 
      return new Promise((resolve, reject) => {
         Browser.api.storage.local.set(rec, () => {
           resolve();
         });
        
      })
  }


  async getValue(id)
  {
    var val = null;

    try {
      val = await this._getItem(id);

      if (val===undefined)
        val = null;
    } catch(e) {
      console.log(e);
    }

    if (val!==null)
      return val;

    switch(id) {
      case "osds.chatgpt_prompt":
          val = "What do you know about {words} ?";
          break;
      case "ext.osds.chat-srv":
          val = this.def_prompt_srv;
          break;
      case "osds.chatgpt_model":
          val = "gpt-3.5-turbo";
          break;
      case "osds.chatgpt_openai_token":
          val = "sk-xxxxxx";
          break;
      case "osds.chatgpt_temp":
          val = "1";
          break;
      case "osds.chatgpt_max_tokens":
          val = "32000";
          break;

      case "upload_sparql_endpoint":
          val = "https://linkeddata.uriburner.com/sparql";
          break;
      case "upload_sparql_timeout":
          val = "30";
          break;
      case "upload_sparql_graph":
          val = "";
          break;

      case "ext.osds.pref.user.chk":
          val = "1";
          break;
      case "ext.osds.pref.show_action":
          val = "1";
          break;
      case "ext.osds.auto_discovery":
          val = "0";
          break;
      case "ext.osds.jsonld_compact_rel":
          val = "0";
          break;
      case "ext.osds.handle_xml":
          val = "0";
          break;
      case "ext.osds.handle_csv":
          val = "0";
          break;
      case "ext.osds.handle_json":
          val = "0";
          break;
      case "ext.osds.handle_all":
          val = "1";
          break;
      case "ext.osds.uiterm.mode":
          val = "ui-eav"
          break;
      case "ext.osds.import.url":
          val = this.def_import_url;
          break;
      case "ext.osds.import.srv":
          val = this.def_import_srv;
          break;
      case "ext.osds.rww.edit.url":
          val = this.def_rww_edit_url;
          break;
      case "ext.osds.sparql.url":
          val = this.def_sparql_url;
          break;
      case "ext.osds.sparql.cmd":
          val = this.def_sparql_cmd;
          break;
      case "ext.osds.sparql.query":
          val = this.getSparqlQueryDefault(null);
          break;
      case "ext.osds.super_links.query":
          val = this.def_super_links_query;
          break;
      case "ext.osds.super_links.timeout":
          val = this.def_super_links_timeout;
          break;

      case "ext.osds.super_links.retries":
          val = this.def_super_links_retries;
          break;

      case "ext.osds.super_links.retries_timeout":
          val = this.def_super_links_retries_timeout;
          break;
      
      case "ext.osds.super-links-highlight":
          val = "first";
          break;
      case "ext.osds.super-links-sponge-mode":
          val = "xxx";
          break;
      case "ext.osds.super-links-sponge":
          val = "describe-ssl";
          break;

      case "ext.osds.prompt-query":
          val = this.def_prompt_query_jsonld;
          break;
      case "ext.osds.gpt-model":
          val = 'gpt35';
          break;
      case "ext.osds.gpt-tokens":
          val = '32000';
          break;
      case "ext.osds.prompt-lst":
          val = [];
          break;
      case "ext.osds.def_prompt_inject":
          val = this.def_prompt_inject;
    }
    return val;
  }

  async setValue(id, val)
  {
    try {
      await this._setItem(id, val);
    } catch(e) {
      console.log(e);
    }
  }

  async createRwwUrl(curUrl, data)
  {
    var edit_url = await this.getValue('ext.osds.rww.edit.url');
    var store_url = await this.getValue('ext.osds.rww.store.url');
    var docURL = encodeURIComponent(curUrl);

    if (store_url!==null && store_url.length>0) {
      if (edit_url.indexOf("?")!=-1)
        edit_url += "&uri="+encodeURIComponent(store_url);
      else
        edit_url += "?uri="+encodeURIComponent(store_url);
    }

    if (edit_url.indexOf("{url}")!=-1)
      edit_url = edit_url.replace("{url}",docURL);

    if (edit_url.indexOf("{data}")!=-1)
      edit_url = edit_url.replace("{data}", encodeURIComponent(data?data:""));

    return edit_url;
  }


  async createSparqlUrl(curUrl, endpoint)
  {
    function ltrim(str) { return str.replace(/^\s+/,""); }

    var sparql_url = await this.getValue('ext.osds.sparql.url');
    var query = await this.getValue('ext.osds.sparql.query');


    if (endpoint) {
      var lines = query.split('\n');

      for (var i=0; i< lines.length; i++) {
        var s = ltrim(lines[i]).toUpperCase();
        if (s.startsWith('DEFINE '))
          lines[i] = '# '+lines[i];

        if (s.startsWith('SELECT ') || s.startsWith('CONSTRUCT ') || s.startsWith('ASK ') || s.startsWith('DESCRIBE '))
          break;
      }

      query = lines.join('\n');
      query = encodeURIComponent(query.replace(/{url}/g, curUrl));

      return endpoint+'?query='+query+'&format=text%2Fx-html%2Btr';
    } 
    else {
      query = encodeURIComponent(query.replace(/{url}/g, curUrl));
      return sparql_url.replace(/{query}/g, query);
    }
  }


  createSuperLinksQuery(query, curUrl, lang)
  {
    if (curUrl.endsWith('?'))
      curUrl = curUrl.substring(0, curUrl.length-1);

    return query.replace(/{url}/g, curUrl).replace(/{lang}/g, lang);
  }


  async createImportUrl(curUrl)
  {
    var handle_url = await this.getValue('ext.osds.import.url');
    var srv = await this.getValue('ext.osds.import.srv');
    return this._createImportUrl_1(curUrl, handle_url, srv)
  }

  _createImportUrl_1(curUrl, handle_url, srv)
  {
    var docURL = encodeURIComponent(curUrl);

    switch(srv) {
      case 'about':
      case 'about-ssl':
        var result = curUrl.match(/^((\w+):\/)?\/?(.*)$/);
        if (!result) {
          throw 'Invalid url:\n' + curUrl;
          return null;
        }
//        var protocol = result[2]=="https"?"http":result[2];
        var protocol = result[2];
        docURL = protocol + '/' + result[3];
        break;

      case 'ode':
      case 'ode-ssl':
      case 'describe':
      case 'describe-ssl':
      default:
        break;
    }

    if (handle_url.indexOf("{url}")!=-1)
       return handle_url.replace("{url}",docURL);
    else
       return handle_url + docURL;
  }


  createDefaultImportCmdFor(srv, _url)
  {
    var url = new URL(_url);
    var h_url = "";

    switch (srv) {
      case 'describe':
        url.protocol = 'http:';
        url.pathname = '/describe/';
        url.search = '';
        url.hash = '';
        h_url = url.toString();
        h_url += '?url={url}&sponger:get=add';
        break;
      case 'describe-ssl':
        url.protocol = 'https:';
        url.pathname = '/describe/';
        url.search = '';
        url.hash = '';
        h_url = url.toString();
        h_url += '?url={url}&sponger:get=add';
        break;
      case 'about':
        url.protocol = 'http:';
        url.pathname = '/about/html/';
        url.search = '';
        url.hash = '';
        h_url = url.toString();
        break;
      case 'about-ssl':
        url.protocol = 'https:';
        url.pathname = '/about/html/';
        url.search = '';
        url.hash = '';
        h_url = url.toString();
        break;
      case 'ode':
        url.protocol = 'http:';
        url.pathname = '/ode/';
        url.search = '?uri=';
        url.hash = '';
        h_url = url.toString();
        break;
      case 'ode-ssl':
        url.protocol = 'https:';
        url.pathname = '/ode/';
        url.search = '?uri=';
        url.hash = '';
        h_url = url.toString();
        break;
      case 'custom':
        h_url = _url;
        break;
    }
    return h_url;
  }


  createSpongeCmdFor(srv, mode, _url)
  {
    var h_url = '';
    var docURL;
    var _mode = null;

    if (_url.endsWith('?'))
      _url = _url.substring(0, _url.length-1);

    if (mode === 'soft')
      _mode = 'sponger:get=soft';
    else if (mode === 'add')
      _mode = 'sponger:get=add';
    else if (mode === 'replace')
      _mode = 'sponger:get=replace';

    function createProxyURI(srv, url)
    {
      var proxyurl = encodeURIComponent(url);

      if (srv==='describe' || srv==='describe-ssl') {
        var rc = url.match(/^((\w+):\/)?\/?(.*)$/);
        if (rc) {
          url = rc[2] + '/' + rc[3];
          if (srv==='describe')
            proxyurl = 'http://linkeddata.uriburner.com/about/id/entity/'+url;
          else if (srv==='describe-ssl')
            proxyurl = 'https://linkeddata.uriburner.com/about/id/entity/'+url;
        }
      }
      return proxyurl;      
    }


    if (srv==='describe' || srv==='describe-ssl') {
//      docURL = encodeURIComponent(createProxyURI(srv, _url));
      docURL = encodeURIComponent(_url);
    }
    else {
        var rc = _url.match(/^((\w+):\/)?\/?(.*)$/);
        if (!rc)
          docURL = encodeURIComponent(_url);
        else
          docURL = rc[2] + '/' + rc[3];
    }

    switch (srv) {
      case 'describe':
        h_url = 'http://linkeddata.uriburner.com/describe/?url={url}';
        if (_mode)
          h_url += '&'+_mode;
        break;
      case 'describe-ssl':
        h_url = 'https://linkeddata.uriburner.com/describe/?url={url}';
        if (_mode)
          h_url += '&'+_mode;
        break;
      case 'about':
        h_url = 'http://linkeddata.uriburner.com/about/html/{url}';
        if (_mode)
          h_url += '?'+_mode;
        break;
      case 'about-ssl':
      default:
        h_url = 'https://linkeddata.uriburner.com/about/html/{url}';
        if (_mode)
          h_url += '?'+_mode;
        break;
    }

    if (h_url.indexOf("{url}")!=-1)
       return h_url.replace("{url}",docURL);
    else
       return h_url + docURL;
  }

  validate_prompt_injects(str)
  { 
    try {
      const data = JSON.parse(str);
      for(const key of Object.keys(data)) 
      {
        const el = data[key];
        if (!el['name'])
          throw new Error(`item "${key}" must have attribute "name"`)
        if (!el['url'])
          throw new Error(`item "${key}" must have attribute "url"`)
        if (!el["location.startsWith"])
          throw new Error(`item "${key}" must have attribute "location.startsWith"`)
        if (!el['prompt.selector'])
          throw new Error(`item "${key}" must have attribute "prompt.selector"`)
      }
      return {rc:1, data};
    } catch(e) {
      console.log(e);
      return {rc:0, err:e.toString()}
    }
  }

}



