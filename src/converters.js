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



class Convert_Turtle{
  constructor() 
  {
    this.baseURI = null;
    this.skipped_error = [];
    this.bnode_types = {};
  }

  async prepare_query(ttlData, baseURL)
  {
    var self = this;
    var handler = new Handle_Turtle(0, true, true);
    var ret = await handler.parse(ttlData, baseURL);

    if (ret.errors.length>0)
      self.skipped_error = self.skipped_error.concat(ret.errors);

    return ret.data;
  }



  async fix_ttl(ttlData, baseURL)
  {
    var self = this;
    var handler = new Handle_Turtle(0, true);
    var ret = await handler.parse(ttlData, baseURL);

    if (ret.errors.length>0)
      self.skipped_error = self.skipped_error.concat(ret.errors);

    return ret.data;
  }

  async _fix_nano_ttl(ttlData, nanoData, baseURL, skip_docpref) 
  {
    var self = this;
    var data = [];

    if (ttlData && ttlData.length > 0) {
      var handler = new Handle_Turtle(0, true, false, null, skip_docpref);
      var ret = await handler.parse(ttlData, baseURL);

      if (ret.errors.length>0)
        self.skipped_error = self.skipped_error.concat(ret.errors);

      if (ret.data && ret.data.length > 0)
        data = data.concat(ret.data);
    }

    if (nanoData!==null && nanoData.length > 0) {
      var handler = new Handle_Turtle(0, true);
      var ret = await handler.parse_nano(nanoData, baseURL);

      if (ret.errors.length>0)
        self.skipped_error = self.skipped_error.concat(ret.errors);

      if (ret.data && ret.data.length > 0)
        data = data.concat(ret.data);
    }

    return data;
  }

  async to_jsonld(ttlData, nanoData, baseURL) 
  {
    var fixed_ttl = await this._fix_nano_ttl(ttlData, nanoData, baseURL, true);
    var output = [];

    for(var i=0; i < fixed_ttl.length; i++)
    {
      var str = await this._to_jsonld_exec(fixed_ttl[i], baseURL);
      output.push(str);
    }
    return output;
  }


  async to_rdf(ttlData, nanoData, baseURL, callback) 
  {
    var fixed_ttl = await this._fix_nano_ttl(ttlData, nanoData, baseURL);
    var output = [];

    for(var i=0; i < fixed_ttl.length; i++)
    {
      output.push(this._to_rdf_exec(fixed_ttl[i], baseURL));
    }

    return output;
  }


  _to_rdf_exec(textData, baseURL) 
  {
    try {
      var store=$rdf.graph();
      var ttl_data = textData;

      $rdf.parse(ttl_data, store, baseURL, 'text/turtle');

      return $rdf.serialize(undefined, store, baseURL, 'application/rdf+xml');
    } catch (ex) {
      this.skipped_error.push(""+ex.toString());
      return '';
    }
  }



  async _to_jsonld_exec(ttl_data, baseURL) 
  {
    this.baseURI = baseURL;
    var self = this;
    var setting = new Settings();
    var compact_relative = await setting.getValue("ext.osds.jsonld_compact_rel");


    return new Promise(function (resolve, reject) {
      try {
        var store = new N3.Writer({ format: 'N-Triples' });
        var parser = new N3.Parser({baseIRI:self.baseURI});

        parser.parse(ttl_data,
          function (error, tr, prefixes) {
            if (error) {
              error = ""+error;

              self.skipped_error.push(error);
              resolve('');
            }
            else if (tr) {
              store.addQuad(tr.subject,
                            tr.predicate,
                            tr.object);
            }
            else {
              var context = prefixes;
              var base = baseURL;

              if (context[""])
                delete context[""];

              if (compact_relative === '1')
                context["@base"] = baseURL;

              store.end(async function (error, ttl_text) {

                if (error) {
                  self.skipped_error.push(error);
                  resolve('');
                }

                try {
                  var doc = await jsonld.fromRDF(ttl_text, {format: 'application/nquads'});
               
                  try {
                    var compacted;
                    if (compact_relative === '1')
                      compacted = await jsonld.compact(doc, context, {base, compactToRelative: true});
                    else
                      compacted = await jsonld.compact(doc, context, {compactToRelative: false});

                    resolve(JSON.stringify(compacted, null, 2));

                  } catch (ex) {
                    var json = {'@context':context, '@graph':doc};
                    resolve(JSON.stringify(json, null, 2));
                  }

                } catch (ex) {
                  self.skipped_error.push(ex.toString());
                  resolve('');
                }
              });
            }
          });
      } catch (ex) {
        self.skipped_error.push(""+ex.toString());
        resolve('');
      }
    });
  }

}



