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

const setting = new Settings();
const page_panel_url = Browser.api.runtime.getURL("page_panel.html");
var chk_setting = {
      "ext.osds.handle_all" : "1",
      "ext.osds.handle_csv": "1",
      "ext.osds.handle_json": "1",
      "ext.osds.handle_xml": "1",
      "ext.osds.pref.user.chk": "0",
      "ext.osds.pref.user": ""
    };


  async function reload_settings()
  {
    chk_setting["ext.osds.handle_all"] = await setting.getValue("ext.osds.handle_all");
    chk_setting["ext.osds.handle_csv"] = await setting.getValue("ext.osds.handle_csv");
    chk_setting["ext.osds.handle_json"] = await setting.getValue("ext.osds.handle_json");
    chk_setting["ext.osds.handle_xml"] = await setting.getValue("ext.osds.handle_xml");

    chk_setting['ext.osds.pref.user.chk'] = await setting.getValue('ext.osds.pref.user.chk');
    chk_setting['ext.osds.pref.user'] = await setting.getValue('ext.osds.pref.user');

    const g_chat = new ChatService();
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
        GVars.updatePage(tabId, {content:"", url, type, ext});
      } else {
        GVars.deletePage(tabId);
      }
    } 
    else  if (handle)  {
      var page_url = page_panel_url + "?url="+encodeURIComponent(url)+"&type="+type+"&ext="+ext;
      Browser.api.tabs.update(tabId, { "url": page_url });
      return { cancel: false };
    }
  }


//??TODO Safari
  if (Browser.is_safari) {
      Browser.api.webNavigation.onBeforeNavigate.addListener(
        (d) => {
//?? check me
           return onBeforeLoadName(d.url, d.tabId);
        });
/***
      Browser.api.webNavigation.onTabReplaced.addListener(
        (d) => {
           // 
          //????? return onTabReplaced(d.replacedTabId, d.tabId);
        });
***/
      Browser.api.webNavigation.onCommitted.addListener(
        (d) => {
           // 
          //????? return onCommitted(d.parentFrameId, d.url, d.tabId);
        });
      Browser.api.webNavigation.onHistoryStateUpdated.addListener(
        (d) => {
           // 
          //????? return onCommitted(d.parentFrameId, d.url, d.tabId);
        });
/***
      Browser.api.webNavigation.onCompleted.addListener(
        (d) => {
           //                          -1 = main
          //????? return onCompleted(d.parentFrameId,  d.url, d.tabId);
        });
***/
  }



  Browser.api.webRequest.onBeforeRequest.addListener(
        (d) => {
           return onBeforeLoadName(d.url, d.tabId);
        },
        {types: ["main_frame"], urls: ["file:///*"]}, 
        (Browser.is_chrome_v3 || Browser.is_ff_v3) ? [] :["blocking"]);

  function onBeforeRequestLocal(d)
  {
    return onBeforeLoadName(d.url, d.tabId);
  }


  if (Browser.is_ff || Browser.is_safari) {
    Browser.api.webRequest.onBeforeSendHeaders.addListener(
        function(details) {
          var chk = chk_setting['ext.osds.pref.user.chk'];
          if (chk && chk==="1") {
            var pref_user = chk_setting['ext.osds.pref.user'];
            if (pref_user && pref_user.length> 0) {
              details.requestHeaders.push({name:"On-Behalf-Of", value:pref_user})
            }
          }
          
          return {"requestHeaders": details.requestHeaders};
        },
        {urls: ["<all_urls>"]},
        (Browser.is_chrome_v3 || Browser.is_ff_v3)? ["requestHeaders"] :["blocking", "requestHeaders"]);
  }


  Browser.api.webRequest.onHeadersReceived.addListener(
  	onHeadersReceived, 
  	{types: ["main_frame"], urls: ["<all_urls>"]}, 
        (Browser.is_chrome_v3 || Browser.is_ff_v3) ? ["responseHeaders"] : ["responseHeaders", "blocking"] );


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
        GVars.updatePage(d.tabId, {content:headerContent.value, url:d.url, type, ext});
      } else {
        GVars.deletePage(d.tabId);
      }
      return {};
    } 
    else  if (handle)  {
        var _url = page_panel_url+"?url="+encodeURIComponent(d.url)+"&type="+type+"&ext="+ext;
/***
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
***/
        Browser.createTab(_url);
        if (Browser.is_ff)
          return  { cancel: false };
        else
          return {}
    } else {
        return {};
    }
  }


/**** End WebRequest ****/

Browser.api.runtime.onMessage.addListener(function(request, sender, sendResponse)
{
  try {
    if (request.cmd === "reloadSettings")
    {
      reload_settings();
    }
  } catch(e) {
    console.log("OSDS: onMsg="+e);
  }

});



})();
