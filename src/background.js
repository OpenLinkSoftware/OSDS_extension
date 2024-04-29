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

var pages = {};
var setting = new Settings();
var page_panel_url = Browser.api.extension.getURL("page_panel.html");
var chk_setting = {
      "ext.osds.handle_all" : "1",
      "ext.osds.handle_csv": "1",
      "ext.osds.handle_json": "1",
      "ext.osds.handle_xml": "1",
      "ext.osds.pref.user.chk": "0",
      "ext.osds.pref.user": ""
    };

var g_chat = new ChatService();

  async function reload_settings()
  {
    chk_setting["ext.osds.handle_all"] = await setting.getValue("ext.osds.handle_all");
    chk_setting["ext.osds.handle_csv"] = await setting.getValue("ext.osds.handle_csv");
    chk_setting["ext.osds.handle_json"] = await setting.getValue("ext.osds.handle_json");
    chk_setting["ext.osds.handle_xml"] = await setting.getValue("ext.osds.handle_xml");

    chk_setting['ext.osds.pref.user.chk'] = await setting.getValue('ext.osds.pref.user.chk');
    chk_setting['ext.osds.pref.user'] = await setting.getValue('ext.osds.pref.user');

    await g_chat.load_settings()
  }

  reload_settings();

  function onBeforeLoadName(url, tabId)
  {
    var chk_all = chk_setting["ext.osds.handle_all"];

    var chk_csv = chk_setting["ext.osds.handle_csv"];
    var handle_csv = (chk_csv && chk_csv==="1");
    var chk_json = chk_setting["ext.osds.handle_json"];
    var handle_json = (chk_json && chk_json==="1");
    var chk_xml = chk_setting["ext.osds.handle_xml"];
    var handle_xml = (chk_xml && chk_xml==="1");

    var handle = false;
    var could_handle = false;
    var type = "";
    var ext = "";
    var path_name = (new URL(url)).pathname.toLowerCase();


    if (Browser.is_safari) {
      chk_all = "0";
      handle_csv = true;
      handle_json = true;
      handle_xml = true;
    }

    if (path_name.endsWith(".rdf")) {
      handle = true;
      type = "rdf";
      ext = "rdf";
      could_handle = true;
    }
    else if (path_name.endsWith(".owl")) {
      handle = true;
      type = "rdf";
      ext = "owl";
      could_handle = true;
    }
    else if (path_name.endsWith(".ntriples")) {
      handle = true;
      type = "turtle";
      ext = "ntriples";
      could_handle = true;
    }
    else if (path_name.endsWith(".ttl")) {
      handle = true;
      type = "turtle";
      ext = "ttl";
      could_handle = true;
    }
    else if (path_name.endsWith(".n3")) {
      handle = true;
      type = "turtle";
      ext = "n3";
      could_handle = true;
    }
    else if (path_name.endsWith(".jsonld") || path_name.endsWith(".ldjson")) {
      handle = true;
      type = "jsonld";
      ext = "jsonld";
      could_handle = true;
    }
    else if (path_name.endsWith(".json")) {
      handle = handle_json;
      type = "json";
      ext = "json";
      could_handle = true;
    }
    else if (path_name.endsWith(".jsonl")) {
      handle = true;
      type = "jsonl";
      ext = "jsonl";
      could_handle = true;
    }
    else if (handle_csv && path_name.endsWith(".csv")) {
      handle = handle_csv;
      type = "csv";
      ext = "csv";
      could_handle = true;
    }
    else if (handle_xml && path_name.endsWith(".xml") ) {
      handle = handle_xml;
      type = "xml";
      ext = "xml";
      could_handle = true;
    }

    if (chk_all && chk_all!=="1") 
    {
      if (could_handle) {
        pages[tabId] = {content:"", 
                          url,
                          type,
                          ext
                         };
      } else {
        delete pages[tabId];
      }
    } 
    else  if (handle)  {
      var page_url = page_panel_url + "?url="+encodeURIComponent(url)+"&type="+type+"&ext="+ext;
      Browser.api.tabs.update(tabId, { "url": page_url });
      return { cancel: false };
    }
  }


  if (Browser.is_safari) {
      Browser.api.webNavigation.onBeforeNavigate.addListener(
        (d) => {
           return onBeforeLoadName(d.url, d.tabId);
        });
  }



  Browser.api.webRequest.onBeforeRequest.addListener(
        (d) => {
           return onBeforeLoadName(d.url, d.tabId);
        },
        {types: ["main_frame"], urls: ["file:///*"]}, 
        ["blocking"]);

  function onBeforeRequestLocal(d)
  {
    return onBeforeLoadName(d.url, d.tabId);
  }



  Browser.api.webRequest.onBeforeSendHeaders.addListener(
        function(details) {
          var chk = chk_setting['ext.osds.pref.user.chk'];
          if (chk && chk==="1") {
            var pref_user = chk_setting['ext.osds.pref.user'];
            if (pref_user && pref_user.length> 0) {
              details.requestHeaders.push({name:"On-Behalf-Of", value:pref_user})
/***
              var header_acah = null;
              for (var h of details.requestHeaders) {
                if (h.name && h.name.toLowerCase() === "access-control-allow-headers") {
                  header_acah = h;
                  break;
                }
              }

              if (header_acah && header_acah.value.trim().length > 0) {
                header_acah.value += ', On-Behalf-Of';
              }
              else {
                details.requestHeaders.push({name:"Access-Control-Allow-Headers", value:"On-Behalf-Of"});
              }
***/
            }
          }
          
          return {"requestHeaders": details.requestHeaders};
        },
        {urls: ["<all_urls>"]},
        ["blocking", "requestHeaders"]);



  Browser.api.webRequest.onHeadersReceived.addListener(
  	onHeadersReceived, 
  	{types: ["main_frame"], urls: ["<all_urls>"]}, 
        ["responseHeaders", "blocking"]);


  function onHeadersReceived(d)
  {
      
    if (d.method && d.method!=="GET")
        return {};

    var headerContent = null;
    for (var header of d.responseHeaders) {
      if (header.name && header.name.match(/^content-type/i)) {
        headerContent = header;
        contentType = header.value;
        break;
      }
    }

    var chk_all = chk_setting["ext.osds.handle_all"];

    var chk_xml = chk_setting["ext.osds.handle_xml"];
    var chk_csv = chk_setting["ext.osds.handle_csv"];
    var chk_json = chk_setting["ext.osds.handle_json"];

    var handle_xml = (chk_xml && chk_xml==="1");
    var handle_csv = (chk_csv && chk_csv==="1");
    var handle_json = (chk_json && chk_json==="1");

    var handle = false;
    var type = null;
    var ext = "";
    var content_type = null;
    var could_handle = false;

    if (Browser.is_safari) {
      chk_all = "0";
      handle_csv = true;
      handle_json = true;
      handle_xml = true;
    }

    if (headerContent) {

      if (headerContent.value.match(/\/(turtle)/)) {
        handle = true;
        type = "turtle";
        could_handle = true;
      }
      else if (headerContent.value.match(/\/(n3)/)) {
        handle = true;
        type = "turtle";
        could_handle = true;
      }
      else if (headerContent.value.match(/\/(n-triples)/)) {
        handle = true;
        type = "turtle";
        header.value = "text/plain";
        could_handle = true;
      }
      else if (headerContent.value.match(/\/(json\+ld)/)
               || headerContent.value.match(/(application\/activity\+json)/)       
               || headerContent.value.match(/\/(ld\+json)/)
              ) 
      {
        handle = true;
        type = "jsonld";
        could_handle = true;
      }
      //application/rdf+xml
      else if (headerContent.value.match(/\/(rdf\+xml)/)) {
        handle = true;
        type = "rdf";
        headerContent.value = "text/plain";
        could_handle = true;
      }
      else if (headerContent.value.match(/\/(rss\+xml)/)) {
        handle = true;
        type = "rss";
        could_handle = true;
      }
      else if (headerContent.value.match(/\/(atom\+xml)/)) {
        handle = true;
        type = "atom";
        could_handle = true;
      }
      else if (headerContent.value.match(/\/(csv)/)) {
        handle = handle_csv;
        type = "csv";
        could_handle = true;
      }
      else if (headerContent.value.match(/\/(sparql\-results\+json)/) 
               || headerContent.value.match(/(application\/rdf\+json)/) 
               || headerContent.value.match(/(application\/json)/) 
               || headerContent.value.match(/(application\/jrd\+json)/) 
               || headerContent.value.match(/(application\/odata\+json)/) 
               || headerContent.value.match(/(application\/microdata\+json)/) 
               ) 
      {
        handle = handle_json;
        type = "json";
        could_handle = true;
      }
      else if (headerContent.value.match(/(application\/jsonl)/)) 
      {
        handle = true;
        type = "jsonl";
        could_handle = true;
      }
      else {
        content_type = headerContent.value;
      }
    }

    if (!could_handle && (!content_type || content_type.match(/(application\/xml)/) 
                                          || content_type.match(/(text\/xml)/) 
                                          || content_type.match(/(text\/plain)/)
                                          || content_type.match(/(application\/octet-stream)/)
                     )) {
        var url_path = (new URL(d.url)).pathname.toLowerCase();
        if (url_path.endsWith(".owl")) {
          handle = true;
          type = "rdf";
          ext = "owl";
          could_handle = true;
        }
        else if (url_path.endsWith(".rdf")) {
          handle = true;
          type = "rdf";
          ext = "rdf";
          could_handle = true;
        }
        else if (url_path.endsWith(".ntriples")) {
          handle = true;
          type = "turtle";
          ext = "ntriples";
          could_handle = true;
        }
        else if (url_path.endsWith(".ttl")) {
          handle = true;
          type = "turtle";
          ext = "ttl";
          could_handle = true;
        }
        else if (url_path.endsWith(".csv")) {
          handle = handle_csv;
          type = "csv";
          ext = "csv";
          could_handle = true;
        }
        else if (url_path.endsWith(".json")) {
          handle = handle_json;
          type = "json";
          ext = "json";
          could_handle = true;
        }
        else if (url_path.endsWith(".jsonld")) {
          handle = true;
          type = "jsonld";
          ext = "jsonld";
          could_handle = true;
        }
        else if (url_path.endsWith(".jsonl")) {
          handle = true;
          type = "jsonl";
          ext = "jsonl";
          could_handle = true;
        }
        else if (url_path.endsWith(".xml")) {
          handle = handle_xml;
          type = "xml";
          could_handle = true;
        }
    }

    if (!could_handle && content_type!==null 
        && (content_type.match(/(application\/xml)/) || content_type.match(/(text\/xml)/) )) 
    {
        handle = handle_xml;
        type = "xml";
        could_handle = true;
    }


    var url = new URL(d.url);
    if (url.hash.endsWith("#osds"))
    {
      could_handle = false;
      handle = false;
    }


    if (chk_all && chk_all!=="1") 
    {
      if (could_handle) {
        pages[d.tabId] = {content:headerContent.value, 
                          url:d.url,
                          type,
                          ext
                         };
      } else {
        delete pages[d.tabId];
      }
      return {};
    } 
    else  if (handle)  {
        var _url = page_panel_url+"?url="+encodeURIComponent(d.url)+"&type="+type+"&ext="+ext;
        if (type === "json" || type === "xml" || type === "csv") {
          if (Browser.is_ff) {
            Browser.api.tabs.create({url:_url});
            return { cancel: false };
          }
          else {
            window.open(_url);
            return { cancel: false };
          }
        } else {

          if (Browser.is_ff) {
            Browser.api.tabs.update(d.tabId, { url: _url });
            return { cancel: true };
          }
          else {
            Browser.api.tabs.update(d.tabId, { url: _url });
            return { cancel: true };
          }
        }
    } else {
        return {};
    }
  }


