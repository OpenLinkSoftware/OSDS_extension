/*
 *  This file is part of the OpenLink Structured Data Sniffer
 *
 *  Copyright (C) 2015-2020 OpenLink Software
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

Fix_Nano = function (start_id) {
  this.callback = null;
  this._pos = 0;
  this._output = null;
  this.start_id = 0;
  if (start_id!==undefined)
    this.start_id = start_id;
  this._tokens = 0;
  this._bad_data = false;
};

Fix_Nano.prototype = {

  parse : function(textData, callback) {
    this.callback = callback;
    var self = this;

    if (this._pos < textData.length) {
      try {
        var lexer = N3.Lexer({ lineMode: false });
        var ttl_data = textData[self._pos];
        var tok0;
        var tok1;

        lexer.tokenize(ttl_data, function (error, token) {
          if (token) {
            if (self._tokens ==0) {
              tok0 = token;
            } else if (self._tokens ==1) {
              tok1 = token;
            }
          }

          if (token && self._tokens ==0 &&
              !(token.type==="IRI"
                || token.type==="abbreviation"
                || token.type==="prefixed"
                || token.type==="prefix"
                || token.type==="PREFIX"
                || token.type[0]==="@"
                || token.type==="["
               )) {
            self._bad_data = true;
          }
          if (token && self._tokens ==1 &&
              !(token.type==="IRI"
                || token.type==="abbreviation"
                || token.type==="prefixed"
                || token.type==="prefix"
                || token.type==="PREFIX"
                || token.type===","
                || token.type===";"
                || token.type==="]"
               )) {
            self._bad_data = true;
          }

          if (token && self._tokens==1) {
            if ( (tok0.type === "prefixed" 
                 || tok0.type==="IRI" 
                 || tok0.type==="abbreviation"
                 )
                && 
                 (tok1.type==="," 
                 || tok1.type===";" 
                 || tok1.type==="]" 
                 || tok1.type==="PREFIX"
                 || tok1.type==="prefix"
                 )) {
              self._bad_data = true;
            }
          }

          if (self._tokens==2 && !self._bad_data) {
              if (self._output === null)
                self._output = [];
              self._output.push(textData[self._pos]);
          }

          if (token && !error && !self._bad_data)
            self._tokens++;

          if (error || (token && token.type==="eof")) {
            self._pos++;
            self._tokens = 0;
            self._bad_data = false;
            if (self._pos < textData.length)
               self.parse(textData, self.callback);
            else
               self.callback(self._output);
          }
        });

      } catch (ex) {
        self.callback(null);
      }
    } else {
        self.callback(self._output);
    }

  },
}



Handle_Microdata = function (make_ttl) {
  this.callback = null;
  this._make_ttl = false;
  if (make_ttl)
    this._make_ttl = make_ttl;
};

Handle_Microdata.prototype = {
  parse : function(jsonData, docURL, callback) {
    this.callback = callback;
    var self = this;
    var ret_data = null;
    var error = null;
    try
    {
      var conv = new MicrodataJSON_Converter();
      var out_data = conv.transform(jsonData, docURL);

      if (self._make_ttl)
        ret_data = new TTL_Gen(docURL).load(out_data);
      else
        ret_data = new HTML_Gen(docURL).load(out_data);
    }
    catch (ex) {
      error = ex.toString();
    }
    self.callback(error, ret_data);
  }

}



Handle_Turtle = function (start_id, make_ttl) {
  this.callback = null;
  this.baseURI = null;
  this._pos = 0;
  this._output = null;
  this.start_id = 0;
  if (start_id!==undefined)
    this.start_id = start_id;
  this.ns = new Namespace();
  this.ns_pref = null;
  this.ns_pref_size = 0;
  this.skip_error = true;
  this.skipped_error = [];
  this._pattern = /([0-9]*).$/gm;
  this._make_ttl = false;
  if (make_ttl)
    this._make_ttl = make_ttl;
};

Handle_Turtle.prototype = {

  parse_nano : function(textData, docURL, callback) {
    this.ns_pref = this.ns.get_ns_desc();
    this.ns_pref_size = Object.keys(this.ns.ns_list).length;
    this.parse(textData, docURL, callback);
  },

  parse : function(textData, docURL, callback) {
    this.callback = callback;
    this.baseURI = docURL;
    var self = this;

    if (this._pos < textData.length) {
      try {
        var store = new N3DataConverter();
        var parser = N3.Parser({baseIRI:self.baseURI, format:'text/n3'});
        var ttl_data = textData[self._pos];

        if (this.ns_pref!==null)
          ttl_data = this.ns_pref + ttl_data;

        parser.parse(ttl_data,
          function (error, tr, prefixes) {
            if (error) {
              error = ""+error;
              error = sanitize_str(error);
              if (self.ns_pref_size>0) { // fix line in error message
                try {
                  var m = self._pattern.exec(error);
                  if (m!==null)
                    error = error.substr(0,m.index)+(parseInt(m[1])-self.ns_pref_size-1);
                } catch(e) {}
              }

              if (self.skip_error) {
                self.skipped_error.push(error);
                self._pos++;

                if (self._pos < textData.length)
                  self.parse(textData, docURL, self.callback);
                else
                  self.callback(null, self._output);
              }
              else
              {
                self.error = error;
                self.callback(self.error, null);
              }

            }
            else if (tr) {
              store.addTriple(tr.subject,
                              tr.predicate,
                              tr.object);
            }
            else {

              var triples = store.output;

              if (self._make_ttl) {
                if (self._output===null)
                  self._output = [];

                var ttl_data =  new TTL_Gen(docURL).load(triples, self.start_id);
                self._output.push(ttl_data==null?"":ttl_data);
              }
              else
              {
                if (self._output===null)
                  self._output = "";

                var html_str =  new HTML_Gen(docURL).load(triples, self.start_id);
                self._output += (html_str==null?"":html_str);
              }

              self._pos++;

              if (triples!==null && triples.length!==undefined)
                self.start_id+= triples.length;

              if (self._pos < textData.length)
                self.parse(textData, docURL, self.callback);
              else
                self.callback(null, self._output);
            }
          });
      } catch (ex) {
        self.callback(ex.toString(), null);
      }
    } else {
        self.callback(null, this._output);
    }

  },


}




Handle_JSONLD = function (make_ttl) {
  this.callback = null;
  this._pos = 0;
  this._output = null;
  this.start_id = 0;
  this.skip_error = true;
  this.skipped_error = [];
  this._make_ttl = false;
  if (make_ttl)
    this._make_ttl = make_ttl;
};

Handle_JSONLD.prototype = {

  parse : function(textData, docURL, callback) {
    this.callback = callback;
    var self = this;

    function handle_error(error)
    {
      if (self.skip_error)
      {
        self.skipped_error.push(""+error);
        self._pos++;

        if (self._pos < textData.length)
          self.parse(textData, docURL, self.callback);
        else
          self.callback(null, self._output);
      }
      else {
          self.callback(""+error, null);
      }
    }


    if (this._pos < textData.length)
    {
      try {
        jsonld_data = JSON.parse(textData[this._pos]);
        if (jsonld_data != null) {
          jsonld.expand(jsonld_data, {base:docURL},
            function(error, expanded) {
              if (error) {
                handle_error(error);
              }
              else {
                jsonld.toRDF(expanded, {base:docURL, format: 'application/nquads', includeRelativeUrls: true},
                  function(error, nquads) {
                    if (error) {
                      handle_error(error);
                    }
                    else {
                      var handler = new Handle_Turtle(self.start_id, self._make_ttl);
                      handler.skip_error = false;
                      handler.parse([nquads], docURL, function(error, html_data) {
                        if (error) {
                          handle_error(error);
                        }
                        else {
                          if (self._output===null)
                            self._output = "";

                          self._output += html_data;
                          self._output += "\n\n";
                          self._pos++;
                          self.start_id += handler.start_id;

                          if (self._pos < textData.length)
                            self.parse(textData, docURL, self.callback);
                          else
                            self.callback(null, self._output);
                        }
                      });
                    }
                });
              }
            })
        }
        else
          self.callback(null, null);
      } catch (ex) {
        handle_error(ex.toString());
      }

    } else {
       self.callback(null, this._output);
    }

  }


}


Handle_JSON = function (make_ttl) {
  this.s_id = '_:s'+Date.now().toString(16)+'_';
  this.id = 0;
  this.callback = null;
  this._pos = 0;
  this._output = null;
  this.start_id = 0;
  this.skip_error = true;
  this.skipped_error = [];
  this._make_ttl = false;
  if (make_ttl)
    this._make_ttl = make_ttl;
  this.baseURL = '';
  this.rep1 = /\(/g;
  this.rep2 = /\)/g 
};

Handle_JSON.prototype = {

  gen_subj : function() {
    this.id++;
    return this.s_id+this.id;
  },

  encodeURI: function(v) {
    return encodeURIComponent(v).replace(this.rep1,'%28').replace(this.rep2,'%29');
  },

  handle_simple : function(b, subj, p, o) 
  {
    if (o === null )
      return; // ignore

    var xsd = 'http://www.w3.org/2001/XMLSchema';

    if (typeof o === 'number') {
      if (o % 1 === 0)
        b.push(`${subj} <${this.baseURL}#${this.encodeURI(p)}> "${o}"^^<${xsd}#int> .`);
      else
        b.push(`${subj} <${this.baseURL}#${this.encodeURI(p)}> "${o}"^^<${xsd}#double> .`);
    } else if (typeof o === 'string') {
      b.push(`${subj} <${this.baseURL}#${this.encodeURI(p)}> "${o}" .`);
    } else if (typeof o === 'boolean') {
      b.push(`${subj} <${this.baseURL}#${this.encodeURI(p)}> "${o}"^^<${xsd}#boolean> .`);
    } else {
      b.push(`${subj} <${this.baseURL}#${this.encodeURI(p)}> "${o}" .`);
    }
  },

  handle_arr : function(b, subj, p, o) 
  {
    if (o === null )
      return; // ignore

    if (typeof o === 'object') {
      var s = this.gen_subj();
      b.push(`${subj} <${this.baseURL}#${this.encodeURI(p)}> ${s} .`);
      this.handle_obj(b, s, o);
    } else {
      this.handle_simple(b, subj, p, o);
    }
  },


  handle_obj : function(b, subj, obj)
  {
    if (obj === null )
      return; // ignore
    
    if (typeof obj === 'object') {

      var props = Object.keys(obj);
      for(var i=0; i < props.length; i++) {
        var p = props[i];
        var v = obj[p];

        if (typeof v === 'object') {
          if (Array.isArray(v)) {
            for(var j=0; j < v.length; j++) {
              this.handle_arr(b, subj, p, v[j]);
            }
          } else if (v!== null) {
            var s = this.gen_subj();
            b.push(`${subj} <${this.baseURL}#${this.encodeURI(p)}> ${s} .`);
            this.handle_obj(b, s, v);
          }
        } else {
          this.handle_simple(b, subj, p, v);
        }
      }
    } else {
      this.handle_simple(b, subj, 'p', obj);
    } 
  },
  
  
  parse : function(textData, docURL, callback) {
    this.callback = callback;
    this.baseURL = docURL;
    var self = this;

    function handle_error(error)
    {
      if (self.skip_error)
      {
        self.skipped_error.push(""+error);
        self._pos++;

        if (self._pos < textData.length)
          self.parse(textData, docURL, self.callback);
        else
          self.callback(null, self._output);
      }
      else {
          self.callback(""+error, null);
      }
    }


    if (this._pos < textData.length)
    {
      try {
        var buf = [];
        json_data = JSON.parse(textData[this._pos]);
        if (json_data != null) {
          if (Array.isArray(json_data)) {
            for(var i=0; i < json_data.length; i++)
              self.handle_obj(buf, self.gen_subj(), json_data[i]);
          } else {
            self.handle_obj(buf, self.gen_subj(), json_data);
          }

          var ttl_data = buf.join('\n');
          var handler = new Handle_Turtle(self.start_id, self._make_ttl);
          handler.skip_error = false;
          handler.parse([ttl_data], docURL, function(error, html_data) {
            if (error) {
              handle_error(error);
            }
            else {
              if (self._output===null)
                self._output = "";

              self._output += html_data;
              self._output += "\n\n";
              self._pos++;
              self.start_id += handler.start_id;

              if (self._pos < textData.length)
                self.parse(textData, docURL, self.callback);
              else
                self.callback(null, self._output);
            }
          });
        }
        else
          self.callback(null, null);
      } catch (ex) {
        handle_error(ex.toString());
      }

    } else {
       self.callback(null, this._output);
    }
  },
}




Handle_RDFa = function () {
  this.callback = null;
};

Handle_RDFa.prototype = {

  parse : function(data, docURL, callback) {
    this.callback = callback;

    var self = this;
    try {
      var str = new HTML_Gen(docURL).load(data);
      self.callback(null, str);
    } catch (ex) {
      self.callback(ex.toString(), null);
    }
  }

}






//Convert N3 data to internal format
function N3DataConverter(options) {
  this._LiteralMatcher = /^"([^]*)"(?:\^\^(.+)|@([\-a-z]+))?$/i;
  this.RDF_PREFIX = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
  this.RDF_TYPE   = this.RDF_PREFIX + 'type';
  this.xsdString  = 'http://www.w3.org/2001/XMLSchema#string',
  this.output = [];
}

N3DataConverter.prototype = {

  _IriOrBlank: function (entity) {
    // A blank node or list is represented as-is
    if (entity.termType !== 'NamedNode')
      return 'id' in entity ? entity.id : '_:' + entity.value;
    // Escape special characters
    return entity.value;
  },

  addTriple: function (n_subj, n_pred, n_obj)
  {
      var s = null;
      var o = null;
      var subj = this._IriOrBlank(n_subj);
      var pred = this._IriOrBlank(n_pred);
      var obj = (n_obj.termType==="Literal") ? n_obj.value : this._IriOrBlank(n_obj);

      for(var i=0; i < this.output.length; i++)
        if (this.output[i].s === subj) {
          s = this.output[i];
          break;
        }

      if (s == null) {
        s = {s:subj, n: this.output.length+1};
        this.output.push(s);
      }

      if (s.props === undefined)
        s.props = new Object();
      if (s.props_obj === undefined)
        s.props_obj = new Object();

      var p = s.props[pred];
      var p_obj = s.props_obj[pred];
      if  (p === undefined) {
         s.props[pred] = [];
         s.props_obj[pred] = {};
      }

      p = s.props[pred];
      p_obj = s.props_obj[pred];

      if (!p_obj[obj])
      {
        p_obj[obj]=1;

        if (n_obj.termType==="Literal") {
          p.push({
             value:n_obj.value,
             type: (n_obj.datatypeString!==this.xsdString) ? n_obj.datatypeString : "",
             lang: n_obj.language
            });
        } else {
          p.push({iri :obj});
        }
      }

  }
}


//Convert Microdata JSON to internal format
function MicrodataJSON_Converter(options) {
  this._LiteralMatcher = /^"([^]*)"(?:\^\^(.+)|@([\-a-z]+))?$/i;
  this.RDF_PREFIX = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
  this.RDF_TYPE   = this.RDF_PREFIX + 'type';
  this.output = [];
  this.last_Bnode = 0;
  this.baseURI;
}

MicrodataJSON_Converter.prototype = {
  transform: function (json, baseURI)
  {
      this.baseURI = baseURI;
      var self = this;
      var out = [];

      for(var i=0; i < json.items.length; i++)
      {
        var item = json.items[i];
        var rc = this.expand_item(item);
        out.push(rc.data);
        out = out.concat(rc.data_add);
      }

      for(var i=0; i < out.length; i++)
      {
        out[i]["n"] = i+1;
        if (!out[i].s)
          out[i]["s"] = baseURI;
      }

      return out;
  },

  new_bnode : function()
  {
    this.last_Bnode++;
    return "_:bb"+this.last_Bnode;
  },

  expand_item : function(item)
  {
    var self =this;
    var out = { };
    var out_add = [];
    var retVal = { id:null, data:{}, data_add:[] };
    var i_props = null;
    var props = {};
    var id_ns = null;

    retVal.data = out;
    retVal.data_add = out_add;
    out["props"] = props;

    //try get current NS
    if (item.type!==undefined) {
      var ns_list = new Namespace();
      if ($.isArray(item.type)) {
        for(var i=0; i<item.type.length; i++) {
          id_ns = ns_list.has_known_ns(String(item.type[i]));
          if (id_ns)
            break;
        }
      } else {
        id_ns = ns_list.has_known_ns(String(item.type));
      }
    }


    $.each(item, function(key, val)
     {
       if (key==="properties") {
         i_props = val;
       }
       else if (key==="id")
       {
         if (val.indexOf(':') === -1)
           val = ":"+val;
         out["s"]=val;
         retVal.id = val;
       }
       else if (key==="type")
       {
         if ($.isArray(val)) {
           for(var i=0; i<val.length; i++) {
             if (val[i].indexOf(':') === -1)
               val[i] = { "iri" : ":"+val[i], typeid:1};
             else
               val[i] = { "iri" : val[i], typeid:1};
           }
         }
         else {
           if (val.indexOf(':') === -1)
               val = [{ "iri" : ":"+val, typeid:1}];
           else
               val = [{ "iri" : val, typeid:1}];
         }
         props[self.RDF_TYPE] = val;
       }
       else
       {
         if (key.indexOf(':') === -1)
            key = ":"+key;

         if ($.isArray(val))
           props[key]=val;
         else
           props[key]=[val];
       }
     });


      function expand_sub_item(parent, val)
      {
         var rc = self.expand_item(val);
         if (!rc.id) {
           var bnode = self.new_bnode();
           rc.id = bnode;
           rc.data.s = bnode;
         }
         parent.push({ "iri" : rc.id });
         out_add.push(rc.data);
         for(var i=0; i<rc.data_add.length; i++)
           out_add.push(rc.data_add[i]);
      }

      function handle_val(v_lst, val)
      {
         if (String(val).indexOf('[object Object]') === 0)
           expand_sub_item(v_lst, val);
         else if (val.substring(0,7) ==="http://")
           v_lst.push({ "iri" : val});
         else if (val.substring(0,8) ==="https://")
           v_lst.push({ "iri" : val});
         else if (val.substring(0,9) ==="nodeid://")
           v_lst.push({ "iri" : val});
         else
           v_lst.push({ "value" : val}); //??todo parse literal
/**
      else {
        var match = this._LiteralMatcher.exec(obj);
        if (!match) throw new Error('Invalid literal: ' + obj);
        p.push({
             value:match[1],
             type:match[2],
             llang:match[3]});
      }
****/
      }


    if (i_props) {
      $.each(i_props, function(key, val)
      {
        if (key.indexOf(':') === -1) {
          if (id_ns)
            key = id_ns.link+key;
          else
            key = ":"+key;
        }

       var v = [];
/**
       if (!$.isArray(val) && String(val).indexOf('[object Object]') === 0)
       {
           expand_sub_item(v, val);
       }
       else {
         for(var i=0; i<val.length; i++) {
           if (String(val[i]).indexOf('[object Object]') === 0) //isArray lenght=1, el == Object
             expand_sub_item(v, val[i]);
           else if (val[i].substring(0,7) ==="http://")
             v.push({ "iri" : val[i]});
           else if (val[i].substring(0,8) ==="https://")
             v.push({ "iri" : val[i]});
           else
             v.push({ "value" : val[i]});
         }
       }
**/
       if ($.isArray(val))
       {
         for(var i=0; i<val.length; i++)
           handle_val(v, val[i]);
       }
       else
       {
         handle_val(v, val);
       }

       if (key!==":unnamed")
         props[key] = v;

      });
    }

    return retVal;
  }

}