class Convert_RDF_XML { 
  constructor() {
    this.skipped_error = [];
  }

  to_ttl(textData, baseURL) {
    var output = [];

    for(var i=0; i < textData.length; i++)
    {
      try {
        var rdf_data = textData[i];
        var store=$rdf.graph();

        $rdf.parse(rdf_data, store, baseURL, "application/rdf+xml");
        var ttl_data = $rdf.serialize(undefined, store, baseURL, "text/turtle");
        output.push(ttl_data);

      } catch (ex) {
        this.skipped_error.push(""+ex.toString());
      }
    }
    return output;
  }


  async to_jsonld(textData, baseURL) {
    var output = [];

    for(var i=0; i < textData.length; i++)
    {
      try {
        var rdf_data = textData[i];
        var store=$rdf.graph();

        $rdf.parse(rdf_data, store, baseURL, "application/rdf+xml");
        var ttl_data = $rdf.serialize(undefined, store, baseURL, "text/turtle");

        var conv = new Convert_Turtle();
        var str = await conv.to_jsonld([ttl_data], null, baseURL);
        output.push(str);

      } catch (ex) {
        this.skipped_error.push(""+ex.toString());
      }
    }

    return output;
  }

}



class Convert_JSONLD {
  constructor() {
    this.start_id = 0;
    this.skipped_error = [];
  }

  async to_ttl(textData, baseURL) 
  {
    var output = [];
    var bnode_types = {};

    for(var i=0; i < textData.length; i++)
    {
      try {
        var handler = new Handle_JSONLD(true);
        var ret = await handler.parse([textData[i]], baseURL, bnode_types);

        if (ret.errors.length > 0) 
          this.skipped_error = this.skipped_error.concat(ret.errors);

        if (ret.data.length > 0) {
          if (Array.isArray(ret.data))
            output = output.concat(ret.data);
          else
            output.push(ret.data);
        }

      } catch (ex) {
        this.skipped_error.push(ex.toString());
      }
    }
    return output;
  }

  
  async to_rdf(textData, baseURL)
  {
    var output = [];
    this.baseURI = baseURL;

    var ttl_data = await this.to_ttl(textData, baseURL);

    for(var i=0; i < ttl_data.length; i++)
    {
      output.push(this._to_rdf_exec(ttl_data[i], baseURL));
    }

    return output;
  }


  _to_rdf_exec(textData, baseURL) 
  {
    try {
      var store=$rdf.graph();
      var ttl_data = textData;

      $rdf.parse(ttl_data, store, baseURL, 'text/turtle');

      return $rdf.serialize(undefined, store, baseURL, "application/rdf+xml");
    } catch (ex) {
      this.skipped_error.push(""+ex.toString());
      return '';
    }
  }

}




class Convert_RSS {
  constructor(is_atom) {
    this._output_ttl = [];
    this.skipped_error = [];
    this.is_atom = is_atom ? true : false;
  }

  getVal_or_Attr(val, attr)
  {
    var ret = null;
    if (typeof val === "string")
      ret = val;
    else if (val.$ && val.$[attr])
      ret = val.$[attr].value
    else if (val.value && val.name === attr)
      ret = val.value;
    else if (val._)
      ret = val._;
    return ret;
  }


  getValAttr(val)
  {
    val = Array.isArray(val) ? val[0]: val;

    var attr = val && val.$ ? val.$ : {};

    if (typeof val === "string")
      return {v: val, a: {}};
    else if (val && val._)
      return {v: val._, a: attr}
    else if (val && val.value)
      return {v: val.value, a: attr}
    else
      return {v: '', a: attr}
  }

  normalize_space(v) 
  {
    return v.trim().replace(/\s\s+/g, ' ')
  }

  fix_uri(v) 
  {
    return encodeURI(v.trim())
  }

