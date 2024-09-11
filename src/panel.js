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

var g_tabId = null
var items;
var $ = jQuery;
var gData_exists = false;
var gData_showed = false;
var doc_URL = null;
var prevSelectedTab = null;
var gData = {
        baseURL: null,
        tab_index: null,
        tabs: [],

        micro: null,
        jsonld: null,
        rdfa: null,
        turtle: null,
        rdf: null,
        rdfa: null,
        json: null,
        jsonl: null,
        csv: null,
        rss: null,
        atom: null,
        md: null,

        links: {}
      };

var src_view = null;
var g_RestCons = new Rest_Cons();
var gMutationObserver = new MutationObserver((mlist, observer) => g_RestCons.update())
var gOidc = new OidcWeb();




function showPopup(tabId)
{
  //Request the data from the client (foreground) tab.
  try {
    if (Browser.is_ff) {
      Browser.api.tabs.sendMessage(tabId, { cmd: 'req_doc_data' })
        .then(response => {
          if (Browser.api.runtime.lastError)
            return;
          if (!response || !response.ping) {
            hideDataTabs();
            selectTab('cons');
            g_RestCons.show();
          }
        })
        .catch(err => {
          hideDataTabs();
          selectTab('cons');
          g_RestCons.show();
        });
    } else {
      Browser.api.tabs.sendMessage(tabId, { cmd: 'req_doc_data'},
        function(response) { 
          if (Browser.api.runtime.lastError)
            return;
          if (!response || !response.ping) {
            hideDataTabs();
            selectTab('cons');
            g_RestCons.show();
          }
        });
    }
  } catch(e) {
    hideDataTabs();
    selectTab('cons');
    g_RestCons.show();
  }

  gOidc.restoreConn().then(rc => {
    Download_exec_update_state();
  })

  Download_exec_update_state();

  async function click_login() {
     if (gOidc.getWebId()) {
       await gOidc.logout();
       Download_exec_update_state();
     } else {
       Browser.api.runtime.sendMessage({cmd: 'reset_uploads'});
       gOidc.login();
     }
  } 

  DOM.iSel('oidc-login-btn').onclick = (e) => { click_login() }
  DOM.iSel('oidc-login-btn1').onclick = (e) => { click_login() }

  DOM.iSel("login_btn").onclick = (e) => { Login_exec() }
  DOM.iSel("slink_btn").onclick = (e) => { SuperLinks_exec() }
  DOM.iSel("import_btn").onclick = (e) => { Import_doc() }
  DOM.iSel("rww_btn").onclick = (e) => { Rww_exec(); }
  DOM.iSel("sparql_btn").onclick = (e) => { Sparql_exec(); }

  DOM.iSel("rest_btn").onclick = (e) => { 
    selectTab('cons');
    g_RestCons.load(doc_URL);
    g_RestCons.show();
    var node = DOM.iSel("rest_query");
    gMutationObserver.observe(node, {attributes:true, childList:true, subtree:true});
  }

  DOM.iSel("download_btn").onclick = (e) => { Download_exec() }
  DOM.iSel("prefs_btn").onclick = (e) => { Prefs_exec() }

  DOM.iSel("load_rss").onclick = (e) => {
        if (gData.links.rss)
          gData.links.rss.loadData({}, 0);
  }

  DOM.iSel("load_atom").onclick = (e) => {
        if (gData.links.atom)
          gData.links.atom.loadData({}, 0);
  }

  try {
    src_view = CodeMirror.fromTextArea(document.getElementById('src_place'), {
      lineNumbers: true
    });
    src_view.setSize("100%", "100%");
  } catch(e) { }

  try{
    g_RestCons.yasqe.obj = YASQE.fromTextArea(document.getElementById('query_place'), {
      lineNumbers: false,
      lineWrapping: false,
      foldGutter: false,
      sparql: { showQueryButton: false },
	      createShortLink : null,
	      createShareLink : null,
	      persistent: null,

    });
    g_RestCons.yasqe.obj.setSize("98%", 260);
  } catch(e) {
  }
  
  if (doc_URL)
    g_RestCons.load(doc_URL);

  DOM.iSel("chat_btn").onclick = async (e) =>{ 
    const curTabs = await getCurTab();
    if (curTabs.length > 0) {
      Browser.api.runtime.sendMessage({cmd: 'gpt_page_content', tabId:curTabs[0].id, url:curTabs[0].url});
      close();
    }
  }

  DOM.iSel("rest_exec").onclick = (e) => { g_RestCons.exec(gData.tab_index); }
  DOM.iSel("rest_exit").onclick = (e) => { 
    gMutationObserver.disconnect();
    if (prevSelectedTab)
      selectTab(prevSelectedTab);
    return false;
  }

  DOM.iSel("src_exit").onclick = (e) => { selectTab(prevSelectedTab); return false; }

  gData_showed = false;
}


