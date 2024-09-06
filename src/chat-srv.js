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

class ChatService {
  constructor() 
  {
    this.tab = {};
    this.chatTabSrv = null;
    this.waited_ask = null;
    this.timeout = 3000
    this.prompt_id = null;
    this.prompt_url = null;
    this.prompt_in_new_window = false;
    this.setting = new Settings();
  }

  async saveState() 
  {
    const v = {
      id: this.tab ? this.tab.id : '',
      winId: this.tab ? this.tab.winId : ''
    }
    try {
      await this.setting.setValue('g.ChatTab', JSON.stringify(v));
      await this.setting.setValue('g.ChatTabAsk', JSON.stringify(this.waited_ask || ''));
    } catch(_) {
    }
  }

  async loadState()
  {
    try {
      var v = await this.setting.getValue('g.ChatTab');
      if (v)
        this.tab = JSON.parse(v);

      v = await this.setting.getValue('g.ChatTabAsk');
      if (v)
        this.waited_ask = JSON.parse(v);
      else
        this.waited_ask = null;
    } catch(_) {
    }
  }

  async load_settings()
  {
    this.prompt_id = await this.setting.getValue('ext.osds.chat-srv');
    try {
      const s = await this.setting.getValue('ext.osds.def_prompt_inject')
      const chat_list = JSON.parse(s);
      const v = chat_list[this.prompt_id];
      if (!v) {
        alert('Error:\n Could not find "'+this.prompt_id+'" item in new LLM Server\'s settings!\n Update value for "Chat Service" in settings')
        return;
      }
      this.prompt_url = v['url'] ? v['url'] : null;
      this.prompt_in_new_window = v['prompt_in_new_window'] ? v['prompt_in_new_window'] : false;
    } catch(e) {
      console.log(e);
      this.prompt_id = null;
    }
    await this.loadState();
  }

  async reg_chat_window(tab, chat_id)
  {
    if (chat_id !== this.prompt_id)
      return;

    this.tab = {'id': tab.id, 'winId': tab.windowId};
    await this.saveState();
    //send tabId, winId back to Chat Window
    Browser.api.tabs.sendMessage(this.tab.id, {cmd:"gpt_win_tab", tabId:this.tab.id, winId:this.tab.winId});

    if (this.waited_ask) {
      this.activateChatWin(tab, this.waited_ask)
      this.waited_ask = null;
      await this.saveState();
    }
  }

  async unreg_chat_window(tab)
  {
    if (this.tab && this.tab.id === tab.id) {
      this.tab = {};
      this.waited_ask = null
      await this.saveState();
    }
  }

  async activateChatWin(tab, ask)
  {
    this.tab = {'id': tab.id, 'winId': tab.windowId};
    await this.saveState();

    if (Browser.is_ff || Browser.is_chrome_v3) {
      await Browser.api.windows.update(this.tab.winId, {focused: true});
      await Browser.api.tabs.update(this.tab.id, {active: true});
    } 
    else {
      Browser.api.windows.update(this.tab.winId, {focused: true}, (window) => {
          Browser.api.tabs.update(this.tab.id, {active: true})
      })
    }

    if (this.timeout > 0)
      await sleep(this.timeout);

    const model = await this.setting.getValue('ext.osds.gpt-model');
    var max_len = parseInt(await this.setting.getValue('ext.osds.gpt-tokens'), 10);
    if (max_len == 0)
      max_len = 32000;
  
    ///gpt-35 max_tokens = 4096
    // gpt4 max-tokens = 8192  // 32768
    const myprompt = await this.setting.getValue('ext.osds.prompt');

    var prompt_query = this.setting.def_prompt_query_jsonld;

    if (myprompt) {
      if (myprompt.myid === 'jsonld')
        prompt_query = this.setting.def_prompt_query_jsonld;
      else if (myprompt.myid === 'turtle')
        prompt_query = this.setting.def_prompt_query_turtle;
      else if (myprompt.text && myprompt.text.length > 1)
        prompt_query = myprompt.text;
    }

    prompt_query = prompt_query.replace("{page_url}", ask.url);
    var text = ask.text; 

    if (prompt_query.length + text.length > max_len) 
      text = text.substring(0, Math.max(1, max_len - prompt_query.length));

    prompt_query = prompt_query.replace("{selected_text}", text);

    Browser.api.tabs.sendMessage(tab.id, {cmd:"gpt_prompt", text:prompt_query});
  }


