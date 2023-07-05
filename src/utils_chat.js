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


//  req = "how to create blink animation css ?";
class ChatUI {
  constructor(_chat_lst) 
  {
    this.models = [];
    this.chat_is_working = false;
    this.chat_cancelled = false;
    this.history_offset = 0;
    this.history_len = 0;
    this.chat = new chat_gpt();
    this.last_sid = null;
    this.chat_lst = _chat_lst;
    this.id = 1;
    const self = this;
    this.md = markdownit({
      html:         true,
      xhtmlOut:     true,
      breaks:       true,
      langPrefix:   'language-',  // CSS language prefix for fenced blocks. Can be
                              // useful for external highlighters.
      linkify:      true,        // Autoconvert URL-like text to links

      typographer:  false,

  // Double + single quotes replacement pairs, when typographer enabled,
  // and smartquotes on. Could be either a String or an Array.
  //
  // For example, you can use '«»„“' for Russian, '„“‚‘' for German,
  // and ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] for French (including nbsp).
      quotes: '“”‘’',

      highlight: function (str, lang) {
         if (lang && hljs.getLanguage(lang)) {
           try {
             return '<pre class="hljs"><code>' +
                     hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
                   '</code></pre>';
           } catch (__) {}
         }

         return '<pre class="hljs"><code>' + self.md.utils.escapeHtml(str) + '</code></pre>';
       }
     });
  }

  _create_code_block_html(str, type)
  {
    var v = 
     `<div class="chat_code">`;

    if (type && type==='code')
      v += `<div class="code_header5">`;
    else
      v += `<div class="code_header">
           <span id="copied" class="hidden">Copied!&nbsp;&nbsp;</span>
           <button id="copy_code"><img class="img20" src="images/copy-icon.svg"/>Copy code</button>
           <SELECT id="code_type" >
                 <OPTION id="none" selected></OPTION>
                 <OPTION id="turtle">RDF-Turtle</OPTION>
                 <OPTION id="jsonld">JSON-LD</OPTION>
                 <OPTION id="json">JSON</OPTION>
                 <OPTION id="csv">CSV</OPTION>
                 <OPTION id="rdfxml">RDF/XML</OPTION>
               </SELECT>
           <span>Data type:</span>
        </div>`;

    v += `<div class="code_block">${str}</div>
      </div>`
    return v;                              
  }

  
  _create_text_block_html(str)
  {
    var v = `<div class="chat_text">${str}</div>`;
    return v;                              
  }

  _parse_answer(str) 
  {
    var ret = [];
    var pos = 0;
    while(true) {
      var i = str.indexOf('```', pos);
      if (i == -1) {
        ret.push({type:'t', str: str.substring(pos)});
        break;
      }
      else {
        ret.push({type:'t', str: str.substring(pos, i)});
        pos = i;
        i = str.indexOf("```", i+3);
        if (i == -1) {
          ret.push({type:'c', str: str.substring(pos)});
          break;
        }
        else {
          ret.push({type:'c', str: str.substring(pos, i+3)});
          pos = i + 3;
        }
      }
    }
    return ret;
  }

  _create_msg_html(text, id) 
  {
    var v = 
     `<div class="chat_item">
        <div class="chat_left"> 
        </div> 
        <div id="${id}" class="chat_center">
         <p style="color:red;"> ${DOMPurify.sanitize(text)}
         </p>
        </div>
        <div class="chat_right"> 
        </div>
      </div>`;
    return v;
  }

  _create_question_html(text, id) 
  {
    var v = 
     `<div class="chat_item">
        <div class="chat_left"> 
          <input type="image"src="images/person-icon.svg" width="20" height="20" > 
        </div> 
        <div id="${id}" class="chat_center"> ${text}
        </div>
        <div class="chat_right"> 
        </div>
      </div>`;
    return v;
  }