async function loadPopup()
{
  $("#save-confirm").hide();
  $("#alert-dlg").hide();
  $("#query_place").hide();
  $("#login-dlg").hide();

  hideDataTabs();
  selectTab('posh');

  DOM.iSel("ext_ver").innerText = '\u00a0ver:\u00a0'+ Browser.api.runtime.getManifest().version;

  var curTabs = await getCurTab();
  var tabId = g_tabId = null;

  if (curTabs.length > 0) {
    tabId = g_tabId = curTabs[0].id;
    doc_URL = curTabs[0].url;
  }
  
  var chk_all = "0";

  if (!Browser.is_safari) {
      var setting = new Settings();
      chk_all = await setting.getValue("ext.osds.handle_all");
  }

  if (chk_all && chk_all!=="1") {
    Browser.api.runtime.sendMessage({'cmd': 'openIfHandled', tabId},
       function(resp) {
            if (Browser.api.runtime.lastError) {
              showPopup(tabId);
              return;
            }
            if (resp && resp.opened) {
               close();
            }
            else {
               showPopup(tabId);
            }
       });
  } 
  else {
    showPopup(tabId);
  }
}

DOM.ready(() =>
{ 
  DOM.iSel("c_year").innerText = new Date().getFullYear();

  loadPopup()
});


// Trap any link clicks and open them in the current tab.
$(document).on('click', 'a', function(e) {
  function check_URI(uri) {
    if (gData.baseURL[gData.baseURL.length-1]==="#")
      return uri.startsWith(gData.baseURL);
    else
      return uri.startsWith(gData.baseURL+'#');
  }

  var tab_data = DOM.qSel(`#${getSelectedTab()}_items`);

  var hashName = null;
  var href = e.currentTarget.href;
  var hashPos = href.lastIndexOf('#');

  if (hashPos!=-1 && hashPos!=href.length-1)
    hashName = href.substring(hashPos+1);

  var url = new URL(document.baseURI);
  url.hash = '';
  url = url.toString();

  var baseHost = (new URL(gData.baseURL)).host;
  var hrefHost = (new URL(href)).host;

  if (href.startsWith(url+"#sc")) {
    return true;
  }
  else if (check_URI(href) && hashName) {
    var el = tab_data.querySelectorAll('a[name = "'+hashName+'"]');
    if (el.length > 0)
      el[0].scrollIntoView();
    return false;
  }
  else if (href === doc_URL) {
    return false;
  }
  else {
    var el = tab_data.querySelectorAll('a[href = "'+href+'"][ent]');
    if (el.length > 0)
      el[0].scrollIntoView();
    else
      Browser.openTab(href, gData.tab_index);
    return false;
  }
});


function selectTab(tab)
{
  prevSelectedTab = getSelectedTab();
  var el = DOM.qSel(`#tab-${tab} input`);
  el.checked = true;
  DOM.Show(el.parentNode);
}

function getSelectedTab()
{
  var el = DOM.qSel('.tabs input:checked');
  if (el)
    return el.parentNode.id.substring(4);
  else
    return null;
}


function hideDataTabs()
{
  var lst = DOM.qSelAll('.tabs li[id^="tab"]');
  for(var v of lst) {
    DOM.Hide(v);
  }
}


