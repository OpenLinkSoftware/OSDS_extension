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
var mchatUI;


var cdata = 
 "To create a blink animation using CSS, you can use the `@keyframes` rule to define the animation and set the `animation` property on the element you want to animate.\n"
+"\n"
+"Here's an example of how you might create a blink animation that alternates the visibility of an element every half second:\n"
+"\n"
+"```css\n"
+"@keyframes blink {\n"
+"  50% {\n"
+"    visibility: hidden;\n"
+"  }\n"
+"}\n"
+"\n"
+".blink {\n"
+"  animation: blink 1s linear infinite;\n"
+"}\n"
+"```\n"
+"\n"
+"You can then apply the `blink` class to any element you want to animate:\n"
+"\n"
+"```html\n"
+'<p class="blink">This text will blink</p>\n'
+"```\n"
+"\n"
+"You can customize the duration and timing of the animation by adjusting the values for the `animation` property. For example, you can use the `animation-duration` property to control the length of the animation, and the `animation-timing-function` property to control the speed of the animation.\n"
+"\n"
+"Here's an example of a blink animation that lasts for 2 seconds and uses a ease-in-out timing function:\n"
+"\n"
+"```css\n"
+"@keyframes blink {\n"
+"  50% {\n"
+"    visibility: hidden;\n"
+"  }\n"
+"}\n"
+"\n"
+".blink {\n"
+"  animation: blink 2s ease-in-out infinite;\n"
+"}\n"
+"```\n"
+"\n"
+"I hope this helps! Let me know if you have any questions.\n"
+"\n";



$(document).ready(function()
{
/**
  if (Browser.is_safari) {
      var el = DOM.qSel("body.sniffer");
      el.classList.add("sniffer_sf");
      el.classList.remove("sniffer");

      el = DOM.qSel("div.content");
      el.classList.add("content_sf");
      el.classList.remove("content");
  }
**/

  DOM.iSel("c_year").innerText = new Date().getFullYear();

  chatUI = new ChatUI(DOM.qSel('div.chat'));

  mchatUI = new NChatUI(DOM.qSel('div.chat'));

  DOM.iSel("chat_send").onclick = (e) =>{ chatUI.exec(); }; 

  $("#chat_throbber").hide();

  DOM.iSel("ext_ver").innerText = '\u00a0ver:\u00a0'+ Browser.api.runtime.getManifest().version;

//??  update_view();
});



async function update_view() 
{
  var id = 1;

  var lst = DOM.qSel('div.chat');
  lst.innerHTML = '';

  mchatUI.append_question('My question');

  var l = cdata.split("\n");

  var text = l[0]+"\n";
  mchatUI.append_ai(text);

  for(var i=1; i < l.length; i++) 
  {
    text += l[i]+"\n";
    await sleep(100);
    mchatUI.update_ai(text);
  }

  mchatUI.end_ai();
//  mchatUI.append_question('My question 11');
//  mchatUI.append_ai(cdata);
}



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