Handle_RDF_XML = function (start_id) {
  this.callback = null;
  this.baseURI = null;
  this._pos = 0;
  this._output = null;
  this.start_id = 0;
  if (start_id!==undefined)
    this.start_id = start_id;
  this.skip_error = true;
  this.skipped_error = [];
};

Handle_RDF_XML.prototype = {

  parse : function(textData, baseURL, callback) {
    this.callback = callback;
    this.baseURI = baseURL;
    var self = this;


    function handle_error(error)
    {
      if (self.skip_error)
      {
        self.skipped_error.push(""+error);
        self._pos++;

        if (self._pos < textData.length)
          self.parse(textData, baseURL, self.callback);
        else
          self.callback(null, self._output);
      }
      else {
          self.callback(""+error, null);
      }
    }


    if (this._pos < textData.length) {
      try {
        var store=$rdf.graph();
        var rdf_data = textData[self._pos];

        $rdf.parse(rdf_data, store, baseURL, 'application/rdf+xml');

        var ttl = $rdf.serialize(undefined, store, baseURL, "text/turtle");

        var handler = new Handle_Turtle();
        handler.skip_error = false;
        handler.parse([ttl], baseURL, function(error, html_data) {
          if (error) {
            handle_error(error.toString());
          }
          else {
            if (self._output===null)
              self._output = "";

            self._output += html_data;
            self._output += "\n\n";
            self._pos++;
            self.start_id += handler.start_id;

            if (self._pos < textData.length)
              self.parse(textData, baseURL, self.callback);
            else
              self.callback(null, self._output);
          }
        });

      } catch (ex) {
        handle_error(ex.toString());
      }
    }
    else {
      self.callback(null, self._output);
    }
  },
}