function update_tab(tabname, title, val, err_tabs)
{
  function create_err_msg(fmt_name, errors)
  {
    var err_html = "";
    var err_load = "";
    var msg = "";

    if (errors) {

      if ($.isArray(errors)) {
        for(var i=0; i<errors.length; i++) {
          if (errors[i].startsWith("#L#"))
            err_load += "<tr><td>"+errors[i].substring(3)+"</tr></td>";
          else
            err_html += "<tr><td>"+errors[i]+"</tr></td>";
        }
      }
      else if (errors.length > 0) {
          err_html += "<tr><td>"+errors+"</tr></td>";
      }

      if (err_html.length > 0)
        msg += "<table class='docdata table'><tr><td>"+fmt_name
              +" discovered, but fails syntax checking by parser:</td></tr>"
              +err_html+"</table>";

      if (err_load.length > 0)
        msg += "<table class='docdata table'>"
              +err_load+"</table>";

    }
    return (msg.length>0)?msg:null;
  }


  var html = "";

  $(`#${tabname}_items table.wait`).hide();
  $(`#${tabname}_items #docdata_view`).remove();

  if (tabname !== 'markdown')
    $(`#${tabname}_items`).append("<div id='docdata_view' class='alignleft'/>");

  if (val.html && val.html.trim().length > 0) {
      html += val.html;
      gData.tabs.push(`${tabname}`);
  }
  if (val.error) {
      var err_msg = create_err_msg(title, val.error);
      if (err_msg) {
        html += err_msg;
        if (err_tabs)
          err_tabs.push(`${tabname}`);
      }
  }
  if (html.length > 0 && html.replace(/\s/g, "").length > 0) {
    if (tabname === 'markdown') {
       var preview = $("#md_preview iframe").contents().find("body");
       preview.get(0).innerHTML = html;
    } else {
       $(`#${tabname}_items #docdata_view`).append(html);
    }
      return true;
  } 
  else {
    DOM.qHide(`#tab-${tabname}`);
    DOM.qHide(`#${tabname}-save`);
    return false;
  }
}


async function update_tab_exec(tabname, title, block, err_tabs)
{
  var bnode_types = {};
  var val = await block.to_html(bnode_types, 0);

  return update_tab(tabname, title, val, err_tabs);
}


async function show_Data()
{
  function updateUI(loaded, tabName)
  {
    if (loaded) {
      DOM.qShow(`#tab-${tabName}`);
      DOM.qShow(`#${tabName}-save`);
    }
    else {
      DOM.qHide(`#tab-${tabName}`);
      DOM.qHide(`#${tabName}-save`);
    }
  }
  
  var cons = false;
  var micro = false;
  var jsonld = false;
  var turtle = false;
  var rdfa = false;
  var rdf = false;
  var posh = false;
  var json = false;
  var jsonl = false;
  var csv = false;
  var rss = false;
  var atom = false;
  var markdown = false;
  var html = "";
  var err_tabs = [];
  var bnode_types = {};

  gData.tabs = [];
  DOM.qHide('#rss-save');
  DOM.qHide('#atom-save');

  if (gData.micro)
    micro = await update_tab_exec('micro', 'Microdata', gData.micro, err_tabs);

  if (gData.jsonld)
    jsonld = await update_tab_exec('jsonld', 'JSON-LD', gData.jsonld, err_tabs);

  if (gData.turtle)
    turtle = await update_tab_exec('turtle', 'Turtle', gData.turtle, err_tabs);

  if (gData.rdfa)
    rdfa = await update_tab_exec('rdfa', 'RDFa', gData.rdfa, err_tabs);

  if (gData.rdf)
    rdf = await update_tab_exec('rdf', 'RDF/XML', gData.rdf, err_tabs);
  
  if (gData.json)
    json = await update_tab_exec('json', 'JSON', gData.json, err_tabs);

  if (gData.jsonl)
    jsonl = await update_tab_exec('jsonl', 'JSONL', gData.jsonl, err_tabs);

  if (gData.csv)
    csv = await update_tab_exec('csv', 'CSV', gData.csv, err_tabs);

  if (gData.md)
    markdown = await update_tab_exec('markdown', 'Markdown', gData.md, err_tabs);

  if (gData.rss) {
    rss = await update_tab_exec('rss', 'RSS', gData.rss, err_tabs);
    DOM.qShow('#rss-save');
  }

  if (gData.atom) {
    atom = await update_tab_exec('atom', 'Atom', gData.atom, err_tabs);
    DOM.qShow('#atom-save');
  }

  if (gData.posh)
    posh = await update_tab_exec('posh', 'POSH', gData.posh, err_tabs);

  if (!rss && gData.links.rss)
    rss = true;
  if (!atom && gData.links.atom)
    atom = true;

  if (gData.tabs.length > 0)
    selectTab(gData.tabs[0]);
  else if (err_tabs.length > 0)
    selectTab(err_tabs[0]);

  updateUI(micro,  'micro');
  updateUI(jsonld, 'jsonld');
  updateUI(turtle, 'turtle');
  updateUI(rdfa,   'rdfa');
  updateUI(rdf,    'rdf');
  updateUI(posh,   'posh');
  updateUI(json,   'json');
  updateUI(jsonl,  'jsonl');
  updateUI(csv,    'csv');
  updateUI(markdown, 'markdown');
  updateUI(rss,    'rss');
  updateUI(atom,   'atom');

  if (!jsonl && !json)
    DOM.qHide('#json-save');
  else
    DOM.qShow('#json-save');

  gData_showed = true;
}