  _create_plugin_html(text, id, type, name) 
  {
    var text = this._create_ai_html(`- ${name}\n` + text, type);

    var v = 
     `<div class="chat_item chat_item_plugin">
        <div class="chat_left"> 
          <input type="image"src="images/robot.svg" width="24" height="24" > 
        </div> 
        <div id="${id}" class="chat_center">
          ${text}
        </div>
      </div>`;
    return v;
  }

  
  _create_answer_html(text, id, type) 
  {
    var text = this._create_ai_html(text, type);
    var v = 
     `<div class="chat_item ${type==='code'?'chat_item_plugin':'chat_item_ai'}">
        <div class="chat_left"> 
          <input type="image"src="images/chat.png" width="24" height="24" > 
        </div> 
        <div id="${id}" class="chat_center">
          ${text}
        </div>`;
    if (type!=='code')
      v += `<div class="chat_right"> 
          <input id="thumb_up" type="image" src="images/thumb-up.png" width="20" height="20" > 
          <input id="thumb_down" type="image" src="images/thumb-down.png" width="20" height="20" > 
        </div>`;

    v += `</div>`;
    return v;
  }

  
  _create_ai_html(str, type)
  {
    var block = [];
    var lst = this._parse_answer(str);

    for(const i of lst) {
      if (i.type === 'c') // text
        block.push( this._create_code_block_html(DOMPurify.sanitize(this.md.render(i.str)), type) ) 
      else
        block.push( this._create_text_block_html(DOMPurify.sanitize(this.md.render(i.str))) ) 
    }
  
    return block.join('\n');
  }

  
  append_question(str, disable_scroll)
  {
    var sid = 'ch_q_'+this.id++;

    var s = this._create_question_html(DOMPurify.sanitize(this.md.render(str)), sid);
    var el = DOM.htmlToElement(s);

    this.chat_lst.appendChild(el); 
    this._update_scroll();
  }

  
  append_msg(str)
  {
    var sid = 'ch_q_'+this.id++;
    var s = this._create_msg_html(str, sid);
    var el = DOM.htmlToElement(s);

    this.chat_lst.appendChild(el); 
    this._update_scroll();
  }

  
  append_ai(str, disable_scroll, type)
  {
    var sid = 'ch_ai_'+this.id++;
    var s = this._create_answer_html(str, sid, type);
    var el = DOM.htmlToElement(s);

    this.chat_lst.appendChild(el); 
    this.last_sid = sid;
    this._update_scroll(disable_scroll);
  }

  
  append_plugin(str, disable_scroll, type, name)
  {
    var sid = 'ch_plugin_'+this.id++;
    var s = this._create_plugin_html(str, sid, type, name);
    var el = DOM.htmlToElement(s);

    this.chat_lst.appendChild(el); 
    this.last_sid = sid;
    this._update_scroll(disable_scroll);
  }

  
  update_ai(str, conversation_id, message_id, disable_scroll, type)
  {
    if (this.last_sid) {
      var el = DOM.qSel("div#"+this.last_sid+".chat_center");
      el.conversation_id = conversation_id;
      el.message_id = message_id;
      if (el) {
        el.innerHTML = this._create_ai_html(str, type);
      }
    }
    this._update_scroll(disable_scroll);
  }

  
  async end_ai(is_new)
  {
    const self = this;
    this.last_sid = null;
    var lst = DOM.qSelAll('.code_header button#copy_code');
    for(var el of lst) {
      el.onclick = (e) => {
        var block = e.target.closest('div.chat_code');
        var code = block.querySelector('div.code_block');
        if (code) {
          navigator.clipboard.writeText(code.textContent).then(() => {
              const btn = e.target.closest('#copy_code');
              const copied = block.querySelector("#copied");
              DOM.Hide(btn);
              DOM.Show(copied);

              setTimeout(() => { 
                  DOM.Hide(copied);
                  DOM.Show(btn);
               }, 2000);
            }, 
            () => { /* failed */ });
        }
      }
    }

    lst = DOM.qSelAll('.chat_item_ai input#thumb_up');
    for(var el of lst) {
      el.onclick = (e) => {
        self._feedback_up(e.target);
      }
    }

    lst = DOM.qSelAll('.chat_item_ai input#thumb_down');
    for(var el of lst) {
      el.onclick = (e) => {
        self._feedback_down(e.target);
      }
    }

    if (is_new) {
      if (this.chat_cancelled)
        await sleep(5000);

      await this.reqNewTitle();
      await this.load_history(false, 0);
      this._mark_cur_title(this.chat.getConversationId());
      DOM.iSel('conversations').scrollTo(1,1);
    }
  }

  
  _feedback_up(v) 
  {
    const chat_item = v.closest('div.chat_item_ai');
    var ans;
    const self = this;

    if (chat_item) 
      ans = chat_item.querySelector('div.chat_center');

    $( "#thumb_up-dlg" ).dialog({
      resizable: true, width:380, height:330, modal: true,
      buttons: {
        "Submit feedback": function() {
            var _text = DOM.qSel('#thumb_up-dlg #msg').value;

            self._send_feedback(v, ans.message_id || '', ans.conversation_id || '', 'thumbsUp', _text, []);
            $(this).dialog('destroy');
        }
      }
    });
  } 

  
  _feedback_down(v) 
  {
    const chat_item = v.closest('div.chat_item_ai');
    var ans;
    const self = this;

    if (chat_item) 
      ans = chat_item.querySelector('div.chat_center');

    $( "#thumb_down-dlg" ).dialog({
      resizable: true, width:380, height:380, modal: true,
      buttons: {
        "Submit feedback": function() {
            var _text = DOM.qSel('#thumb_down-dlg #msg').value;
            var _tags = [];
            
            if (DOM.qSel('#thumb_down-dlg #down_harmful').checked)
               _tags.push('harmful');
            if (DOM.qSel('#thumb_down-dlg #down_false').checked)
               _tags.push('false');
            if (DOM.qSel('#thumb_down-dlg #down_not_helpful').checked)
               _tags.push('not-helpful');

            self._send_feedback(v, ans.message_id || '', ans.conversation_id || '', 'thumbsDown', _text, _tags);
            $(this).dialog('destroy');
         }
      }
    });
  } 
                                                                                        
  
  async _send_feedback(el, message_id, conversation_id, rating, msg, tags)
  {
    const {accessToken, ok} = await this.chat.getAccessToken();
    if (!ok || !accessToken)
      return;

    var content = '{}';
    var payload = {message_id, conversation_id, rating, content};

    if (this.chat.user_id)
      payload['user_id'] = this.chat.user_id;

    if (msg) {
      var v = {};
      v['text'] = msg;
      v['tags'] = tags;
      payload.content = JSON.stringify(v);
    }

    var options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload)
    }

    try {
//      console.log(options);
      var rc = await fetch('https://chat.openai.com/backend-api/conversation/message_feedback', options);
      if (rc.ok) {
        el.classList.add(rating === 'thumbsUp' ? 'thumbUp' : 'thumbDown');
      }
    } catch(e) {
    }
  }

  
  _update_scroll(disable_scroll)
  {
    if (disable_scroll)
      return;

    const v = this.chat_lst.scrollHeight
    this.chat_lst.scrollTo(1,v);
  }


  _create_chat_title_html(id, title)
  {
    return `<td><span cid="${id}" class="btn_msg_chat"><input type="image" class="image_btn" src="images/message.svg"> ${title}</span></td>`
  }


  _update_hist_list(v, offset)
  {
    var self = this;
    var tbody = DOM.qSel('tbody#history_list');

    if (offset === 0)
      tbody.innerHTML = '';

    for(var i of v.items) {
      var row = tbody.insertRow(-1);
      const sel = (i.id === this.chat.getConversationId()); 

      row.innerHTML = this._create_chat_title_html(i.id, i.title);
      row.onclick = (e) => { self._load_conversation(e.target); }

      if (sel)
        row.querySelector('td > span').classList.add('btn_selected');
    }
  }

  _add_new_title2list(id, title)
  {
    var self = this;
    var tbody = DOM.qSel('tbody#history_list');

    for(var i of tbody.querySelectorAll('tr > td > span'))
      i.classList.remove('btn_selected');

    var row = tbody.insertRow(0);
    row.innerHTML = this._create_chat_title_html(id, title);
    row.onclick = (e) => { self._load_conversation(e.target); }
    row.querySelector('td > span').classList.add('btn_selected');
  }

  _mark_cur_title(id)
  {
    var lst = DOM.qSelAll('tbody#history_list > tr > td > span');

    for(var i of lst) {
      var cid = i.attributes.cid;
      if (cid && cid.value === id)
        i.classList.add('btn_selected');
      else
        i.classList.remove('btn_selected');
    }
  }


  _startThrobber()
  {
    DOM.qShow("#chat_throbber");
    DOM.iSel('chat_send').disabled = true
  }
  _endThrobber()
  {
    DOM.qHide("#chat_throbber");
    DOM.iSel('chat_send').disabled = false
    DOM.qHide('#chat_stop');
  }

  selectModel(m)
  {
    var found = false;
    for(const model of this.models) 
      if (model.slug === m)
        found = true;

    if (found) {
      this.chat.setModel(m);
      const el = DOM.qSel(`#model option[value="${m}"]`);
      if (el)
        el.selected = true;
    }
  }

  selectDefModel()
  {
    this.chat.setModel(null);
    this.selectModel(this.chat.getModel());
  }

  enableModelList(v)
  {
    if (v)
      DOM.qSel('#model').disabled = false;
    else
      DOM.qSel('#model').disabled = true;
  }

  updateModelList(list)
  {
    this.models = list;
    const sel = DOM.iSel('model');

    sel.innerHTML = '';
    for(const i of this.models) {
        var opt = document.createElement('option');
        opt.id = i.slug;
        opt.value = i.slug;
        if (i.title.toLowerCase().indexOf('gpt')!=-1)
           opt.text = i.title; //'Def(GPT-3.5)';
        else
           opt.text = i.title + ' ( '+ i.tags.join(', ')+' )';
        sel.appendChild(opt);
    }

  }


  async _load_conversation(el) 
  {
    this._startThrobber()
    DOM.iSel('chat_req').value = '';

    try {
      const cid = el.attributes.cid.value;
      if (!cid)
        return;

      var rc = await this.chat.loadConversation(cid);
      if (rc.ok) {
        const list = rc.data.list;

        this.chat_lst.innerHTML = '';
        this.chat.setConversationId(cid);
        this.chat.setParentId(null);
        this.selectModel(rc.data.model);

        for(const m of list) {
          this.chat.setParentId(m.id);
          if (m.role === 'user')  {
            this.append_question(m.text, true);
          }
          else if (m.role === 'assistant') {
            this.append_ai(m.text, true, m.type);
            this.update_ai(m.text, cid, m.id, true, m.type);
          }
          else if (m.role === 'tool') {
            this.append_plugin(m.text, true, m.type, m.name);
          }
        }

        this._mark_cur_title(cid);
        this.chat_lst.scrollTo(1,1);
        this.enableModelList(false);
      }
    } catch(e) {
      console.log('ERR==>'+e);
    } finally {
      this._endThrobber();
      this.end_ai();
    }
  }


  async load_history(show_throbber, s, e)
  {
    var accessToken, ok;
    var offset = s || 0;
    var limit = e || 100;

    if (show_throbber)
       this._startThrobber()

    try {
      ({accessToken, ok} = await this.chat.getAccessToken());
    } catch(e) {
      console.log(e);
    }

    if (!ok || !accessToken) {
      this._endThrobber();
      this.append_msg(" --- Send query againg after the Relogin --- \n");
      Browser.openTab("https://chat.openai.com/auth/login");
      this.end_ai();
      return 0;
    }

    try {
      const rc = await this.chat.checkAccount()
      if (!rc.ok) {
        this._endThrobber();
        this.append_msg(` --- Could not load account info, try again later :${rc.message} --- \n`);
        return 0;
      }
      this.account_plan = rc.account_plan;
    } catch(e) {
      this._endThrobber();
      console.log(e);
    }

    try {
      const rc = await this.chat.getModels()
      if (!rc.ok) {
        this._endThrobber();
        this.append_msg(` --- Could not load list of supported models :${rc.message} --- \n`);
        return 0;
      }

      this.updateModelList(rc.models);
      this.enableModelList(this.models.length > 1);
    } catch(e) {
      this._endThrobber();
      console.log(e);
    }

    try {
      const rc = await this.chat.loadConversationsList(offset, limit);
      if (rc.ok && rc.data) {
        this._update_hist_list(rc.data, offset);
        this.history_offset = rc.data.offset;
        this.history_len = rc.data.items.length;
      }
    } catch(e) {
      this._endThrobber();
      console.log(e);
    } finally {
      if (show_throbber)
        this._endThrobber()
    }

    return 1;
  }


  async load_history_more()
  {
     await thisload_history(true, this.history_offset+this.history_len);
  }

  async reqNewTitle()
  {
    var accessToken, ok;
    const conversation_id = this.chat.getConversationId();
    const message_id = this.chat.getParentId();

    this._startThrobber()

    try {
      ({accessToken, ok} = await this.chat.getAccessToken());
    } catch(e) {
      console.log(e);
    }

    if (!ok || !accessToken)
      return;

    try {
      var rc = await this.chat.genTitle(conversation_id, message_id);
      if (rc.ok && rc.title)
        this._add_new_title2list(conversation_id, rc.title);
       
    } catch(e) {
      console.log(e);
    } finally {
      this._endThrobber();
    }
  }


  async exec()
  {
    var accessToken, ok;

    const model = this.chat.getModel();
    if (model === 'gpt-4-browsing' || model === 'gpt-4-plugins' || model === 'gpt-4-mobile')
    {
      alert("Sending prompts for this model isn't supported yet.");
      return;
    }

    this._startThrobber();

    try {
      ({accessToken, ok} = await this.chat.getAccessToken());
    } catch(e) {
      this._endThrobber()
      console.log(e);
    }

    if (!ok || !accessToken) {
      this._endThrobber()
      this.append_msg(" --- Send query againg after the Relogin --- \n");
      Browser.openTab("https://chat.openai.com/auth/login");
      this.end_ai();
      return;
    }

    var req = DOM.iSel('chat_req').value ;
    if (!req) {
      this._endThrobber()
      return;
    }

    this.append_question(req);
    this.append_ai("\n");
    const new_chat = !this.chat.getConversationId();
    this.chat_is_working = true;
    this.chat_cancelled = false;
    DOM.qShow('#chat_stop');
    try {
      var answer = await this.chat.getAnswer(req, (data) => {
        if (data.text)
          this.update_ai(data.text, data.conversation_id, data.message_id);
      });

      this.update_ai(answer.text, answer.conversation_id, answer.message_id);

    } catch(e) {
      DOM.qHide('#chat_stop');
      this.chat_is_working = false;
      const s = e.message;
      this.end_ai(new_chat);
      this.append_msg(" "+s+"\n");
      if (s.startsWith("HTTP: 403"))  {
         this.append_msg(" --- Send query againg after the Relogin --- \n");
         Browser.openTab("https://chat.openai.com/auth/login");
      }
    } finally {
      DOM.qHide('#chat_stop');
      this.chat_is_working = false;
    }
    DOM.iSel('chat_req').value = '';
    this.enableModelList(false);
    await this.end_ai(new_chat);
    this._endThrobber()
  }

  stop_exec()
  {
    if (this.chat_is_working) {
      this.chat.stop_work();
      this.chat_cancelled = true;
    }
  }
  
  new_chat()
  {
    this.chat_lst.innerHTML = '';
    this.chat.newChat();
    this.selectDefModel();
    this.enableModelList(true);
  }



}