/**** End WebRequest ****/


async function handle_super_links_chatgpt(sender, chatgpt_req, event)
{
  const setting = new Settings();
  const curTab = sender.tab.id;

  try {
    const model = await setting.getValue("osds.chatgpt_model");
    let temperature = await setting.getValue("osds.chatgpt_temp");
    const token = await setting.getValue("osds.chatgpt_openai_token");
    let max_tokens = await setting.getValue("osds.chatgpt_max_tokens");

    try {
      max_tokens = parseInt(max_tokens,10);
      if (max_tokens <= 0)
        max_tokens = 4096;
    } catch(e) { 
      max_tokens = 4096;
    }
    try {
      temperature = parseFloat(temperature).toFixed(2);
      temperature = parseFloat(temperature);
      if (temperature <0 || temperature >1)
        temperature = 1;
    } catch(e) { 
      temperature = 1;
    }

    Browser.api.tabs.sendMessage(curTab, {cmd:'super_links_msg_show', message: 'Send OpenAI request' });

    const ret = await req_openai({token, model, temperature, max_tokens, req: chatgpt_req})
    if (ret.rc === 1)
      Browser.api.tabs.sendMessage(curTab, {cmd:"super_links_chatgpt_return", req:chatgpt_req, resp:ret.text, event});
    else
      Browser.api.tabs.sendMessage(curTab, {cmd:"super_links_chatgpt_return", err:ret.err, event});
  } 
  finally {
    Browser.api.tabs.sendMessage(curTab, { cmd: 'super_links_msg_hide' });
  }
}