function links_cb_start(tab)
{
  $(`#${tab}_items #load_${tab}`).attr('disabled','disabled');
  $(`#${tab}_items #throbber`).show();
}

function links_cb_error(tab)
{
  $(`#${tab}_items #load_${tab}`).removeAttr('disabled');
  $(`#${tab}_items #throbber`).hide();
}

function links_cb_success(tab, tabName, rc)
{
  if (rc) {
    update_tab(tab, tabName, rc);
    $(`#${tab}_items table.loader`).hide();

    DOM.qShow(`#tab-${tab}`);
    DOM.qShow(`#${tab}-save`);
  } 
}



async function parse_Data(dData)
{
  doc_URL = dData.doc_URL;

  var url = new URL(doc_URL);
  url.hash ='';
  gData.baseURL = url.toString();

  var val = {d:dData, start_id:0, bnode_types:{}};
  var bnode_types = {};

  try {
    gData.links.atom = null;
    gData.links.rss = null;
    gData.links.jsonld = null;
    gData.links.rdf = null;
    gData.links.ttl = null;
    
    gData.micro = new Microdata_Block(gData.baseURL, [JSON.stringify(dData.micro.data, undefined, 2)], dData.micro.data);

    gData.jsonld = new JSONLD_Block(gData.baseURL, dData.jsonld.text);
    gData.jsonld.add_nano(dData.jsonld_nano.text);

    gData.json = new JSON_Block(gData.baseURL, dData.json_nano.text);
    gData.jsonl = new JSONL_Block(gData.baseURL, dData.jsonl_nano.text);

    gData.turtle = new TTL_Block(gData.baseURL, dData.turtle.text);
    await gData.turtle.add_nano(dData.ttl_nano.text);
    await gData.turtle.add_nano_curly(dData.ttl_curly_nano.text);

    gData.posh = new TTL_Block(gData.baseURL, [dData.posh.text]);

    gData.rdfa = new RDFa_Block(gData.baseURL, dData.rdfa.ttl, dData.rdfa.data);
    
    gData.rdf = new RDF_Block(gData.baseURL, dData.rdf.text);
    gData.rdf.add_nano(dData.rdf_nano.text);

    gData.csv = new CSV_Block(gData.baseURL, dData.csv_nano.text);

    gData.md = new Markdown_Block(gData.baseURL, dData.md_nano.text);

    if (dData.rss_nano.text && dData.rss_nano.text.length > 0) {
      gData.rss = new RSS_Block(gData.baseURL, dData.rss_nano.text, false);
      $(`#rss_items table.wait`).show();
    }
    if (dData.atom_nano.text && dData.atom_nano.text.length > 0) {
      gData.atom = new RSS_Block(gData.baseURL, dData.atom_nano.text, true);
      $(`#atom_items table.wait`).show();
    }

    if (dData.posh.links) 
    {
      var setting = new Settings();
      var chk_discovery = await setting.getValue("ext.osds.auto_discovery");
      var atom_links = {};
      var rss_links = {};
      var jsonld_links = {};
      var rdf_links = {};
      var ttl_links = {};

      for(var href in val.d.posh.links) {
        var type = val.d.posh.links[href];
        if (type === 'application/atom+xml')
           atom_links[href] = type;
        else if (type === 'application/rss+xml')
          rss_links[href] = type;
        else if (type === 'application/json+ld' || type === 'application/ld+json' || type === 'application/activity+json')
          jsonld_links[href] = type;
        else if (type === 'application/rdf+xml')
          rdf_links[href] = type;
        else if (type === 'text/turtle' || type === 'text/n3')
          ttl_links[href] = type;
      }

      if (dData.posh.dlinks.rss.length > 0) {

        for(var v of dData.posh.dlinks.rss) {
          if (!rss_links[v])
            rss_links[v] = 'application/rss+xml'; 
        }
      }


      if (Object.keys(rss_links).length > 0) {
        gData.links.rss = new RSS_Links("rss", "RSS", gData.baseURL, rss_links, links_cb_start, links_cb_error, links_cb_success);
        $(`#rss_items table.loader`).show();
      }

      if (Object.keys(atom_links).length > 0) {
        gData.links.atom = new Atom_Links("atom", "Atom", gData.baseURL, atom_links, links_cb_start, links_cb_error, links_cb_success);
        $(`#atom_items table.loader`).show();
      }

      if (chk_discovery === "1") {
        $('#atom_items #load_atom').hide();
        $('#atom_items #throbber').show();
        $('#rss_items #load_rss').hide();
        $('#rss_items #throbber').show();

        if (gData.links.rss)
          gData.links.rss.loadData({}, 0);

        if (gData.links.atom)
          gData.links.atom.loadData({}, 0);
      }

      if (Object.keys(jsonld_links).length > 0) {
        $('#jsonld_items #throbber').show();
        $('#jsonld_items #load_jsonld').hide();
        $(`#jsonld_items table.loader`).show();
        gData.links.jsonld = new JSONLD_Links("jsonld", "JSON-LD", gData.baseURL, jsonld_links, gData.jsonld, links_cb_start, links_cb_error, links_cb_success);
        gData.links.jsonld.loadData({}, 0); 
      }

      if (Object.keys(rdf_links).length > 0) {
        $('#rdf_items #throbber').show();
        $('#rdf_items #load_rdf').hide();
        $(`#rdf_items table.loader`).show();
        gData.links.rdf = new RDF_Links("rdf", "RDF/XML", gData.baseURL, rdf_links, gData.rdf, links_cb_start, links_cb_error, links_cb_success);
        gData.links.rdf.loadData({}, 0); 
      }

      if (Object.keys(ttl_links).length > 0) {
        $('#turtle_items #throbber').show();
        $('#turtle_items #load_turtle').hide();
        $(`#turtle_items table.loader`).show();
        gData.links.ttl = new TTL_Links("turtle", "Turtle", gData.baseURL, ttl_links, gData.turtle, links_cb_start, links_cb_error, links_cb_success);
        gData.links.ttl.loadData({}, 0); 
      }
    }
  } catch (e) {
    console.log(e);
  }
}


