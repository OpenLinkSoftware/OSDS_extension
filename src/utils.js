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

class Rest_Cons {
  constructor()
  {
    this.callback = null;
    this.yasqe = {
        obj : null,
        val : null,
        init: false,
      };
    this.fix_restURI = null;
    this.doc_url;
  }


  update() 
  {
    if (!this.doc_url) {
      return;
    }

    var _url = new URL(this.doc_url);
    _url.search = "";
    _url.protocol = DOM.iSel("rest_scheme").value;
    var v = DOM.iSel("rest_auth").value;
    var vlist = v.split('@');
    if (vlist.length == 1) {
      _url.host = vlist[0];
    } else {
      _url.username = vlist[0];
      _url.host = vlist[1];
    }

    _url.pathname = DOM.iSel("rest_path").value;
    _url.hash = DOM.iSel("rest_hash").value;

    if (this.yasqe.obj) {
      var val = this.yasqe.obj.getValue();
      var name = $("#query_id").val();
      if (val && (val.replace(/[\r\n ]/g, '')).length > 0) {
         _url.searchParams.append(name, val);
      }
    }

    var rows = $('#restData>tr');
    for(var i=0; i < rows.length; i++) {
      var r = $(rows[i]);
      var h = r.find('#h').val();
      var v = r.find('#v').val();
      if (h.length>0) {
         _url.searchParams.append(h, v);
      }
    }

    _url = _url.toString();
    if (this.fix_restURI) {
      _url = _url.replace(/%23\/editor\?/g, "#/editor\?");
    }

    DOM.iSel("rest_url").value = _url;
  }


  show() 
  {
    if (this.yasqe.obj && this.yasqe.val && !this.yasqe.init) {
      this.yasqe.obj.setValue(this.yasqe.val+"\n");
      this.yasqe.init = true;
    }
  }

  exec(tab_index)
  {
    if (!this.doc_url) {
      return;
    }

    this.update();
    var _url = DOM.iSel("rest_url").value;

    if (tab_index) {
      Browser.openTab(_url, tab_index);
    } else {
      Browser.api.tabs.create({url:_url});
    }
  }

  del_row(e)
  {
    //get the row we clicked on
    var row = $(e.currentTarget).parents('tr:first');
    var self = this;

    $('#alert-msg').prop('textContent','Delete row ?');
    $('#alert-dlg').dialog({
      resizable: false,
      height:180,
      modal: true,
      buttons: {
        'Yes': function() {
            row.remove();
            self.update()
            $(this).dialog( 'destroy' );
        },
        'No': function() {
            $(this).dialog( 'destroy' );
        }
      }
    });
    return true;
  }

  
  create_row(h,v)
  {
    return `<td width="12px"><button id="rest_del" class="rest_del">Del</button></td>
            <td><input id="h" style="WIDTH: 100%" value="${h}"></td>
            <td><textarea id="v" style="WIDTH: 100%; height:3em">${v}</textarea></td>`;
  }


  add_empty_row() 
  {
    this.add_row('','');
  }

  add_row(h,v) 
  {
    var tbody = DOM.qSel("#rest_params tbody");
    var r = tbody.insertRow(-1);
    r.innerHTML = this.create_row(h, v);

    $('.rest_del').button({
      icons: { primary: 'ui-icon-minusthick' },
      text: false
    });
    r.querySelector(".rest_del").onclick = (e) => { this.del_row(e) }
    r.querySelector("#h").oninput = (e) => { this.update() }
    r.querySelector("#v").oninput = (e) => { this.update() }
  }


  clear() 
  {
    var data = $('#users_data>tr');
    var data = $('#restData>tr');
    for(var i=0; i < data.length; i++) {
      $(data[i]).remove();
    }
  }

