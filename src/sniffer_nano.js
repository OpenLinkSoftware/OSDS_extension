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

var Nano = {};

Nano.ttl_nano_pattern = /(^\s*## (Nanotation|Turtle|RDF-Turtle) +Start ##[\s\n\r]*)((.|\n|\r)*?)(^\s*## (Nanotation|Turtle|RDF-Turtle) +(End|Stop) ##)(.*)/gmi;
Nano.jsonld_nano_pattern = /(^\s*## JSON-LD +Start ##[\s\n\r]*)((.|\n|\r)*?)((^\s*## JSON-LD +(End|Stop) ##))(.*)/gmi;
Nano.json_nano_pattern = /(^\s*## JSON +Start ##[\s\n\r]*)((.|\n|\r)*?)((^\s*## JSON +(End|Stop) ##))(.*)/gmi;
Nano.jsonl_nano_pattern = /(^\s*## JSONL +Start ##[\s\n\r]*)((.|\n|\r)*?)((^\s*## JSONL +(End|Stop) ##))(.*)/gmi;
Nano.csv_nano_pattern = /(^\s*## CSV +Start ##[\s\n\r]*)((.|\n|\r)*?)((^\s*## CSV +(End|Stop) ##))(.*)/gmi;
Nano.rdf_nano_pattern = /(^\s*## RDF(\/|-)XML +Start ##[\s\n\r]*)((.|\n|\r)*?)((^\s*## RDF(\/|-)XML +(End|Stop) ##))(.*)/gmi;
Nano.md_nano_pattern = /(^\s*## Markdown +Start ##[\s\n\r]*)((.|\n|\r)*?)((^\s*## Markdown +(End|Stop) ##))(.*)/gmi;
Nano.rss_nano_pattern = /(^\s*## RSS +Start ##[\s\n\r]*)((.|\n|\r)*?)((^\s*## RSS +(End|Stop) ##))(.*)/gmi;
Nano.atom_nano_pattern = /(^\s*## Atom +Start ##[\s\n\r]*)((.|\n|\r)*?)((^\s*## Atom +(End|Stop) ##))(.*)/gmi;

Nano.fix_Nano_data = (str) => {
        str = str.replace(/\xe2\x80\x9c/g, '"')       //replace smart quotes with sensible ones (opening)
            .replace(/\xe2\x80\x9d/g, '"')       //replace smart quotes with sensible ones (closing)
            .replace(/\xc3\xa2\xc2\x80\xc2\x9c/g, '"')  //smart->sensible quote replacement, wider encoding
            .replace(/\xc3\xa2\xc2\x80\xc2\x9d/g, '"')  //smart->sensible quote replacement, wider encoding

            .replace(/\u00a0/g, " ")   //&nbsp
            .replace(/\u009d/g, " ")   //&nbsp
            .replace(/\u0080/g, " ")   //&nbsp

            .replace(/\u202F/g, " ")   // NARROW NO-BREAK SPACE
            .replace(/\u2009/g, " ")   // thin space
            .replace(/\u2007/g, " ")   // FIGURE SPACE

            .replace(/\u200B/g, "")   //ZERO WIDTH SPACE
            .replace(/\u200D/g, "")   // WORD-JOINER
            .replace(/\u200C/g, "")   // ZERO WIDTH NON-JOINER
            .replace(/\uFEFF/g, "")   // zero width no-break space Unicode code point

            .replace(/\u201A/g, "'")
            .replace(/\u2018/g, "'")
            .replace(/\u2019/g, "'")
            .replace(/\u2039/g, "'")
            .replace(/\u203A/g, "'")
            .replace(/\u201C/g, '"')
            .replace(/\u201D/g, '"')
            .replace(/\u201E/g, '"')
            .replace(/\u00BB/g, '"')
            .replace(/\u00AB/g, '"');
//       .replace(/\u8629/g,' ')
//       .replace(/\u2026/g,'...');

        return str;
    }

Nano.getSelectionString = (el, win) => {
        win = win || window;
        var doc = win.document, sel, range, prevRange, selString;

        if (win.getSelection && doc.createRange) {
            sel = win.getSelection();
            if (sel.rangeCount) {
                prevRange = sel.getRangeAt(0);
            }
            range = doc.createRange();
            range.selectNodeContents(el);
            sel.removeAllRanges();
            sel.addRange(range);
            selString = sel.toString();
            sel.removeAllRanges();
            prevRange && sel.addRange(prevRange);
        }
        else if (doc.body.createTextRange) {
            range = doc.body.createTextRange();
            range.moveToElementText(el);
            range.select();
        }
        return selString;
    }



Nano.sniff_nanotation_Document = (doc_Texts) => 
    {
        var eoln = /(?:\r\n)|(?:\n)|(?:\r)/g;
        var comment = /^ *#/;
        var ret = {ttl:[], ttl_curly:[], jsonld:[], json:[], jsonl:[], rdf:[], csv:[], md:[], rss:[], atom:[]};

        if (!doc_Texts)
            return {exists: false, data: ret};


        function isWhitespace(c) 
        {
            var cc = c.charCodeAt(0);
            if (( cc >= 0x0009 && cc <= 0x000D ) ||
                ( cc == 0x0020 ) ||
                ( cc == 0x0085 ) ||
                ( cc == 0x00A0 )) {
                return true;
            }
            return false;
        }

        function dropComments(str) 
        {
          if (str.length > 0) 
          {
             //drop commetns
             var s_split = str.split(eoln);
             var v = [];
             s_split.forEach(function (item, i, arr) {
               if (!comment.test(item))
                  v.push(item);
             });

             return v.join('\n');
          } 
          else
            return str;
        }

        for (var i = 0; i < doc_Texts.length; i++) {

            txt = doc_Texts[i];
            if (txt) {

                var s_doc = Nano.fix_Nano_data(txt);

                //try get Turtle Nano
                while (true) {
                    var ndata = Nano.ttl_nano_pattern.exec(s_doc);
                    if (ndata == null)
                        break;

                    var str = ndata[3];
                    if (str.length > 0)
                      ret.ttl.push(dropComments(str));
                }

                //try get Turtle Nano in CurlyBraces { ... }
                var j = 0;
                var inCurly = 0;
                var str = "";
                while (j < s_doc.length) {
                    var ch = s_doc[j++];
                    if (ch == '"') {
                        var rc = s_doc.indexOf(ch, j);
                        if (rc == -1)
                            break;
                        if (inCurly > 0)
                            str += s_doc.substring(j - 1, rc + 1);
                        j = rc + 1;
                    }
                    else if (ch == '{') {
                        inCurly++;
                    }
                    else if (ch == '}') {
                        inCurly--;
                        ret.ttl_curly.push(dropComments(str));
                        str = "";
                    }
                    else if (inCurly > 0) {
                        str += ch;
                    }
                }

                //try get JSON-LD Nano
                while (true) {
                    var ndata = Nano.jsonld_nano_pattern.exec(s_doc);
                    if (ndata == null)
                        break;

                    var str = ndata[2];
                    if (str.length > 0) {
                        var add = false;
                        for (var c = 0; c < str.length; c++) {
                            add = str[c] === "{" ? true : false;
                            if (add)
                                break;
                            if (!isWhitespace(str[c]))
                                break;
                        }

                        if (add)
                            ret.jsonld.push(str);
                    }
                }

                //try get RDF/XML Nano
                while (true) {
                    var ndata = Nano.rdf_nano_pattern.exec(s_doc);
                    if (ndata == null)
                        break;

                    var str = ndata[3];
                    if (str.length > 0) {
                        ret.rdf.push(str);
                    }
                }

                //try get JSON Nano
                while (true) {
                    var ndata = Nano.json_nano_pattern.exec(s_doc);
                    if (ndata == null)
                        break;

                    var str = ndata[2];
                    if (str.length > 0) {
                        var add = false;
                        for (var c = 0; c < str.length; c++) {
                            add = (str[c] === "{" || str[c] === "[") ? true : false;
                            if (add)
                                break;
                            if (!isWhitespace(str[c]))
                                break;
                        }

                        if (add)
                            ret.json.push(str);
                    }
                }


                //try get JSONL Nano
                while (true) {
                    var ndata = Nano.jsonl_nano_pattern.exec(s_doc);
                    if (ndata == null)
                        break;

                    var str = ndata[2];
                    if (str.length > 0) {
                        var add = false;
                        for (var c = 0; c < str.length; c++) {
                            add = (str[c] === "{" || str[c] === "[") ? true : false;
                            if (add)
                                break;
                            if (!isWhitespace(str[c]))
                                break;
                        }

                        if (add)
                            ret.jsonl.push(str);
                    }
                }


                //try get CSV Nano
                while (true) {
                    var ndata = Nano.csv_nano_pattern.exec(s_doc);
                    if (ndata == null)
                        break;

                    var str = ndata[2];
                    if (str.length > 0) {
                        ret.csv.push(str);
                    }
                }

                //try get MD Nano
                while (true) {
                    var ndata = Nano.md_nano_pattern.exec(s_doc);
                    if (ndata == null)
                        break;

                    var str = ndata[2];
                    if (str.length > 0) {
                        ret.md.push(str);
                    }
                }

                //try get Rss Nano
                while (true) {
                    var ndata = Nano.rss_nano_pattern.exec(s_doc);
                    if (ndata == null)
                        break;

                    var str = ndata[2];
                    if (str.length > 0) {
                        ret.rss.push(str);
                    }
                }

                //try get Atom Nano
                while (true) {
                    var ndata = Nano.atom_nano_pattern.exec(s_doc);
                    if (ndata == null)
                        break;

                    var str = ndata[2];
                    if (str.length > 0) {
                        ret.atom.push(str);
                    }
                }

            }
        }


        if (ret.ttl.length > 0 || ret.ttl_curly.length > 0 || ret.jsonld.length > 0 
            || ret.rdf.length > 0|| ret.json.length > 0 || ret.jsonl.length > 0 
            || ret.csv.length > 0 || ret.md.length > 0|| ret.rss.length > 0 || ret.atom.length > 0)
            return {exists: true, data: ret}; 
        else
            return {exists: false, data: ret};
    }


 
Nano.sniff_nanotation_ms_copilot = (nano) =>
    {
      _top = document.querySelector('cib-serp').shadowRoot.querySelector('cib-conversation').shadowRoot;

      if (!_top)
        return nano;

      for(const c0 of _top.querySelectorAll('cib-chat-turn[mode="conversation"]'))
      {
        for(const c1 of c0.shadowRoot.querySelectorAll('cib-message-group[mode=conversation]')) 
        {
          for(const c2 of c1.shadowRoot.querySelectorAll('cib-message[type="text"]'))
          {
            for(const v of c2.shadowRoot.querySelectorAll('cib-shared cib-code-block'))
            {
              const text = v.getAttribute('clipboard-data');
              //const dd_el = e_hdr.querySelector('#code_type');
              const dd_el = v.shadowRoot.querySelector('select#code_type option:checked');
              if (text && dd_el) {
                let lst = null;
                switch(dd_el.id) {
                  case 'turtle': 
                    nano.ttl.push(text);
                    break;
                  case 'jsonld':
                    nano.jsonld.push(text);
                    break;
                  case 'json':
                    nano.json.push(text);
                    break;
                  case 'csv':
                    nano.csv.push(text);
                    break;
                  case 'rdfxml':
                    nano.rdf.push(text);
                    break;
                  case 'markdown':
                    nano.md.push(text);
                    break;
                  case 'rss':
                    nano.rss.push(text);
                    break;
                  case 'atom':
                    nano.atom.push(text);
                    break;
                }
              }
            }
          }
        }
      }
      return nano;
    }

Nano.sniff_nanotation_chat = (nano, chat_id) =>
    {
      const chats = { 
             openai: { menu:'main pre select#code_type option:checked', 
                       sel: {parentNode:4}, 
                       code:'code'
                     }, 

             openai_play: { menu:'div[data-panel] select#code_type option:checked', 
                       sel: { parentNode:3 }, 
                       code_all:'pre code code ~ *'
                     }, 

             gemini: { menu:'message-content code-block select#code_type option:checked', 
                       sel: {closest:'div.code-block'}, 
                       code:'code'
                     }, 
             claude: { menu:'pre > div select#code_type option:checked', 
                       sel: {closest:'pre'}, 
                       code:'code'
                     }, 
             claude1: { menu:'div > select#code_type option:checked', 
                       sel: { parentNode:4 }, 
                       code:'code'
                     }, 
             perplexity: { menu:'main pre select#code_type option:checked', 
                       sel: {closest:'pre'}, 
                       code:'code'
                     }, 
             perplexity_labs: { menu:'main pre select#code_type option:checked',  
                       sel: {closest:'pre'}, 
                       code:'code'
                     }, 

             mistral: { menu:'pre select#code_type option:checked', 
                       sel: {closest:'pre'}, 
                       code:'code'
                     }, 
             huggingface: { menu:'select#code_type option:checked', 
                       sel: { parentNode:3 },
                       code:'pre code'
                     }, 
             you: { menu:'div#ydc-content-area select#code_type option:checked', 
                       sel: { parentNode:4 },
                       code:'pre code'
                     }, 
             meta: { menu:'select#code_type option:checked', 
                       sel: { parentNode:5 },
                       code:'pre code'
                     }, 
             openperplex: { menu:'select#code_type option:checked', 
                       sel: { parentNode:3 },
                       code:'pre code'
                     }, 

           }

      const fmt = chats[chat_id];
      if (!fmt)
        return nano;

      var el_pre, el_code;
      
      var lst = DOM.qSelAll(fmt.menu);
      for (var el of lst) {
        const el_type = el.id;

        if (fmt.sel.closest) {
          el_pre = el.closest(fmt.sel.closest);
        }
        else if (fmt.sel.parentNode) {
          el_pre = el;
          for(var i=0; i<fmt.sel.parentNode; i++)
            el_pre = el_pre.parentNode;
        }

        if (el_pre) {
          let text = null;
          if (fmt.code) {
            text = el_pre.querySelector(fmt.code)?.textContent;
          }
          else if (fmt.code_all) {
             let lst = []
             for(const v of el_pre.querySelectorAll(fmt.code_all))
               lst.push(v.textContent);
             text = lst.join('');
          }
          if (text) {
            switch(el_type) {
              case 'turtle':
                nano.ttl.push(text);
                break;
              case 'jsonld':
                nano.jsonld.push(text);
                break;
              case 'json':
                nano.json.push(text);
                break;
              case 'csv':
                nano.csv.push(text);
                break;
              case 'rdfxml':
                nano.rdf.push(text);
                break;
              case 'markdown':
                nano.md.push(text);
                break;
              case 'rss':
                nano.rss.push(text);
                break;
              case 'atom':
                nano.atom.push(text);
                break;
            }
          }
        }
      }

      return nano;
    }

 

