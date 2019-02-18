/*
 *  This file is part of the OpenLink Structured Data Sniffer
 *
 *  Copyright (C) 2015-2019 OpenLink Software
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

    var g_super_links = null;
    var micro_items = 0;
    var json_ld_Text = null;
    var turtle_Text = null;
    var posh_Text = null;
    var rdfa_subjects = null;
    var rdf_Text = null;
    var ttl_nano_Text = null;
    var json_nano_Text = null;
    var rdf_nano_Text = null;
    var data_found = false;

    var ttl_nano_pattern = /(## (Nanotation|Turtle) +Start ##)((.|\n|\r)*?)(## (Nanotation|Turtle) +(End|Stop) ##)(.*)/gmi;
    var json_nano_pattern = /(## JSON-LD +Start ##)((.|\n|\r)*?)((## JSON-LD +(End|Stop) ##))(.*)/gmi;
    var rdf_nano_pattern = /(## RDF\/XML +Start ##)((.|\n|\r)*?)((## RDF\/XML +(End|Stop) ##))(.*)/gmi;


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
        var doc_Texts = [];
        var ttl_ret = [];
        var json_ret = [];
        var rdf_ret = [];

        function isWhitespace(c) {
            var cc = c.charCodeAt(0);
            if (( cc >= 0x0009 && cc <= 0x000D ) ||
                ( cc == 0x0020 ) ||
                ( cc == 0x0085 ) ||
                ( cc == 0x00A0 )) {
                return true;
            }
            return false;
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
                //drop commetns
                var eoln = /(?:\r\n)|(?:\n)|(?:\r)/g;
                var s_split = txt.split(eoln);
                var s_doc = "";
                var p1 = /## +([Nn]anotation|[Tt]urtle) +(Start|End|Stop) *##/;
                var p2 = /^ *#/;
                var p3 = /## +(JSON-LD) +(Start|End|Stop) *##/;
                var p4 = /## +(RDF\/XML) +(Start|End|Stop) *##/;

                s_split.forEach(function (item, i, arr) {
                    if (item.length > 0 && (!p2.test(item) || p1.test(item) || p3.test(item) || p4.test(item)))
                        s_doc += item + "\n";
                });

                s_doc = fix_Nano_data(s_doc);
                //try get Turtle Nano
                while (true) {
                    var ndata = ttl_nano_pattern.exec(s_doc);
                    if (ndata == null)
                        break;

                    var str = ndata[3];
                    if (str.length > 0)
                        ttl_ret.push(str);
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
                        ttl_ret.push(str);
                        str = "";
                    }
                    else if (inCurly > 0) {
                        str += ch;
                    }
                }

                //try get JSON-LD Nano
                while (true) {
                    var ndata = json_nano_pattern.exec(s_doc);
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
                            json_ret.push(str);
                    }
                }

                //try get RDF/XML Nano
                while (true) {
                    var ndata = rdf_nano_pattern.exec(s_doc);
                    if (ndata == null)
                        break;

                    var str = ndata[2];
                    if (str.length > 0) {
                        rdf_ret.push(str);
                    }
                }

            }
        }


        if (ttl_ret.length > 0 || json_ret.length > 0 || rdf_ret.length > 0)
            return {ttl: ttl_ret, json: json_ret, rdf: rdf_ret};
        else
            return null;
    }


    function is_data_exist() {
        try {

            scan_frames();
            data_found = false;

            var items = jQuery('[itemscope]').not(jQuery('[itemscope] [itemscope]'));
            if (items && items.length > 0)
                data_found = true;

            if (!data_found) {
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
                    posh_Text = new POSH().getData(document.location.href);
                } catch (e) {
                    console.log("OSDS:" + e);
                }

                if (posh_Text && posh_Text.length > 0)
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
                if (ret) {
                    ttl_nano_Text = (ret.ttl.length > 0) ? ret.ttl : null;
                    json_nano_Text = (ret.json.length > 0) ? ret.json : null;
                    rdf_nano_Text = (ret.rdf.length > 0) ? ret.rdf : null;
                    data_found = true;
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

            if (posh_Text === null) {
                try {
                    posh_Text = new POSH().getData(document.location.href);
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
                    && all[i].getAttribute('type') == "text/turtle") {
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

            ttl_nano_Text === null;
            json_nano_Text === null;
            rdf_nano_Text === null;
            var ret = sniff_nanotation();
            if (ret) {
                ttl_nano_Text = (ret.ttl.length > 0) ? ret.ttl : null;
                json_nano_Text = (ret.json.length > 0) ? ret.json : null;
                rdf_nano_Text = (ret.rdf.length > 0) ? ret.rdf : null;
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
                    var p = s.props[plist[j]];
                    if (p === undefined)
                        s.props[plist[j]] = [];

                    p = s.props[plist[j]];
                    p_triple = " " + iri2str(fmt(plist[j]));

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


    function xhr_new ()
    {
      var xhr = null;

      var oXMLHttpRequest = window.XMLHttpRequest;
      if (oXMLHttpRequest)
        xhr = new oXMLHttpRequest(); /* gecko */
      else if (window.ActiveXObject)
        xhr = new ActiveXObject("Microsoft.XMLHTTP"); /* ie */
      return xhr;
    }


    function add_super_links(sender, links_query, links_timeout)
    {
      if (g_super_links==null) {
         $('body').append(
           `<div class="super_links_popup" >
            <a href="#close" title="Close" class="super_links_popup_close">&times;</a> 
            <div class="super_links_popup-content"></div>
            </div> 
            <div class="super_links_msg" style="font-size: 14px;"> 
            <table style="border-style:none">
            <tr>
             <td class="super_links_msg_td" style="width:16px;">
              <img src="data:image/gif;base64,${Browser.throbber}" class="super_links_img" />
             </td>
             <td class="super_links_msg_td">
              &nbsp;Preparing&nbsp;Super&nbsp;Links
             </td>
            </tr>
            </table>
            </div> `
         );
      }
        var result = location.href.match(/^((\w+):\/)?\/?(.*)$/);
        var url_about = "https://linkeddata.uriburner.com/about/html/http/"+result[3]+"?sponger:get=add";

        var xhr = xhr_new ();
        xhr.onreadystatechange = function()
          {
            if (xhr.readyState == 4) {
              if (xhr.status===200) {
                  if (xhr.responseURL.lastIndexOf("https://linkeddata.uriburner.com/rdfdesc/login.vsp", 0) === 0) {
                    location.href = xhr.responseURL; //console.log("redirected");
                    return;
                  }
                  exec_super_links_query(links_query, links_timeout);

              }
              else {
                alert("Sponge error:"+xhr.status+" ["+xhr.statusText+"]");
                //$(".super_links_msg").css("display","none");
                exec_super_links_query(links_query, links_timeout);
              }
            }
          }

        $(".super_links_msg").css("display","block");

        try {
          xhr.withCredentials = true;
          xhr.timeout = 30000;
          xhr.open ('GET', url_about, true);
          xhr.setRequestHeader ('Accept', 'text/html');
          xhr.setRequestHeader ('Cache-control', 'no-cache');
          xhr.send (null);
        } catch (e) {}
    }

    function exec_super_links_query(links_query, links_timeout)
    {
      var url = new URL(location.href);
      url.hash = '';
      var iri = url.toString();

      var br_lang = navigator.language || navigator.userLanguage;
      if (br_lang && br_lang.length>0) {
        var i = br_lang.indexOf('-');
        if (i!=-1)
           br_lang = br_lang.substr(0,i);
      } else {
        br_lang = 'en';
      }

      var url_links = "https://linkeddata.uriburner.com/sparql";
      var links_sparql_query = new Settings().createSuperLinksQuery(links_query, iri, br_lang);

      jQuery.ajaxSetup({
         dataType: "text",
         headers:{'Accept': 'application/json',
               'Cache-control': 'no-cache'},
         cache: false,
         timeout: links_timeout,
         xhrFields: {
               withCredentials: true
         }
      });

      params = {
              format:'application/json',
              query: links_sparql_query,
              CXML_redir_for_subjs: 121,
              timeout: links_timeout
                };

      jQuery.get(url_links, params, function(data, status){
        try {
          var val = JSON.parse(data);
          g_super_links = val.results.bindings;
          var labels = [];
          for(var i=0; i < g_super_links.length; i++) {
            labels.push(g_super_links[i].extractLabel.value);
            g_super_links[i]._id = g_super_links[i].extractLabel.value.toLowerCase();
          }

          mark_strings(labels);
        } finally {
          $(".super_links_msg").css("display","none");
        }
      }, "text").fail(function(msg) {
          $(".super_links_msg").css("display","none");
          alert("Could not load data from: "+url_links+"\nError: "+msg.statusText);
      });


    }