  load(doc_url) 
  {
    this.yasqe.val = null;
    this.fix_restURI = null;
    this.doc_url = doc_url;
    $("#rest_query").hide();

    this.clear();

    if (!this.doc_url) {
      this.add_empty_row();
      return;
    }

    DOM.iSel("rest_url").value = this.doc_url;

    var url = new URL(this.doc_url);
    var hash = url.hash;
    // check for RDF Editor URL
    if (hash.lastIndexOf("#/editor?", 0) === 0) {
      var tmp_url = this.doc_url.replace(/#\/editor\?/g, "%23/editor?");
      this.fix_restURI = url = new URL(tmp_url);
    }


    var params = url.searchParams;
    var count = 0;
    for(var pair of params.entries()) {
      var key = pair[0];
      var val = pair[1];
      if (key === "query" || key === "qtxt") {
        $("#rest_query").show();
        this.yasqe.val = val;
        var n = DOM.iSel("query_id");
        n.value = key;
        n.oninput = (e) => { this.update() };
      }
      else {
        this.add_row(key, val);
      }
      count++;
    }


    if (count == 0) {
      this.add_empty_row();
    }

    if (this.yasqe.obj && this.yasqe.val) {
      this.yasqe.obj.setValue(this.yasqe.val+"\n");
    }
    else {
      if (this.yasqe.obj)
        this.yasqe.obj.setValue("\n");
      $(".yasqe").hide();
    }


    url.search = "";

    var n = DOM.iSel("rest_scheme");
    n.value = url.protocol;
    n.oninput = (e) => { this.update() };

    n = DOM.iSel("rest_auth");
    n.value = url.username ? url.username+'@'+ url.host : url.host;
    n.oninput = (e) => { this.update() };

    n = DOM.iSel("rest_path");
    n.value = url.pathname;
    n.oninput = (e) => { this.update() };

    n = DOM.iSel("rest_hash");
    n.value = decodeURIComponent(url.hash);
    n.oninput = (e) => { this.update() };

    $('#rest_add').button({
      icons: { primary: 'ui-icon-plusthick' },
      text: false
    });
    
    DOM.iSel("rest_add").onclick = (e) => { this.add_empty_row(); }
  }


  parse_params(search)
  {
    var params = [];
    var s = search && search.length > 1 ? search.substring(1) : "";
    var lst = s.split('&');
    for(var v of lst) 
    {
       var lv = v.split('=');
       params.push( [lv[0], decodeURIComponent(lv[1])] );
    }
    return params;
  }
}



async function getCurWin()
{
  if (Browser.is_chrome) {
    return new Promise(function (resolve, reject) {
      Browser.api.windows.getCurrent({}, (w) => {
        resolve(w)
      });
    })
  } else {
    return Browser.api.windows.getCurrent({});
  }
}

async function getCurTab()
{
  if (Browser.is_chrome) {
    return new Promise(function (resolve, reject) {
      Browser.api.tabs.query({active:true, currentWindow:true}, (t) => {
        resolve(t)
      });
    })
  } else {
    return Browser.api.tabs.query({active:true, currentWindow:true});
  }
}


function fixedEncodeURIComponent (str) {
  return encodeURIComponent(str).replace(/[!'()*&?#$,.:@=;+\/]/g, function(c) {
    return '%' + c.charCodeAt(0).toString(16);
  });
}


async function fetchWithTimeout(url, options = {}, timeout) {
  const _timeout = timeout || 60000;
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const response = await fetch(url, {
    ...options,
    signal: controller.signal  
  });
  clearTimeout(id);

  return response;
}



function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function req_openai(v) 
{
    const openai_token = v.token;
    const model = v.model || "gpt-3.5-turbo";
    const req = v.req;
    const temp = v.temperature || 1;
    const system_msg = "You are a helpful assistant."

    const calc_len = gpt3encoder.countTokens(req+system_msg)+1;
    const max_tokens = v.max_tokens-calc_len;

    var payload = {
      "model": model,
      messages: [
        {
          role: "system",
          "content": system_msg
        },
        {
          role: "user",
          "content": req
        }
      ],
       "temperature": temp,
       "max_tokens": max_tokens
    };

    var options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
          Authorization: `Bearer ${openai_token}`,
      },
      body: JSON.stringify(payload)
    }

    try {
      var rc = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', options, 60000);
      if (rc.ok) {
        var data = await rc.json();
        if (data.object === 'chat.completion' && data.choices && data.choices.length > 0) {
          const text = data.choices[0].message.content
          return {rc:1, text};
        }
        return {rc:0, err:'Could not parse OpenAI response'}
      } else {
        return {rc:0, err:'HTTP='+rc.status}
      }
    } catch(e) {
      return {rc:0, err:e.toString()}
    }
}



