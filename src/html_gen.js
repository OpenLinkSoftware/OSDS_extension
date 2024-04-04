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
  

class HTML_Gen {
  constructor(_docURI, bnode_types, uimode) 
  {
    this.ns = new Namespace();
    this.uimode = "";
    this.SubjName = "Subject";
    this.PredName = "Predicate";
    this.ObjName  = "Object";
    this.docURI = _docURI;
    this.bnode_types = bnode_types || {};
    this.test_esc = /[!'()*&?#$:@=;+.\/]/;
    this.subst_list = {
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#label": "Label",
            "http://www.w3.org/2000/01/rdf-schema#label": "Label",
                                "https://schema.org/name": "Name",
          "http://www.w3.org/2004/02/skos/core#altLabel": "AltLabel",
         "http://www.w3.org/2004/02/skos/core#prefLabel": "PrefLabel",
    };

    this.uimode = uimode;
    if (this.uimode===null)
      this.uimode = "ui-eav";

    if (this.uimode === "ui-eav") 
    {
      this.SubjName = "Entity";
      this.PredName = "Attribute";
      this.ObjName  = "Value";
    }
  }

  load(n_data, start_id, _base) 
  {
      var expanded = null;
      var id_list = {};
   
      if (start_id===undefined)
        start_id = 0;

      if (_base)
        this.docURI = _base;

      if (n_data!=null &&
          n_data.length!==undefined && 
          n_data.length > 0) 
      {
        var str = "";

        //rename bnodes based on rdf:type relation
        this.bnodes = {};
        for(var i=0; i < n_data.length; i++) 
        {
          var subj = n_data[i].s;
          var isBNode = false;

          if (this.is_VBNode(subj)) {
            this.bnodes[subj] = this.docURI + "#nodeID" + subj.substring(9);
            isBNode = true;
          }
          else if (this.is_BNode(subj)) {
            this.bnodes[subj] = this.docURI + "#" + subj.substring(2);
            isBNode = true;
          }

          if (isBNode) {
            for (const [key, val] of Object.entries(n_data[i].props)) 
            {
              if (key === this.ns.RDF_TYPE && val.length > 0) {
                var type_name = this.create_iri_for_type(val[0]);
                var id = this.bnode_types[type_name];

                if (id!==undefined)
                  id++;
                else
                  id = 0;
                
                this.bnodes[subj] = this.create_iri_for_type(val[0], id);
                this.bnode_types[type_name] = id;
              }
            }
          }
        }

        //fill id_list
        for(var i=0; i < n_data.length; i++) 
        {
          var subj = n_data[i].s;
          id_list[n_data[i].s] = start_id+i+1;

          //replace bNode with IRI
          if (this.is_BNode(subj)) {
            var s = this.bnodes[subj];
            if (s)
              n_data[i].s = s;
            else
              n_data[i].s = this.docURI + "#" + subj.substring(2);
          }
          else if (this.is_VBNode(subj)) {
            var s = this.bnodes[subj];
            if (s)
              n_data[i].s = s;
            else
              n_data[i].s = this.docURI + "#nodeID" + subj.substring(9);
          }

          for (const [key, val] of Object.entries(n_data[i].props)) 
          {
              for(var j=0; j < val.length; j++) {
                var obj = val[j];
                if (obj.iri) {
                  if (this.is_BNode(obj.iri)) {
                    var s = this.bnodes[obj.iri];
                    if (s)
                      n_data[i].props[key][j].iri = s;
                    else
                      n_data[i].props[key][j].iri = this.docURI + "#" + obj.iri.substring(2);
                  }
                  else if (this.is_VBNode(obj.iri)) {
                    var s = this.bnodes[obj.iri];
                    if (s)
                      n_data[i].props[key][j].iri = s;
                    else
                      n_data[i].props[key][j].iri = this.docURI + "#nodeID" + obj.iri.substring(9);
                  }
                }
              }
          }
          //end replace bNode with IRI
        }


        for(var i=0; i < n_data.length; i++) 
        {
          var item = n_data[i];
          var item_num = start_id + item.n;
          str += 
           `<table class='docdata table'> 
              <thead> 
                <tr> 
                  <th width='40%'></th> 
                  <th width='60%'></th> 
                </tr> 
              </thead> 
              <tbody> 
                <tr class='major'>
                  <td><a name='sc${item_num}'>Fact Collection #${item_num}</a></td>
                  <td></td>
                </tr> 
                `;
          str += this.format_id(item.s, id_list);

          var props = "";
          props += this.format_props(item.props, id_list, true);
          props += this.format_props(item.props, id_list, false);

          if (props.length > 0)
            str += `<tr class='major'> 
                      <td>${this.PredName}s</td>
                      <td></td> 
                    </tr>${props}`;

          str += `
              </tbody> 
            </table> 
            `;
        }

        var tbl_start = `
                <table> 
                  <tbody> `;
        var tbl_end = `
                  </tbody>
                </table>
                `;
        if (str.length > 0)
           expanded = tbl_start + str + tbl_end;
      }
      return expanded;
  }


  format_props(props, id_list, only_rdf_type)
  {
      if (props=== undefined) 
        return "";
        
      var str = "";

      for (const [key, val] of Object.entries(props)) 
      {
        if ((only_rdf_type && key!==this.ns.RDF_TYPE)
            || (!only_rdf_type && key===this.ns.RDF_TYPE))
          continue;

        var key_str = this.iri2html(null, key, true);

        for(var i=0; i<val.length; i++) {
          var obj = val[i];
          if (obj.iri) {
            var iri = obj.iri;
            var entity_id = id_list[iri];
            //nodeID://
            if (entity_id!==undefined && (this.is_BNode(iri) || this.is_VBNode(iri))) {
              str += `<tr class='data_row'>
                         <td> ${key_str} </td>
                         <td class='major'>
                           <a href='#sc${entity_id}'><i>See Fact Collection #${entity_id}</i></a>
                         </td>
                      </tr>`;
            }
            else {
              var sval = this.iri2html(key, obj.iri, null, null, true);
              var td_class = obj.typeid!==undefined || key===this.ns.RDF_TYPE ?" class='typeid'":"";
              str += `<tr class='data_row'>
                        <td ${td_class}> ${key_str} </td>
                        <td ${td_class} > ${sval} </td>
                      </tr>`;
            }
          } 
          else {
            var v = obj.value;
            var sval;
            if (obj.type) {
              var pref = this.ns.has_known_ns(obj.type);
              if (pref)
                sval = this.check_link(key, v)+"("+this.pref_link(obj.type,pref)+")";
              else
                sval = this.check_link(key, v)+"("+this.check_link(null, obj.type)+")";
            }
            else if (obj.lang){
              sval = '"'+this.check_link(key, v)+'"@'+obj.lang;
            } 
            else {
              sval = this.check_link(key, v);
            }
            str += `<tr class='data_row'>
                      <td> ${key_str} </td>
                      <td> ${sval} </td>
                    </tr>`;
          }
        } 
      }
      return str;
  }

  create_iri_for_type(obj, id)
  {
      var sid = (id && id > 0) ? '_'+id : '';
      if (obj.iri && !this.is_VBNode(obj.iri) && !this.is_BNode(obj.iri)) {
        var value = obj.iri;
        var pref = this.ns.has_known_ns(value);
        if (pref!=null) {
          var data = value.substring(pref.link.length);
          var len = data.length;
          if (data[len-1]==="/") 
            data = data.substr(0, len-1);

          if (data.indexOf("/")!==-1) {
            var lst = data.split('/');
            data = lst.length>0 ? lst[lst.length-1] : "";
            if (!data)
              data = "b";
          }
          
          return this.docURI +"#"+data+sid;
        }
        else {
          var u = new URL(value);
          if (u.hash) {
            var hash = u.hash.endsWith('/') ? u.hash.substring(0, u.hash.length-1) : u.hash;
            return this.docURI +hash+sid;
          } else {
            var lst = u.pathname.split('/');
            var data = lst.length>0 ? lst[lst.length-1] : "";
            if (!data)
              data = "b";

            return this.docURI +"#"+data+sid;
          }
        }
      } else 
        return null;
  }


  format_id(value, id_list) 
  {
       var entity_id = id_list[value];
       {
         // for scroll between entities on page
         var uri = String(value);
         if ( uri.match(/^http(s)?:\/\//) ) 
           uri = (new URL(uri)).href;

         var anc = "";
         if (this.docURI && this.check_URI(uri)) {
           var hashPos = uri.lastIndexOf("#");
           if (hashPos!=-1 && hashPos!=uri.length-1) {
             anc = '<a name="'+uri.substr(hashPos+1)+'"/>';           
           }
         }
         var sval = this.iri2html(null, uri, null, 'ent', true);
         return `<tr class='major data_row'>
                   <td> ${anc} ${this.SubjName} </td>
                   <td> ${sval} </td>
                 </tr>`;
       }
  }

  iri2html(key, uri, is_key, myid, is_iri)
  {
      var v = this.check_subst(uri, myid);

      if (v.rc==true) {
         return v.val;
      }
      else { 
        var pref = this.ns.has_known_ns(uri);
        var sid = myid ? ` ${myid} ` : '';
        return (pref!=null) ? this.pref_link(uri, pref, sid) : this.check_link(key, uri, is_key, sid, is_iri);
      }
  }
    
  check_link(prop, val, is_key, sid, is_iri) 
  {
      var s_val = String(val);

      if ( s_val.match(/^http(s)?:\/\//) ) 
      {
        s_val = (new URL(s_val)).href;

        if ( s_val.match(/\.(jpg|png|gif|svg|webp)$/) ) {
          var width = (is_key!==undefined && is_key)?200:300;
          return `<a ${sid} href="${s_val}" title="${s_val}"><img src="${s_val}" style="max-width: ${width}px;" /></a>`;
        } 
        if ( s_val.match(/\.(jpg|png|gif|svg|webp)[?#].*/) ) {
          var width = (is_key!==undefined && is_key)?200:300;
          return `<a ${sid} href="${s_val}" title="${s_val}"><img src="${s_val}" style="max-width: ${width}px;" /></a>`;
        }
        if (prop && (prop ==='http://schema.org/image' || prop ==='https://schema.org/image')) {
          var width = (is_key!==undefined && is_key)?200:300;
          return `<a ${sid} href="${s_val}" title="${s_val}"><img src="${s_val}" style="max-width: ${width}px;" /></a>`;
        } 
        return `<a ${sid} href="${s_val}"> ${this.decodeURI(s_val)} </a>`;
      } 
      else if ( s_val.match(/^data:image\/(png|gif|jpg|webp)/) ) 
      {
          var width = (is_key!==undefined && is_key)?200:300;
          return `<a ${sid} href="${s_val}" title="${s_val}"><img src="${s_val}" style="max-width: ${width}px;" /></a>`;
      }
      else if ( s_val.match(/^mailto:/) ) 
      {
        return `<a ${sid} href="${s_val}"> ${this.decodeURI(s_val)} </a>`;
      }
      else if (is_iri)
      {
        return `<a ${sid} href="${s_val}"> ${this.decodeURI(s_val)} </a>`;
      }
      return this.pre(s_val);
  }


  pref_link(val, pref, sid) 
  {
      var s_val = String(val);

      if ( s_val.match(/^http(s)?:\/\//) ) 
        s_val = (new URL(s_val)).href;

      var data = s_val.substring(pref.link.length);
      if (data.endsWith("/")) 
        data = data.substring(0, data.length-1);

      if (data.indexOf("/")!==-1 || this.test_esc.test(data))
        return `<a ${sid} href="${s_val}" title="${s_val}"> ${this.decodeURI(s_val)} </a>`;
      else
        return `<a ${sid} href="${s_val}" title="${s_val}"> ${pref.ns}:${this.decodeURI(data)}</a>`;
  }

  pre(text) 
  {
      return sanitize_str(text);
  }

  is_BNode(str) 
  {
        return str.startsWith("_:");
  }

  is_VBNode(str) 
  {
        return (str.startsWith("nodeID://") || str.startsWith("nodeid://"));
  }

  check_URI(uri) 
  {
      if (this.docURI[this.docURI.length-1]==="#")
        return uri.startsWith(this.docURI);
      else
        return uri.startsWith(this.docURI+'#');
  }

  check_subst(uri, myid) 
  {
      if (uri.startsWith(this.docURI)) {
        var s = uri.substr(this.docURI.length);
        if (s[0]==="#") {
          var v = '<a '+ (myid?myid:'')+' href="' + uri + '" title="' + uri + '">' +this.decodeURI(s)+ '</a>';
          return {rc:true, val:v};
        }
        else
          return {rc:false};
      } 
      else {
        var anc_name = this.subst_list[uri];
        if (anc_name) {
          var v = `<a href="${uri}" title="${uri}"> ${this.decodeURI(anc_name)}</a>`;
          return {rc:true, val:v};
        }
        else
          return {rc:false};
      }
  }

  decodeURI(val) 
  {
      try {
        return decodeURI(val);
      } catch (ex) {
        return val; 
      }
  }

}