Browser.api.runtime.onMessage.addListener(function(request, sender, sendResponse)
{
  try {
    if (request.cmd === "openIfHandled")
    {
      var tabId = request.tabId;
      var tab = pages[tabId];
      if (tab) {
        var url = page_panel_url+"?url="+encodeURIComponent(tab.url)+"&type="+tab.type+"&ext="+tab.ext;
        Browser.openTab(url);
        sendResponse({'cmd': request.cmd, 'opened':true, url});
        return true;
      } 
      else {
        sendResponse({'cmd': request.cmd, 'opened':false});
        return true;
      }
    }
    else if (request.cmd === "reloadSettings")
    {
      reload_settings();
    }
    else if (request.cmd === "super_links_chatgpt")
    {
      handle_super_links_chatgpt(sender, request.req, request.event);
    }
  } catch(e) {
    console.log("OSDS: onMsg="+e);
  }

});


Browser.api.runtime.onMessage.addListener(async function(request, sender, sendResponse)
{
  try {
    if (request.cmd === "actionSuperLinks")
    {
      var curTab = await getCurTab();
      if (curTab.length > 0)
        actionSuperLinks(null, curTab[0]);
    }
    else if (request.cmd === "actionSPARQL_Upload")
    {
      var curTab = await getCurTab();
      if (curTab.length > 0)
        actionSPARQL_Upload(null, curTab[0], request);
    }
  } catch(e) {
    console.log("OSDS: onMsg="+e);
  }

});



