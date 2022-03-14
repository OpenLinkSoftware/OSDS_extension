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

var POSH = (function () {

  'use strict';

  function POSH(uriStr) {
    this.terms = {};
    this.terms["description"] = "schema:description";
    this.terms["title"] = "schema:title";
    this.terms["describedby"] = "wdrs:describedby";
    this.facebook_vision = "Image may contain: ";

    this.namespace = new Namespace();
    this.twcard_id = 0;

    this.prefixes = {
        "xhv": "http://www.w3.org/1999/xhtml/vocab#",
        "wdrs": "http://www.w3.org/2007/05/powder-s#",

	"opltw": "http://www.openlinksw.com/schemas/twitter#",
	"schema":"https://schema.org/",
	"schemavideo":"https://schema.org/VideoObject#",
        "formats": "http://www.w3.org/ns/formats/",
	"geo": "http://www.w3.org/2003/01/geo/wgs84_pos#",

        "foaf": "http://xmlns.com/foaf/0.1/",
        "dc": "http://purl.org/dc/elements/1.1/",
        "sioc":"http://rdfs.org/sioc/ns#",
        "rdfs":"http://www.w3.org/2000/01/rdf-schema#",
        "rdf":"http://www.w3.org/1999/02/22-rdf-syntax-ns#",
      };

    this._prefixed = /^((?:[A-Za-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])(?:\.?[\-0-9A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff])*)?:((?:(?:[0-:A-Z_a-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff]|%[0-9a-fA-F]{2}|\\[!#-\/;=?\-@_~])(?:(?:[\.\-0-:A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff]|%[0-9a-fA-F]{2}|\\[!#-\/;=?\-@_~])*(?:[\-0-:A-Z_a-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u037f-\u1fff\u200c\u200d\u203f\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]|[\ud800-\udb7f][\udc00-\udfff]|%[0-9a-fA-F]{2}|\\[!#-\/;=?\-@_~]))?)?)(?=\.?[,;\s#()\[\]\{\}"'<])/;


    function fix_twitterid(content) {
      var o = "";
      var p = content.indexOf("@");

      if (p!=-1)
        o +=content.substring(p+1);

      return "https://twitter.com/"+o;
    }

    function fix_twitter_creator(content) {
      var o = "";
      var p = content.indexOf("@");

      if (p!=-1)
        o +=content.substring(p+1);

      return "https://twitter.com/"+o+"#this";
    }

    this.twcard = {
        "meta@name='twitter:url'": {p:"schema:mainEntityOfPage", o:"iri:content"},
        "meta@name='og:url'"     : {p:"schema:mainEntityOfPage", o:"iri:content"},
        "meta@property='og:url'" : {p:"schema:mainEntityOfPage", o:"iri:content"},

        "meta@name='twitter:player:stream'": {p:"schemavideo:embedUrl", o:"iri:content"},

        "meta@name='twitter:player'": {p:"schemavideo:embedUrl", o:"iri:content"},

        "meta@name='twitter:player:stream:'": {p:"formats:media_type", o:"val:content"},

        "meta@name='twitter:url'": {p:"schema:mainEntityOfPage", o:"iri:content"},

        "meta@name='twitter:title'": [{p:"schema:title", o:"val:content"}, {p:"schema:name", o:"val:content"}],
        "meta@name='og:title'"     : [{p:"schema:title", o:"val:content"}, {p:"schema:name", o:"val:content"}],
        "meta@property='og:title'" : [{p:"schema:title", o:"val:content"}, {p:"schema:name", o:"val:content"}],

        "meta@name='twitter:description'": {p:"schema:description", o:"val:content"},
        "meta@name='og:description'"     : {p:"schema:description", o:"val:content"},
        "meta@property='og:description'" : {p:"schema:description", o:"val:content"},

        "meta@name='twitter:image'"    : {p:"schema:image", o:"iri:content"},
        "meta@name='og:image'"         : {p:"schema:image", o:"iri:content"},
        "meta@property='og:image'"     : {p:"schema:image", o:"iri:content"},


        "meta@name='twitter:site'": {p:"schema:url", o:"iri:content"},
        "meta@name='twitter:site'@": {p:"schema:author", o:"cmd:content", cmd:fix_twitter_creator},

        "meta@name='twitter:site:id'": {p:"opltw:id", o:"content"},

        "meta@name='twitter:creator'": {p:"schema:author", o:"cmd:content", cmd:fix_twitter_creator},

        "meta@name='twitter:creator:id'": {p:"schema:author", o:"cmd:content", cmd:fix_twitter_creator},
       };
  
  }

  POSH.prototype = {
    getData: function (baseURI) 
    {
      var links = {};
      var triples = "";
      var self = this;
      var twittercard = false;
      var url = new URL(baseURI);
      var baseOrigin = url.origin;
      var basePATH = baseURI;
      var baseURL = new URL(baseURI);

      baseURL.search = '';
      baseURL.hash = ''

      if (baseURI.lastIndexOf('.')!=-1) {
        var path = baseURL.pathname;
        if (path[path.length-1] !== '/')
          baseURL.pathname += '/';
      }

      basePATH = baseURL.href;


      function node2str(n)
      {
        if (n.length==0)
        {
          return "<#this>";
        }
        else if (n.startsWith("http://") 
                 || n.startsWith("https://")
                 || n.startsWith("mailto:")
                )
        {
          return "<"+n+">";
        }
        else if (n.startsWith("#"))
        {
          return "<"+encodeURI(n)+">";
        }
        else if (n.lastIndexOf(":")!=-1)
        {
          var arr = n.split(":");
          var pref_link = self.namespace.has_known_prefix(arr[0]);
          if (!pref_link) //unknown prefix
             return "xhv:"+fixedEncodeURIComponent(n);
          else {
             var p = self.prefixes[arr[0]];
             if (!p)
               self.prefixes[arr[0]] = pref_link;
             return n;
          }
        }
        else {
          var s = self.terms[n];
          if (s)
            return s;
          return "xhv:"+fixedEncodeURIComponent(n);
        }
      }

      function addTriple_s(s, p, o, obj_is_Literal)
      {
        var ttl = "";
        var qv = '"';

        if (o.indexOf("\n")!=-1 || o.indexOf("\r")!=-1) {
          qv = "'''";
          o = o.replace(/\\/g,'\\\\').replace(/\"/g,"\\\"");
        } else {
          o = o.replace(/\\/g,'\\\\').replace(/\'/g,"''").replace(/\"/g,"\\\"");
        }

        ttl += node2str(s)+" "+node2str(p)+" ";

        if (obj_is_Literal) {
          ttl += qv+o+qv;
        }
        else {
          if (o==="<>" || o==="<#this>")
            ttl += o;
          else if (o.startsWith("http://") 
                 || o.startsWith("https://")
                 || o.startsWith("mailto:")
                )
            ttl += "<"+o+">";
          else if (o.startsWith("#"))
            ttl += "<"+encodeURI(o)+">";
          else if (o.lastIndexOf(":")!=-1) 
          {
            var arr = o.split(":");
            var pref_link = self.namespace.has_known_prefix(arr[0]);
            if (!pref_link) {//unknown prefix
              ttl += qv+o+qv;
            } else {
              var p = self.prefixes[arr[0]];
              if (!p)
                self.prefixes[arr[0]] = pref_link;
              ttl += arr[0]+":"+fixedEncodeURIComponent(o.substring(arr[0].length+1));
            }
          }
          else
            ttl += qv+o+qv;
        }

        ttl += " .\n";
        return ttl;
      } 


      function addTriple(s, p, o, obj_is_Literal)
      {
        var s = addTriple_s(s, p, o, obj_is_Literal);
        triples += s;
      } 


      function handleTwitterCard() 
      {
        var cardtype = "SummaryCard";
        var content;
        var el = $("head link,meta[name='twitter:card']");

        if (el && el.length > 0) {
          content = el[0].getAttribute("content");
          if (content==="player")
            cardType = "PlayerCard";
          else if (content==="photo")
            cardType = "PhotoCard";
        }

        var entity = "#TwitterCard"+(self.twcard_id>0 ? "_"+self.twcard_id : "");
        var ttl = handleTwitterCardFor(entity, "head meta[name^='twitter:']");
        if (ttl.length > 0) {
          self.twcard_id++;
          addTriple("#this", "rdf:about", entity);
          addTriple(entity, "rdf:type", "opltw:"+cardtype);
          addTriple(entity, "schema:url", "<>");
          triples += ttl;
        }

        var entity = "#TwitterCard"+(self.twcard_id>0 ? "_"+self.twcard_id : "");
        ttl = handleTwitterCardFor(entity, "head meta[name^='og:']");
        if (ttl.length > 0) {
          self.twcard_id++;
          addTriple("#this", "rdf:about", entity);
          addTriple(entity, "rdf:type", "opltw:"+cardtype);
          addTriple(entity, "schema:url", "<>");
          triples += ttl;
        }

        entity = "#TwitterCard"+(self.twcard_id>0 ? "_"+self.twcard_id : "");
        ttl = handleTwitterCardFor(entity, "head meta[property^='og:']");
        if (ttl.length > 0) {
          self.twcard_id++;
          addTriple("#this", "rdf:about", entity);
          addTriple(entity, "rdf:type", "opltw:"+cardtype);
          addTriple(entity, "schema:url", "<>");
          triples += ttl;
        }
      }

      function handleTwitterCardFor(entity, mask) 
      {
        var ttl = "";
        $(mask).each(function(i, el){
         try {
           var name = el.getAttribute("name");
           var content = el.getAttribute("content");
           var property = el.getAttribute("property");

           var val = null;
           var add_dog = (content && content.startsWith("@"))?"@":"";

           if (name) {
             if (add_dog.length>0)
               val = self.twcard["meta@name='"+name+"'"+add_dog];
             if (!val)
               val = self.twcard["meta@name='"+name+"'"];
           }
           else {
             if (add_dog.length>0)
               val = self.twcard["meta@property='"+property+"'"+add_dog];
             if (!val)
               val = self.twcard["meta@property='"+property+"'"];
           }

           if (val) {
             var op_lst = $.isArray(val)?val:[val];

             for(var i=0; i<op_lst.length; i++) 
             {
               var op = op_lst[i];
               if (op) {
                 if (!op.cmd) {
                   if (op.o==="iri:content")
                     ttl += addTriple_s(entity, op.p, content);
                   else if (op.o==="val:content")
                     ttl += addTriple_s(entity, op.p, content);
                   else
                     ttl += addTriple_s(entity, op.p, content);
                 } else {
                   //command exec
                   ttl += addTriple_s(entity, op.p, op.cmd(content));
                 }
               } 
             }
           }
         } catch(e) {
           console.log(e);
         }
        });
        return ttl;
      }

      function fix_href(n)
      {
        if (n.length==0)
        {
          return n;
        }
        else if (n.startsWith("http://") 
                 || n.startsWith("https://")
                 || n.startsWith("mailto:")
                )
        {
          return n;
        }
        else if (n.startsWith("#"))
        {
          var u = new URL(baseURI);
          u.hash = n;
          return u.toString();
        }
        else if (n.startsWith("/"))
        {
          return baseOrigin+n;
        }
        else
        {
          return basePATH+n;
        }
      }

      function url_hash(href, hash)
      {
        var u = new URL(href);
        u.hash = hash;
        return u.toString();
      }

//      $("head link,meta[name],meta[property]").each(function(i, el){
      $("head link,meta[name],title").each(function(i, el){
        try{
         if (el.localName==="title") {
           addTriple("#this", "title", el.textContent, true);
         }
         else if (el.localName==="link") {
           var rev = el.getAttribute("rev");
           var rel = el.getAttribute("rel");
           var href = el.href;
           var type = el.type;

           if (href && rel && type && rel === "alternate") {
               links[href] = type;
           }

           if (rel && href) {
             href = encodeURI(fix_href(href));
             var title = el.getAttribute("title");
             addTriple("#this", encodeURI(rel), href);   
             addTriple(url_hash(href,"#this"), "rdf:type", "schema:CreativeWork");
             if (title)
               addTriple(url_hash(href,"#this"), "schema:name", title);   
             if (type)
               addTriple(url_hash(href,"#this"), "schema:fileFormat", type);   
           }
           else if(rev && href) {
             href = encodeURI(fix_href(href));
             addTriple(href, encodeURI(rev), "<#this>")
           }
         }
         else if (el.localName==="meta") {
           var name = el.getAttribute("name");
           var content = el.getAttribute("content");

           if (name && name.startsWith("twitter:")) {
             if (!twittercard) {
               twittercard = true;
               handleTwitterCard();
             }
           }
           else if (name && content) {
             addTriple("#this", name, content);
           }

         }
       } catch(e) {
         console.log(e);
       }
      });

      $("img[alt^='"+this.facebook_vision+"']").each(function(i, el){
           var src = el.getAttribute("src");
           var alt = el.getAttribute("alt");

           addTriple(url_hash(src,"#this"), "rdf:type", "schema:ImageObject");
           addTriple(url_hash(src,"#this"), "schema:mainEntityOfPage", src);
           addTriple(url_hash(src,"#this"), "schema:name", " "+src, true);
           addTriple(url_hash(src,"#this"), "schema:description", alt.substring(self.facebook_vision.length));
           addTriple(url_hash(src,"#this"), "schema:url", src);
      });


      var s = "";
      $.each(this.prefixes, function(pref, link_url) {
        s += "@prefix "+pref+": <"+link_url+"> .\n";
        return true;
      });

      return {triples: (triples.length > 0)?s+triples: triples, 
              links };
    }
  }


  return POSH;
}());