  fix_text(val)
  {
    var qv = '"';

    val = typeof val === 'string' ? val: val.toString();
    if (val.indexOf("\n")!=-1 || val.indexOf("\r")!=-1) {
      qv = '"""';
      val = val.replace(/\\/g,'\\\\').replace(/\"/g,"\\\"");
    } else {
      val = val.replace(/\\/g,'\\\\').replace(/\'/g,"''").replace(/\"/g,"\\\"");
    }

    return qv+val+qv;
  }

  fix_text2(val)
  {
    return this.fix_text(this.normalize_space(val));
  }
  
  removeTags(val)
  {
    return this.fix_text(val.replace(/<\/?[^>]+(>|$)/g, ""));
  }

  categories_2_ttl(vals, link)
  {
    var ttl = '';
    for(const it of vals) {
      const v = this.normalize_space(it._);
      ttl += `<${link}#${encodeURI(v)}> a skos:Concept; skos:prefLabel "${v}" .\n`
    }
    return ttl;
  }

  contains(s, lst)
  {
     var pos = -1;
     for(var v of lst) {
       pos = s.indexOf(v);
       if (pos != -1)
         break;
     }
     return pos;                                                                                          
  }

  prop2str(prop, vals, isItem, channel_link)
  {
    var val = vals[prop]
    var ttl = '';
    var pref = isItem?'dc':'rss';
    var v = this.getValAttr(val);

    if (this.is_atom) {
      if (prop === 'subtitle' || prop === 'summary')
        return `schema:description ${this.fix_text(v.v)}`;
      else if (prop === 'rights')
        return `schema:copyrightHolder ${this.fix_text(v.v)}`;
      else if (prop === 'updated')
        return `schema:modifiedTime "${(new Date(v.v)).toISOString()}"^^xsd:dateTime `;
      else if (prop === 'published' || prop === 'issued')
        return `schema:dateCreated "${(new Date(v.v)).toISOString()}"^^xsd:dateTime `;
      else if (prop === 'modified')
        return `schema:dateModified "${(new Date(v.v)).toISOString()}"^^xsd:dateTime `;
      else if (prop === 'a_link' || prop === 'link') {
        if (v.a.rel && v.a.rel.value === 'alternate') {
          return v.v ? `schema:mainEntity <${this.fix_uri(v.v)}> ` : '';
        }
        else if (v.a.rel && v.a.rel.value === 'related' && v.a.href) {
          ttl = `schema:seeAlso [ a schema:Thing `;
          if (v.a.title)
            ttl += `; schema:title ${this.fix_text(v.v)}; rdfs:label ${this.fix_text(v.v)}`;
          ttl += ` ] `
          return ttl;
        }
      }
      else if (prop === 'a_author') {
          ttl = `schema:author [ a foaf:agent `;

          for(var v in val) {
            var s = (v === 'name' || v === 'email') ? this.prop2str(v, val, true, null) : '';
            if (s) 
              ttl += '; '+s+' ';
          }
          ttl += ` ] `
          return ttl;
      }
      else if (prop === 'category') {
         var scolon = false;
         for(var i=0; i < val.length; i++) {
           var v = this.getValAttr(val[i]);
           if (v.a.term) {
             ttl += `${scolon?';\n    ':''}schema:about [ a skos:Concept ; skos:prefLabel ${this.fix_text(v.a.term.value)} ] `;
             scolon = true;
           }
           
         }
          return ttl;
      }
      else if (prop === 'contentSnippet' && v.v.length > 0){
          var cont = this.getValAttr(vals['a_content']);
          var c_type = cont.a.type ? cont.a.type.value : '';

          switch (c_type) {
            case 'xhtml': c_type = 'application/xhtml+xml'; break;
            case 'html': c_type = 'text/html'; break;
            case 'xml': c_type = 'text/xml'; break;
          }

          ttl = `atomowl:content [ a atomowl:Content `;
          if (c_type)
            ttl += `; atomowl:type ${this.fix_text(c_type)}`;

          ttl += `; atomowl:body ${this.fix_text(cont.v)} ] `;
          return ttl;
      }
    } 
    else  // === RSS ===
    {
      if (prop === 'a_link') 
        return v.a.href ? `dc:source <${this.fix_uri(v.a.href.value)}> ` : ''
      else if (prop === 'link') {
        val = this.getVal_or_Attr(val,'href');
        ttl = `schema:relatedLink <${this.fix_uri(val)}> `;
        var p	 = val.indexOf('#');
        if (p != -1) {
          ttl+= `;\n    schema:seeAlso <${this.fix_uri(val.substring(0,p))}>`
        }
        return ttl;
      }
      else if (prop === 'contentSnippet' && v.v.length > 0){
        if (!isItem)
          ttl = `schema:description ${this.removeTags(v.v)} `;
      }
    }


    if (prop === 'pubdate' || prop === 'isoDate' || prop === 'lastBuildDate') 
      ttl = `schema:dateCreated "${(new Date(v.v)).toISOString()}"^^xsd:dateTime `;
    else if (prop === 'pubDate') 
      ttl = `schema:datePublished "${(new Date(v.v)).toISOString()}"^^xsd:dateTime `;
    else if (prop === 'date' || prop === 'dc:date') 
      ttl = `schema:date "${(new Date(v.v)).toISOString()}"^^xsd:dateTime `;
    else if (prop === 'language' || prop === 'dc:language')
      ttl = `schema:inLanguage ${this.fix_text2(v.v)} `;
    else if (prop === 'guid') {
      if (v.a.isPermalink && v.a.isPermalink.value !== 'false')
        ttl = `schema:url <${this.fix_uri(v.v)}> `;
    }
    else if (prop === 'id')
        ttl = `schema:url <${this.fix_uri(v.v)}> `;
    else if (prop === 'copyright')
      ttl = `schema:copyrightHolder ${this.fix_text(v.v)} `;
    else if (prop === 'managingEditor' || prop === 'a_author')
      ttl = `schema:creator ${this.fix_text2(v.v)} `;
    else if (prop === 'title') 
      ttl = `schema:title ${this.fix_text2(v.v)} ;\n`
          + `    rdfs:label ${this.fix_text2(v.v)} `;
    else if (prop === 'feedUrl' && v.v)
      ttl = `dc:source <${this.fix_uri(v.v)}> `;
    else if (prop === 'source' && v.a.url)
      ttl = `dc:source <${this.fix_uri(v.a.url.value)}> `;
    else if (prop === 'media_content' && v.a.url)
      ttl = `media:content <${this.fix_uri(v.a.url.value)}> `;
    else if (prop === 'docs' && v.v)
      ttl = `dc:documentation <${this.fix_uri(v.v)}> `;
    else if (prop === 'ttl' && v.v)
      ttl = `dcterms:temporal ${this.fix_text(v.v)} `;
    else if (prop === 'description' && v.v) {
      if (vals['title'])
        ttl = `schema:text ${this.removeTags(v.v)} `;
      else
        ttl = `schema:name ${this.removeTags(v.v)} `;
    }
    else if (prop === 'wfw:commentRss' && v.v)
      ttl = `wfw:commentRss ${this.removeTags(v.v)} `;
    else if (prop === 'georss_point' && v.v) {
      val = v.v.split(' ');
      if (val.length > 1)
        ttl = `geo:lat ${val[0]} ; geo:long ${val[1]} `;
    }
    else if (prop === 'geo_point') {
       var v_lat = val['geo:lat'];
       var v_long = val['geo:long']

       if (v_lat && v_lat.length > 0)
         ttl += `geo:lat ${v_lat[0]._} `;

       if (v_long && v_long.length > 0)
         ttl += `${v_lat && v_lat.length > 0 ? '; ':''}geo:long ${v_long[0]._} `;
    }
    else if (prop === 'rating' && v.v)
      ttl = `schema:contentRating [ a schema:Rating ; schema:ratingValue ${this.fix_text2(v.v)}] `;
    else if (prop === 'webMaster' && v.v)
      ttl = `schema:contactPoint [ a schema:ContactPoint ; schema:email ${this.fix_text2(v.v)}] `;
    else if (prop === 'categories')
      ttl = `schema:about <${channel_link}#${this.fix_uri(v.v)}> `;
    else if (prop === 'a_enclosure') {
      ttl = `schema:associatedMedia [ a schema:MediaObject `;
      if (v.a.url)
        ttl += `; schema:url <${this.fix_uri(v.a.url.value)}> `;
      if (v.a.type)
        ttl += `; schema:encodingFormat ${this.fix_text2(v.a.type.value)} `;
      if (v.a.length)
        ttl += `; schema:contentSize ${this.fix_text2(v.a.length.value)} `;
      ttl += `] `;
    }
    else if (prop === 'image') {
      if (v.v.url && v.v.url.length > 0)
      ttl = `schema:image <${this.fix_uri(v.v.url[0]._)}> `;
    }
    else if (v.v && v.v.length > 0) {
      if (prop.indexOf(':') == -1)
        ttl = `schema:${prop} ${this.fix_text2(v.v)} `;
      else
        ttl = `${prop} ${this.fix_text2(v.v)} `;
    }


    return ttl;
  }

  ttl_for_item(it, channel_link)
  {
    var ttl = '';

    for (var iprop in it) {
      if (iprop === 'items' || 
//          iprop.indexOf(':')!=-1 || 
          iprop.startsWith('itunes:') ||
          iprop === 'content' ||
          iprop === 'a_content' ||
          iprop === 'author' ||
          iprop === 'enclosure' ||
          iprop === 'creator' ||
          iprop === 'paginationLinks') 
        continue;

      if (this.is_atom && iprop === 'pubDate')
        continue;

      var s = this.prop2str(iprop, it, true, channel_link);

      if (s.length > 0)
        ttl += ` ;\n        ${s}`;
    }

    return ttl;
  }



  async to_ttl(textData, baseURL)

  {
    this.baseURL = baseURL;

    for(var x=0; x < textData.length; x++)
    {
      try {
        var text0 = textData[x];

        var opts = {
           "indent":"auto",
           "indent-spaces":2,
           "markup":true,
           "numeric-entities":true,
           "quote-marks":true,
           "quote-nbsp":false,
           "show-body-only":false,
           "quote-ampersand":false,
           "break-before-br":true,
           "uppercase-tags":false,
           "uppercase-attributes":false,
           "drop-font-tags":true,
           "tidy-mark":false,
           "fix-uri":true,
           "wrap": 0,
           "input-xml":true,
           "output-xml":true
          };
        
        var text = tidy_html5(text0, opts);

        if (text.trim().length <= 0) {
          continue;
        }
         
        var ttl_add = '\n';
        var ttl_items = '\n';
        var ttl = '@prefix a:    <http://www.w3.org/2005/Atom> . \n'
                 +'@prefix atom: <http://www.w3.org/2005/Atom/> . \n'
                 +'@prefix atomowl: <http://bblfish.net/work/atom-owl/2006-06-06/#> . \n'
                 +'@prefix content: <http://purl.org/rss/1.0/modules/content/> . \n'
                 +'@prefix dc:      <http://purl.org/dc/elements/1.1/> . \n'
                 +'@prefix dcterms: <http://purl.org/dc/terms/> . \n'
                 +'@prefix foaf:    <http://xmlns.com/foaf/0.1/> . \n'
                 +'@prefix g:       <http://base.google.com/ns/1.0> . \n'
                 +'@prefix geo:     <http://www.w3.org/2003/01/geo/wgs84_pos#> . \n'
                 +'@prefix georss:  <http://www.georss.org/georss> . \n'
                 +'@prefix gml:     <http://www.opengis.net/gml> . \n'
                 +'@prefix gphoto:  <http://schemas.google.com/photos/2007> . \n'
                 +'@prefix media:   <http://search.yahoo.com/mrss/> . \n' 
                 +'@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n'
                 +'@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> . \n'
                 +'@prefix rss:     <http://purl.org/rss/1.0/> . \n'
                 +'@prefix schema:  <http://schema.org/> . \n'
                 +'@prefix sioc:   <http://rdfs.org/sioc/ns#> . \n'
                 +'@prefix skos:   <http://www.w3.org/2004/02/skos/core#> . \n'
                 +'@prefix terms:  <http://purl.org/dc/terms/> . \n'
                 +'@prefix owl:    <http://www.w3.org/2002/07/owl#> . \n'
                 +'@prefix wfw:    <http://wellformedweb.org/CommentAPI/> . \n'
                 +'@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> . \n'
                 +'@prefix : <#> . \n\n';


        function rebuildURI(name, prefix) 
        {
          var i = name.indexOf(':');
          if (i == -1)
            return prefix+':'+name;
          else
            return prefix+':'+name.substring(i+1);
        }

        var prefixMatch = new RegExp(/(?!xmlns)^.*:/);
        
        function fixPrefix(name, key, uri, prefix) 
        {
          if (prefix) {
            var v = name.replace(prefixMatch, '');
            if (uri === 'http://www.w3.org/2005/Atom')
              return v;
            else if (uri === 'http://backend.userland.com/rss2')
              return v;
            else if (uri === 'http://purl.org/rss/1.0/')
              return v;
            else if (uri === 'http://purl.org/dc/elements/1.1/')
              return rebuildURI(name, 'dc');
            else if (uri === 'http://www.georss.org/georss') 
              return rebuildURI(name, 'georss');
            else if (uri === 'http://purl.org/dc/terms/')
              return rebuildURI(name, 'dcterms');
            else if (uri === 'http://www.w3.org/2004/02/skos/core#') 
              return rebuildURI(name, 'skos');
            else if (uri === 'http://rdfs.org/sioc/ns#')
              return rebuildURI(name, 'sioc');
            else if (uri === 'http://base.google.com/ns/1.0')
              return rebuildURI(name, 'g');
            else if (uri === 'http://www.opengis.net/gml')
              return rebuildURI(name, 'gml');
            else if (uri === 'http://schemas.google.com/photos/2007') 
              return rebuildURI(name, 'gphoto');
            else if (uri === 'http://schema.org/')
              return rebuildURI(name, 'schema');
            else if (uri === 'http://xmlns.com/foaf/0.1/')
              return rebuildURI(name, 'foaf');
            else
              return name;
          } 
          else
            return name;
        }


        var parser;
        if (this.is_atom)
          parser = new RSSParser({
              xml2js: {ignoreAttrs: false, xmlns: true, tagNameProcessors: [fixPrefix], strictError: false},
              customFields: {
                  feed: ["subtitle", "summary",
                         ['link', 'a_link', {keepAttrs:true}],
                         ['author', 'a_author', {keepAttrs:true}],
                         ['category', 'category', {keepAttrs:true, keepArray:true}],
                         'name',
                         'email',
                         'rights',
                         'updated',
                         'published',
                         'issued',
                         'modified',
                         'id',
                         'dc:*',
                         'georss:*',
                         'dcterms:*',
                         'skos:*',
                         'sioc:*',
                         'g:*',
                         'gml:*',
                         'gphoto:*',
                         'schema:*',
                         'foaf:*',
                         ],
                  item: [
                         ['link', 'a_link', {keepAttrs:true}],
                         'updated',
                         'published',
                         'issued',
                         'modified',
                         'id',
                         ['author', 'a_author', {keepAttrs:true}],
                         ['content', 'a_content', {keepAttrs:true}],
                         ['category', 'category', {keepAttrs:true, keepArray:true}],
                         'dc:*',
                         'georss:*',
                         'dcterms:*',
                         'skos:*',
                         'sioc:*',
                         'g:*',
                         'gml:*',
                         'gphoto:*',
                         'schema:*',
                         'foaf:*',
                        ],
              }
          });
        else
          parser = new RSSParser({
              xml2js: {ignoreAttrs: false, xmlns: true, tagNameProcessors: [fixPrefix], strictError: false},
              customFields: {
                  feed: ['language',
                         'dc:language',
                         'source',
                         ['author', 'a_author'],
                         ['enclosure','a_enclosure', {keepAttrs:true}],
//                         ['r:image', 'image'],
                         ['media:content', 'media_content'],
                         'date','pubdate', 'docs', 'image'
                         ],
                  item: [
                         ['author', 'a_author'],
                         ['enclosure','a_enclosure', {keepAttrs:true}],
                         ['guid','guid', {keepAttrs:true}],
                         ['media:content', 'media_content'],
                         ['a:link', 'a_link'],
                         ['georss:point', 'georss_point'],
                         ['geo:Point', 'geo_point'],
                         'source', 'description','wfw:commentRss'
                        ],
              }
          });

        var feed = await parser.parseString(text);
        if (!feed) 
          continue;

        var channel_link = feed.link ? this.getVal_or_Attr(feed.link, 'href') : baseURL;
        channel_link = this.fix_uri((new URL(channel_link)).toString());

        ttl +=  `:this schema:mainEntity <${channel_link}> .\n\n`
               +`<${channel_link}> a schema:DataFeed`;

        if (!this.is_atom)
           ttl +=`;\n    schema:url <${channel_link}>` 

        for (var prop in feed) {
          if (prop === 'items' ||
              prop === 'creator'|| 
              prop === 'enclosure') 
            continue;

          var s = this.prop2str(prop, feed, false, channel_link);

          if (s.length > 0)
            ttl += ` ;\n    ${s}`;
        }
        if (feed.categories && feed.categories.length > 0)
          ttl_add += this.categories_2_ttl(feed.categories, channel_link)


        var items = feed.items;
        if (items && items.length > 0) {
          ttl += ' ;\n';

          var ID = 0;
          for(var it of items) {

            ID++;

            if (ID > 1)
              ttl += ';\n'

            ttl += '\n    schema:dataFeedElement [ a schema:DataFeedItem ';

            ttl += this.ttl_for_item(it, channel_link);
            
            ttl += ' ]';

            if (it.categories && it.categories.length > 0)
              ttl_add += this.categories_2_ttl(it.categories, channel_link)
          }
        }

        ttl += ' .\n\n';

        ttl += ttl_items;
        ttl += ttl_add;


        this._output_ttl.push(ttl);

      } catch (ex) {
        this.skipped_error.push(""+ex.toString());
      }
    
    }
    return {ttl:this._output_ttl, error: this.skipped_error};
  }
}


class Convert_CSV {
  constructor() 
  {
    this._output_ttl = [];
    this.skipped_error = [];
  }

