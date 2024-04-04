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

  let g_chat_id = null;
  var g_chatTab = null; //{windowId:0, tabId:0};
  var g_top = null;

  let g_prompt_id = null;
  let g_prompt_set = {};

  const dropDown_openai = `<div class="flex items-center gap-2 ml-auto">
           <span>Data format:</span>
           <SELECT id="code_type" style="color:black" class="text-sm">
                 <OPTION id="none" selected></OPTION>
                 <OPTION id="turtle">RDF-Turtle</OPTION>
                 <OPTION id="jsonld">JSON-LD</OPTION>
                 <OPTION id="json">JSON</OPTION>
                 <OPTION id="csv">CSV</OPTION>
                 <OPTION id="rdfxml">RDF/XML</OPTION>
                 <OPTION id="markdown">Markdown</OPTION>
                 <OPTION id="rss">RSS</OPTION>
                 <OPTION id="atom">Atom</OPTION>
           </SELECT>
           </div>`;

  const ms_wrap = '<div style="display:flex; flex-direction:row-reverse; margin-right:70px">'
  const dropDown_ms = `<div>
           <span>Data format:</span>
           <SELECT id="code_type" >
                 <OPTION id="none" selected></OPTION>
                 <OPTION id="turtle">RDF-Turtle</OPTION>
                 <OPTION id="jsonld">JSON-LD</OPTION>
                 <OPTION id="json">JSON</OPTION>
                 <OPTION id="csv">CSV</OPTION>
                 <OPTION id="rdfxml">RDF/XML</OPTION>
                 <OPTION id="markdown">Markdown</OPTION>
                 <OPTION id="rss">RSS</OPTION>
                 <OPTION id="atom">Atom</OPTION>
           </SELECT>
           </div>`;


  function scan_code_openai()
  {
    const lst = document.querySelectorAll('pre');
    for(const v of lst) 
    {
      let i=0;
      const title = v.children[0].children[0];
      let btn_copy = title.querySelector('button');
      while(btn_copy.parentNode!=title && i < 10) {
        btn_copy = btn_copy.parentNode
        i++
      }
      const dd_el = title.querySelector('#code_type');
      if (!dd_el && btn_copy.parentNode === title) {
        title.insertBefore(DOM.htmlToElements(dropDown_openai)[0], btn_copy);
      }
    }
  }


  function scan_code_ms_copilot()
  {
    if (!g_top)
      return;

    for(const c0 of g_top.querySelectorAll('cib-chat-turn[mode="conversation"]'))
    {
      for(const c1 of c0.shadowRoot.querySelectorAll('cib-message-group[mode=conversation]')) 
      {
        for(const c2 of c1.shadowRoot.querySelectorAll('cib-message[type="text"]'))
        {
          for(const v of c2.shadowRoot.querySelectorAll('cib-shared cib-code-block'))
          {
            const e_hdr = v.shadowRoot.querySelector('div.code-header')
            const e_hdr1 = v.shadowRoot.querySelector('div.code')
            if (e_hdr) {
              const btn_copy = e_hdr.querySelector('div.code-actions')
              const dd_el = e_hdr.querySelector('#code_type');
              if (btn_copy && !dd_el)
                e_hdr.insertBefore(DOM.htmlToElements(dropDown_ms)[0], btn_copy);
            }
            else if (e_hdr1) {
              const dd_el = v.shadowRoot.querySelector('#code_type');
              if (!dd_el) {
                const dd_html = ms_wrap + dropDown_ms + '</div>';
                v.shadowRoot.insertBefore(DOM.htmlToElements(dd_html)[0], e_hdr1);
              }
            }
          }
        }
      }
    }
  }


  var gMutationObserver = new MutationObserver(debounce((v) => {
      if (g_top) {
        if (g_chat_id === 'ch_openai') 
          scan_code_openai();
        else if (g_chat_id === 'ch_copilot')
          scan_code_ms_copilot()
      }
    }, 500));



  function handle_chat_code()
  {
    // fix code blocks
    try {
      
      if (g_chat_id === 'ch_openai') {
        scan_code_openai();
        g_top = document.querySelector('div#__next');
      }
      else if (g_chat_id === 'ch_copilot') {
        scan_code_ms_copilot();
        try {
          g_top = document.querySelector('cib-serp').shadowRoot.querySelector('cib-conversation').shadowRoot
          setInterval(scan_code_ms_copilot, 10*1000);
        } catch(e){} 
      }

      if (g_top) {
        gMutationObserver.observe(g_top, {childList:true, subtree:true, characterData: false });
      }
    } catch(e) {
      console.log(e);
    }
  }

  
  function handle_chat_prompt()
  {
    if (g_prompt_id)
    {
      try {
        // register chat in background
        Browser.api.runtime.sendMessage({cmd:"gpt_window_reg", chat_id:g_prompt_id});

        Browser.api.runtime.onMessage.addListener(function (request, sender, sendResponse) 
        {
            if (request.cmd === "gpt_ping") { // send alive message
               sendResponse({ping:1, winId: g_chatTab.winId, tabId: g_chatTab.tabId, chat_id:g_prompt_id});
               return true;
            }
            else if (request.cmd === "gpt_win_tab") { // store winId, tabId for current page
               g_chatTab = {};
               g_chatTab["tabId"] = request.tabId;
               g_chatTab["winId"] = request.winId;
               sendResponse({});
               return true;
            }
            else if (request.cmd === "gpt_prompt") 
               update_prompt(request.text);
        });

      } catch (e) {
        console.log("OSDS:" + e);
      }
    }
  }


  function getChatID()
  {
    if (location.host==='chat.openai.com')
      return 'ch_openai';
    else if (location.host==='copilot.microsoft.com')
      return 'ch_copilot';
    else
     return null;
  }


  async function init_prompt_inject()
  {
    const setting = new Settings();
    g_prompt_id = await setting.getValue('ext.osds.chat-srv');
    try {
      const s = await setting.getValue('ext.osds.def_prompt_inject')
      const chat_list = JSON.parse(s);
      const v = chat_list[g_prompt_id];
      if (v['prompt.selector'])
      {
        if (v['location.host'] && location.host === v['location.host'])
          g_prompt_set = v;
        else if (v['location.origin'] && location.origin === v['location.origin'])
          g_prompt_set = v;
        else if (v['location.startsWith'] && location.href.startsWith(v['location.startsWith']))
          g_prompt_set = v;
        else
          g_prompt_id = null;
      }
    } catch(e) {
      g_prompt_id = null;
    }
  }


  window.onload = async () => {
    g_chat_id = getChatID();

    if (g_chat_id === 'ch_openai' || g_chat_id === 'ch_copilot')
      handle_chat_code();

    await init_prompt_inject();

    if (g_prompt_id && g_prompt_set) {
      handle_chat_prompt();

      window.onbeforeunload = function () 
      {
        // unregister chat in background
        Browser.api.runtime.sendMessage({cmd:"gpt_window_unreg"});

        if (gMutationObserver)
          gMutationObserver.disconnect()
      }
    }
  };


  function update_prompt(txt)
  {
    if (!txt || !g_prompt_set)
      return;
    
    const sel = g_prompt_set['prompt.selector'];
    const addClass = g_prompt_set['prompt.css.addClass'];
    const removeClass = g_prompt_set['prompt.css.removeClass'];
    if (sel) 
    {
      let txtArea = null;
      if (Array.isArray(sel))
      {
        let root = document;
        for(const v of sel) {
          root = (v === '#shadow-root') ? root.shadowRoot : root.querySelector(v)
          if (!root)
            break;
        }
        txtArea = root;
      }
      else 
      {
        txtArea = document.querySelector(sel);
      }

      if (txtArea) {
        txtArea.focus();
        window.document.execCommand('insertText', false, txt);
        if (removeClass)
          txtArea.classList.remove(removeClass);
        if (addClass)
          txtArea.classList.add(addClass);
      }
    }
  }


})();