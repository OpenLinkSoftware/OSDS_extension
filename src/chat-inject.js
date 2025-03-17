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

  const dd_base_openai = `<span>Data format:</span>
           <SELECT id="code_type" class="dark:bg-token-main-surface-secondary text-xs">
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

  const dd_base_openai_play = `<span style="background-color: lightgreen;">Data format:</span>
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
  const dd_base_pplabs = `<span style="background-color: lightgreen;">Data format:</span>
           <SELECT id="code_type" class="bg-offsetPlus dark:bg-offsetPlusDark" >
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
  const dd_base_hugging = `<span>Data format:</span>
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

  const dd_base_groq = `<span style="background-color: lightgreen;">Data format:</span>
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

  const dropDown_openai = `<div class="flex items-center gap-2" style="height:24px;margin-right:300px"> ${dd_base_openai} </div>`;

  const ms_wrap = '<div style="display:flex; flex-direction:row-reverse; margin-right:70px">'
  const dropDown_ms = `<div> ${dd_base} </div>`;

  const dropDown_claude = `<div style="display:flex; flex-direction:row; margin-left:200px; height:24px;" class="text-text-500">
           ${dd_base_rev} </div>`;
  const dropDown_claude_ar = `<div style="display:flex; flex-direction:row; justify-content:center; background: lightgray; height:24px;" class="text-text-500">
           ${dd_base_rev} </div>`;

  const dropDown_gemini = `<div style="display:flex; flex-direction:row; height:24px;">
           ${dd_base} </div>`;
  const dropDown_gemini1 = `<div style="display:flex; flex-direction:row-reverse; margin-right:10px">
           ${dropDown_gemini} </div>`;

  const dropDown_perplexity_labs = `<div class="flex items-center gap-2 ml-auto text-textOff dark:text-textOffDark" style="height:24px;margin-left:200px;margin-right:100px;position:absolute;top:0px;"> ${dd_base_pplabs} </div>`;
  const dropDown_perplexity = `<div class="flex items-center gap-2 ml-auto text-textOff dark:text-textOffDark" style="height:24px;margin-left:200px;margin-right:100px;position:absolute;"> ${dd_base_pplabs} </div>`;

  const dropDown_mistral = `<div class="flex items-center gap-2 ml-auto" style="height:24px;margin-left:300px"> ${dd_base_rev} </div>`;
  const dropDown_huggingface = `<div style="margin-left:300px; display:flex; flex-flow:row; height:18px; align-items:center;"> ${dd_base_hugging} </div>`;
  const dropDown_you = `<div style="display:flex; flex-direction:row; height:24px;align-items:center; color:black"> ${dd_base_pplabs} </div>`;
  const dropDown_meta = `<div style="height:20px;margin-left:200px;position:absolute;"> ${dd_base_hugging} </div>`;

  const dropDown_openai_play = `<div style="display:flex; flex-direction:row; margin-left:200px; height:24px;align-items:center">
           ${dd_base_openai_play} </div>`;

  const dropDown_openperplex = `<div style="display:flex; flex-direction:row; justify-content:center; align-items:center">
           ${dd_base_openai_play} </div>`;

  const dropDown_grok = `<div style="display:flex; flex-direction:row; justify-content:center; height:24px;" class="text-text-500">
           ${dd_base_rev} </div>`;

  const dropDown_groq_chat = `<div class="flex items-center gap-2 ml-auto text-textOff dark:text-textOffDark" style="height:24px;margin-left:300px;position:absolute;"> 
           ${dd_base_groq} </div>`;


  const dropDown_deepseek = `<div style="display:flex; flex-direction:row; justify-content:center; align-items:baseline; height:24px;" class="text-text-500">
           ${dd_base_rev} </div>`;

  const dropDown_qwen = `<div class="text-xs text-black dark:text-white rounded-lg" style="display:flex; flex-flow:row; height:24px; align-items:baseline;justify-content:center;background:lightgray; "> 
           ${dd_base_rev} </div>`;

  const dropDown_cerebras = `<div class="text-md text-black dark:text-white rounded-lg" style="display:flex; flex-flow:row; height:24px; align-items:baseline;justify-content:center;background:lightgray; "> 
           ${dd_base_rev} </div>`;

  const dropDown_allenai = `<div style="display:flex; flex-direction:row; justify-content:center; height:24px; align-items:baseline;">
           ${dd_base_rev} </div>`;

  const dropDown_github = `<div style="display:flex; flex-direction:row; justify-content:center; height:24px; align-items:baseline; margin-right:200px;">
           ${dd_base_rev} </div>`;


  function scan_code_openai()
  {
    let lst = document.querySelectorAll('main pre');
    for(const v of lst) 
    {
      const hdr = v.children[0];
      const dd_el = hdr.querySelector('#code_type');
      if (dd_el)
        continue;

      const btn_copy = hdr.querySelector('button')
      hdr.children[0]?.append(DOM.htmlToElements(dropDown_openai)[0]);
    }
    lst = document.querySelectorAll('article pre');
    for(const v of lst) 
    {
      const hdr = v.children[0];
      const dd_el = hdr.querySelector('#code_type');
      if (dd_el)
        continue;

      const btn_copy = hdr.querySelector('button')
      hdr.children[0]?.append(DOM.htmlToElements(dropDown_openai)[0]);
    }
  }


  function scan_code_openai_play()
  {
    const lst = document.querySelectorAll('div[data-panel] pre');
    for(const v of lst) 
    {
      const hdr = v.parentNode
      const dd_el = hdr.querySelector('#code_type');
      if (dd_el)
        continue;

      const btn_copy = hdr.querySelector('button')
      if (btn_copy)
      	hdr.insertBefore(DOM.htmlToElements(dropDown_openai_play)[0], btn_copy);
    }
  }


  function scan_code_claude()
  {
    let lst = document.querySelectorAll('pre > div');
    for(const v of lst) 
    {
      const hdr = v.querySelector('div')
      const dd_el = v.querySelector('#code_type');
      if (dd_el)
        continue;

      if (v.childNodes.length > 1) {
        v.childNodes[0].append(DOM.htmlToElements(dropDown_claude)[0]);
        v.childNodes[0].style['display']='flex';
      }
    }

    lst = document.querySelectorAll('div > code');
    for(const v of lst) 
    {
      const blk = v.parentNode.parentNode.parentNode.parentNode;
      const child = blk.childNodes;
      if (child.length >= 3) {
        const title = child[0];
        const dd_el = title.querySelector('#code_type');
        if (dd_el)
          continue;
        title.childNodes[0].insertAdjacentHTML('afterend', dropDown_claude_ar);
      }
      // artifacts
      if (child.length >= 2) {
        const dd_el = blk.querySelector('#code_type');
        if (dd_el)
          continue;
        blk.insertAdjacentHTML('afterbegin',dropDown_claude_ar);
      }
    }
  }


  function scan_code_gemini()
  {
    const lst = document.querySelectorAll('message-content code-block');
    for(const v of lst) 
    {
      const dd_el = v.querySelector('#code_type');
      if (dd_el)
        continue;

      const block = v.querySelector('div.code-block')
      const hdr_type = block.querySelector('div > div > span')
      if (hdr_type) {
        hdr_type.insertAdjacentHTML('afterend', dropDown_gemini);
      } 
      else {
        const internal = block.querySelector('div')
        if (internal)
          internal.insertAdjacentHTML('afterbegin', dropDown_gemini1);
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
    const lst = document.querySelectorAll('main pre');
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
    const lst = document.querySelectorAll('main pre');
    for(const v of lst) 
    {
      const dd_el = v.querySelector('#code_type');
      if (dd_el)
        continue;

      const title = v.children[0].children[0];
      title.insertBefore(DOM.htmlToElements(dropDown_perplexity)[0], title.children[0]);
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

  function scan_code_openperplex()
  {
    const lst = document.querySelectorAll('div#app pre');
    for(const v of lst) 
    {
      const code = v.querySelector('code');
      if (!code)
        continue;

      const block = v.parentNode;
      const dd_el = block.querySelector('#code_type');
      if (dd_el)
        continue;

      block.insertBefore(DOM.htmlToElements(dropDown_openperplex)[0], v);
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
        block.insertBefore(DOM.htmlToElements(dropDown_huggingface)[0], v);
    }
  }

  function scan_code_you()
  {
    const lst = document.querySelectorAll('div#ydc-content-area  div[data-testid="youchat-code"] pre');
    for(const v of lst) 
    {
      const block = v.parentNode?.parentNode;

      const dd_el = block.querySelector('#code_type');
      if (dd_el)
        continue;

      const btn = block?.querySelector('div > button')?.parentNode;
      if (btn)
        btn.parentNode.insertBefore(DOM.htmlToElements(dropDown_you)[0], btn);
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

  function scan_code_grok()
  {
    const lst = document.querySelectorAll('main pre > code');
    for(const v of lst) 
    {
      const block = v.parentNode.parentNode;
      const dd_el = block.querySelector('#code_type');
      if (dd_el)
        continue;

      const btn_copy = block.querySelector('div > button');
      if (btn_copy) {
        const btn_block = btn_copy.parentNode.closest('div'); 
        btn_block.insertAdjacentHTML('afterbegin', dropDown_grok);
        btn_block.style['display']='flex';
        btn_block.style['flex-flow']='row';
        btn_block.style['justify-content']='space-between';
      }
    }
  }

  function scan_code_groq_chat()
  {
    const lst = document.querySelectorAll('main pre > code');
    for(const v of lst) 
    {
      const block = v.parentNode.parentNode;
      const dd_el = block.querySelector('#code_type');
      if (dd_el)
        continue;
      
      block.insertAdjacentHTML('afterbegin', dropDown_groq_chat);
    }
  }

  function scan_code_deepseek()
  {
    const lst = document.querySelectorAll('pre');
    for(const v of lst) 
    {
      const block = v.parentNode;
      const dd_el = block.querySelector('#code_type');
      if (dd_el)
        continue;

      const el = block.querySelector('div > div > div:last-child > div:first-child');
      if (el)
        el.insertAdjacentHTML('afterend', dropDown_deepseek);
    }
  }

  function scan_code_qwen()
  {
    const lst = document.querySelectorAll('div[id^="code-textarea-"]');
    for(const v of lst) 
    {
      const block = v.parentNode.parentNode.parentNode;
      const dd_el = block.querySelector('#code_type');
      if (dd_el)
        continue;

      block.insertAdjacentHTML('afterbegin', dropDown_qwen);
    }
  }

  function scan_code_cerebras()
  {
    const lst = document.querySelectorAll('div[data-testid$="-code-block"]');
    for(const v of lst) 
    {
      const block = v.parentNode;
      const dd_el = block.querySelector('#code_type');
      if (dd_el)
        continue;

      block.insertAdjacentHTML('afterbegin', dropDown_cerebras);
    }
  }

  function scan_code_allenai()
  {
    const lst = document.querySelectorAll('main pre code');
    for(const v of lst) 
    {
      const block = v.parentNode.parentNode;
      const dd_el = block.parentNode.querySelector('#code_type');
      if (dd_el)
        continue;

      block.insertAdjacentHTML('beforebegin', dropDown_allenai);
    }
  }
  
  function scan_code_github()
  {
    const lst = document.querySelectorAll('main pre code');
    for(const v of lst) 
    {
      const block = v.parentNode.parentNode.parentNode;
      const dd_el = block.parentNode.querySelector('#code_type');
      if (dd_el)
        continue;
      const title = block.querySelector('figcaption');
      title.insertAdjacentHTML('beforeend', dropDown_github);
    }
  }

  
  var gMutationObserver = new MutationObserver(debounce((v) => {
      if (g_top) {
        if (g_chat_id === 'ch_openai') 
          scan_code_openai();
        else if (g_chat_id === 'ch_openai_play') 
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
        setInterval(scan_code_openai, 5*1000);
      }
      else if (g_chat_id === 'ch_openai_play') {
        scan_code_openai_play();
        setInterval(scan_code_openai_play, 5*1000);
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
      else if (g_chat_id === 'ch_claude_artifacts') {
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
        setInterval(scan_code_perplexity, 5*1000);
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
        setInterval(scan_code_you, 3*1000);
      }
      else if (g_chat_id === 'ch_meta') {
        scan_code_mistral();
        g_top = document.querySelector('body');
        setInterval(scan_code_meta, 3*1000);
      }
      else if (g_chat_id === 'ch_openperplex') {
        scan_code_openperplex();
        g_top = document.querySelector('body');
        setInterval(scan_code_openperplex, 3*1000);
      }
      else if (g_chat_id === 'ch_grok') {
        scan_code_grok();
        g_top = document.querySelector('body');
        setInterval(scan_code_grok, 3*1000);
      }
      else if (g_chat_id === 'ch_groq_chat') {
        scan_code_groq_chat();
        g_top = document.querySelector('body');
        setInterval(scan_code_groq_chat, 3*1000);
      }
      else if (g_chat_id === 'ch_qwen') {
        scan_code_qwen();
        g_top = document.querySelector('body');
        setInterval(scan_code_qwen, 3*1000);
      }
      else if (g_chat_id === 'ch_cerebras') {
        scan_code_cerebras();
        g_top = document.querySelector('body');
        setInterval(scan_code_cerebras, 3*1000);
      }
      else if (g_chat_id === 'ch_deepseek') {
        scan_code_deepseek();
        g_top = document.querySelector('body');
        setInterval(scan_code_deepseek, 3*1000);
      }
      else if (g_chat_id === 'ch_allenai') {
        scan_code_allenai();
        g_top = document.querySelector('body');
        setInterval(scan_code_allenai, 3*1000);
      }
      else if (g_chat_id === 'ch_github') {
        scan_code_github();
        g_top = document.querySelector('body');
        setInterval(scan_code_github, 3*1000);
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
    if (location.host==='chat.openai.com' || location.host==='chatgpt.com')
      return 'ch_openai';
    else if (location.href.startsWith('https://platform.openai.com/playground'))
      return 'ch_openai_play';
    else if (location.href.startsWith('https://copilot.microsoft.com'))
      return 'ch_copilot';
    else if (location.href.startsWith('https://claude.ai/chat'))
      return 'ch_claude';
    else if (location.href.startsWith('https://claude.site/artifacts'))
      return 'ch_claude_artifacts';
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
    else if (location.href.startsWith('https://openperplex.com'))
      return 'ch_openperplex';
    else if (location.href.startsWith('https://x.com/i/grok'))
      return 'ch_grok';
    else if (location.href.startsWith('https://chat.groq.com'))
      return 'ch_groq_chat';
    else if (location.href.startsWith('https://chat.deepseek.com/'))
      return 'ch_deepseek';
    else if (location.href.startsWith('https://chat.qwenlm.ai/'))
      return 'ch_qwen';
    else if (location.href.startsWith('https://inference.cerebras.ai/'))
      return 'ch_cerebras';
    else if (location.href.startsWith('https://playground.allenai.org/'))
      return 'ch_allenai';
    else if (location.href.startsWith('https://github.com/marketplace/models/'))
      return 'ch_github';

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

    if (g_chat_id === 'ch_openai' || g_chat_id === 'ch_openai_play' 
       || g_chat_id === 'ch_copilot' 
       || g_chat_id === 'ch_claude' || g_chat_id === 'ch_claude_artifacts' 
       || g_chat_id === 'ch_gemini'
       || g_chat_id === 'ch_perplexity_labs' || g_chat_id === 'ch_perplexity' 
       || g_chat_id === 'ch_mistral' 
       || g_chat_id === 'ch_huggingface'
       || g_chat_id === 'ch_you' 
       || g_chat_id === 'ch_meta'
       || g_chat_id === 'ch_grok' 
       || g_chat_id === 'ch_groq_chat' 
       || g_chat_id === 'ch_deepseek' 
       || g_chat_id === 'ch_qwen' 
       || g_chat_id === 'ch_cerebras' 
       || g_chat_id === 'ch_allenai'
       || g_chat_id === 'ch_github'
       || g_chat_id == 'ch_openperplex')
      handle_chat_code();

    await init_prompt_inject();

    if (g_prompt_id && g_prompt_set) {
      handle_chat_prompt();

      window.onbeforeunload = function () 
      {
        // unregister chat in background
        try {
          Browser.api.runtime.sendMessage({cmd:"gpt_window_unreg"});
        } catch(_) {}

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