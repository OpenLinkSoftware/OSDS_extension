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

class NChatUI {
  constructor(_chat_lst) 
  {
    this.last_sid = null;
    this.chat_lst = _chat_lst;
    this.id = 1;
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

  // Highlighter function. Should return escaped HTML,
  // or '' if the source string is not changed and should be escaped externally.
  // If result starts with <pre... internal wrapper is skipped.
//--    highlight: function (/*str, lang*/) { return ''; }
      highlight: function (str, lang) {
         if (lang && hljs.getLanguage(lang)) {
           try {
             return '<pre class="hljs"><code>' +
                     hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
                   '</code></pre>';
           } catch (__) {}
         }

         return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
       }
     });
  }


  create_code_block_html(str)
  {
    var v = 
     `<div class="chat_code">
        <div class="code_header">
           <span id="copied" class="hidden">Copied!&nbsp;&nbsp;</span>
           <button id="copy_code"><img class="img20" src="images/copy-icon.svg"/>Copy code</button> 
           <input id="edit_code" type="image" class="img20" src="images/chat.png">
        </div>
        <div class="code_block">${str}</div>
      </div>`
    return v;                              
  }

  create_text_block_html(str)
  {
    var v = `<div class="chat_text">${str}</div>`;
    return v;                              
  }

  parse_answer(str) 
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

  create_question_html(query, id) 
  {
    var v = 
     `<div class="chat_item">
        <div class="chat_left"> 
          <input type="image"src="images/person-icon.svg" width="20" height="20" > 
        </div> 
        <div id="${id}" class="chat_center">
         <p> ${DOMPurify.sanitize(query)}
         </p>
        </div>
        <div class="chat_right"> 
        </div>
      </div>`;
    return v;
  }

  create_answer_html(text, id) 
  {
    var text = this.create_ai_html(text);
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

  create_ai_html(str)
  {
    var block = [];
    var lst = this.parse_answer(str);

    for(const i of lst) {
      if (i.type === 'c') // text
        block.push( this.create_code_block_html(this.md.render(i.str)) ) 
      else
        block.push( this.create_text_block_html(this.md.render(i.str)) ) 
    }
  
    return block.join('\n');
  }

  append_question(str)
  {
    var sid = 'ch_q_'+this.id++;
    var s = this.create_question_html(str, sid);
    var el = DOM.htmlToElement(s);
    this.chat_lst.appendChild(el); 
    this.update_scroll();
  }

  append_ai(str)
  {
    var sid = 'ch_ai_'+this.id++;
    var s = this.create_answer_html(str, sid);
    var el = DOM.htmlToElement(s);
    this.chat_lst.appendChild(el); 
    this.last_sid = sid;
    this.update_scroll();
  }

  update_ai(str)
  {
    if (this.last_sid) {
      var el = DOM.qSel("div#"+this.last_sid+".chat_center");
      if (el) {
        el.innerHTML = this.create_ai_html(str);
      }
    }
    this.update_scroll();
  }

  update_scroll()
  {
    const v = this.chat_lst.scrollHeight
    this.chat_lst.scrollTo(1,v);
  }

  end_ai()
  {
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

    lst = DOM.qSelAll('.chat_item_ai input#edit_code');
    for(var el of lst) {
      el.onclick = (e) => {
        const block = e.target.closest('div.chat_code');
        const code = block.querySelector('div.code_block');
        const editor = new MediumEditor(code);
      }
    }

    lst = DOM.qSelAll('.chat_item_ai input#thumb_up');
    for(var el of lst) {
      el.onclick = (e) => {
        alert("Thumb-Up isn't implemented")
      }
    }

    lst = DOM.qSelAll('.chat_item_ai input#thumb_down');
    for(var el of lst) {
      el.onclick = (e) => {
        alert("Thumb-Down isn't implemented")
      }
    }

  }

}




//  req = "how to create blink animation css ?";
class ChatUI {
  constructor(_chat_lst) 
  {
    this.chat = new chat_gpt();
    this.last_sid = null;
    this.chat_lst = _chat_lst;
    this.id = 1;
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

  // Highlighter function. Should return escaped HTML,
  // or '' if the source string is not changed and should be escaped externally.
  // If result starts with <pre... internal wrapper is skipped.
//--    highlight: function (/*str, lang*/) { return ''; }
      highlight: function (str, lang) {
         if (lang && hljs.getLanguage(lang)) {
           try {
             return '<pre class="hljs"><code>' +
                     hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
                   '</code></pre>';
           } catch (__) {}
         }

         return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
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

  #create_question_html(query, id) 
  {
    var v = 
     `<div class="chat_item">
        <div class="chat_left"> 
          <input type="image"src="images/person-icon.svg" width="20" height="20" > 
        </div> 
        <div id="${id}" class="chat_center">
         <p> ${DOMPurify.sanitize(query)}
         </p>
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

  append_question(str)
  {
    var sid = 'ch_q_'+this.id++;
    var s = this.#create_question_html(str, sid);
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

  append_ai(str)
  {
    var sid = 'ch_ai_'+this.id++;
    var s = this.#create_answer_html(str, sid);
    var el = DOM.htmlToElement(s);

    this.chat_lst.appendChild(el); 
    this.last_sid = sid;
    this.#update_scroll();
  }

  update_ai(str)
  {
    if (this.last_sid) {
      var el = DOM.qSel("div#"+this.last_sid+".chat_center");
      if (el) {
        el.innerHTML = this.#create_ai_html(str);
      }
    }
    this.#update_scroll();
  }

  end_ai()
  {
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
        alert("Thumb-Up isn't implemented")
      }
    }

    lst = DOM.qSelAll('.chat_item_ai input#thumb_down');
    for(var el of lst) {
      el.onclick = (e) => {
        alert("Thumb-Down isn't implemented")
      }
    }
  }

  #update_scroll()
  {
    const v = this.chat_lst.scrollHeight
    this.chat_lst.scrollTo(1,v);
  }


  async exec()
  {
    var accessToken, ok;

    $("#chat_throbber").show();

    try {
      ({accessToken, ok} = await this.chat.getAccessToken());
    } catch(e) {
      $("#chat_throbber").hide();
      console.log(e);
    }

    if (!ok || !accessToken) {
      $("#chat_throbber").hide();
      this.append_msg(" --- Send query againg after the Relogin --- \n");
      Browser.openTab("https://chat.openai.com/auth/login");
      this.end_ai();
      return;
    }

    var req = DOM.iSel('chat_req').value ;
    if (!req) {
      $("#chat_throbber").hide();
      this.end_ai();
      return;
    }

    this.append_question(req);
    this.append_ai("\n");
    try {
      var answer = await this.chat.getAnswer(req, (data) => {
        if (data.message)
          this.update_ai(data.message.content.parts[0]);
      });

      this.update_ai(answer);
    } catch(e) {
      const s = e.message;
      this.end_ai();
      this.append_msg(" "+s+"\n");
    }
    this.end_ai();
    $("#chat_throbber").hide();
   }
}