  async openChatWin()
  {
    if (this.prompt_id && this.prompt_url) {
      // Open GPT window
      Browser.createTab(this.prompt_url);
    }
  }


  async askChatGPT(ask, tab, mode) 
  {
    const self = this;
    ask["mode"] = mode;

    await this.load_settings();

    if (this.chatTabSrv && this.chatTabSrv !== this.prompt_id) {
      this.chatTabSrv = null;
      this.tab = {};
      await this.saveState();
    }

    async function new_llm_win() {
      self.waited_ask = ask;
      await self.saveState();
      self.openChatWin();
    }

    async function handle_resp(resp)
    {
      if (Browser.api.runtime.lastError) {
        new_llm_win();
        return;
      }

      if (resp && resp.ping === 1 && resp.chat_id === self.prompt_id) {

        // GPT window opened
        if (!self.prompt_in_new_window && resp.winId && resp.tabId) {
          self.activateChatWin({windowId:resp.winId, id:resp.tabId}, ask);
        }
        else {
          self.waited_ask = ask;
          await this.saveState();
          self.openChatWin();
        }
      }
      else {
        self.waited_ask = ask;
        await this.saveState();
        self.openChatWin();
      }
    }
  
    if (this.tab && this.tab.id) {
      if (Browser.is_ff || Browser.is_chrome_v3) {
        try {
          const resp = await Browser.api.tabs.sendMessage(this.tab.id, {cmd:"gpt_ping"});
          handle_resp(resp);
        } catch(ex) {
          console.log(ex);
          new_llm_win();
        }
      }
      else {
        try {
          Browser.api.tabs.sendMessage(this.tab.id, {cmd:"gpt_ping"}, handle_resp);
        } catch(ex) {
          console.log(ex);
        }
      }
    }
    else {
      new_llm_win();
    }
  }


  askChatGPT_selection(info, tab) 
  {
    // send text to ChatService
    this.askChatGPT({text:info.selectionText, url:info.pageUrl}, tab, 'selection');
  }

  async askChatGPT_page_content(info, tab) 
  {
    const self = this;
    let page_text = "";

    function handle_frames(rc)
    {
      if (rc && rc.length > 0)
        self.askChatGPT({text:rc.join('\n'), url:info.pageUrl}, tab, 'content');
      else
        self.askChatGPT({text:page_text, url:info.pageUrl}, tab, 'content');
    }

    async function scan_frames()
    {
      if (Browser.is_chrome_v3 || Browser.is_ff_v3) {
        let frames = await Browser.api.scripting.executeScript({ 
                      target: {tabId: tab.id, allFrames:true},
                      injectImmediately: true,  
                      files: ['frame_scan.js']
                    });
        let lst = [];
        for(var v of frames)
          lst.push(v.result);
        handle_frames(lst);
      }
      else
        Browser.api.tabs.executeScript(tab.id, {file:"frame_scan.js", allFrames:true, runAt: 'document_start'}, handle_frames);
    }

    async function handle_resp(resp)
    {
      if (Browser.api.runtime.lastError)
        return;
      // content received send it to ChatService
      if (resp && resp.page_content) {
        if (resp.dom && resp.dom===1 && resp.frames>0) {
          page_text = resp.page_content;
          await scan_frames();
        }
        else
          self.askChatGPT({text:resp.page_content, url:info.pageUrl}, tab, 'content');

      }
    }

    // request page content from page content script
    if (Browser.is_ff || Browser.is_chrome_v3)
      Browser.api.tabs.sendMessage(tab.id, {cmd:"page_content"})
        .then(resp => { handle_resp(resp)})
        .catch(err => {
          console.log(err);
        });
    else
      Browser.api.tabs.sendMessage(tab.id, {cmd:"page_content"}, handle_resp);
  }
}
