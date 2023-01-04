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


var $ = jQuery;
var chatUI;


$(document).ready(function()
{
  if (Browser.is_safari) {
      var el = DOM.qSel("body.sniffer");
      el.classList.add("sniffer_sf");
      el.classList.remove("sniffer");

      el = DOM.qSel("div.content");
      el.classList.add("content_sf");
      el.classList.remove("content");
  }

  DOM.iSel("c_year").innerText = new Date().getFullYear();

  var chat_view;
  try {
    chat_view = CodeMirror.fromTextArea(document.getElementById('chat_place'), {
        mode: 'markdown',
        lineNumbers: true,
        lineWrapping: true,
        readOnly: true,
        theme: "default",
        value: " \n"
      });
    chat_view.setSize("100%", "100%");
  } catch(e) { }

  chatUI = new ChatUI(chat_view);


//??  DOM.iSel("chat_btn").onclick = (e) =>{ chatUI.open(); }; 

  DOM.iSel("chat_send").onclick = (e) =>{ chatUI.exec(); }; 

  $("#chat_throbber").hide();

  DOM.iSel("ext_ver").innerText = '\u00a0ver:\u00a0'+ Browser.api.runtime.getManifest().version;

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

