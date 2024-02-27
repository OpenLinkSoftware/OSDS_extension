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


(function () {

    window._osds_isTop = true;
    window._osds_frames = {};
    let g_chat_cache = {};

    var g_super_links = null;
    var micro_items = 0;
    var json_ld_Text = null;
    var turtle_Text = null;
    var posh_Data = null;
    var rdfa_subjects = null;
    var rdf_Text = null;
    var nano = {ttl:null, ttl_curly:null, jsonld:null, rdf:null, json:null, jsonl:null, csv:null, md:null, 
    		rss:null, atom:null};
    var data_found = false;

    var ttl_nano_pattern = /(^\s*## (Nanotation|Turtle|RDF-Turtle) +Start ##[\s\n\r]*)((.|\n|\r)*?)(^\s*## (Nanotation|Turtle|RDF-Turtle) +(End|Stop) ##)(.*)/gmi;
    var jsonld_nano_pattern = /(^\s*## JSON-LD +Start ##[\s\n\r]*)((.|\n|\r)*?)((^\s*## JSON-LD +(End|Stop) ##))(.*)/gmi;
    var json_nano_pattern = /(^\s*## JSON +Start ##[\s\n\r]*)((.|\n|\r)*?)((^\s*## JSON +(End|Stop) ##))(.*)/gmi;
    var jsonl_nano_pattern = /(^\s*## JSONL +Start ##[\s\n\r]*)((.|\n|\r)*?)((^\s*## JSONL +(End|Stop) ##))(.*)/gmi;
    var csv_nano_pattern = /(^\s*## CSV +Start ##[\s\n\r]*)((.|\n|\r)*?)((^\s*## CSV +(End|Stop) ##))(.*)/gmi;
    var rdf_nano_pattern = /(^\s*## RDF(\/|-)XML +Start ##[\s\n\r]*)((.|\n|\r)*?)((^\s*## RDF(\/|-)XML +(End|Stop) ##))(.*)/gmi;
    var md_nano_pattern = /(^\s*## Markdown +Start ##[\s\n\r]*)((.|\n|\r)*?)((^\s*## Markdown +(End|Stop) ##))(.*)/gmi;
    var rss_nano_pattern = /(^\s*## RSS +Start ##[\s\n\r]*)((.|\n|\r)*?)((^\s*## RSS +(End|Stop) ##))(.*)/gmi;
    var atom_nano_pattern = /(^\s*## Atom +Start ##[\s\n\r]*)((.|\n|\r)*?)((^\s*## Atom +(End|Stop) ##))(.*)/gmi;


    function getSelectionString(el, win) {
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


    function fix_Nano_data(str) {
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


    function sniff_frames(doc_Texts, frames, id) {
        try {
            for (var i = 0; i < frames.length; i++) {
                var win = frames[i];
                var txt = null;
                var frame_id = id + "_" + i;

                try {
                    txt = win.document.body.innerText;
                } catch (e) {
                    txt = window._osds_frames[frame_id];
                }

                if (txt === undefined || (txt !== null && txt.length == 0))
                    txt = getSelectionString(win.document.body, win);

                if (txt && txt.length > 0)
                    doc_Texts.push(txt);

                if (frames[i].frames.length > 0)
                    sniff_frames(doc_Texts, frames[i].frames, frame_id);
            }
        } catch (e) {
        }
    }


    function scan_frames() {
        try {
            if (window.frames.length > 0) {
                window._osds_frames = {};
                scan_iframes(window.frames, "f");
            }
        } catch (e) {
        }
    }

    function scan_iframes(frames, id) {
        for (var i = 0; i < frames.length; i++) {
            var win = frames[i];
            var frame_id = id + "_" + i;

            win.postMessage('osds:{"sniff":true, "frame":"' + frame_id + '"}', "*");

            if (win.frames.length > 0)
                scan_iframes(win.frames, frame_id);
        }
    }


    function sniff_nanotation() {
        var eoln = /(?:\r\n)|(?:\n)|(?:\r)/g;
        var comment = /^ *#/;
        var doc_Texts = [];
        var ret = {ttl:[], ttl_curly:[], jsonld:[], json:[], jsonl:[], rdf:[], csv:[], md:[], rss:[], atom:[]};

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


        var txt = document.body.innerText;

        if (txt === undefined || (txt !== null && txt.length == 0))
            txt = getSelectionString(document.body, window);

        if (txt && txt.length > 0)
            doc_Texts.push(txt);

        if (window.frames.length > 0)
            sniff_frames(doc_Texts, window.frames, "f");

        for (var i = 0; i < doc_Texts.length; i++) {

            txt = doc_Texts[i];
            if (txt) {

                var s_doc = fix_Nano_data(txt);

                //try get Turtle Nano
                while (true) {
                    var ndata = ttl_nano_pattern.exec(s_doc);
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
                    var ndata = jsonld_nano_pattern.exec(s_doc);
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
                    var ndata = rdf_nano_pattern.exec(s_doc);
                    if (ndata == null)
                        break;

                    var str = ndata[3];
                    if (str.length > 0) {
                        ret.rdf.push(str);
                    }
                }

                //try get JSON Nano
                while (true) {
                    var ndata = json_nano_pattern.exec(s_doc);
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
                    var ndata = jsonl_nano_pattern.exec(s_doc);
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
                    var ndata = csv_nano_pattern.exec(s_doc);
                    if (ndata == null)
                        break;

                    var str = ndata[2];
                    if (str.length > 0) {
                        ret.csv.push(str);
                    }
                }

                //try get MD Nano
                while (true) {
                    var ndata = md_nano_pattern.exec(s_doc);
                    if (ndata == null)
                        break;

                    var str = ndata[2];
                    if (str.length > 0) {
                        ret.md.push(str);
                    }
                }

                //try get Rss Nano
                while (true) {
                    var ndata = rss_nano_pattern.exec(s_doc);
                    if (ndata == null)
                        break;

                    var str = ndata[2];
                    if (str.length > 0) {
                        ret.rss.push(str);
                    }
                }

                //try get Atom Nano
                while (true) {
                    var ndata = atom_nano_pattern.exec(s_doc);
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
            return {exists: false, data: {ttl:[], ttl_curly:[], jsonld:[], json:[], jsonl:[], rdf:[], 
                    csv:[], md:[], rss:[], atom:[]}};
    }


    function sniff_nanotation_openai(nano) 
    {
        var el_pre, el_code;
      
        var lst = DOM.qSelAll('div#__next main pre select#code_type option:checked');
        for (var el of lst) {
          var el_type = el.id;

          if (el_type === 'turtle') {
            el_pre = el.closest('pre');
            if (el_pre) {
              el_code = el_pre.querySelector('code');
              if (el_code) {
                nano.exists = true;
                nano.data.ttl.push(el_code.textContent);
              }
            }
          }
          else if (el_type === 'jsonld') {
            el_pre = el.closest('pre');
            if (el_pre) {
              el_code = el_pre.querySelector('code');
              if (el_code) {
                nano.exists = true;
                nano.data.jsonld.push(el_code.textContent);
              }
            }
          }
          else if (el_type === 'json') {
            el_pre = el.closest('pre');
            if (el_pre) {
              el_code = el_pre.querySelector('code');
              if (el_code) {
                nano.exists = true;
                nano.data.json.push(el_code.textContent);
              }
            }
          }
          else if (el_type === 'csv') {
            el_pre = el.closest('pre');
            if (el_pre) {
              el_code = el_pre.querySelector('code');
              if (el_code) {
                nano.exists = true;
                nano.data.csv.push(el_code.textContent);
              }
            }
          }
          else if (el_type === 'rdfxml') {
            el_pre = el.closest('pre');
            if (el_pre) {
              el_code = el_pre.querySelector('code');
              if (el_code) {
                nano.exists = true;
                nano.data.rdf.push(el_code.textContent);
              }
            }
          }
          else if (el_type === 'markdown') {
            el_pre = el.closest('pre');
            if (el_pre) {
              el_code = el_pre.querySelector('code');
              if (el_code) {
                nano.exists = true;
                nano.data.md.push(el_code.textContent);
              }
            }
          }
          else if (el_type === 'rss') {
            el_pre = el.closest('pre');
            if (el_pre) {
              el_code = el_pre.querySelector('code');
              if (el_code) {
                nano.exists = true;
                nano.data.rss.push(el_code.textContent);
              }
            }
          }
          else if (el_type === 'atom') {
            el_pre = el.closest('pre');
            if (el_pre) {
              el_code = el_pre.querySelector('code');
              if (el_code) {
                nano.exists = true;
                nano.data.atom.push(el_code.textContent);
              }
            }
          }

        }

      return nano;
    }

 
    function sniff_nanotation_ms_copilot(nano) 
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
                    nano.exists = true;
                    nano.data.ttl.push(text);
                    break;
                  case 'jsonld':
                    nano.exists = true;
                    nano.data.jsonld.push(text);
                    break;
                  case 'json':
                    nano.exists = true;
                    nano.data.json.push(text);
                    break;
                  case 'csv':
                    nano.exists = true;
                    nano.data.csv.push(text);
                    break;
                  case 'rdfxml':
                    nano.exists = true;
                    nano.data.rdf.push(text);
                    break;
                  case 'markdown':
                    nano.exists = true;
                    nano.data.md.push(text);
                    break;
                  case 'rss':
                    nano.exists = true;
                    nano.data.rss.push(text);
                    break;
                  case 'atom':
                    nano.exists = true;
                    nano.data.atom.push(text);
                    break;
                }
              }
            }
          }
        }
      }
      return nano;
    }


    function is_data_exist() 
    {
        try {

            scan_frames();
            data_found = false;

            var items = jQuery('[itemscope]').not(jQuery('[itemscope] [itemscope]'));
            if (items && items.length > 0)
                data_found = true;

            if (!data_found) {
                //?? document.querySelector('script[type="application/ld+json"]');
                var all = document.getElementsByTagName("script");
                for (var i = 0; i < all.length; i++) {
                    if (all[i].hasAttribute('type')
                        && all[i].getAttribute('type') === "application/ld+json") {
                        data_found = true;
                    }
                }
            }

            if (!data_found) {
                for (var i = 0; i < all.length; i++) {
                    if (all[i].hasAttribute('type')
                        && (all[i].getAttribute('type') === "text/turtle"
                        || all[i].getAttribute('type') === "application/turtle")
                    ) {
                        data_found = true;
                    }
                }
            }


            if (!data_found) {
                var all = document.getElementsByTagName("script");
                for (var i = 0; i < all.length; i++) {
                    if (all[i].hasAttribute('type')
                        && all[i].getAttribute('type') === "application/rdf+xml") {
                        data_found = true;
                    }
                }
            }


            if (!data_found) {
                try {
                    posh_Data = new POSH().getData(document.location.href);
                } catch (e) {
                    console.log("OSDS:" + e);
                }

                if (posh_Data && posh_Data.triples && posh_Data.triples.length > 0)
                    data_found = true;
            }

            if (!data_found) {
                try {
                    GreenTurtle.attach(document);
                    rdfa_subjects = document.data.getSubjects();
                } catch (e) {
                    console.log("OSDS:" + e);
                }

                if (rdfa_subjects && rdfa_subjects.length > 0)
                    data_found = true;
            }


            if (!data_found) {
                var ret = sniff_nanotation();
                data_found = ret.exists;
                nano = ret.data;

                if (!data_found && location.href.startsWith('https://chat.openai.com')) {
                  ret = sniff_nanotation_openai(ret);
                  data_found = ret.exists;
                  nano = ret.data;
                }
                else if (!data_found && location.href.startsWith('https://copilot.microsoft.com')) {
                  ret = sniff_nanotation_ms_copilot(ret);
                  data_found = ret.exists;
                  nano = ret.data;
                }
            }


            // Tell the chrome extension that we're ready to receive messages
            //send data_exists flag to extension
            Browser.api.runtime.sendMessage({
                        property: "status",
                        status: "ready",
                        data_exists: data_found,
                        doc_URL: document.location.href
                    });

        } catch (e) {
            console.log("OSDS:" + e);
        }

        if (!data_found) {
            setTimeout(is_data_exist, 6000);
        }
    }


    function sniff_Data() {
        try {
            micro_items = jQuery('[itemscope]').not(jQuery('[itemscope] [itemscope]'));

            if (posh_Data === null) {
                try {
                    posh_Data = new POSH().getData(document.location.href);
                } catch (e) {
                    console.log("OSDS:" + e);
                }
            }

            try {
                GreenTurtle.attach(document);
                rdfa_subjects = document.data.getSubjects();
            } catch (e) {
                console.log("OSDS:" + e);
            }

            json_ld_Text = null;
            var all = document.getElementsByTagName("script");
            for (var i = 0; i < all.length; i++) {
                if (all[i].hasAttribute('type')
                    && all[i].getAttribute('type') == "application/ld+json") {
                    var htmlText = all[i].innerHTML;
                    if (json_ld_Text == null)
                        json_ld_Text = [];

                    htmlText = htmlText.replace("//<![CDATA[", "").replace("//]]>", "");
                    htmlText = htmlText.replace("<![CDATA[", "").replace("]]>", "");
                    if (htmlText.length > 0)
                        json_ld_Text.push(htmlText);
                }
            }

            turtle_Text = null;
            for (var i = 0; i < all.length; i++) {
                if (all[i].hasAttribute('type')
                    && (all[i].getAttribute('type') == "text/turtle"
                        || all[i].getAttribute('type') === "application/turtle"))
                {
                    var htmlText = all[i].innerHTML;
                    if (turtle_Text == null)
                        turtle_Text = [];

                    htmlText = htmlText.replace("//<![CDATA[", "").replace("//]]>", "");
                    htmlText = htmlText.replace("<![CDATA[", "").replace("]]>", "");
                    if (htmlText.length > 0)
                        turtle_Text.push(htmlText);
                }
            }

            rdf_Text = null;
            for (var i = 0; i < all.length; i++) {
                if (all[i].hasAttribute('type')
                    && all[i].getAttribute('type') == "application/rdf+xml") {
                    var htmlText = all[i].innerHTML;
                    if (rdf_Text == null)
                        rdf_Text = [];

                    htmlText = htmlText.replace("//<![CDATA[", "").replace("//]]>", "");
                    htmlText = htmlText.replace("<![CDATA[", "").replace("]]>", "");
                    if (htmlText.length > 0)
                        rdf_Text.push(htmlText);
                }
            }

            var ret = sniff_nanotation();
            nano = ret.data;
            
            if (location.href.startsWith('https://chat.openai.com')) {
               ret = sniff_nanotation_openai(ret);
               nano = ret.data;
            }
            else if (location.href.startsWith('https://copilot.microsoft.com')) {
               ret = sniff_nanotation_ms_copilot(ret);
               nano = ret.data;
            }

        } catch (e) {
            console.log("OSDS:" + e);
        }

    }


    function isBlank(n) {
        return n && n.substr(0, 2) === '_:';
    }

    function iri2str(n) {
        return (n && n.substr(0, 2) === '_:') ? n : "<" + n + ">";
    }


    function NodeList2Str(list) {
        var s = "";
        for (var i = 0; i < list.length; i++) {
            if (i > 0)
                s += "\n";
            if (list[i].innerHTML)
                s += list[i].innerHTML;
            else
                s += list[i].textContent;
        }
        return s;
    }

    function get_rdfa_data()
    {
        var escape = /["\\\t\n\r\b\f\u0000-\u0019\ud800-\udbff]/;
        var escapeAll = /["\\\t\n\r\b\f\u0000-\u0019]|[\ud800-\udbff][\udc00-\udfff]/g;
        var escapeReplacements = {
            '\\': '\\\\', '"': '\\"', '\t': '\\t',
            '\n': '\\n', '\r': '\\r', '\b': '\\b', '\f': '\\f'
        };

        function fmt(value) {
            function characterReplacer(character) {
                // Replace a single character by its escaped version
                var result = escapeReplacements[character];
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

            if (escape.test(value))
                value = value.replace(escapeAll, characterReplacer);

            return value;
        }


        var rdfa = null;
        var rdfa_ttl = null;
        var namespace = new Namespace();

        ///Convert RDFa data to internal format
        if (rdfa_subjects != null && rdfa_subjects.length > 0) {
            rdfa = [];
            rdfa_ttl = "";
            var _LiteralMatcher = /^"([^]*)"(?:\^\^(.+)|@([\-a-z]+))?$/i;

            for (var i = 0; i < rdfa_subjects.length; i++) {
                var s_triple = " " + iri2str(fmt(rdfa_subjects[i]));
                var p_triple;
                var o_triple;
                var s = {s: rdfa_subjects[i], n: i + 1};
                rdfa.push(s);
                var plist = document.data.getProperties(rdfa_subjects[i]);
                s.props = new Object();

                for (var j = 0; j < plist.length; j++) {
                    var prop = plist[j];
                    if (prop.lastIndexOf(":")!=-1) {
                      var arr = prop.split(":");
                      var pref_link = namespace.has_known_prefix(arr[0]);
                      if (pref_link) {
                        prop = pref_link + arr[1];
                      }
                    }

                    var p = s.props[prop];
                    if (p === undefined)
                        s.props[prop] = [];

                    p = s.props[prop];
                    p_triple = " " + iri2str(fmt(prop));

                    var vlist = document.data.getObjects(rdfa_subjects[i], plist[j]);
                    for (var z = 0; z < vlist.length; z++) {
                        var v = vlist[z];
                        if (v.type === "http://www.w3.org/1999/02/22-rdf-syntax-ns#object") {
                            p.push({"iri": String(v.value)});
                            o_triple = " " + iri2str(fmt(v.value));
                        }
                        else if (v.type === "http://www.w3.org/1999/02/22-rdf-syntax-ns#PlainLiteral") {
                            var v_val = null;

                            if (v.value instanceof NodeList)
                                v_val = NodeList2Str(v.value);
                            else
                                v_val = v.value != null ? String(v.value) : null;

                            var v_lang = v.language != null ? String(v.language) : null;
                            p.push({value: v_val, type: null, lang: v_lang});
                            o_triple = ' "' + fmt(v_val) + '"';
                            if (v_lang != null)
                                o_triple += '@' + v_lang;
                        }
                        else {
                            var v_val = null;

                            if (v.value instanceof NodeList)
                                v_val = NodeList2Str(v.value);
                            else
                                v_val = v.value != null ? String(v.value) : null;

                            var v_lang = v.language != null ? String(v.language) : null;
                            var v_type = v.type != null ? String(v.type) : null;
                            p.push({value: v_val, type: v_type, lang: v_lang});
                            o_triple = ' "' + fmt(v_val) + '"';
                            if (v_lang != null)
                                o_triple += '@' + v_lang;
                            else if (v_type != null)
                                o_triple += '^^<' + v_type + ">";
                        }
                        rdfa_ttl += s_triple + p_triple + o_triple + " .\n";
                    }
                }
            }
        }

        return {data: rdfa, ttl: rdfa_ttl};
    }


    function request_open_tab(url, sender) {
        if (url)
          window.open(url);
    }


    function inject_osds_popup()
    {
      if ($(".osds_popup").length == 0) {
        $('body').append(
          `<div class="osds_revert_css osds_popup" style="display:none">
             <div class="osds_revert_css osds_popup-title"> <b>&nbsp;Error</b></div>
             <div class="osds_revert_css osds_popup-content">
               <p class="osds_revert_css" id="osds_popup_msg">  </p>
               <div class="osds_revert_css osds_popup_btns">
                 <input id="osds_popup_retry" value=" Try&nbsp;Again " type="button" class="osds_revert_css osds_popup_btn">
                 <input id="osds_popup_cancel" value=" Cancel " type="button" class="osds_revert_css osds_popup_btn">
               <div>
             </div>
           </div>`
        );

        DOM.qSel('.osds_popup #osds_popup_retry').onclick = () => {
           DOM.qSel('.osds_popup').style.display = 'none';
           Browser.api.runtime.sendMessage({cmd: "osds_popup_retry" });
           return false;
        };
        DOM.qSel('.osds_popup #osds_popup_cancel').onclick = () => {
           DOM.qSel('.osds_popup').style.display = 'none';
           Browser.api.runtime.sendMessage({cmd: "osds_popup_cancel" });
           return false;
        };
      }
    } 
    

    function inject_super_links_popup() 
    {
      if ($(".super_links_popup").length == 0) {
        $('body').append(
         `<div class="osds_revert_css super_links_popup" style="display:none" >
           <div class="osds_revert_css super_links_popup-title"> &nbsp;Super Links </div>
           <a href="#close" title="Close" class="osds_revert_css super_links_popup_close">&times;</a> 
           <div class="osds_revert_css super_links_popup-content"></div>
           <img class="osds_revert_css super_links_popup-resizer" src="data:image/gif;base64,R0lGODlhCgAKAJEAAAAAAP///6CgpP///yH5BAEAAAMALAAAAAAKAAoAAAIRnI+JosbN3hryRDqvxfp2zhUAOw==" alt="Resize" width="10" height="10"/>
          </div> 
          <div class="osds_revert_css super_links_chatgpt" style="display:none" >
           <div class="osds_revert_css super_links_chatgpt-title"> &nbsp;ChatGPT </div>
           <a href="#close" title="Close" class="osds_revert_css super_links_chatgpt_close">&times;</a> 
           <div class="osds_revert_css super_links_chatgpt-content">
             <textarea id="osds_words"class="osds_revert_css super_links_chatgpt-content-text"></textarea>
           </div>
           <img class="osds_revert_css super_links_chatgpt-resizer" src="data:image/gif;base64,R0lGODlhCgAKAJEAAAAAAP///6CgpP///yH5BAEAAAMALAAAAAAKAAoAAAIRnI+JosbN3hryRDqvxfp2zhUAOw==" alt="Resize" width="10" height="10"/>
          </div> 
          <div class="osds_revert_css super_links_msg" style="display:none" > 
            <div class="osds_revert_css" style="width:16px;">
              <img src="data:image/gif;base64,${Browser.throbber}" class="osds_revert_css super_links_img">
            </div>
            <div class="osds_revert_css" id="super_links_msg_text">&nbsp;Applying&nbsp;Super&nbsp;Links</div>
          </div>
          <div class="osds_revert_css" id="super_links_snackbar">
            <div class="osds_revert_css" id="msg1"></div>
            <div class="osds_revert_css" id="msg2"></div>
          </div>`
        );

      }
    }



    async function add_super_links(sender, data)
    {
      if (!data)
        return;

      var settings = new Settings();
      var highlight_mode = await settings.getValue('ext.osds.super-links-highlight');

      DOM.qSel('.super_links_msg #super_links_msg_text').innerHTML = '&nbsp;Applying&nbsp;Super&nbsp;Links';
      DOM.qSel('.super_links_msg').style.display = 'flex';

      setTimeout(() => {
        try {
          var val = JSON.parse(data);
          g_super_links = val.results.bindings;
          var list = {};
          for(var i=0; i < g_super_links.length; i++) {
            var s = g_super_links[i].extractLabel.value;
            var sl = s.toLowerCase();
            g_super_links[i]._id = sl;
            list[sl]=0;
          }

          var keys = Object.keys(list); 
          for(var i=0; i< keys.length; i++) {
            var s = keys[i];
            for(var j=0; j < keys.length; j++) {
              if (j != i && keys[j].indexOf(s) != -1) {
                list[s] = 1;
                break;
              }
            }
          }

          var labels = [];
          for(var i=0; i< keys.length; i++) {
            var s = keys[i];
            if (list[s] === 0)
              labels.push(s);
          }
          for(var i=0; i< keys.length; i++) {
            var s = keys[i];
            if (list[s] !== 0)
              labels.push(s);
          }

          mark_strings(labels, highlight_mode);
        } catch(e) {
          console.log(e);
        } finally {
          setTimeout(()=> DOM.qSel('.super_links_msg').style.display = 'none', 2000);
        }
      }, 200);
    }


/**********************************************/
    function handle_ask(tableId)
    {
      let lst = DOM.qSelAll(tableId+' td a#osds_ask_gpt')
      for(const el of lst) 
      {
        el.onclick = (ev) => {
          ev.preventDefault();
          const words = ev.target.attributes.getNamedItem('words');
          if (words && words.value) {
             ask_ChatGPT(ev, words.value);
          }
        }
      }
    }

    async function create_popup_table(lst, ev)
    {
      $('.super_links_popup-content').children().remove();

      var settings = new Settings();
      var viewer_mode = await settings.getValue('ext.osds.super-links-viewer');

      async function create_href(url) {
         if (viewer_mode==='html-fb')
           return await settings.createImportUrl(url);
         else
           return url;
      }
      

      if (lst.length > 0)
      {
        var tdata = '';
        for(var i=0; i < lst.length; i++)
        {
          var v = lst[i];

          try {
            var extract = v.extract?v.extract.value:null;
            var prov = v.provider?v.provider.value:null;
            if (extract && prov) {
              var extLabel = v.extractLabel?v.extractLabel.value:'';
              var provName = v.providerLabel?v.providerLabel.value:prov;
              var entityType = v.entityType.value;
              var entityTypeLabel = v.entityTypeLabel?v.entityTypeLabel.value:entityType;

              var association = v.association.value;
              var associationLabel = v.associationLabel?v.associationLabel.value:association;
              var extract_href = await create_href(extract);

              tdata += 
              `<tr><td> <a target="_blank" href="${extract_href}">${extLabel}</a></td>`+
              ` <td> <a target="_blank" href="${association}">${associationLabel}</a> </td>`+
              ` <td> <a target="_blank" href="${prov}">${provName}</a></td>`+
              ` <td> <a target="_blank" href="${entityType}">${entityTypeLabel}</a></td>`+
              ` <td> <a id="osds_ask_gpt" target="_blank" href="#osds_ask_gpt" words="${extLabel}">Ask</a></td>`+
              `</tr>`;
            }
          } catch(e) {}
        }


        $('.super_links_popup-content')
           .append('<table class="osds_revert_css super_links_table">'
               +'<thead><tr>'
               +'<th class="osds_revert_css"> Word <span class="super_links_table-resize-handle"/></th>'
               +'<th class="osds_revert_css"> Association <span class="super_links_table-resize-handle"/></th>'
               +'<th class="osds_revert_css"> Source <span class="super_links_table-resize-handle"/></th>'
               +'<th class="osds_revert_css"> Type <span class="super_links_table-resize-handle"/></th>'
               +'<th class="osds_revert_css"> ChatGPT <span class="super_links_table-resize-handle"/></th>'
               +'</tr></thead>'
                +'<tbody>'+tdata+'</tbody>'
                +'</table>');
        $('.super_links_popup').show();

        var popup = DOM.qSel('.super_links_popup');
        const columns_css = ['minmax(100px, 1.5fr)', 'minmax(100px, 2.5fr)', 'minmax(100px, 4fr)', 'minmax(100px, 2fr)', 'minmax(100px, 2fr)'];
        makeResizableTable('table.super_links_table', columns_css, '.super_links_popup');

        dragElement(popup, DOM.qSel('.super_links_popup-title'));
        makeResizable(popup, DOM.qSel('.super_links_popup-resizer'));

        handle_ask('table.super_links_table');

        positionPopupOnPage(".super_links_popup", ev);
      }
    }


    function mark_strings(keywords, highlight_mode)
    {
      $("body").unmark();

      for(var i=0; i < keywords.length; i++)
      {
        var keyword = keywords[i];
        var word;
        var options = {
            "element": "a",  //"a"
            "className": "super_link_mark",
            "exclude": ["a"],
            "separateWordSearch": false,
            "acrossElements": false,
            "accuracy": {
               "value": "exactly",
               "limiters": ":;.,’'\"-–—‒_(){}[]!+=".split("")
             },
            "diacritics": false,
            "caseSensitive": false,
            "ignoreJoiners": false,
            "filter": function(textNode, foundTerm, totalCounter, termCount){
                      // textNode is the text node which contains the found term
                      // foundTerm is the found search term
                      // totalCounter is a counter indicating the total number of all marks
                      // at the time of the function call
                 word = foundTerm.toLowerCase();
                 return (termCount > 0 && highlight_mode==='first')? false: true;
            },
            "each": function(node){
                // node is the marked DOM element
                $(node).attr("href","");
                $(node).attr("mark_id",keyword.toLowerCase());

            },
          };

        $("body").mark(keyword, options);
      }

      $('.super_links_popup_close').click(function(e){
          $('.super_links_popup').hide();
          return false;
       });

      $('.super_link_mark').click(function(ev){
          var mark_id = ev.target.getAttribute('mark_id');
          var lst = [];
          for (var i=0; i < g_super_links.length; i++) {
            if (g_super_links[i]._id.indexOf(mark_id)!=-1)
              lst.push(g_super_links[i]);
          }

          create_popup_table(lst, ev);
          return false;
       });
    }


    
    async function ask_ChatGPT(ev, words)
    {
      let event = {clientX: ev.clientX, clientY:ev.clientY};
      const settings = new Settings();
      let chatgpt_req = await settings.getValue("osds.chatgpt_prompt");
      if (!chatgpt_req)
        chatgpt_req = "What do you know about '{words}' ?";

      chatgpt_req = chatgpt_req.replace("{words}", "'"+words+"'");

      const chat_resp = g_chat_cache[chatgpt_req];
      if (chat_resp) {
        add_chatgpt_data({resp:chat_resp, event});
      } 
      else {
        Browser.api.runtime.sendMessage({cmd: "super_links_chatgpt", req:chatgpt_req, event });
      }
    }

    function add_chatgpt_data(resp)
    {
      if (resp.err) {
        showSnackbar("Error", resp.err);
        return;
      }

      const chat_req = resp.req;
      let chat_resp = resp.resp;

      if (chat_resp) 
        g_chat_cache[chat_req] = chat_resp;

      if (chat_resp) {
        const el = DOM.qSel('#osds_words');
        el.value = chat_resp;

        const popup = DOM.qSel('.super_links_chatgpt');
        dragElement(popup, DOM.qSel('.super_links_chatgpt-title'));
        makeResizable(popup, DOM.qSel('.super_links_chatgpt-resizer'));

        $('.super_links_chatgpt_close').click(function(e){
            $('.super_links_chatgpt').hide();
            return false;
         });

        positionPopupOnPage('.super_links_chatgpt', resp.event);
      }
    }


    DOM.ready(() => {

        try {
            is_data_exist();
            if (!data_found) {
                window.setTimeout(is_data_exist, 3000);
            }


            function request_doc_data() {
                scan_frames();

                sniff_Data();
                send_doc_data();
            }


            function send_doc_data() {
                var data_exists = false;
                var docData = {
                    doc_URL: document.location.href,
                    micro: {data: null},
                    jsonld: {text: null},
                    json: {text: null},
                    rdfa: {data: null, ttl: null},
                    rdf: {text: null},
                    turtle: {text: null},
                    ttl_nano: {text: null},
                    ttl_curly_nano: {text: null},
                    jsonld_nano: {text: null},
                    json_nano: {text: null},
                    jsonl_nano: {text: null},
                    rdf_nano: {text: null},
                    csv_nano: {text: null},
                    md_nano: {text: null},
                    rss_nano: {text: null},
                    atom_nano: {text: null},
                    posh: {text: null}
                };

                var microdata = jQuery.microdata.json(micro_items, 
                   function (o) 
                   {
                     function scan_array(v)
                     {
                       if (v.length > 0)
                       {
                         var v_str = {};
                         var v_arr = [];
                         for(var e of v)
                         {
                           if (typeof e === 'string')
                             v_str[e] = 1;
                           else
                             v_arr.push(e);
                         } 
                         return v_arr.concat(Object.keys(v_str))
                       }     
                       else
                         return v;
                     }

                     function scan_obj(v)
                     {
                       if (typeof v === 'object')
                       {
                         for(var key in v)
                           v[key] = scan_item(v[key]);
                       }
                       return v;
                     }

                     function scan_item(v)
                     {
                       if (Array.isArray(v))
                         return scan_array(v);
                       else
                         return scan_obj(v)
                     }

                     try {
                       if (o) {
                         for(var i=0; i < o.items.length; i++)
                           o.items[i] = scan_obj(o.items[i]);
                       }
                     } catch(ex) {
                       console.log(ex);
                     }

                    return o;
                   }
                 );
                var rdfa = get_rdfa_data(); //null;

                docData.micro.data = microdata;
                docData.jsonld.text = json_ld_Text;
                docData.turtle.text = turtle_Text;
                docData.rdf.text = rdf_Text;
                docData.rdfa.data = rdfa.data;
                docData.rdfa.ttl = rdfa.ttl;
                docData.posh.text = posh_Data.triples;
                docData.posh.links = posh_Data.links;

                docData.ttl_nano.text = nano.ttl;
                docData.ttl_curly_nano.text = nano.ttl_curly;
                docData.jsonld_nano.text = nano.jsonld;
                docData.json_nano.text = nano.json;
                docData.jsonl_nano.text = nano.jsonl;
                docData.rdf_nano.text = nano.rdf;
                docData.csv_nano.text = nano.csv;
                docData.md_nano.text = nano.md;
                docData.rss_nano.text = nano.rss;
                docData.atom_nano.text = nano.atom;

//??--                var list = document.querySelectorAll('a[href$="/rss"], a[href$=".rss"]');
                var list = document.querySelectorAll('a[href$=".rss"]');

                docData.posh.dlinks = {rss:[]};

                for(var v of list) {
                  var uri = decodeURIComponent(v.href);
                  var i = 0;
                  var p;

                  if ((p = uri.lastIndexOf('https://')) > i)
                    i = p;
                  if ((p = uri.lastIndexOf('http://')) > i)
                    i = p;

                  if (i > 0)
                    uri = uri.substring(i);

                  docData.posh.dlinks.rss.push(uri);
                }


                if ((microdata.items && microdata.items.length > 0)
                    || (json_ld_Text && json_ld_Text.length > 0)
                    || (turtle_Text  && turtle_Text.length > 0)
                    || (rdf_Text     && rdf_Text.length > 0)
                    || (rdfa.data    && rdfa.data.length > 0)
                    || (nano.ttl     && nano.ttl.length > 0)
                    || (nano.ttl_curly && nano.ttl_curly.length > 0)
                    || (nano.jsonld  && nano.jsonld.length > 0)
                    || (nano.json    && nano.json.length > 0)
                    || (nano.jsonl   && nano.jsonl.length > 0)
                    || (nano.rdf     && nano.rdf.length > 0)
                    || (nano.csv     && nano.csv.length > 0)
                    || (nano.md      && nano.md.length > 0)
                    || (nano.rss      && nano.rss.length > 0)
                    || (nano.atom     && nano.atom.length > 0)
                    || (posh_Data    && posh_Data.triples.length > 0)
                    || (posh_Data    && posh_Data.links.length > 0)
                   )
                  data_exists = true;

                //send data to extension
                Browser.api.runtime.sendMessage(
                    {
                        property: "doc_data",
                        data: JSON.stringify(docData, undefined, 2),
                        is_data_exists: data_exists
                    });
            }


            // wait data req from extension
        
            Browser.api.runtime.onMessage.addListener(function (request, sender, sendResponse) {
                if (request.cmd === "req_doc_data") {
                    request_doc_data();
                    sendResponse({ping:1});
                    return true;
                 }
                else if (request.property === "open_tab")
                    request_open_tab(request.url, sender);
                else if (request.cmd == "super_links_chatgpt_return") {
                    add_chatgpt_data(request);
                }
                else if (request.cmd == "super_links_data") {
                    inject_super_links_popup();
                    add_super_links(sender, request.data);
                }
                else if (request.cmd === "super_links_msg_show") {
                    if (request.message) {
                      inject_super_links_popup();
                      DOM.qSel('.super_links_msg #super_links_msg_text').innerHTML = request.message;
                      DOM.qSel('.super_links_msg').style.display = 'flex';
                    }
                }
                else if (request.cmd === "super_links_msg_hide") {
                    var el = DOM.qSel('.super_links_msg');
                    if (el)
                      el.style.display = 'none';
                }
                else if (request.cmd === "super_links_snackbar") {
                    inject_super_links_popup();
                    if (request.msg1) {
                      showSnackbar(request.msg1, request.msg2);
                    }
                }
                else if (request.cmd === "osds_msg_show") {
                    if (request.message) {
                      inject_osds_popup();
                      DOM.qSel('.osds_popup #osds_popup_msg').innerText = request.message;
                      DOM.qSel('.osds_popup').style.display = 'block';
                    }
                }
                else if (request.cmd === "osds_msg_hide") {
                    var el = DOM.qSel('.osds_popup');
                    if (el)
                      el.style.display = 'none';
                }
                else if (request.cmd === "page_content") {
                    const scanner = new Social();
                    const page_content = scanner.scan(location);
                    sendResponse({page_content});
                    //console.log(page_content);
                    return true;
                }
            });


        } catch (e) {
            console.log("OSDS:" + e);
        }
    });


})();