async function handle_docData(data, is_data_exists, tab_index)
{
  try {
    async function frames_data(v)
    {
      const rc = Nano.sniff_nanotation_Document(v);
      is_data_exists = is_data_exists || rc.exists
      const nano = rc.data;

      var dData = JSON.parse(data);
      dData.ttl_nano.text       = dData.ttl_nano.text.concat(nano.ttl)
      dData.ttl_curly_nano.text = dData.ttl_curly_nano.text.concat(nano.ttl_curly)
      dData.jsonld_nano.text    = dData.jsonld_nano.text.concat(nano.jsonld)
      dData.rdf_nano.text       = dData.rdf_nano.text.concat(nano.rdf)
      dData.json_nano.text      = dData.json_nano.text.concat(nano.json)
      dData.jsonl_nano.text     = dData.jsonl_nano.text.concat(nano.jsonl)
      dData.csv_nano.text       = dData.csv_nano.text.concat(nano.csv)
      dData.md_nano.text        = dData.md_nano.text.concat(nano.md)
      dData.rss_nano.text       = dData.rss_nano.text.concat(nano.rss)
      dData.atom_nano.text      = dData.atom_nano.text.concat(nano.atom)

      try {
        gData.tab_index = tab_index;
      } catch(e){}

      g_RestCons.load(doc_URL);

      if (is_data_exists)
      {
        try {
          await parse_Data(dData);
          await show_Data();
        } catch(ex) {
          console.log("OSDS: Error="+ex);
          hideDataTabs();
        }
      }
      else
      {
        hideDatsaTabs();

        selectTab('cons');
        g_RestCons.show();
      }
    }

    if (Browser.is_chrome_v3 || Browser.is_ff_v3 || Browser.is_safari) {
      let frames = await Browser.api.scripting.executeScript({ 
                      target: {tabId: g_tabId, allFrames:true},
                      injectImmediately: true,  
                      files: ['frame_text.js']
                    });
      let lst = [];
      for(var v of frames)
        lst.push(v.result);
      frames_data(lst);
    }
    else
      Browser.api.tabs.executeScript(g_tabId, {file:"frame_text.js", allFrames:true, runAt: 'document_start'}, frames_data);

  } catch(e) {
    console.log("OSDS: onMsg="+e);
  } 

}


//Chrome API
//wait data from extension
Browser.api.runtime.onMessage.addListener(async function(request, sender, sendResponse)
{
  if (request.property == "doc_data")
  {
    handle_docData(request.data, request.is_data_exists, sender.tab.index);
  }

});


////////////////////////////////////////////////////

