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

  var g_chatTab = null; //{windowId:0, tabId:0};
  var g_top = null;
  const dropDown = `<div class="flex items-center gap-2 ml-auto">
           <span>Data type:</span>
           <SELECT id="code_type" style="color:black" class="text-sm">
                 <OPTION id="none" selected></OPTION>
                 <OPTION id="turtle">RDF-Turtle</OPTION>
                 <OPTION id="jsonld">JSON-LD</OPTION>
                 <OPTION id="json">JSON</OPTION>
                 <OPTION id="csv">CSV</OPTION>
                 <OPTION id="rdfxml">RDF/XML</OPTION>
           </SELECT>
           </div>`;



  var gMutationObserver = new MutationObserver(debounce((v) => {
//      console.log('page was updated');
      if (g_top) {
//        console.log('start scan for code');
        const lst = document.querySelectorAll('pre');
        if (lst.length > 0) {
            for(const v of lst) {
              const title = v.children[0].children[0];
              const btn_copy = title.querySelector('button');
              const dd_el = title.querySelector('#code_type');
              if (!dd_el) {
                title.insertBefore(DOM_htmlToElements(dropDown)[0], btn_copy);
              }
            }
        }
      }
    }, 500));

  DOM_ready = (fn) => {
    // If we're early to the party
    document.addEventListener("DOMContentLoaded", fn);
    // If late; I mean on time.
    if (document.readyState === "interactive" || document.readyState === "complete" ) {
      fn();
    }
  }


  DOM_ready(async () =>
  {
//    console.log('ready start');

    try {
//      g_top = document.querySelector('div#__next main');
      g_top = document.querySelector('div#__next');
      if (g_top) {
//        gMutationObserver.observe(g_top, {attributes:true, childList:true, subtree:true});
        gMutationObserver.observe(g_top, {childList:true, subtree:true, characterData: false });
//        console.log('ready done');
      }
    } catch(e) {
      console.log(e);
    }


    try {

      // register chat in background
      Browser.api.runtime.sendMessage({cmd:"gpt_window_reg"});

      Browser.api.runtime.onMessage.addListener(function (request, sender, sendResponse) 
      {
            if (request.cmd === "gpt_ping") { // send alive message
               sendResponse({ping:1, winId: g_chatTab.winId, tabId: g_chatTab.tabId});
               return true;
            }
            else if (request.cmd === "gpt_win_tab") { // store winId, tabId for current page
               g_chatTab = {};
               g_chatTab["tabId"] = request.tabId;
               g_chatTab["winId"] = request.winId;
               sendResponse({});
               return true;
            }
            else if (request.cmd === "gpt_prompt") {
              update_prompt(request.text, request.url);
            }
      });

    } catch (e) {
      console.log("OSDS:" + e);
    }

/**      
      const _url = new URL(location.href);
      if (_url.hash.length > 1) {
        const par = new URLSearchParams(_url.hash.substring(1));

        _url.hash = '#';
        location.href = _url.toString();
      
        if (par.size > 0 && par.has('prompt') && par.has('url'))
          update_prompt(par.get('prompt'), par.get('url'));
      }
 **/


  });


  window.onbeforeunload = function () {
    // unregister chat in background
    Browser.api.runtime.sendMessage({cmd:"gpt_window_unreg"});

    if (gMutationObserver)
      gMutationObserver.disconnect()
  }


  async function update_prompt(txt, url)
  {
    if (!txt)
      return;

    const pref = new Settings();
    const _url = url ?? '';
    var prompt_query = await pref.getValue('ext.osds.prompt-query');
    prompt_query = prompt_query.replace("{selected_text}", txt);
    prompt_query = prompt_query.replace("{url}", url);

    const txtArea = document.getElementById('prompt-textarea');
    txtArea.value = prompt_query;
    txtArea.classList.remove('resize-none');
    txtArea.classList.add('resize');
    txtArea.style['overflow-y'] = 'auto';
  }


  function debounce(callback, wait) {
    let timeout;
    return (...args) => {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => callback.apply(context, args), wait);
    };
  }


  DOM_htmlToElements = (html) => {
    var template = document.createElement('template');
    template.innerHTML = html;
    return template.content.childNodes;
  }


})();