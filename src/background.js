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

var page_panel_url = Browser.api.runtime.getURL("page_panel.html");


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


Browser.api.runtime.onMessage.addListener(async function(request, sender, sendResponse)
{
  try {
    if (request.cmd === "openIfHandled")
    {
      var tabId = request.tabId;
      var tab = await GVars.getPage(tabId);
      if (tab) {
        var url = page_panel_url+"?url="+encodeURIComponent(tab.url)+"&type="+tab.type+"&ext="+tab.ext;
        Browser.createTab(url);
        sendResponse({'cmd': request.cmd, 'opened':true, url});
        return true;
      } 
      else {
        sendResponse({'cmd': request.cmd, 'opened':false});
        return true;
      }
    }
    else if (request.cmd === "super_links_chatgpt")
    {
      handle_super_links_chatgpt(sender, request.req, request.event);
    }
    else if (request.cmd === "actionSuperLinks")
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



Browser.api.runtime.onMessage.addListener(async function(request, sender, sendResponse)
{
  try {
    if (request.cmd === "gpt_window_reg")  {  //receive that chat is opened
      const chat = new ChatService();
      await chat.load_settings();
      chat.reg_chat_window(sender.tab, request.chat_id)
    }
    else if (request.cmd === "gpt_window_unreg")  {  //receive that chat is opened
      const chat = new ChatService();
      await chat.load_settings();
      chat.unreg_chat_window(sender.tab)
    }
    else if (request.cmd === "gpt_page_content" && request.tabId)  { // request from popup panel
      const chat = new ChatService();
      await chat.load_settings();
      chat.askChatGPT_page_content({pageUrl:request.url},{id:request.tabId}); 
    }
  } catch(e) {
    console.log("OSDS: onMsg="+e);
  }

});


////////// Context Menu
  try {
    Browser.api.runtime.onInstalled.addListener((d) => {
      if(d.reason !== "install" && d.reason !== "update") return;

      Browser.api.contextMenus.create(
        {title: "Super Links", contexts:["page"], id: "mn-superlinks"});

      Browser.api.contextMenus.create(
        {title: "Ask ChatGPT", contexts:["selection"], id: "mn-askLLM-sel"});

      Browser.api.contextMenus.create(
        {title: "Ask ChatGPT for Page Content", contexts:["page"], id: "mn-askLLM-page"});
    });

    Browser.api.contextMenus.onClicked.addListener(async (info, tab) => {
      switch (info.menuItemId) {
        case "mn-superlinks":
          actionSuperLinks(info, tab);
          break;
        case "mn-askLLM-sel":
          {
            const chat = new ChatService();
            await chat.load_settings();
            chat.askChatGPT_selection(info, tab)
          }
          break;
        case "mn-askLLM-page":
          {
            const chat = new ChatService();
            await chat.load_settings();
            chat.askChatGPT_page_content(info, tab)
          }
          break;
      }
    });

  } catch(e) {
    console.log(e);
  }



async function actionSuperLinks(info, tab) {
  await Actions.clear();

  var slinks = new SuperLinks(tab.url, tab.id);
  await slinks.save_state();

  var rc = await slinks.check_login();

  if (rc) {
    rc = await slinks.mexec();
    if (rc) {
      await Actions.clear();
    }
  }
}

//actionSPARQL_Upload(null, curTab[0], request.data, request.sparql_ep);
async function actionSPARQL_Upload(info, tab, request) {
  await Actions.clear();

  var sparql = new SPARQL_Upload(tab, request);
  await sparql.save_state();

  var rc = await sparql.check_login();

  if (rc) {
    rc = await sparql.mexec();
    if (rc) {
      await Actions.clear();
    }
  }
}




//Chrome API
//wait data from extension
Browser.api.runtime.onMessage.addListener(async function(request, sender, sendResponse)
{
  try {
    if (request.cmd === "reset_uploads")
    {
      await Actions.clear();
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

      if (await Actions.useSuperLinks()) {
        var slinks = new SuperLinks();
        await slinks.load_state();
        if (slinks && slinks.state) {
          var rc = await slinks.reexec();
          if (rc) {
            await Actions.clear();
          }
        } else {
          await Actions.clear();
        }
      }
      else if (await Actions.useSPARQL_Uploads()) {
        var sparql = new SPARQL_Upload();
        await sparql.load_state();
        if (sparql && sparql.state) {
          var rc = await sparql.reexec();
          if (rc)
            await Actions.clear();
        } else {
          await Actions.clear();
        }
      }

    }
    else if (request.cmd === "osds_popup_retry")
    {
      if (await Actions.useSPARQL_Uploads()) {
        var sparql = new SPARQL_Upload();
        await sparql.load_state();
        if (sparql && sparql.state === "init") {
          var rc = await sparql.reexec();
          if (rc)
            await Actions.clear();
        } else {
          await Actions.clear();
        }
      }
    }
    else if (request.cmd === "osds_popup_cancel")
    {
      if (await Actions.useSPARQL_Uploads()) {
        await Actions.clear();
      }
    }
    
  } catch(e) {
    console.log("OSDS: onMsg="+e);
  }

});

Browser.api.tabs.onRemoved.addListener(async function(tabId, removed) {
 await GVars.deletePage(tabId);
})

})();