Handle_CSV = function (start_id) {
  this.callback = null;
  this.baseURI = null;
  this._pos = 0;
  this._output = null;
  this._output_ttl = [];
  this.start_id = 0;
  if (start_id!==undefined)
    this.start_id = start_id;
  this.skip_error = true;
  this.skipped_error = [];

};

Handle_CSV.prototype = {

  parse : function(textData, baseURL, callback) {
    this.callback = callback;
    this.baseURI = baseURL;
    var self = this;


    function handle_error(error)
    {
      if (self.skip_error)
      {
        self.skipped_error.push(""+error);
        self._pos++;

        if (self._pos < textData.length)
          self.parse(textData, baseURL, self.callback);
        else
          self.callback(null, self._output, self._output_ttl);
      }
      else {
          self.callback(""+error, null, self._output_ttl);
      }
    }

    if (this._pos < textData.length) {
      try {
        var text = textData[self._pos];
        if (text.trim().length <= 0) {
           self._pos++;
           self.parse(textData, baseURL, self.callback);
           return;
        }
         
        var ttl = '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n'
                 +'@prefix xsd: <http://www.w3.org/2001/XMLSchema#> . \n\n';
        var res = Papa.parse(text, {skipEmptyLines:true, dynamicTyping:true});
        if (res.errors && res.errors.length > 0) {
            handle_error(res.errors[0].message);
            return;
        }

        var col = res.data[0];
        var col_type = [];
        if (res.data.length > 1) {
          for (var i=0; i < res.data[1].length; i++) {
            var v = res.data[1][i];
            if (typeof v === 'number') {
              var is_int = 1;
              for(var r=1; r < res.data.length; r++) {
                if (res.data[r][i] % 1 !== 0) {
                  is_int = 0;
                  break;
                }
              }
              col_type.push(is_int?'integer':'decimal');
            } else if (typeof v === 'boolean') {
              col_type.push('boolean'); 
            } else if (typeof v === 'string') {
              if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('mailto:') || v.startsWith('urn:') || v.startsWith('../'))
                col_type.push('anyURI');
              else
                col_type.push('string');
            } else {
              col_type.push('string');
            }
          }
        }
        ttl += '\n';

        var rep1 = /\(/g;
        var rep2 = /\)/g 

        for (var i=0; i < col.length; i++) {
          col[i] = encodeURIComponent(col[i]).replace(rep1,'%28').replace(rep2,'%29');
          ttl += '<#'+col[i]+'> rdf:domain <#> .\n';
        }

        ttl += '\n';

        for (var i=0; i < col.length; i++) {
          ttl += '<#'+col[i]+'> rdf:range xsd:'+col_type[i]+' .\n';
        }

        ttl += '\n';

        for(var i=1; i < res.data.length; i++) {
          var d = res.data[i];
          var s = '[\n';
          for(var j=0; j < d.length; j++) {
            var val = d[j];
            s += '<#'+col[j]+'> "'+d[j]+'"^^xsd:'+col_type[j]+' ;\n' ;
          }
          ttl += s +'].\n\n';
        }

        self._output_ttl.push(ttl);

        var handler = new Handle_Turtle();
        handler.skip_error = false;
        handler.parse([ttl], baseURL, function(error, html_data) {
          if (error) {
            handle_error(error.toString());
          }
          else {
            if (self._output===null)
              self._output = "";

            self._output += html_data;
            self._output += "\n\n";
            self._pos++;
            self.start_id += handler.start_id;

            if (self._pos < textData.length)
              self.parse(textData, baseURL, self.callback);
            else
              self.callback(null, self._output, self._output_ttl);
          }
        });

      } catch (ex) {
        handle_error(ex.toString());
      }
    }
    else {
      self.callback(null, self._output, self._output_ttl);
    }
  },


}