async function SuperLinks_exec()
{
  var settings = new Settings();
  await settings._syncAll();

  if (doc_URL!==null) {
    Browser.api.runtime.sendMessage({cmd: 'reset_uploads'});
    Browser.api.runtime.sendMessage({cmd: 'actionSuperLinks'});
    close(); // close popup
  }
  return false;
}




async function Import_doc()
{
  if (doc_URL!==null) {
     var settings = new Settings();
     var _url = await settings.createImportUrl(doc_URL);
     Browser.openTab(_url, gData.tab_index);
  }

  return false;
}


async function Rww_exec()
{
  var settings = new Settings();

  async function openRww(data)
  {
     var _url = await settings.createRwwUrl(doc_URL, data);
     Browser.openTab(_url, gData.tab_index);
  }


  if (doc_URL!==null) {
     var edit_url = await settings.getValue('ext.osds.rww.edit.url');

     if (edit_url.indexOf("{data}")!=-1) {
        save_data("export-rww", "data.txt", "ttl", openRww);
     } else {
        openRww(null);
     }
  }

  return false;
}


async function Sparql_exec()
{
  if (doc_URL!==null) {
     var u = new URL(doc_URL);
     var settings = new Settings();
     var _url = await settings.createSparqlUrl(u.toString());
     Browser.openTab(_url, gData.tab_index);
  }

  return false;
}


function Prefs_exec()
{
  //snow preferenses
  Browser.openTab("options.html")

  return false;
}

function Login_exec()
{
  Download_exec_update_state();

  var dlg = $( "#login-dlg" ).dialog({
    resizable: true,
    width:500,
    height:200,
    modal: true,
    buttons: {
      "OK": function() {
        $(this).dialog( "destroy" );
      }
    }
  });

  return false;
}



async function Download_exec_update_state(pod) 
{
  try {
    const webid = gOidc.getWebId();
    const webid_href = DOM.iSel('oidc-webid');
    const webid1_href = DOM.iSel('oidc-webid1');

    webid1_href.href = webid_href.href = webid ? webid :'';
    webid1_href.title = webid_href.title = webid ? webid :'';
    webid1_href.style.display = webid_href.style.display = webid ? 'initial' :'none';

    const oidc_login_btn = DOM.iSel('oidc-login-btn');
    const oidc_login_btn1 = DOM.iSel('oidc-login-btn1');
    oidc_login_btn1.innerText = oidc_login_btn.innerText = webid ? 'Logout' : 'Login';

    const login_tab = DOM.iSel('login_btn');
    if (webid) {
      login_tab.title = "Logged as "+webid;
      login_tab.src = "images/uid.png";
    } else {
      login_tab.title = "Solid Login";
      login_tab.src = "images/slogin24.png";
    }
  } catch(e) {}  


  var cmd = $('#save-action option:selected').attr('id');
  if (cmd==='filesave')
    $('#save-file').show();
  else
    $('#save-file').hide();

  if (cmd==='fileupload') {
    $('#login-fmt-item').show();
    $('#oidc-upload').show();
  } 
  else if (cmd==='sparqlupload') {
    $('#login-fmt-item').show();
    $('#oidc-upload').hide();
  }
  else {
    $('#login-fmt-item').hide();
    $('#oidc-upload').hide();
  }

  var filename;
  var fmt = $('#save-fmt option:selected').attr('id');

  if (fmt == "jsonld")
    filename = cmd==="fileupload" ? "jsonld_data.jsonld" : "jsonld_data.txt";
  else if (fmt == "json")
    filename = "json_data.txt";
  else if (fmt == "rdf") 
    filename = "rdf_data.rdf";
  else 
    filename = cmd==="fileupload" ? "turtle_data.ttl" : "turtle_data.txt";

  if (cmd ==="sparqlupload") {
    $('#save-filename').hide();    
    $('#save-fmt-item').hide();    
    $('#save-sparql-item').show();    
  } else {
    $('#save-filename').show();    
    $('#save-fmt-item').show();    
    $('#save-sparql-item').hide();    
  }

  if (pod)
    await gOidc.checkSession();

  var oidc_url = document.getElementById('oidc-url');
  oidc_url.value = (gOidc.storage || '') + (filename || '');

  var save_filename = document.getElementById('save-filename');
  save_filename.value = filename || '';
}