Browser.api.runtime.onMessage.addListener(function(request, sender, sendResponse)
{
  try {
    if (request.cmd === "gpt_window_reg")  {  //receive that chat is opened
      g_chat.reg_chat_window(sender.tab, request.chat_id)
    }
    else if (request.cmd === "gpt_window_unreg")  {  //receive that chat is opened
      g_chat.unreg_chat_window(sender.tab)
    }
    else if (request.cmd === "gpt_page_content" && request.tabId)  { // request from popup panel
      g_chat.askChatGPT_page_content({pageUrl:request.url},{id:request.tabId}); 
    }
  } catch(e) {
    console.log("OSDS: onMsg="+e);
  }

});


////////// Context Menu

if (Browser.is_ff || Browser.is_chrome) {
  try {
    Browser.api.contextMenus.create(
        {"title": "Super Links", 
         "contexts":["page"],
         "onclick": actionSuperLinks});

    Browser.api.contextMenus.create(
        {"title": "Ask ChatGPT", 
         "contexts":["selection"],
         "onclick": g_chat.askChatGPT_selection});

    Browser.api.contextMenus.create(
        {"title": "Ask ChatGPT for Page Content", 
         "contexts":["page"],
         "onclick": g_chat.askChatGPT_page_content});

         
  } catch(e) {
    console.log(e);
  }
}


var gSuperLinks = null;
var gSPARQL_Upload = null;

