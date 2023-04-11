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

// React when the browser action's icon is clicked.

(function () {

  var g_super_links = null;

  var $ = jQuery;
  var chatUI;

    DOM.ready(() =>
    {
      if ($(".osds_popup").length == 0) {
         $('body').append(
           `<div class="osds_popup">
              <div class="osds_popup-title"> <b>&nbsp;Error</b></div>
              <div class="osds_popup-content">
                <p id="osds_popup_msg">  </p>
                <div class="osds_popup_btns">
                  <input id="osds_popup_retry" value=" Try&nbsp;Again " type="button" class="osds_popup_btn">
                  <input id="osds_popup_cancel" value=" Cancel " type="button" class="osds_popup_btn">
                <div>
              </div>
            </div>`
         );

         DOM.qSel('.osds_popup').style.display = 'none';

         DOM.qSel('.osds_popup #osds_popup_retry').onclick = () => {
             DOM.qSel('.osds_popup').style.display = 'none';
             Browser.api.runtime.sendMessage({cmd: "osds_popup_retry" });
             return false;
         };
         DOM.qSel('.osds_popup #osds_popup_cancel').onclick = () => {
             DOM.qSel('.osds_popup').style.display = 'none';
             Browser.api.runtime.sendMessage({cmd: "osds_popup_cancel" });
             return false;
         };
      }
      
      
      DOM.iSel("c_year").innerText = new Date().getFullYear();

      chatUI = new ChatUI(DOM.qSel('div.chat'));

      DOM.iSel("chat_send").onclick = (e) =>{ chatUI.exec(); }; 
      DOM.iSel("chat_stop").onclick = (e) =>{ chatUI.stop_exec(); }; 
      DOM.iSel("new_chat").onclick = (e) =>{ chatUI.new_chat(); }; 

      DOM.qHide("#chat_throbber");
      $("#thumb_up").hide();
      $("#thumb_down").hide();
      $("#alert-dlg").hide();

      DOM.iSel("ext_ver").innerText = '\u00a0ver:\u00a0'+ Browser.api.runtime.getManifest().version;


      try {

          Browser.api.runtime.onMessage.addListener(function (request, sender, sendResponse) 
          {
                if (request.property == "req_doc_data") {
                    request_doc_data();
                    sendResponse({ping:1});
                    return;
                 }
                else if (request.property == "open_tab") {
                    request_open_tab(request.url, sender);
                }
                else if (request.property == "osds_msg_show") {
                    if (request.message) {
                      DOM.qSel('.osds_popup #osds_popup_msg').innerText = request.message;
                      DOM.qSel('.osds_popup').style.display = 'block';
                    }
                }
                else if (request.property == "osds_msg_hide") {
                    DOM.qSel('.osds_popup').style.display = 'none';
                }

                sendResponse({});  // stop
          });


      } catch (e) {
         console.log("OSDS:" + e);
      }


      DOM.iSel('conversations').onscroll = (e)=> {
        if (e.target.scrollTop + e.target.clientHeight >= e.target.scrollHeight) {
          chatUI.load_history_more();
        }
      }

      
      chatUI.load_history(true, 0);
  });



    function showInfo(msg)
    {
      $('#alert-msg').prop('textContent',msg);
      $('#alert-dlg').dialog({
        resizable: true,
        height:180,
        modal: true,
        buttons: {
          "OK": function() {
            $(this).dialog('destroy');
          }
        }
      });
    }


    function request_open_tab(url, sender) {
        if (url)
          window.open(url);
    }

    function request_doc_data() 
    {
        var data_exists = false;
        var docData = {
            doc_URL: document.location.href,
            micro: {data: null},
            jsonld: {text: null},
            json: {text: null},
            rdfa: {data: null, ttl: null},
            rdf: {text: null},
            turtle: {text: null},
            ttl_nano: {text: null},
            ttl_curly_nano: {text: null},
            jsonld_nano: {text: null},
            json_nano: {text: null},
            rdf_nano: {text: null},
            csv_nano: {text: null},
            posh: {text: ''}
        };

        var lst = DOM.qSelAll('.chat_code');
        for (var el of lst) {
          var el_type = el.querySelector('.code_header select#code_type option:checked').id;

          if (el_type === 'turtle') {
            data_exists = true;
            if (!docData.ttl_nano.text)
              docData.ttl_nano.text = [];

            docData.ttl_nano.text.push( el.querySelector('.code_block').textContent );
          }
          else if (el_type === 'jsonld') {
            data_exists = true;
            if (!docData.jsonld_nano.text)
              docData.jsonld_nano.text = [];

            docData.jsonld_nano.text.push( el.querySelector('.code_block').textContent );
          }
          else if (el_type === 'json') {
            data_exists = true;
            if (!docData.json_nano.text)
              docData.json_nano.text = [];

            docData.json_nano.text.push( el.querySelector('.code_block').textContent );
          }
          else if (el_type === 'csv') {
            data_exists = true;
            if (!docData.csv_nano.text)
              docData.csv_nano.text = [];

            docData.csv_nano.text.push( el.querySelector('.code_block').textContent );
          }
          else if (el_type === 'rdfxml') {
            data_exists = true;
            if (!docData.rdf_nano.text)
              docData.rdf_nano.text = [];

            docData.rdf_nano.text.push( el.querySelector('.code_block').textContent );
          }
        }

        Browser.api.runtime.sendMessage(
            {
                property: "doc_data",
                data: JSON.stringify(docData, undefined, 2),
                is_data_exists: data_exists
            });
    }



})();

