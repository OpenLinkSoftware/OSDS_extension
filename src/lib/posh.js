var POSH = (function () {

  'use strict';


  function POSH(uriStr) {
    this.terms = {};
    this.terms["description"] = "schema:description";
    this.terms["describedby"] = "wdrs:describedby";

    this.namespace = new Namespace();

    this.prefixes = {
        "xhv": "http://www.w3.org/1999/xhtml/vocab#",
        "wdrs": "http://www.w3.org/2007/05/powder-s#",

	"opltw": "http://www.openlinksw.com/schemas/twitter#",
	"schema":"http://schema.org/",
	"schemavideo":"http://schema.org/VideoObject#",
        "formats": "http://www.w3.org/ns/formats/",
	"geo": "http://www.w3.org/2003/01/geo/wgs84_pos#",

        "foaf": "http://xmlns.com/foaf/0.1/",
        "dc": "http://purl.org/dc/elements/1.1/",
        "sioc":"http://rdfs.org/sioc/ns#",
        "rdfs":"http://www.w3.org/2000/01/rdf-schema#",
        "rdf":"http://www.w3.org/1999/02/22-rdf-syntax-ns#",
      };


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
        "meta@name='twitter:site'@": {p:"schema:url", o:"cmd:content", cmd:fix_twitterid},

        "meta@name='twitter:site:id'": {p:"opltw:id", o:"content"},

        "meta@name='twitter:creator'": {p:"schema:author", o:"cmd:content", cmd:fix_twitter_creator},

        "meta@name='twitter:creator:id'": {p:"schema:author", o:"cmd:content", cmd:fix_twitter_creator},
       };
  
  }

  POSH.prototype = {
    getData: function (baseURI) 
    {
      var triples = "";
      var self = this;
      var twittercard = false;

      function s_startWith(str, val) {
        return str.lastIndexOf(val, 0) === 0;
      }

      function node2str(n)
      {
        if (n.length==0)
        {
          return "<#this>";
        }
        else if (s_startWith(n, "http://") 
                 || s_startWith(n, "https://")
                 || s_startWith(n, "mailto:")
                 || s_startWith(n, "#")
                )
        {
          return "<"+n+">";
        }
        else if (n.lastIndexOf(":")!=-1)
        {
          var arr = n.split(":");
          var pref_link = self.namespace.ns_list[arr[0]];
          if (!pref_link) //unknown prefix
             return "xhv:"+n;
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
          return "xhv:"+n;
        }
      }

      function addTriple(s, p, o)
      {
        triples += node2str(s)+" "+node2str(p)+" ";
        if (o==="<>" || o==="<#this>")
          triples += o;
        else if (s_startWith(o, "http://") 
                 || s_startWith(o, "https://")
                 || s_startWith(o, "mailto:")
                 || s_startWith(o, "#")
                )
          triples += "<"+o+">";
        else
          triples += '"'+o.replace(/\"/g,'\\\"')+'"';

        triples += " .\n";
      } 


      function handleTwitterCard(p, o) 
      {
        var cardtype = "SummaryCard";
        var content;
        var el = $("head link,meta[name='twitter:card']");

        if (el && el.length > 0) {
          content = el[0].getAttribute("content");
          if (content==="player")
            cardType = "PlayerCard";
          else if (content==="photo")
            o = "PhotoCard";
        }

        addTriple("#this", "rdf:about", "#TwitterCard");
        addTriple("#TwitterCard", "opltw:hasCard", cardtype);

        $("head meta[name^='twitter:'],meta[name^='og:'],meta[property^='og:']").each(function(i, el){
           var name = el.getAttribute("name");
           var content = el.getAttribute("content");
           var property = el.getAttribute("property");

           var val = null;
           var add_dog = s_startWith(content,"@")?"@":"";

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
                     addTriple("#TwitterCard", op.p, content);
                   else if (op.o==="val:content")
                     addTriple("#TwitterCard", op.p, content);
                   else
                     addTriple("#TwitterCard", op.p, content);
                 } else {
                   //command exec
                   addTriple("#TwitterCard", op.p, op.cmd(content));
                 }
               } 
             }
           }

        });

      }



//      $("head link,meta[name],meta[property]").each(function(i, el){
      $("head link,meta[name]").each(function(i, el){
         if (el.localName==="link") {
           var rev = el.getAttribute("rev");
           var rel = el.getAttribute("rel");
           var href = el.getAttribute("href");

           if (rel && href) {
             addTriple("#this", encodeURI(rel), href);   
           }
           else if(rev && href) {
             addTriple(href, encodeURI(rev), "<#this>")
           }
         }
         else if (el.localName==="meta") {
           var name = el.getAttribute("name");
           var content = el.getAttribute("content");

           if (name && s_startWith(name, "twitter:")) {
             if (!twittercard) {
               twittercard = true;
               handleTwitterCard();
             }
           }
           else if (name && content) {
             addTriple("#this", name, content);   
           }

         }
      });

      var s = "";
      $.each(this.prefixes, function(pref, link_url) {
        s += "@prefix "+pref+": <"+link_url+"> .\n";
        return true;
      });

      return (triples.length > 0)?s+triples: triples;
    }
  }


  return POSH;
}());
