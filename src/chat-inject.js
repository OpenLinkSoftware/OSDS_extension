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

  const dd_base = `<span>Data format:</span>
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
           </SELECT>`;
  const dd_base_rev = `<span>Data format:</span>
           <SELECT style="all:revert;" id="code_type" >
                 <OPTION id="none" selected></OPTION>
                 <OPTION id="turtle">RDF-Turtle</OPTION>
                 <OPTION id="jsonld">JSON-LD</OPTION>
                 <OPTION id="json">JSON</OPTION>
                 <OPTION id="csv">CSV</OPTION>
                 <OPTION id="rdfxml">RDF/XML</OPTION>
                 <OPTION id="markdown">Markdown</OPTION>
                 <OPTION id="rss">RSS</OPTION>
                 <OPTION id="atom">Atom</OPTION>
           </SELECT>`;
  const dd_base_pplabs = `<span style="background-color: green;">Data format:</span>
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
           </SELECT>`;
  const dd_base_hugging = `<span style="background-color: green;">Data format:</span>
           <SELECT style="all:revert;" id="code_type" >
                 <OPTION id="none" selected></OPTION>
                 <OPTION id="turtle">RDF-Turtle</OPTION>
                 <OPTION id="jsonld">JSON-LD</OPTION>
                 <OPTION id="json">JSON</OPTION>
                 <OPTION id="csv">CSV</OPTION>
                 <OPTION id="rdfxml">RDF/XML</OPTION>
                 <OPTION id="markdown">Markdown</OPTION>
                 <OPTION id="rss">RSS</OPTION>
                 <OPTION id="atom">Atom</OPTION>
           </SELECT>`;

  const dropDown_openai = `<div class="flex items-center gap-2 ml-auto" style="height=24px;"> ${dd_base} </div>`;

  const ms_wrap = '<div style="display:flex; flex-direction:row-reverse; margin-right:70px">'
  const dropDown_ms = `<div> ${dd_base} </div>`;

  const dropDown_claude = `<div style="display:flex; flex-direction:row; margin-right:70px; height=24px;" class="text-text-500">
           ${dd_base_rev} </div>`;

  const dropDown_gemini = `<div style="display:flex; flex-direction:row; height=24px;">
           ${dd_base} </div>`;
  const dropDown_gemini1 = `<div style="display:flex; flex-direction:row-reverse; margin-right:10px">
           ${dropDown_gemini} </div>`;

  const dropDown_perplexity_labs = `<div class="flex items-center gap-2 ml-auto" style="height:24px;margin-left:300px;position:absolute;top:0px;"> ${dd_base_pplabs} </div>`;
  const dropDown_perplexity = `<div class="flex items-center gap-2 ml-auto text-textMainDark" style="height:24px;margin-left:300px;top:10px;position:absolute;"> ${dd_base_rev} </div>`;
  const dropDown_mistral = `<div class="flex items-center gap-2 ml-auto" style="height:24px;margin-left:300px"> ${dd_base_rev} </div>`;
  const dropDown_huggingface = `<div class="flex items-center gap-2 ml-auto" style="height:20px;margin-left:300px;top:5px;position:absolute;"> ${dd_base_hugging} </div>`;
  const dropDown_you = `<div style="display:flex; flex-direction:row; height:24px;margin-left:300px;position:absolute;top:3px;align-items:center;"> ${dd_base_pplabs} </div>`;
  const dropDown_meta = `<div style="height:20px;margin-left:200px;position:absolute;"> ${dd_base_hugging} </div>`;



  function scan_code_openai()
  {
    const lst = document.querySelectorAll('div#__next main pre');
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


  function scan_code_claude()
  {
    const lst = document.querySelectorAll('pre > div');
    for(const v of lst) 
    {
      const hdr = v.querySelector('div')
      const dd_el = hdr.querySelector('#code_type');
      if (dd_el)
        continue;

      const btn_copy = hdr.querySelector('button')
      if (btn_copy)
      	hdr.insertBefore(DOM.htmlToElements(dropDown_claude)[0], btn_copy);
    }
  }


  function scan_code_gemini()
  {
    const lst = document.querySelectorAll('model-response message-content code-block');
    for(const v of lst) 
    {
      const dd_el = v.querySelector('#code_type');
      if (dd_el)
        continue;

      const block = v.querySelector('div.code-block')
      const hdr = block.querySelector('div.header')
      if (hdr) {
        hdr.append(DOM.htmlToElements(dropDown_gemini)[0]);
      } 
      else {
        const internal = block.querySelector('div.code-block-internal-container')
        if (internal)
          internal.insertBefore(DOM.htmlToElements(dropDown_gemini1)[0], internal.children[0]);
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


  function scan_code_perplexity_labs()
  {
    const lst = document.querySelectorAll('div#__next main pre');
    for(const v of lst) 
    {
      const title = v.children[0].children[0];
      const dd_el = title.querySelector('#code_type');
      if (dd_el)
        continue;

      title.insertBefore(DOM.htmlToElements(dropDown_perplexity_labs)[0], title.children[0]);
    }
  }


  function scan_code_perplexity()
  {
    const lst = document.querySelectorAll('div#__next main pre');
    for(const v of lst) 
    {
      const dd_el = v.querySelector('#code_type');
      if (dd_el)
        continue;

      const code = v.querySelector('code')?.parentNode;
      const block = code?.parentNode;
      if (code && block)
        block.insertBefore(DOM.htmlToElements(dropDown_perplexity)[0], code);
    }
  }

  function scan_code_mistral()
  {
    const lst = document.querySelectorAll('pre');
    for(const v of lst) 
    {
      let i=0;
      const block = v.children[0];
      const dd_el = block.querySelector('#code_type');
      if (dd_el)
        continue;

      const btn_copy = block?.querySelector('button')
      if (btn_copy && block)
        block.insertBefore(DOM.htmlToElements(dropDown_mistral)[0], btn_copy);
    }
  }

  function scan_code_huggingface()
  {
    const lst = document.querySelectorAll('pre');
    for(const v of lst) 
    {
      const block = v.parentNode;
      const dd_el = block.querySelector('#code_type');
      if (dd_el)
        continue;

      const btn_copy = block.querySelector('button')
      if (btn_copy)
        block.insertBefore(DOM.htmlToElements(dropDown_huggingface)[0], btn_copy);
    }
  }

  function scan_code_you()
  {
    const lst = document.querySelectorAll('div#ydc-content-area  div[data-testid="youchat-code"] pre');
    for(const v of lst) 
    {
      const block = v.parentNode;

      const dd_el = block.querySelector('#code_type');
      if (dd_el)
        continue;

      const btn = block.querySelector('div > div[data-eventactioncontent]')?.parentNode;
      if (btn && block)
        block.insertBefore(DOM.htmlToElements(dropDown_you)[0], btn);
    }
  }

  function scan_code_meta()
  {
    const lst = document.querySelectorAll('pre');
    for(const v of lst) 
    {
      const block = v.parentNode.parentNode;
      const dd_el = block.querySelector('#code_type');
      if (dd_el)
        continue;

      const btn_copy = block.querySelector('div[role="button"]')?.parentNode.closest('div')
      if (btn_copy) {
        btn_copy.parentNode.insertBefore(DOM.htmlToElements(dropDown_meta)[0], btn_copy);
      }
    }
  }


  var gMutationObserver = new MutationObserver(debounce((v) => {
      if (g_top) {
        if (g_chat_id === 'ch_openai') 
          scan_code_openai();
        else if (g_chat_id === 'ch_copilot')
          scan_code_ms_copilot()
        else if (g_chat_id === 'ch_claude') 
          scan_code_claude();
        else if (g_chat_id === 'ch_gemini') 
          scan_code_gemini();
        else if (g_chat_id === 'ch_perplexity_labs') 
          scan_code_perplexity_labs();
        else if (g_chat_id === 'ch_perplexity') 
          scan_code_perplexity();
        else if (g_chat_id === 'ch_you') 
          scan_code_you();
      }
    }, 500));



  function handle_chat_code()
  {
    let use_mutation_observer = false;
    try {
      
      if (g_chat_id === 'ch_openai') {
        scan_code_openai();
        g_top = document.querySelector('div#__next');
        use_mutation_observer = true;
      }
      else if (g_chat_id === 'ch_copilot') {
        scan_code_ms_copilot();
        try {
          g_top = document.querySelector('cib-serp').shadowRoot.querySelector('cib-conversation').shadowRoot
          setInterval(scan_code_ms_copilot, 5*1000);
        } catch(e){} 
      }
      else if (g_chat_id === 'ch_claude') {
        scan_code_claude();
        g_top = document.querySelector('body');
        setInterval(scan_code_claude, 5*1000);
      }
      else if (g_chat_id === 'ch_gemini') {
        scan_code_gemini();
        g_top = document.querySelector('body');
        setInterval(scan_code_gemini, 5*1000);
      }
      else if (g_chat_id === 'ch_perplexity_labs') {
        scan_code_perplexity_labs();
        g_top = document.querySelector('div#__next');
        use_mutation_observer = true;
      }
      else if (g_chat_id === 'ch_perplexity') {
        scan_code_perplexity();
        g_top = document.querySelector('div#__next');
        use_mutation_observer = true;
      }
      else if (g_chat_id === 'ch_mistral') {
        scan_code_mistral();
        g_top = document.querySelector('body');
        setInterval(scan_code_mistral, 3*1000);
      }
      else if (g_chat_id === 'ch_huggingface') {
        scan_code_huggingface();
        g_top = document.querySelector('body');
        setInterval(scan_code_huggingface, 3*1000);
      }
      else if (g_chat_id === 'ch_you') {
        scan_code_you();
        g_top = document.querySelector('div#ydc-content-area');
        use_mutation_observer = true;
      }
      else if (g_chat_id === 'ch_meta') {
        scan_code_mistral();
        g_top = document.querySelector('body');
        setInterval(scan_code_meta, 3*1000);
      }
      

      if (g_top && use_mutation_observer) {
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
    else if (location.href.startsWith('https://copilot.microsoft.com'))
      return 'ch_copilot';
    else if (location.href.startsWith('https://claude.ai/chat'))
      return 'ch_claude';
    else if (location.href.startsWith('https://gemini.google.com'))
      return 'ch_gemini';
    else if (location.href.startsWith('https://labs.perplexity.ai/'))
      return 'ch_perplexity_labs';
    else if (location.href.startsWith('https://www.perplexity.ai'))
      return 'ch_perplexity';
    else if (location.href.startsWith('https://huggingface.co/chat'))
      return 'ch_huggingface';
    else if (location.href.startsWith('https://chat.mistral.ai/chat'))
      return 'ch_mistral';
    else if (location.href.startsWith('https://you.com/'))
      return 'ch_you';
    else if (location.href.startsWith('https://www.meta.ai'))
      return 'ch_meta';
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

  async function win_load()
  {
    g_chat_id = getChatID();

    if (g_chat_id === 'ch_openai' || g_chat_id === 'ch_copilot' 
       || g_chat_id === 'ch_claude' || g_chat_id === 'ch_gemini'
       || g_chat_id === 'ch_perplexity_labs' || g_chat_id === 'ch_perplexity' 
       || g_chat_id === 'ch_mistral' || g_chat_id === 'ch_huggingface'
       || g_chat_id === 'ch_you' || g_chat_id === 'ch_meta')
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
  }

  if (Browser.is_ff)
    window.addEventListener('pageshow', win_load);
  else
    window.addEventListener('load', win_load);


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