/**********************************************/
    function positionPopupOnPage( evt )
    {
      var vpWH = [];
      var vpW, vpH;
      var intCoordX = evt.clientX;
      var intCoordY = evt.clientY;
      var intXOffset = intCoordX;
      var intYOffset = intCoordY;

      vpWH = getViewPortWidthHeight();
      vpW = vpWH[0];
      vpH = vpWH[1];
      var popup = $(".super_links_popup");

      popup.css("position","fixed");
      // if not display: block, .offsetWidth & .offsetHeight === 0
      popup.css("display","block");
      popup.css("zIndex","2147483647");

      if ( intCoordX > vpW/2 )
        intXOffset -= popup.width();

      if ( intCoordY > vpH/2 )
        intYOffset -= popup.height();

      if ( vpW <= 500 )
        intXOffset = ( vpW - popup.width() ) / 2;

      if ( vpH <= 500 )
        intYOffset = (vpH - popup.height() ) / 2;

      var rpos = intXOffset + popup.outerWidth() + 5;
      if (rpos > vpW)
        intXOffset -= rpos - vpW;

      if (intXOffset < 0 )
        intXOffset = 0;

      popup.css("top", intYOffset + 'px');
      popup.css("left", intXOffset + 'px');
      popup.css("visibility", 'visible');
    }


    function getViewPortWidthHeight()
    {
      var viewPortWidth;
      var viewPortHeight;

 	// the more standards compliant browsers (mozilla/netscape/opera/IE7)
 	// use window.innerWidth and window.innerHeight
      if (typeof window.innerWidth != 'undefined')
      {
        viewPortWidth = window.innerWidth;
        viewPortHeight = window.innerHeight;
      }
      
      return [viewPortWidth, viewPortHeight];
    }
