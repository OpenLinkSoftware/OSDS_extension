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

const prefix_oidc = "oidc-webid:";
const prefix_oidc_slogin = "oidc-webid-slogin:";
const prefix_code = "oidc-code:";
const prefix_code1 = "oidc-code1:";

window.addEventListener("message", recvMessage, false);

async function recvMessage(event)
{
  var ev_data;
  var session = null;
  var idp = null;

  const ev = String(event.data);
  if (!ev.startsWith(prefix_code) && !ev.startsWith(prefix_code1))
    return;

  const authData = (ev.startsWith(prefix_code)) ? ev.substring(prefix_code.length) : ev.substring(prefix_code1.length);
  await save_data('oidc_code', authData);

  Browser.api.runtime.sendMessage({cmd:'store_updated', key:'oidc_code'});

  setTimeout(function (){
     if (ev.startsWith(prefix_code1))
       Browser.api.runtime.sendMessage({cmd:'close_oidc_web_slogin', url: document.location.href});
     else
       Browser.api.runtime.sendMessage({cmd:'close_oidc_web', url: document.location.href});
  }, 1500);
}


async function save_data(key, val) 
{
    var rec = {};
    rec[key]=val;
    if (Browser.is_chrome) {
      return new Promise(function (resolve, reject) {
        Browser.api.storage.local.set(rec, () => {
          resolve()
        });
      })
    } else {
      return Browser.api.storage.local.set(rec);
    }
}


})();