  to_ttl(textData, baseURL) 
  {
    for(var x=0; x < textData.length; x++)
    {
      try {
        var text = textData[x];
        if (text.trim().length <= 0) {
          continue;
        }
         
        var ttl = '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n'
                 +'@prefix xsd: <http://www.w3.org/2001/XMLSchema#> . \n'
                 +'@prefix : <#> . \n\n';
        var res = Papa.parse(text, {skipEmptyLines:true, dynamicTyping:true});
        if (res.errors && res.errors.length > 0)
        {
          var bad = false;
          if (res.errors[0].code === "UndetectableDelimiter") {
            var data = res.data;
            var count = 0;
            for (var i=0; i < data.length; i++){
              if (i == 0)
                count = data[i].length;
              else if (data[i].length != count)
                bad = true;
            }
          }
          else
            bad = true;     

          if (bad)
            throw new Error(res.errors[0].message);
        }

        var col = res.data[0];
        var col_type = [];
        var found = 0;

        for (var i=0; i < col.length; i++){
          if (!col[i])
            col[i] = 'Unnamed'+i;
          var lst = col[i].split(':');
          if (lst.length > 1) {
            col[i] = lst.length > 2 ? lst[2] : lst[0];
            found++;
            switch(lst[1]) {
              case 'int':
                col_type[i] = 'integer';
                break;
              case 'long':
                col_type[i] = 'long';
                break;
              case 'float':
                col_type[i] = 'float';
                break;
              case 'double':
                col_type[i] = 'double';
                break;
              case 'boolean':
                col_type[i] = 'boolean';
                break;
              case 'byte':
                col_type[i] = 'byte';
                break;
              case 'short':
                col_type[i] = 'short';
                break;
              case 'datetime':
                col_type[i] = 'dateTime';
                break;
              case 'date':
                col_type[i] = 'date';
                break;
              case 'time':
                col_type[i] = 'time';
                break;
              case 'decimal':
                col_type[i] = 'decimal';
                break;
              case 'uuid':
              case 'string': 
              default:
                col_type[i] = 'string';
                break;
            }
          } else {
            col_type[i] = 'string';
          }
        }  
        if (!found) {
          col_type = [];
        }

        if (res.data.length > 1) {
          if (col_type.length === 0)
            for (var i=0; i < res.data[1].length; i++) {
              var v = res.data[1][i];
              if (typeof v === 'number') {
                var is_int = 1;
                var v_type = 'integer';
                for(var r=1; r < res.data.length; r++) {
                  v = res.data[r][i];
                  if (v) {
                    if (typeof v === 'number') {
                      if (is_int == 1 && (v % 1) !== 0) {
                        is_int = 0;
                        v_type = 'decimal;'
                      }
                    } 
                    else {
                      is_int = -1;
                      v_type = 'string';
                      break;
                    }

                  } else {
                    v_type = 'string';
                    break;
                  }
                }
                col_type.push(v_type);
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
          col[i] = fixedEncodeURIComponent(col[i]);
          ttl += ':'+col[i]+' rdf:domain :this .\n';
          ttl += ':'+col[i]+' rdf:range xsd:'+col_type[i]+' .\n';
          ttl += ':'+col[i]+' a <http://www.w3.org/1999/02/22-rdf-syntax-ns#Property> .\n';
        }

        ttl += '\n';

        for(var i=1; i < res.data.length; i++) {
          var d = res.data[i];
          var s = '[\n';

          for(var j=0; j < d.length; j++) {
            var val = d[j] ? ''+d[j] : '';
            var qv = '"';

            if (val.indexOf("\n")!=-1 || val.indexOf("\r")!=-1) {
              qv = '"""';
              val = val.replace(/\\/g,'\\\\').replace(/\"/g,"\\\""); 
            } else {
              val = val.replace(/\\/g,'\\\\').replace(/\'/g,"''").replace(/\"/g,"\\\"");
            }

            s += ':'+col[j]+' '+qv+val+qv+'^^xsd:'+col_type[j]+' ;\n' ;
          }
          ttl += s +'].\n\n';
        }

        this._output_ttl.push(ttl);

      } catch (ex) {
        this.skipped_error.push(""+ex.toString());
      }
    }
    return {ttl:this._output_ttl, error: this.skipped_error};
  }

}


class Convert_JSON {
  constructor() 
  {
    this.s_id = ':this';
    this.id = 0;
    this.skipped_error = [];
    this.baseURL = '';
    this.rep1 = /\(/g;
    this.rep2 = /\)/g;
    this.jprops = {}; 
  }

  gen_subj() {
    this.id++;
    return this.s_id+this.id;
  }


  check_pred(val) 
  {
    if ( val.match(/^http(s)?:\/\//) ) {
      val = "<"+val+">";
    } else {
      val = ':'+fixedEncodeURIComponent(val);
    }
    return val;
  }

  str2obj_val(s) {
    var qv = '"';

    if (s.indexOf("\n")!=-1 || s.indexOf("\r")!=-1) {
      qv = '"""';
      s = s.replace(/\\/g,'\\\\').replace(/\"/g,"\\\"");
    } else {
      s = s.replace(/\\/g,'\\\\').replace(/\'/g,"''").replace(/\"/g,"\\\"");
    }

    return qv+s+qv;
  }

  handle_simple(b, subj, p, o) 
  {
    if (o === null )
      return; // ignore

    var pred = this.check_pred(p);
    var xsd = 'http://www.w3.org/2001/XMLSchema';
    var obj_type = `${xsd}#string`;

    if (typeof o === 'number') {
      if (o % 1 === 0) {
        b.push(`${subj} ${pred} "${o}"^^<${xsd}#int> .`);
        obj_type = `${xsd}#int`;
      }
      else {
        b.push(`${subj} ${pred} "${o}"^^<${xsd}#double> .`);
        obj_type = `${xsd}#double`;
      }
    } else if (typeof o === 'string') {
      b.push(`${subj} ${pred} ${this.str2obj_val(o)} .`);
    } else if (typeof o === 'boolean') {
      b.push(`${subj} ${pred} "${o}"^^<${xsd}#boolean> .`);
      obj_type = `${xsd}#boolean`;
    } else {
      b.push(`${subj} ${pred} ${this.str2obj_val(o)} .`);
    }

    this.jprops[pred] = obj_type;
  }

  handle_arr(b, subj, p, o) 
  {
    if (o === null )
      return; // ignore

    if (typeof o === 'object') {
      var s = this.gen_subj();
      b.push(`${subj} ${this.check_pred(p)} ${s} .`);
      this.handle_obj(b, s, o);
    } else {
      this.handle_simple(b, subj, p, o);
    }
  }


  handle_obj(b, subj, obj)
  {
    if (obj === null )
      return; // ignore
    
    if (typeof obj === 'object') {

      var props = Object.keys(obj);

      if (props.length > 0)
        b.push(`${subj} a <http://www.w3.org/2002/07/owl#Thing> .`);

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
            b.push(`${subj} ${this.check_pred(p)} ${s} .`);
            this.handle_obj(b, s, v);
          }
        } else {
          this.handle_simple(b, subj, p, v);
        }
      }
    } else {
      this.handle_simple(b, subj, 'p', obj);
    } 
  }
  
  
  to_ttl(textData, baseURL) 
  {
    this.baseURL = baseURL;
    var output_ttl = [];
    var json_text = [];

    for(var x=0; x < textData.length; x++)
    {
      try {
        var buf = [];
        var json_data = JSON.parse(textData[x]);
        if (json_data != null) 
        {
          try {
            json_text.push(JSON.stringify(json_data, null, 2));
          } catch(e) {
            json_text.push(textData[x]);
          }

          if (Array.isArray(json_data)) {
            for(var i=0; i < json_data.length; i++)
              this.handle_obj(buf, this.gen_subj(), json_data[i]);
          } else {
            this.handle_obj(buf, this.gen_subj(), json_data);
          }

          var lst = Object.keys(this.jprops);
          for(var i=0; i < lst.length; i++) {
            var p = lst[i];
            var p_type = this.jprops[p];
            buf.push(`[ a <http://www.w3.org/1999/02/22-rdf-syntax-ns#Property> ;
                      <http://schema.org/name> ${p} ;
                      <http://www.w3.org/2000/01/rdf-schema#range> <${p_type}> ;
                      <http://www.w3.org/2000/01/rdf-schema#domain> <http://www.w3.org/2002/07/owl#Thing> ] .`);
          }

          var ttl_data = '@prefix : <#> .\n' 
                        + buf.join('\n');

          output_ttl.push(ttl_data);
        }
      } catch (ex) {
        json_text.push(textData[x]);
        this.skipped_error.push(""+ex.toString());
      }
    }
    return {ttl:output_ttl, json_text, error: this.skipped_error};
  }

}