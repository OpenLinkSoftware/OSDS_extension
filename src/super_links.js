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

class SuperLinks {
  constructor()
  {
    this.super_links = null;
    this.chat_cache = {};
  }


  inject_super_links_popup() 
  {
    if ($(".super_links_popup").length == 0) {
      $('body').append(
       `<div class="osds_revert_css super_links_popup" style="display:none" >
         <div class="osds_revert_css super_links_popup-title"> &nbsp;Super Links </div>
         <a href="#close" title="Close" class="osds_revert_css super_links_popup_close">&times;</a> 
         <div class="osds_revert_css super_links_popup-content"></div>
         <img class="osds_revert_css super_links_popup-resizer" src="data:image/gif;base64,R0lGODlhCgAKAJEAAAAAAP///6CgpP///yH5BAEAAAMALAAAAAAKAAoAAAIRnI+JosbN3hryRDqvxfp2zhUAOw==" alt="Resize" width="10" height="10"/>
        </div> 
        <div class="osds_revert_css super_links_chatgpt" style="display:none" >
         <div class="osds_revert_css super_links_chatgpt-title"> &nbsp;ChatGPT </div>
         <a href="#close" title="Close" class="osds_revert_css super_links_chatgpt_close">&times;</a> 
         <div class="osds_revert_css super_links_chatgpt-content">
           <textarea id="osds_words"class="osds_revert_css super_links_chatgpt-content-text"></textarea>
         </div>
         <img class="osds_revert_css super_links_chatgpt-resizer" src="data:image/gif;base64,R0lGODlhCgAKAJEAAAAAAP///6CgpP///yH5BAEAAAMALAAAAAAKAAoAAAIRnI+JosbN3hryRDqvxfp2zhUAOw==" alt="Resize" width="10" height="10"/>
        </div> 
        <div class="osds_revert_css super_links_msg" style="display:none" > 
          <div class="osds_revert_css" style="width:16px;">
            <img src="data:image/gif;base64,${Browser.throbber}" class="osds_revert_css super_links_img">
          </div>
          <div class="osds_revert_css" id="super_links_msg_text">&nbsp;Applying&nbsp;Super&nbsp;Links</div>
        </div>
        <div class="osds_revert_css" id="super_links_snackbar">
          <div class="osds_revert_css" id="msg1"></div>
          <div class="osds_revert_css" id="msg2"></div>
        </div>`
      );

    }
  }


  async add_super_links(sender, data)
  {
    if (!data)
      return;

    var settings = new Settings();
    var highlight_mode = await settings.getValue('ext.osds.super-links-highlight');

    DOM.qSel('.super_links_msg #super_links_msg_text').innerHTML = '&nbsp;Applying&nbsp;Super&nbsp;Links';
    DOM.qSel('.super_links_msg').style.display = 'flex';

    const self = this

    setTimeout(() => {
      try {
        var val = JSON.parse(data);
        self.super_links = val.results.bindings;
        var list = {};
        for(var i=0; i < self.super_links.length; i++) {
          var s = self.super_links[i].extractLabel.value;
          var sl = s.toLowerCase();
          self.super_links[i]._id = sl;
          list[sl]=0;
        }

        var keys = Object.keys(list); 
        for(var i=0; i< keys.length; i++) {
          var s = keys[i];
          for(var j=0; j < keys.length; j++) {
            if (j != i && keys[j].indexOf(s) != -1) {
              list[s] = 1;
              break;
            }
          }
        }

        var labels = [];
        for(var i=0; i< keys.length; i++) {
          var s = keys[i];
          if (list[s] === 0)
            labels.push(s);
        }
        for(var i=0; i< keys.length; i++) {
          var s = keys[i];
          if (list[s] !== 0)
            labels.push(s);
        }

        self.mark_strings(labels, highlight_mode);
      } catch(e) {
        console.log(e);
      } finally {
        setTimeout(()=> DOM.qSel('.super_links_msg').style.display = 'none', 2000);
      }
    }, 200);
  }


  add_chatgpt_data(resp)
  {
    if (resp.err) {
      showSnackbar("Error", resp.err);
      return;
    }

    const chat_req = resp.req;
    let chat_resp = resp.resp;

    if (chat_resp) 
      this.chat_cache[chat_req] = chat_resp;

    if (chat_resp) {
      const el = DOM.qSel('#osds_words');
      el.value = chat_resp;

      const popup = DOM.qSel('.super_links_chatgpt');
      dragElement(popup, DOM.qSel('.super_links_chatgpt-title'));
      makeResizable(popup, DOM.qSel('.super_links_chatgpt-resizer'));

      $('.super_links_chatgpt_close').click(function(e){
          $('.super_links_chatgpt').hide();
          return false;
       });

      positionPopupOnPage('.super_links_chatgpt', resp.event);
    }
  }


  async ask_ChatGPT(ev, words)
  {
    let event = {clientX: ev.clientX, clientY:ev.clientY};
    const settings = new Settings();
    let chatgpt_req = await settings.getValue("osds.chatgpt_prompt");
    if (!chatgpt_req)
      chatgpt_req = "What do you know about '{words}' ?";

    chatgpt_req = chatgpt_req.replace("{words}", "'"+words+"'");

    const chat_resp = this.chat_cache[chatgpt_req];
    if (chat_resp) {
      this.add_chatgpt_data({resp:chat_resp, event});
    } 
    else {
      Browser.api.runtime.sendMessage({cmd: "super_links_chatgpt", req:chatgpt_req, event });
    }
  }