/**********************************************/




    function create_popup_table(lst, ev)
    {
      $('.super_links_popup-content').children().remove();

      var settings = new Settings();

      function create_href(url) {
         // http://linkeddata.uriburner.com/about/id/entity/https/thenextweb.com/hardfork/2019/02/05/facebook-is-doing-something-with-blockchain-but-nobody-knows-what/#babelfy_bn%3A03624775n_ED31AF22-2E19-11E9-B5EB-80FD74DC2BE9       
         var href = url;
         if (href.startsWith('http://'))
           href = href.substring('http://'.length)
         else if (href.startsWith('https://'))
           href = href.substring('http://'.length)
         else
           return url;

         var prefix = 'linkeddata.uriburner.com/about/id/entity/';
         if (href.startsWith(prefix))
           href = href.substring(prefix.length);
         else
           return url;

         if (href.startsWith('http/'))
           href = 'http://'+ href.substring('http/'.length)
         else if (href.startsWith('https/'))
           href = 'https://' + href.substring('https/'.length)
         else
           return url;

//         return settings.createSparqlUrl(href);
         return settings.createImportUrl(href);
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
              var entityTypeLabel = v.entityTypeLabel?v.entityTypeLabel.value:type_iri;

              var association = v.association.value;
              var associationLabel = v.associationLabel?v.associationLabel.value:association;
              var extract_href = create_href(extract);

              tdata += 
              `<tr><td> <a target="_blank" href="${extract_href}">${extLabel}</a></td>`+
              ` <td> <a target="_blank" href="${association}">${associationLabel}</a> </td>`+
              ` <td> <a target="_blank" href="${prov}">${provName}</a></td>`+
              ` <td> <a target="_blank" href="${entityType}">${entityTypeLabel}</a></td>`+
              `</tr>`;
            }
          } catch(e) {}
        }

        $('.super_links_popup-content')
           .append('<table class="super_links_table">'
               +'<thead><tr>'
               +'<th style="max-width:190px;">Word</th>'
               +'<th style="max-width:95px;">Association</th>'
               +'<th style="max-width:285px;">Source</th>'
               +'<th style="max-width:300px;">Type</th>'
               +'</tr></thead>'
                +'<tbody>'+tdata+'</tbody>'
                +'</table>');
        $('.super_links_popup').show();
        positionPopupOnPage(ev);
      }
    }


    function mark_strings(keyword)
    {
      var terms = {};
      var options = {
            "element": "a",  //"a"
            "className": "super_link_mark",
            "exclude": ["a"],
            "separateWordSearch": false,
            "acrossElements": true,
            "accuracy": "exactly",
//!            "diacritics": true,
            "diacritics": false,
            "iframes": false,
            "iframesTimeout": 5000,
            "caseSensitive": false,
            "ignoreJoiners": false,
            "filter": function(textNode, foundTerm, totalCounter){
                      // textNode is the text node which contains the found term
                      // foundTerm is the found search term
                      // totalCounter is a counter indicating the total number of all marks
                      // at the time of the function call
                 var count = terms[foundTerm];
                 if (count===undefined) {
                    terms[foundTerm]=1;
                    return true;
                 } else {
                    terms[foundTerm]=count+1;
                    return (count >= 1)? false: true;
                 } 
            },
            "each": function(node){
                // node is the marked DOM element
                $(node).attr("href","");
            },
            "done": function(counter){

                $('.super_links_popup_close').click(function(e){
                    $('.super_links_popup').hide();
                    return false;
                 });

                $('.super_link_mark').click(function(ev){
                    var label = ev.target.innerText.toLowerCase();
                    var lst = [];
                    for (var i=0; i < g_super_links.length; i++) {
                      if (g_super_links[i]._id.indexOf(label)!=-1)
                        lst.push(g_super_links[i]);
                    }

                    create_popup_table(lst, ev);
                    return false;
                 });
            }
        };


      $("body").unmark({
        done: function() {
          $("body").mark(keyword, options);
        }
      });
    }




    jQuery(document).ready(function () {

        try {

            is_data_exist();
            if (!data_found) {
                setTimeout(is_data_exist, 3000);
            }


            function request_doc_data() {
                scan_frames();

                function prepared_data() {
                    sniff_Data();
                    send_doc_data();
                }

                setTimeout(prepared_data, 500);
            }


            function send_doc_data() {
                var data_exists = false;
                var docData = {
                    doc_URL: document.location.href,
                    micro: {data: null},
                    jsonld: {text: null},
                    rdfa: {data: null, ttl: null},
                    rdf: {text: null},
                    turtle: {text: null},
                    ttl_nano: {text: null},
                    json_nano: {text: null},
                    rdf_nano: {text: null},
                    posh: {text: null}
                };

                var microdata = jQuery.microdata.json(micro_items, function (o) {
                    return o;
                });
                var rdfa = get_rdfa_data(); //null;

                docData.micro.data = microdata;
                docData.jsonld.text = json_ld_Text;
                docData.turtle.text = turtle_Text;
                docData.rdf.text = rdf_Text;
                docData.rdfa.data = rdfa.data;
                docData.rdfa.ttl = rdfa.ttl;
                docData.ttl_nano.text = ttl_nano_Text;
                docData.json_nano.text = json_nano_Text;
                docData.rdf_nano.text = rdf_nano_Text;
                docData.posh.text = posh_Text;

                if ((microdata.items && microdata.items.length > 0)
                    || (json_ld_Text && json_ld_Text.length > 0)
                    || (turtle_Text  && turtle_Text.length > 0)
                    || (rdf_Text     && rdf_Text.length > 0)
                    || (rdfa.data    && rdfa.data.length > 0)
                    || (ttl_nano_Text && ttl_nano_Text.length > 0)
                    || (json_nano_Text && json_nano_Text.length > 0)
                    || (rdf_nano_Text && rdf_nano_Text.length > 0)
                    || (posh_Text    && posh_Text.length > 0)
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
                if (request.property == "doc_data")
                    request_doc_data();
                else if (request.property == "open_tab")
                    request_open_tab(request.url, sender)
                else if (request.property == "super_links")
                    add_super_links(sender, request.query, request.timeout)
                else
                    sendResponse({});  // stop
            });


        } catch (e) {
            console.log("OSDS:" + e);
        }
    });

})();