async function Download_exec()
{
  var settings = new Settings();
  var selectedTab = getSelectedTab();
  await settings._syncAll();

  var _url = new URL(doc_URL);
  _url.hash = "osds";

  const graph = await settings.getValue('upload_sparql_graph');
  DOM.iSel('save-sparql-graph').value = graph ? graph : _url.toString();

  $('#save-action').change(function() {
    Download_exec_update_state();
  });

  $('#save-fmt').change(function() {
    Download_exec_update_state();
  });

  Download_exec_update_state(1);

  var isFileSaverSupported = false;
  try {
    isFileSaverSupported = !!new Blob;
  } catch (e) {}

  if (!isFileSaverSupported) {
    $('#save-action').prop('disabled', true);
  }

  var filename = null;
  var fmt = "jsonld";

  $('#save-fmt #json').prop('disabled', true);

  for(var v of gData.tabs) {
    DOM.qSel(`#${v}-chk`).checked = false;
  }
  DOM.qSel(`#${selectedTab}-chk`).checked = true;


  if (selectedTab==="jsonld") {
    filename = "jsonld_data.txt";
    fmt = "jsonld";
  }
  else if (selectedTab==="turtle") {
    filename = "turtle_data.txt";
    fmt = "ttl";
  }
  else if (selectedTab==="micro") {
    filename = "microdata_data.txt";
    fmt = "jsonld";
  }
  else if (selectedTab==="rdfa") {
    filename = "rdfa_data.txt";
    fmt = "ttl";
  }
  else if (selectedTab==="rdf") {
    filename = "rdf_xml_data.txt";
    fmt = "rdf";
  }
  else if (selectedTab==="posh") {
    filename = "posh_data.txt";
    fmt = "ttl";
  }
  else if (selectedTab==="json" || selectedTab==="jsonl") {
    filename = "json_data.txt";
    fmt = "json";
    $('#save-fmt #json').prop('disabled', false);
  }
  else if (selectedTab==="csv") {
    filename = "turtle_data.txt";
    fmt = "ttl";
  }
  else if (selectedTab==="rss") {
    filename = "turtle_data.txt";
    fmt = "ttl";
  }
  else if (selectedTab==="atom") {
    filename = "turtle_data.txt";
    fmt = "ttl";
  }
  else if (selectedTab==="markdown") {
    return;
  }


  if (filename!==null) {
    $('#save-filename').val(filename);

    var cur_fmt = $('#save-fmt option:selected').attr('id');
    $('#'+cur_fmt,'#save-fmt').removeProp('selected');
    $('#'+fmt,'#save-fmt').prop('selected',true);

    DOM.iSel('save-sparql-endpoint').value = await settings.getValue('upload_sparql_endpoint');

    var dlg = $( "#save-confirm" ).dialog({
      resizable: true,
      width:520,
      height:420,
      modal: true,
      buttons: {
        "OK": function() {
          var action = $('#save-action option:selected').attr('id');
          var fmt = $('#save-fmt option:selected').attr('id');
          var fname = action ==='fileupload' ? $('#oidc-url').val().trim(): $('#save-filename').val().trim();
          save_data(action, fname, fmt)
           .then(() => {$("#save-confirm").dialog( "destroy" )});
        },
        Cancel: function() {
          $(this).dialog( "destroy" );
        }
      }
    });
  } else {
    return false;
  }

  return false;
}