async function showSnackbar(text1, text2) {
    const tm = 15000;
    var x = DOM.iSel("super_links_snackbar");
    DOM.qSel("#super_links_snackbar #msg1").innerText = text1;
    DOM.qSel("#super_links_snackbar #msg2").innerText = text2 || '';
    x.className = "show";
    setTimeout(function(){ x.className = x.className.replace("show", ""); }, tm);
    await sleep(tm);
}


function sanitize_str(str) {
  str = str || '';
  return str.replace(/&/g, '&amp;')
                 .replace(/</g, '&lt;')
                 .replace(/>/g, '&gt;')
                 .replace(/"/g, '&quot;')
                 .replace(/'/g, '&#39;');
}


var DOM = {};
DOM.qSel = (sel) => { return document.querySelector(sel); };
DOM.qSelAll = (sel) => { return document.querySelectorAll(sel); };
DOM.iSel = (id) => { return document.getElementById(id); };
DOM.htmlToElement = (html) => {
    var template = document.createElement('template');
    html = html.trim(); // Never return a text node of whitespace as the result
    template.innerHTML = html;
    return template.content.firstChild;
  }

DOM.htmlToElements = (html) => {
    var template = document.createElement('template');
    template.innerHTML = html;
    return template.content.childNodes;
  }
DOM.qShow = (sel) => { DOM.qSel(sel)?.classList.remove('hidden'); };
DOM.qHide = (sel) => { DOM.qSel(sel)?.classList.add('hidden'); };
DOM.Show = (el) => { el?.classList.remove('hidden'); };
DOM.Hide = (el) => { el?.classList.add('hidden'); };
DOM.ready = (fn) => {
  // If we're early to the party
  document.addEventListener("DOMContentLoaded", fn);
  // If late; I mean on time.
  if (document.readyState === "interactive" || document.readyState === "complete" ) {
    fn();
  }
}
// query elements even deeply within shadow doms. e.g.:
// ts-app::shadow paper-textarea::shadow paper-input-container
DOM.querySelectorDeep = (selector, root = document) => {
  let currentRoot = root;
  let partials = selector.split('::shadow');
  let elems = currentRoot.querySelectorAll(partials[0]);
  for (let i = 1; i < partials.length; i++) {
    let partial = partials[i];
    let elemsInside = [];
    for (let j = 0; j < elems.length; j++) {
      let shadow = elems[j].shadowRoot;
      if (shadow) {
        const matchesInShadow = shadow.querySelectorAll(partial);
        elemsInside = elemsInside.concat([... matchesInShadow]);
      }
    }
    elems = elemsInside;
  }
  return elems;
}

function debounce(callback, wait) {
    let timeout;
    return (...args) => {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => callback.apply(context, args), wait);
    };
}

async function setRule_OnBehalfOf(chk, UID) {
  if (chk==="1" && UID && UID.length > 1) {
      await Browser.api.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: [2],
          addRules: [{
            "id": 2,
            "priority": 1,
            "action": {
              "type": "modifyHeaders",
              "requestHeaders": [
                { "header": "On-Behalf-Of", "operation": "set", "value": UID }
              ]
            },
            "condition": {
              "resourceTypes": ["main_frame", "sub_frame"]
            }
          }]
      });
  }
  else {
      await Browser.api.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [2]
      });  
  }
}