  handle_ask(tableId)
  {
    let lst = DOM.qSelAll(tableId+' td a#osds_ask_gpt')
    for(const el of lst) 
    {
      el.onclick = (ev) => {
        ev.preventDefault();
        const words = ev.target.attributes.getNamedItem('words');
        if (words && words.value) {
           this.ask_ChatGPT(ev, words.value);
        }
      }
    }
  }


  async create_popup_table(lst, ev)
  {
    $('.super_links_popup-content').children().remove();

    var settings = new Settings();
    var viewer_mode = await settings.getValue('ext.osds.super-links-viewer');

    async function create_href(url) {
       if (viewer_mode==='html-fb')
         return await settings.createImportUrl(url);
       else
         return url;
    }
    

    if (lst.length > 0)
    {
      var tdata = '';
      for(var i=0; i < lst.length; i++)
      {
        var v = lst[i];

        try {
          var extract = v.extract?v.extract.value:null;
          var prov = v.provider?v.provider.value:null;
          if (extract && prov) {
            var extLabel = v.extractLabel?v.extractLabel.value:'';
            var provName = v.providerLabel?v.providerLabel.value:prov;
            var entityType = v.entityType.value;
            var entityTypeLabel = v.entityTypeLabel?v.entityTypeLabel.value:entityType;

            var association = v.association.value;
            var associationLabel = v.associationLabel?v.associationLabel.value:association;
            var extract_href = await create_href(extract);

            tdata += 
            `<tr><td> <a target="_blank" href="${extract_href}">${extLabel}</a></td>`+
            ` <td> <a target="_blank" href="${association}">${associationLabel}</a> </td>`+
            ` <td> <a target="_blank" href="${prov}">${provName}</a></td>`+
            ` <td> <a target="_blank" href="${entityType}">${entityTypeLabel}</a></td>`+
            ` <td> <a id="osds_ask_gpt" target="_blank" href="#osds_ask_gpt" words="${extLabel}">Ask</a></td>`+
            `</tr>`;
          }
        } catch(e) {}
      }


      $('.super_links_popup-content')
         .append('<table class="osds_revert_css super_links_table">'
             +'<thead><tr>'
             +'<th class="osds_revert_css"> Word <span class="super_links_table-resize-handle"/></th>'
             +'<th class="osds_revert_css"> Association <span class="super_links_table-resize-handle"/></th>'
             +'<th class="osds_revert_css"> Source <span class="super_links_table-resize-handle"/></th>'
             +'<th class="osds_revert_css"> Type <span class="super_links_table-resize-handle"/></th>'
             +'<th class="osds_revert_css"> ChatGPT <span class="super_links_table-resize-handle"/></th>'
             +'</tr></thead>'
              +'<tbody>'+tdata+'</tbody>'
              +'</table>');
      $('.super_links_popup').show();

      var popup = DOM.qSel('.super_links_popup');
      const columns_css = ['minmax(100px, 1.5fr)', 'minmax(100px, 2.5fr)', 'minmax(100px, 4fr)', 'minmax(100px, 2fr)', 'minmax(100px, 2fr)'];
      makeResizableTable('table.super_links_table', columns_css, '.super_links_popup');

      dragElement(popup, DOM.qSel('.super_links_popup-title'));
      makeResizable(popup, DOM.qSel('.super_links_popup-resizer'));

      this.handle_ask('table.super_links_table');

      positionPopupOnPage(".super_links_popup", ev);
    }
  }


  mark_strings(keywords, highlight_mode)
  {
    $("body").unmark();

    for(var i=0; i < keywords.length; i++)
    {
      var keyword = keywords[i];
      var word;
      var options = {
          "element": "a",  //"a"
          "className": "super_link_mark",
          "exclude": ["a"],
          "separateWordSearch": false,
          "acrossElements": false,
          "accuracy": {
             "value": "exactly",
             "limiters": ":;.,’'\"-–—‒_(){}[]!+=".split("")
           },
          "diacritics": false,
          "caseSensitive": false,
          "ignoreJoiners": false,
          "filter": function(textNode, foundTerm, totalCounter, termCount){
                    // textNode is the text node which contains the found term
                    // foundTerm is the found search term
                    // totalCounter is a counter indicating the total number of all marks
                    // at the time of the function call
               word = foundTerm.toLowerCase();
               return (termCount > 0 && highlight_mode==='first')? false: true;
          },
          "each": function(node){
              // node is the marked DOM element
              $(node).attr("href","");
              $(node).attr("mark_id",keyword.toLowerCase());

          },
        };

      $("body").mark(keyword, options);
    }

    const self = this;

    $('.super_links_popup_close').click(function(e){
        $('.super_links_popup').hide();
        return false;
     });

    $('.super_link_mark').click(function(ev){
        var mark_id = ev.target.getAttribute('mark_id');
        var lst = [];
        for (var i=0; i < self.super_links.length; i++) {
          if (self.super_links[i]._id.indexOf(mark_id)!=-1)
            lst.push(self.super_links[i]);
        }

        self.create_popup_table(lst, ev);
        return false;
     });
  }





}