async function save_data(action, fname, fmt, callback)
{
  Browser.api.runtime.sendMessage({cmd: 'reset_uploads'});

  if (action==="sparqlupload") 
  {
    var sparqlendpoint = $('#save-sparql-endpoint').val().trim();
    var sparql_graph = $('#save-sparql-graph').val().trim();
    var data = [];
    var exec_cmd = { cmd:'actionSPARQL_Upload', 
                     baseURI: gData.baseURL,
                     qdata:[], 
                     sparql_ep:sparqlendpoint,
                     sparql_graph, 
                     sparql_check:null
                   };
    
    fmt = "ttl";

    if (!sparqlendpoint || sparqlendpoint.length < 1) {
      showInfo('SPARQL endpoint is empty');
      return;
    }
    
    for(var v of gData.tabs) {
      if (DOM.qSel(`#${v}-chk`).checked) {
        var dt = await prepare_data(true, v, fmt);
        if (dt)
          data.push(dt);
      }
    }

    const handler = new Convert_Turtle();
    try {
      for(var v of data) {
        if (v.error && !v.txt)
          showInfo('Unable prepare data:' +v.error)
        var ttl_data = await handler.prepare_query(v.txt, exec_cmd.baseURI);
        var query = ttl_data.map(item => ({prefixes: item.prefixes, triples: item.triples}));;
        exec_cmd.qdata = exec_cmd.qdata.concat(query);
      }
    } catch(ex) {
      console.log(ex);
      showInfo(ex);
      return;
    }

    if (document.querySelector('#save-sparql-check-res').checked) {
      var settings = new Settings();
      exec_cmd.sparql_check = await settings.createSparqlUrl(sparql_graph, sparqlendpoint);
    }

    Browser.api.runtime.sendMessage(exec_cmd);
    close(); // close popup

  } 
  else 
  {
    var retdata = await prepare_data(false, getSelectedTab(), fmt);
    if (!retdata)
      return;

    if (retdata && retdata.error.length > 0) {
      showInfo(retdata.error);
    }
    
    if (action==="export-rww") {
        if (callback)
          callback(retdata.txt);
    }
    else if (action==="filesave") 
    {
      var blob = new Blob([retdata.txt + retdata.error], {type: "text/plain;charset=utf-8"});
      saveAs(blob, fname);
/***
    var blob = new Blob([retdata.txt + retdata.error], {type: "text/plain;charset=utf-8"});
    var blobUrl = window.URL.createObjectURL(blob);

    var link = document.createElement('a');
    link.href = blobUrl;
    link.download = fname; 


    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(link);
      }, 2000);

***/
    }
    else if (action==="fileupload") 
    {
      const webId = await gOidc.checkSession();
      if (!webId) {
        showInfo("You must be LoggedIn for Upload")
        return;
      }

      var contentType = "text/plain;charset=utf-8";

      if (fmt==="jsonld")
        contentType = "application/ld+json;charset=utf-8";
      else if (fmt==="json")
        contentType = "application/json;charset=utf-8";
      else if (fmt==="rdf")
        contentType = "application/rdf+xml;charset=utf-8";
      else
        contentType = "text/turtle;charset=utf-8";
      
      DOM.qSel('.super_links_msg').style.display = 'flex';
      let v = await gOidc.putResource(fname, retdata.txt, contentType);
      DOM.qSel('.super_links_msg').style.display = 'none';
      if (v.rc===1)
        showInfo('Saved', fname);
      else
        showInfo('Unable to save: ' +v.err);
    }
    else {
      selectTab("src");
      src_view.setValue(retdata.txt + retdata.error+" \n \n ");
    }

  }
    
}


async function prepare_data(for_query, curTab, fmt)
{
  try{
    var block = null;

    if (curTab==="jsonld")
      block = gData.jsonld;
    else if (curTab==="json")
      block = gData.json;
    else if (curTab==="jsonl")
      block = gData.jsonl;
    else if (curTab==="turtle")
      block = gData.turtle;
    else if (curTab==="micro")
      block = gData.micro;
    else if (curTab==="rdfa")
      block = gData.rdfa;
    else if (curTab==="rdf")
      block = gData.rdf;
    else if (curTab==="posh")
      block = gData.posh;
    else if (curTab==="csv")
      block = gData.csv;
    else if (curTab==="rss" && (gData.links.rss && gData.links.rss.loaded() || gData.rss)) {
      if (gData.rss) {
        block = gData.rss.copy();
        if (gData.links.rss && gData.links.rss.loaded())
          block.add_nano(gData.links.rss.block.text);
      } else {
        block = gData.links.rss.block;
      }
    }
    else if (curTab==="atom" && (gData.links.atom && gData.links.atom.loaded() || gData.atom)) {
      if (gData.atom) {
        block = gData.atom.copy();
        if (gData.links.atom && gData.links.atom.loaded())
          block.add_nano(gData.links.atom.block.text);
      } else {
        block = gData.links.atom.block;
      }
    }
    else
      return null;


    if (fmt === "ttl")
      return await block.to_ttl(for_query);
    else if (fmt === "jsonld")
      return await block.to_jsonld();
    else if (fmt === "rdf")
      return await block.to_rdf();
    else if (fmt === "json")
      return await block.to_json();


  } catch(ex) {
    return {txt: "", error: ex.toString()};
  }

}


function showInfo(msg, href)
{
  let el;

  el = DOM.iSel('alert-msg');
  el.textContent = msg;

  el = DOM.iSel('alert_href')
  if (href) {
    el.href = href;
    el.innerText = href
    DOM.Show(el);
  } else {
    DOM.Hide(el);
  }

  $('#alert-dlg').dialog({
    resizable: true,
    height:250,
    width:450,
    modal: true,
    buttons: {
      "OK": function() {
        $(this).dialog('destroy');
      }
    }
  });
}




