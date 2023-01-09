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

  #create_code_block_html(str)
  {
    var v = 
     `<div class="chat_code">
        <div class="code_header">
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
        </div>
        <div class="code_block">${str}</div>
      </div>`
    return v;                              
  }

  
  #create_text_block_html(str)
  {
    var v = `<div class="chat_text">${str}</div>`;
    return v;                              
  }

  #parse_answer(str) 
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

  #create_msg_html(text, id) 
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

  #create_question_html(text, id) 
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

  #create_answer_html(text, id) 
  {
    var text = this.#create_ai_html(text);
    var v = 
     `<div class="chat_item chat_item_ai">
        <div class="chat_left"> 
          <input type="image"src="images/chat.png" width="24" height="24" > 
        </div> 
        <div id="${id}" class="chat_center">
          ${text}
        </div>
        <div class="chat_right"> 
          <input id="thumb_up" type="image" src="images/thumb-up.png" width="20" height="20" > 
          <input id="thumb_down" type="image" src="images/thumb-down.png" width="20" height="20" > 
        </div>
      </div>`;
    return v;
  }

  
  #create_ai_html(str)
  {
    var block = [];
    var lst = this.#parse_answer(str);

    for(const i of lst) {
      if (i.type === 'c') // text
        block.push( this.#create_code_block_html(this.md.render(i.str)) ) 
      else
        block.push( this.#create_text_block_html(this.md.render(i.str)) ) 
    }
  
    return block.join('\n');
  }

  
  append_question(str, disable_scroll)
  {
    var sid = 'ch_q_'+this.id++;

    var s = this.#create_question_html(this.md.render(str), sid);
    var el = DOM.htmlToElement(s);

    this.chat_lst.appendChild(el); 
    this.#update_scroll();
  }

  
  append_msg(str)
  {
    var sid = 'ch_q_'+this.id++;
    var s = this.#create_msg_html(str, sid);
    var el = DOM.htmlToElement(s);

    this.chat_lst.appendChild(el); 
    this.#update_scroll();
  }

  
  append_ai(str, disable_scroll)
  {
    var sid = 'ch_ai_'+this.id++;
    var s = this.#create_answer_html(str, sid);
    var el = DOM.htmlToElement(s);

    this.chat_lst.appendChild(el); 
    this.last_sid = sid;
    this.#update_scroll(disable_scroll);
  }

  
  update_ai(str, conversation_id, message_id, disable_scroll)
  {
    if (this.last_sid) {
      var el = DOM.qSel("div#"+this.last_sid+".chat_center");
      el.conversation_id = conversation_id;
      el.message_id = message_id;
      if (el) {
        el.innerHTML = this.#create_ai_html(str, conversation_id, message_id);
      }
    }
    this.#update_scroll(disable_scroll);
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
        self.#feedback_up(e.target);
      }
    }

    lst = DOM.qSelAll('.chat_item_ai input#thumb_down');
    for(var el of lst) {
      el.onclick = (e) => {
        self.#feedback_down(e.target);
      }
    }

    if (is_new) {
      await this.reqNewTitle();
      await this.load_history(false, 0);
      this.#mark_cur_title(this.chat.getConversationId());
      DOM.iSel('conversations').scrollTo(1,1);
    }
  }

  
  #feedback_up(v) 
  {
    const chat_item = v.closest('div.chat_item_ai');
    var ans;
    const self = this;

    if (chat_item) 
      ans = chat_item.querySelector('div.chat_center');

    $( "#thumb_up-dlg" ).dialog({
      resizable: true, width:380, height:280, modal: true,
      buttons: {
        "Submit feedback": function() {
            var _text = DOM.qSel('#thumb_up-dlg #msg').value;

            self.#send_feedback(v, ans.message_id || '', ans.conversation_id || '', 'thumbsUp', _text, []);
            $(this).dialog('destroy');
        }
      }
    });
  } 

  
  #feedback_down(v) 
  {
    const chat_item = v.closest('div.chat_item_ai');
    var ans;
    const self = this;

    if (chat_item) 
      ans = chat_item.querySelector('div.chat_center');

    $( "#thumb_down-dlg" ).dialog({
      resizable: true, width:380, height:350, modal: true,
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

            self.#send_feedback(v, ans.message_id || '', ans.conversation_id || '', 'thumbsDown', _text, _tags);
            $(this).dialog('destroy');
         }
      }
    });
  } 
                                                                                        
  
  async #send_feedback(el, message_id, conversation_id, rating, msg, tags)
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
      console.log(options);
      var rc = await fetch('https://chat.openai.com/backend-api/conversation/message_feedback', options);
      if (rc.ok) {
        el.classList.add(rating === 'thumbsUp' ? 'thumbUp' : 'thumbDown');
      }
    } catch(e) {
    }
  }

  
  #update_scroll(disable_scroll)
  {
    if (disable_scroll)
      return;

    const v = this.chat_lst.scrollHeight
    this.chat_lst.scrollTo(1,v);
  }


  #create_chat_title_html(id, title)
  {
    return `<td><span cid="${id}" class="btn_msg_chat"><input type="image" class="image_btn" src="images/message.svg"> ${title}</span></td>`
  }


  #update_hist_list(v, offset)
  {
    var self = this;
    var tbody = DOM.qSel('tbody#history_list');

    if (offset === 0)
      tbody.innerHTML = '';

    for(var i of v.items) {
      var row = tbody.insertRow(-1);
      const sel = (i.id === this.chat.getConversationId()); 

      row.innerHTML = this.#create_chat_title_html(i.id, i.title);
      row.onclick = (e) => { self.#load_conversation(e.target); }

      if (sel)
        row.querySelector('td > span').classList.add('btn_selected');
    }
  }

  #add_new_title2list(id, title)
  {
    var self = this;
    var tbody = DOM.qSel('tbody#history_list');

    for(var i of tbody.querySelectorAll('tr > td > span'))
      i.classList.remove('btn_selected');

    var row = tbody.insertRow(0);
    row.innerHTML = this.#create_chat_title_html(id, title);
    row.onclick = (e) => { self.#load_conversation(e.target); }
    row.querySelector('td > span').classList.add('btn_selected');
  }

  #mark_cur_title(id)
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


  #startThrobber()
  {
    $("#chat_throbber").show();
    DOM.iSel('chat_send').disabled = true
  }
  #endThrobber()
  {
    $("#chat_throbber").hide();
    DOM.iSel('chat_send').disabled = false
  }


  async #load_conversation(el) 
  {
    this.#startThrobber()
    DOM.iSel('chat_req').value = '';

    try {
      const cid = el.attributes.cid.value;
      if (!cid)
        return;

      var rc = await this.chat.loadConversation(cid);
      if (rc.ok) {
        const last = rc.data.current_node;
        const lst = rc.data.mapping;

        var cur_id;
        for(var key in lst) {
          var v = lst[key];
          if (!v.parent && !v.message && v.children.length > 0) 
            cur_id = v.id;
        }

        if (cur_id) {
          // start
          this.chat_lst.innerHTML = '';
          this.chat.setConversationId(cid);
          this.chat.setParentId(null);

          while(cur_id && lst[cur_id] !== null) 
          {
            var v = lst[cur_id];

            if (v.id)
              this.chat.setParentId(v.id);

            if (v.message) 
            {
              const m = v.message;
              if (m.content.content_type === 'text' && m.content.parts.length > 0) 
              {
                if (m.role === 'user') 
                  this.append_question(m.content.parts[0], true);
                else if (m.role === 'assistant') {
                  this.append_ai(m.content.parts[0], true);
                  this.update_ai(m.content.parts[0], cid, m.id, true);
                }
              }
            }

            if (!v.children || v.children.length < 1)
              break;
            if (v.id === last)
              break;
            cur_id = v.children[0];
          }
        }

        this.#mark_cur_title(cid);
        this.chat_lst.scrollTo(1,1);
      }
    } catch(e) {
      console.log('ERR==>'+e);
    } finally {
      this.#endThrobber();
      this.end_ai();
    }
  }


  async load_history(show_throbber, s, e)
  {
    var accessToken, ok;
    var offset = s || 0;
    var limit = e || 100;

    if (show_throbber)
       this.#startThrobber()

    try {
      ({accessToken, ok} = await this.chat.getAccessToken());
    } catch(e) {
      console.log(e);
    }

    if (!ok || !accessToken) {
      this.#endThrobber();
      this.append_msg(" --- Send query againg after the Relogin --- \n");
      Browser.openTab("https://chat.openai.com/auth/login");
      this.end_ai();
      return;
    }

    try {
      var options = {
        headers: {
          'Content-Type': 'application/json',
           Authorization: `Bearer ${accessToken}`,
        }
      }

      var rc = await fetch(`https://chat.openai.com/backend-api/conversations?offset=${offset}&limit=${limit}`, options);
      if (rc.ok) {
        var data = await rc.json();
        this.#update_hist_list(data, offset);
        this.history_offset = data.offset;
        this.history_len = data.items.length;
      }

    } catch(e) {
      console.log(e);
    } finally {
      if (show_throbber)
        this.#endThrobber()
    }
  }


  async load_history_more()
  {
     await this.load_history(true, this.history_offset+this.history_len);
  }

  async reqNewTitle()
  {
    var accessToken, ok;
    const conversation_id = this.chat.getConversationId();
    const message_id = this.chat.getParentId();

    this.#startThrobber()

    try {
      ({accessToken, ok} = await this.chat.getAccessToken());
    } catch(e) {
      console.log(e);
    }

    if (!ok || !accessToken)
      return;

    const payload = {
      message_id,
      model: "text-davinci-002-render"
    };

    try {
      var options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
           Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload)
      }

      var rc = await fetch(`https://chat.openai.com/backend-api/conversation/gen_title/${conversation_id}`, options);
      if (rc.ok) {
        var data = await rc.json();
        this.#add_new_title2list(conversation_id, data.title);
      }
    } catch(e) {
      console.log(e);
    } finally {
      this.#endThrobber();
    }
  }


  async exec()
  {
    var accessToken, ok;

    this.#startThrobber();

    try {
      ({accessToken, ok} = await this.chat.getAccessToken());
    } catch(e) {
      this.#endThrobber()
      console.log(e);
    }

    if (!ok || !accessToken) {
      this.#endThrobber()
      this.append_msg(" --- Send query againg after the Relogin --- \n");
      Browser.openTab("https://chat.openai.com/auth/login");
      this.end_ai();
      return;
    }

    var req = DOM.iSel('chat_req').value ;
    if (!req) {
      this.#endThrobber()
      return;
    }

    this.append_question(req);
    this.append_ai("\n");
    const new_chat = !this.chat.getConversationId();

    try {
      var answer = await this.chat.getAnswer(req, (data) => {
        if (data.text)
          this.update_ai(data.text, data.conversation_id, data.message_id);
      });

      this.update_ai(answer.text, answer.conversation_id, answer.message_id);

    } catch(e) {
      const s = e.message;
      this.end_ai(new_chat);
      this.append_msg(" "+s+"\n");
      if (s.startsWith("HTTP: 403"))  {
         this.append_msg(" --- Send query againg after the Relogin --- \n");
         Browser.openTab("https://chat.openai.com/auth/login");
      }
    }
    DOM.iSel('chat_req').value = '';
    await this.end_ai(new_chat);
    this.#endThrobber()
  }

  
  new_chat()
  {
    this.chat_lst.innerHTML = '';
    this.chat.newChat();
  }



}