async function actionSuperLinks(info, tab) {
  gSuperLinks = null;
  gSPARQL_Upload = null;

  var msg = 
       { 
         throbber_show: function (txt) {
            Browser.api.tabs.sendMessage(tab.id, { cmd: 'super_links_msg_show', message: txt });
         },
         throbber_hide: function () {
            Browser.api.tabs.sendMessage(tab.id, { cmd: 'super_links_msg_hide' });
         },
         snackbar_show: function (msg1, msg2) {
            Browser.api.tabs.sendMessage(tab.id, { cmd: 'super_links_snackbar', msg1, msg2 });
         },
       }

  var slinks = new SuperLinks(tab.url, tab.id, msg);
  gSuperLinks = slinks;

  var rc = await slinks.check_login();

  if (rc) {
    rc = await slinks.mexec();
    if (rc)
      gSuperLInks = null;
  }
}

//actionSPARQL_Upload(null, curTab[0], request.data, request.sparql_ep);
async function actionSPARQL_Upload(info, tab, request) {
  gSuperLinks = null;
  gSPARQL_Upload = null;

  var msg = 
       { 
         throbber_show: function (txt) {
            Browser.api.tabs.sendMessage(tab.id, { cmd: 'super_links_msg_show', message: txt });
         },
         throbber_hide: function () {
            Browser.api.tabs.sendMessage(tab.id, { cmd: 'super_links_msg_hide' });
         },
         snackbar_show: function (msg1, msg2) {
            Browser.api.tabs.sendMessage(tab.id, { cmd: 'super_links_snackbar', msg1, msg2 });
         },
         msg_show: function(msg) {
            Browser.api.tabs.sendMessage(tab.id, { cmd: 'osds_msg_show', message: msg });
         },
         msg_hide: function() {
            Browser.api.tabs.sendMessage(tab.id, { cmd: 'osds_msg_hide' });
         }
       }

  var sparql = new SPARQL_Upload(tab, msg, request);
  gSPARQL_Upload = sparql;

  var rc = await sparql.check_login();

  if (rc) {
    rc = await sparql.mexec();
    if (rc)
      gSPARQL_Upload = null;
  }
}




//Chrome API
//wait data from extension
Browser.api.runtime.onMessage.addListener(async function(request, sender, sendResponse)
{
  try {
    if (request.cmd === "reset_uploads")
    {
      gSuperLInks = null;
      gSPARQL_Upload = null;
    }
    else if (request.cmd === "close_oidc_web")
    {
      var curWin = await getCurWin();
      var curTab = await getCurTab();
      if (request.url && curTab.length > 0 && curTab[0].windowId === curWin.id
          && curTab[0].url === request.url) {
        Browser.api.tabs.remove(curTab[0].id);
      }

    }
    else if (request.cmd === "close_oidc_web_slogin")
    {
      var curWin = await getCurWin();
      var curTab = await getCurTab();
      if (request.url && curTab.length > 0 && curTab[0].windowId === curWin.id
          && curTab[0].url === request.url) {
        Browser.api.tabs.remove(curTab[0].id);
      }

      if (gSuperLinks) {
        var slinks = gSuperLinks;
        if (slinks && slinks.state) {
          var rc = await slinks.reexec();
          if (rc)
            gSuperLInks = null;
        } else {
          gSuperLInks = null;
        }
      }
      else if (gSPARQL_Upload) {
        var sparql = gSPARQL_Upload;
        if (sparql && sparql.state) {
          var rc = await sparql.reexec();
          if (rc)
            gSPARQL_Upload = null;
        } else {
          gSPARQL_Upload = null;
        }
      }

    }
    else if (request.cmd === "osds_popup_retry")
    {
      if (gSPARQL_Upload) {
        var sparql = gSPARQL_Upload;
        if (sparql && sparql.state === "init") {
          var rc = await sparql.reexec();
          if (rc)
            gSPARQL_Upload = null;
        } else {
          gSPARQL_Upload = null;
        }
      }
    }
    else if (request.cmd === "osds_popup_cancel")
    {
      if (gSPARQL_Upload) {
        gSPARQL_Upload = null;
      }
    }
    
  } catch(e) {
    console.log("OSDS: onMsg="+e);
  }

});



})();
