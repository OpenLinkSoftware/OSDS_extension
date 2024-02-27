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
    this.tab = null; //chatTab = null;
    this.chatTabSrv = null;
    this.waited_ask = null;
    this.timeout = 3000
    this.prompt_id = null;
    this.prompt_url = null;
    this.setting = new Settings();
  }

  async load_settings()
  {
    this.prompt_id = await this.setting.getValue('ext.osds.chat-srv');
    try {
      const s = await this.setting.getValue('ext.osds.def_prompt_inject')
      const chat_list = JSON.parse(s);
      const v = chat_list[this.prompt_id];
      if (v['url'])
      {
        this.prompt_url = v['url']
      } else {
        this.prompt_url = null;
      }
    } catch(e) {
      this.prompt_id = null;
    }
  }

  reg_chat_window(tab, chat_id)
  {
    if (chat_id !== this.prompt_id)
      return;

    this.tab = tab;
    //send tabId, winId back to Chat Window
    Browser.api.tabs.sendMessage(tab.id, {cmd:"gpt_win_tab", tabId:tab.id, winId:tab.windowId});

    if (this.waited_ask) {
      this.activateChatWin(tab, this.waited_ask)
      this.waited_ask = null;
    }
  }

  unreg_chat_window(tab)
  {
    if (this.tab && this.tab.id === tab.id) {
      this.tab = null;
      this.waited_ask = null
    }
  }

  async activateChatWin(tab, ask)
  {
    this.tab = tab

    if (Browser.is_ff) {
      await Browser.api.windows.update(tab.windowId, {focused: true});
      await Browser.api.tabs.update(tab.id, {active: true});
    } 
    else {
      Browser.api.windows.update(tab.windowId, {focused: true}, (window) => {
        Browser.api.tabs.update(tab.id, {active: true})
      })
    }

    if (this.timeout > 0)
      await sleep(this.timeout);

    const model = await this.setting.getValue('ext.osds.gpt-model');
    var max_len = parseInt(await this.setting.getValue('ext.osds.gpt-tokens'), 10);
    if (max_len == 0)
      max_len = 4096;
  
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
    {
      const pattern_len = gpt3encoder.countTokens(prompt_query);
      var txt_encoded = gpt3encoder.encode(text);

      if (pattern_len + txt_encoded.length > max_len) {
        const len = Math.max(1, max_len - pattern_len);
        txt_encoded.splice(len);
        text = gpt3encoder.decode(txt_encoded);
      }
    }

    prompt_query = prompt_query.replace("{selected_text}", text);

    Browser.api.tabs.sendMessage(tab.id, {cmd:"gpt_prompt", text:prompt_query});
  }


  async openChatWin()
  {
    if (this.prompt_id && this.prompt_url) {
      // Open GPT window
      if (Browser.is_ff)
        Browser.api.tabs.create({url:this.prompt_url});
      else
        window.open(this.prompt_url);
    }
  }


  askChatGPT(ask, tab, mode) 
  {
    const self = this;
    ask["mode"] = mode;

    if (this.chatTabSrv && this.chatTabSrv !== this.prompt_id) {
      this.chatTabSrv = null;
      this.tab = null;
    }

    function handle_resp(resp)
    {
      if (resp && resp.ping === 1 && resp.chat_id === self.prompt_id) {
        // GPT window opened
        if (resp.winId && resp.tabId) {
          self.activateChatWin({windowId:resp.winId, id:resp.tabId}, ask);
        }
        else {
          self.waited_ask = ask;
          self.openChatWin();
        }
      }
      else {
        self.waited_ask = ask;
        self.openChatWin();
      }
    }
  
    if (this.tab && this.tab.id) {
      if (Browser.is_ff)
        Browser.api.tabs.sendMessage(this.tab.id, {cmd:"gpt_ping"})
          .then(resp => { handle_resp(resp)})
          .catch(err => {
            console.log(err);
          });
      else
        Browser.api.tabs.sendMessage(this.tab.id, {cmd:"gpt_ping"}, handle_resp);
    }
    else {
      this.waited_ask = ask;
      this.openChatWin();
    }
  }


  askChatGPT_selection(info, tab) 
  {
    // send text to ChatService
    this.askChatGPT({text:info.selectionText, url:info.pageUrl}, tab, 'selection');
  }

  askChatGPT_page_content(info, tab) 
  {
    const self = this;

    function handle_resp(resp)
    {
      // content received send it to ChatService
      if (resp && resp.page_content) {
        self.askChatGPT({text:resp.page_content, url:info.pageUrl}, tab, 'content');
      }
    }

    // request page content from page content script
    if (Browser.is_ff)
      Browser.api.tabs.sendMessage(tab.id, {cmd:"page_content"})
        .then(resp => { handle_resp(resp)})
        .catch(err => {
          console.log(err);
        });
    else
      Browser.api.tabs.sendMessage(tab.id, {cmd:"page_content"}, handle_resp);
  }
}
