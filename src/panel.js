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

var items;
var $ = jQuery;
var gData_exists = false;
var gData_showed = false;
var doc_URL = null;
var prevSelectedTab = null;
var selectedTab = null;
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
        csv: null,
        rss: null,
        atom: null,

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
    if (Browser.isFirefoxWebExt) {
      Browser.api.tabs.sendMessage(tabId, { property: 'req_doc_data' })
        .then(response => {
          if (!response || !response.ping) {
            hideDataTabs();
            selectedTab = null;
            selectTab('#cons');
            g_RestCons.show();
          }
        })
        .catch(err => {
          hideDataTabs();
          selectedTab = null;
          selectTab('#cons');
          g_RestCons.show();
        });
    } else {
      Browser.api.tabs.sendMessage(tabId, { property: 'req_doc_data'},
        function(response) { 
          if (!response || !response.ping) {
            hideDataTabs();
            selectedTab = null;
            selectTab('#cons');
            g_RestCons.show();
          }
        });
    }
  } catch(e) {
    hideDataTabs();
    selectedTab = null;
    selectTab('#cons');
    g_RestCons.show();
  }

  Download_exec_update_state();

  async function click_login() {
     if (gOidc.webid) {
       await gOidc.logout();
       Download_exec_update_state();
     } else {
       gOidc.login();
     }
  } 

  var oidc_login_btn = document.getElementById('oidc-login-btn');
  oidc_login_btn.addEventListener('click', click_login);

  var oidc_login_btn1 = document.getElementById('oidc-login-btn1');
  oidc_login_btn1.addEventListener('click', click_login);


  $('#slink_btn').click(SuperLinks_exec);

  $('#login_btn').click(Login_exec);

  $('#import_btn').click(Import_doc);

  $('#rww_btn').click(Rww_exec);

  $('#sparql_btn').click(Sparql_exec);

  $('#rest_btn').click(function() {
    selectTab('#cons');
    g_RestCons.load(doc_URL);
    g_RestCons.show();
    var node = DOM.iSel("rest_query");
    gMutationObserver.observe(node, {attributes:true, childList:true, subtree:true});
  });

  $('#download_btn').click(Download_exec);

  $('#prefs_btn').click(Prefs_exec);

  $('#tabs a[href="#src"]').click(function(){
      selectTab(prevSelectedTab);
      return false;
  });
  $('#tabs a[href="#cons"]').click(function(){
    selectTab(prevSelectedTab);
    return false;
  });
  $('#tabs a[href="#micro"]').click(function(){
    selectTab('#micro');
    return false;
  });
  $('#tabs a[href="#jsonld"]').click(function(){
    selectTab('#jsonld');
    return false;
  });
  $('#tabs a[href="#turtle"]').click(function(){
    selectTab('#turtle');
    return false;
  });
  $('#tabs a[href="#rdfa"]').click(function(){
    selectTab('#rdfa');
    return false;
  });
  $('#tabs a[href="#rdf"]').click(function(){
    selectTab('#rdf');
    return false;
  });
  $('#tabs a[href="#posh"]').click(function(){
    selectTab('#posh');
    return false;
  });
  $('#tabs a[href="#json"]').click(function(){
    selectTab('#json');
    return false;
  });

  $('#tabs a[href="#csv"]').click(function(){
    selectTab('#csv');
    return false;
  });

  $('#tabs a[href="#rss"]').click(function(){
    selectTab('#rss');
    return false;
  });

  $('#tabs a[href="#atom"]').click(function(){
    selectTab('#atom');
    return false;
  });

  $('#load_rss').click(function() {
        if (gData.links.rss)
          gData.links.rss.loadData({}, 0);
  });

  $('#load_atom').click(function() {
        if (gData.links.atom)
          gData.links.atom.loadData({}, 0);
  });


  $('#tabs a[href="#rss"]').hide();
  $('#tabs a[href="#atom"]').hide();

  try {
    src_view = CodeMirror.fromTextArea(document.getElementById('src_place'), {
      lineNumbers: true
    });
    src_view.setSize("100%", "100%");
  } catch(e) { }

  try{
    g_RestCons.yasqe.obj = YASQE.fromTextArea(document.getElementById('query_place'), {
      lineNumbers: true,
      lineWrapping: false,
      sparql: { showQueryButton: false },
	      createShortLink : null,
	      createShareLink : null,
	      persistent: null,

    });
    g_RestCons.yasqe.obj.setSize("100%", 260);
  } catch(e) {
  }
  
  if (doc_URL)
    g_RestCons.load(doc_URL);

  $('#rest_exec').click(function() {
    g_RestCons.exec(gData.tab_index);
  });
  $('#rest_exit').click(function(){
    gMutationObserver.disconnect();
    if (prevSelectedTab)
      selectTab(prevSelectedTab);
    return false;
  });

  $('#src_exit').click(function(){
    selectTab(prevSelectedTab);
    return false;
  });

  gData_showed = false;
}


async function loadPopup()
{
  $("#save-confirm").hide();
  $("#alert-dlg").hide();
  $("#login-dlg").hide();
  $("#query_place").hide();
  selectTab('#micro');

  jQuery('#ext_ver').text('\u00a0ver:\u00a0'+ Browser.api.runtime.getManifest().version);

  var curTabs = await getCurTab();
  var tabId = null;

  if (curTabs.length > 0) {
    tabId = curTabs[0].id;
    doc_URL = curTabs[0].url;
  }
  
  var setting = new Settings();
  var chk_all = setting.getValue("ext.osds.handle_all");
  if (chk_all && chk_all!=="1") {
    Browser.api.runtime.sendMessage({'cmd': 'openIfHandled', tabId},
       function(resp) {
            if (resp && resp.opened)
               close();
            else
               showPopup(tabId);
       });
  } 
  else {
    showPopup(tabId);
  }
}

$(document).ready(function ()
{ 
  document.getElementById("c_year").innerText = new Date().getFullYear();

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

  var tab_data = DOM.qSel(`${selectedTab}_items`);

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
  prevSelectedTab = selectedTab;
  selectedTab = tab;

  function updateTab(tab, selTab)
  {
    var tab_data = $(tab+'_items');
    var tab_id = $('#tabs a[href="'+tab+'"]');

    if (selTab===tab) {
      tab_data.show()
      tab_id.addClass('selected');
    } else {
      tab_data.hide()
      tab_id.removeClass('selected');
    }
  }

  updateTab('#src', selectedTab);
  updateTab('#cons', selectedTab);
  updateTab('#micro', selectedTab);
  updateTab('#jsonld', selectedTab);
  updateTab('#turtle', selectedTab);
  updateTab('#rdfa', selectedTab);
  updateTab('#rdf', selectedTab);
  updateTab('#posh', selectedTab);
  updateTab('#json', selectedTab);
  updateTab('#csv', selectedTab);
  updateTab('#rss', selectedTab);
  updateTab('#atom', selectedTab);
  $('#tabs a[href="#src"]').hide();
  $('#tabs a[href="#cons"]').hide();
}


function hideDataTabs()
{
  $('#tabs a[href="#micro"]').hide();
  $('#tabs a[href="#jsonld"]').hide();
  $('#tabs a[href="#turtle"]').hide();
  $('#tabs a[href="#rdfa"]').hide();
  $('#tabs a[href="#rdf"]').hide();
  $('#tabs a[href="#posh"]').hide();
  $('#tabs a[href="#json"]').hide();
  $('#tabs a[href="#csv"]').hide();
  $('#tabs a[href="#rss"]').hide();
  $('#tabs a[href="#atom"]').hide();
}


function update_tab(tabname, title, val, err_tabs)
{
  function create_err_msg(fmt_name, errors)
  {
    var err_html = "";
    if (errors) {

      if ($.isArray(errors)) {
        for(var i=0; i<errors.length; i++)
          err_html += "<tr><td>"+errors[i]+"</tr></td>";
      }
      else if (errors.length > 0) {
          err_html += "<tr><td>"+errors+"</tr></td>";
      }

      if (err_html.length > 0)
        err_html = "<table class='docdata table'><tr><td>"+fmt_name
                  +" discovered, but fails syntax checking by parser:</td></tr>"
                  +err_html+"</table>";
    }
    return (err_html.length>0)?err_html:null;
  }


  var html = "";

  $(`#${tabname}_items table.wait`).hide();
  $(`#${tabname}_items #docdata_view`).remove();
  $(`#${tabname}_items`).append("<div id='docdata_view' class='alignleft'/>");

  if (val.html && val.html.trim().length > 0) {
      html += val.html;
      gData.tabs.push(`#${tabname}`);
  }
  if (val.error) {
      var err_msg = create_err_msg(title, val.error);
      if (err_msg) {
        html += err_msg;
        if (err_tabs)
          err_tabs.push(`#${tabname}`);
      }
  }
  if (html.length > 0 && html.replace(/\s/g, "").length > 0) {
      $(`#${tabname}_items #docdata_view`).append(html);
      return true;
  } else {
    $(`#tabs a[href="#${tabname}"]`).hide();
    $(`#${tabname}-save`).hide();
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
  var cons = false;
  var micro = false;
  var jsonld = false;
  var turtle = false;
  var rdfa = false;
  var rdf = false;
  var posh = false;
  var json = false;
  var csv = false;
  var rss = false;
  var atom = false;
  var html = "";
  var err_tabs = [];
  var bnode_types = {};

  gData.tabs = [];
//  $('table.wait').hide();
  $('#rss-save').hide();
  $('#atom-save').hide();

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
  
  if (gData.posh)
    posh = await update_tab_exec('posh', 'POSH', gData.posh, err_tabs);

  if (gData.json)
    json = await update_tab_exec('json', 'JSON', gData.json, err_tabs);

  if (gData.csv)
    csv = await update_tab_exec('csv', 'CSV', gData.csv, err_tabs);

  if (gData.links.rss)
    rss = true;
  if (gData.links.atom)
    atom = true;

  if (gData.tabs.length > 0)
    selectTab(gData.tabs[0]);
  else if (err_tabs.length > 0)
    selectTab(err_tabs[0]);


  if (!micro) {
    $('#tabs a[href="#micro"]').hide();
    $('#micro-save').hide();
  }
  if (!jsonld) {
    $('#tabs a[href="#jsonld"]').hide();
    $('#jsonld-save').hide();
  }
  if (!turtle) {
    $('#tabs a[href="#turtle"]').hide();
    $('#turtle-save').hide();
  }
  if (!rdfa) {
    $('#tabs a[href="#rdfa"]').hide();
    $('#rdfa-save').hide();
  }
  if (!rdf) {
    $('#tabs a[href="#rdf"]').hide();
    $('#rdf-save').hide();
  }
  if (!posh) {
    $('#tabs a[href="#posh"]').hide();
    $('#posh-save').hide();
  }
  if (!json) {
    $('#tabs a[href="#json"]').hide();
    $('#json-save').hide();
  }
  if (!csv) {
    $('#tabs a[href="#csv"]').hide();
    $('#csv-save').hide();
  }
  if (rss) {
    $('#tabs a[href="#rss"]').show();
  } 
  if (atom) {
    $('#tabs a[href="#atom"]').show();
  }

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

    $(`#tabs a[href="#${tab}"]`).show();
    $(`#${tab}-save`).show();
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

    gData.turtle = new TTL_Block(gData.baseURL, dData.turtle.text);
    await gData.turtle.add_nano(dData.ttl_nano.text);
    await gData.turtle.add_nano(dData.ttl_curly_nano.text);

    gData.posh = new TTL_Block(gData.baseURL, [dData.posh.text]);

    gData.rdfa = new RDFa_Block(gData.baseURL, dData.rdfa.ttl, dData.rdfa.data);
    
    gData.rdf = new RDF_Block(gData.baseURL, dData.rdf.text);
    gData.rdf.add_nano(dData.rdf_nano.text);

    gData.csv = new CSV_Block(gData.baseURL, dData.csv_nano.text);

    if (dData.posh.links) 
    {
      var setting = new Settings();
      var chk_discovery = setting.getValue("ext.osds.auto_discovery");
      var atom_links = [];
      var rss_links = [];
      var jsonld_links = []
      var rdf_links = []
      var ttl_links = []

      for(var href in val.d.posh.links) {
        var type = val.d.posh.links[href];
        if (type === 'application/atom+xml')
           atom_links.push(href);
        else if (type === 'application/rss+xml')
          rss_links.push(href);
        else if (type === 'application/json+ld' || type === 'application/ld+json')
          jsonld_links.push(href);
        else if (type === 'application/rdf+xml')
          rdf_links.push(href);
        else if (type === 'text/turtle' || type === 'text/n3')
          ttl_links.push(href);
      }

      if (rss_links.length > 0) 
        gData.links.rss = new RSS_Links("rss", "RSS", gData.baseURL, rss_links, links_cb_start, links_cb_error, links_cb_success);

      if (atom_links.length > 0)
        gData.links.atom = new Atom_Links("atom", "Atom", gData.baseURL, atom_links, links_cb_start, links_cb_error, links_cb_success);

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

      if (jsonld_links.length > 0) {
        $('#jsonld_items #throbber').show();
        $('#jsonld_items #load_jsonld').hide();
        $(`#jsonld_items table.loader`).show();
        gData.links.jsonld = new JSONLD_Links("jsonld", "JSON-LD", gData.baseURL, jsonld_links, gData.jsonld, links_cb_start, links_cb_error, links_cb_success);
        gData.links.jsonld.loadData({}, 0); 
      }

      if (rdf_links.length > 0) {
        $('#rdf_items #throbber').show();
        $('#rdf_items #load_jsonld').hide();
        $(`#rdf_items table.loader`).show();
        gData.links.rdf = new RDF_Links("rdf", "RDF/XML", gData.baseURL, rdf_links, gData.rdf, links_cb_start, links_cb_error, links_cb_success);
        gData.links.rdf.loadData({}, 0); 
      }

      if (ttl_links.length > 0) {
        $('#ttl_items #throbber').show();
        $('#ttl_items #load_jsonld').hide();
        $(`#ttl_items table.loader`).show();
        gData.links.ttl = new TTL_Links("turtle", "Turtle", gData.baseURL, ttl_links, gData.turtle, links_cb_start, links_cb_error, links_cb_success);
        gData.links.ttl.loadData({}, 0); 
      }
    }
  } catch (e) {
    console.log(e);
  }
}



//Chrome API
//wait data from extension
Browser.api.runtime.onMessage.addListener(async function(request, sender, sendResponse)
{
  try {
    if (request.property == "doc_data")
    {
      var dData = JSON.parse(request.data);
      try {
        gData.tab_index = sender.tab.index;
      } catch(e){}

      g_RestCons.load(doc_URL);

      if (request.is_data_exists)
      {
        try {
          await parse_Data(dData);
          await show_Data();
        } catch(ex) {
          console.log("OSDS: Error="+ex);
          hideDataTabs();
          selectedTab = null;
        }
      }
      else
      {
        hideDataTabs();
        selectedTab = null;

        selectTab('#cons');
        g_RestCons.show();
      } 
    }

    sendResponse({}); /* stop */
  } catch(e) {
    console.log("OSDS: onMsg="+e);
  }

});



////////////////////////////////////////////////////
async function SuperLinks_exec()
{
  if (doc_URL!==null) {
    Browser.api.runtime.sendMessage({cmd: 'actionSuperLinks'});
  }
  return false;
}




function Import_doc()
{
  if (doc_URL!==null) {
     var _url = (new Settings()).createImportUrl(doc_URL);
     Browser.openTab(_url, gData.tab_index);
  }

  return false;
}


function Rww_exec()
{
  function openRww(data)
  {
     var _url = (new Settings()).createRwwUrl(doc_URL, data);
     Browser.openTab(_url, gData.tab_index);
  }


  if (doc_URL!==null) {
     var edit_url = (new Settings()).getValue('ext.osds.rww.edit.url');

     if (edit_url.indexOf("{data}")!=-1) {
        save_data("export-rww", "data.txt", "ttl", openRww);
     } else {
        openRww(null);
     }
  }

  return false;
}


function Sparql_exec()
{
  if (doc_URL!==null) {
     var u = new URL(doc_URL);
     var _url = (new Settings()).createSparqlUrl(u.toString());
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



async function Login_exec()
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


function Download_exec_update_state() 
{
  try {
    gOidc.checkSession().then(() => {
      var webid = gOidc.webid;

      var webid_href = document.getElementById('oidc-webid');
      var webid1_href = document.getElementById('oidc-webid1');

      webid1_href.href = webid_href.href = webid ? webid :'';
      webid1_href.title = webid_href.title = webid ? webid :'';
      webid1_href.style.display = webid_href.style.display = webid ? 'initial' :'none';

      var oidc_login_btn = document.getElementById('oidc-login-btn');
      var oidc_login_btn1 = document.getElementById('oidc-login-btn1');
      oidc_login_btn1.innerText = oidc_login_btn.innerText 
                                = webid ? 'Logout' : 'Login';

      var login_tab = document.getElementById('login_btn');
      if (webid) {
        login_tab.title = "Logged as "+webid;
        login_tab.src = "images/uid.png";
      } else {
        login_tab.title = "Solid Login";
        login_tab.src = "images/slogin24.png";
      }
    });


  } catch (e) {
    console.log(e);
  }

  
  var cmd = $('#save-action option:selected').attr('id');
  if (cmd==='filesave')
    $('#save-file').show();
  else
    $('#save-file').hide();

  if (cmd==='fileupload') {
    $('#oidc-login').show();
    $('#oidc-upload').show();
  } 
  else if (cmd==='sparqlupload') {
    $('#oidc-login').show();
    $('#oidc-upload').hide();
  }
  else {
    $('#oidc-login').hide();
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

  var oidc_url = document.getElementById('oidc-url');
  oidc_url.value = (gOidc.storage || '') + (filename || '');

  var save_filename = document.getElementById('save-filename');
  save_filename.value = filename || '';
}


async function Download_exec()
{
  var _url = new URL(doc_URL);
  _url.hash = "osds";
  $('#save-sparql-graph').val(_url.toString());

  $('#save-action').change(function() {
    Download_exec_update_state();
  });

  $('#save-fmt').change(function() {
    Download_exec_update_state();
  });

  Download_exec_update_state();

  var isFileSaverSupported = false;
  try {
    isFileSaverSupported = !!new Blob;
  } catch (e) {}

  if (!isFileSaverSupported) {
    $('#save-action').prop('disabled', true);
  }

  if (Browser.isEdgeWebExt)
    $('#save-action').prop('disabled', true);


  var filename = null;
  var fmt = "jsonld";

  $('#save-fmt #json').prop('disabled', true);

  for(var v of gData.tabs) {
    DOM.qSel(`${v}-chk`).checked = false;
  }
  DOM.qSel(`${selectedTab}-chk`).checked = true;


  if (selectedTab==="#jsonld") {
    filename = "jsonld_data.txt";
    fmt = "jsonld";
  }
  else if (selectedTab==="#turtle") {
    filename = "turtle_data.txt";
    fmt = "ttl";
  }
  else if (selectedTab==="#micro") {
    filename = "microdata_data.txt";
    fmt = "jsonld";
  }
  else if (selectedTab==="#rdfa") {
    filename = "rdfa_data.txt";
    fmt = "ttl";
  }
  else if (selectedTab==="#rdf") {
    filename = "rdf_xml_data.txt";
    fmt = "rdf";
  }
  else if (selectedTab==="#posh") {
    filename = "posh_data.txt";
    fmt = "ttl";
  }
  else if (selectedTab==="#json") {
    filename = "json_data.txt";
    fmt = "json";
    $('#save-fmt #json').prop('disabled', false);
  }
  else if (selectedTab==="#csv") {
    filename = "turtle_data.txt";
    fmt = "ttl";
  }
  else if (selectedTab==="#rss") {
    filename = "turtle_data.txt";
    fmt = "ttl";
  }
  else if (selectedTab==="#atom") {
    filename = "turtle_data.txt";
    fmt = "ttl";
  }


  if (filename!==null) {
    $('#save-filename').val(filename);

    var cur_fmt = $('#save-fmt option:selected').attr('id');
    $('#'+cur_fmt,'#save-fmt').removeProp('selected');
    $('#'+fmt,'#save-fmt').prop('selected',true);

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
  if (action==="sparqlupload") 
  {
    var sparqlendpoint = $('#save-sparql-endpoint').val().trim();
    var sparql_graph = $('#save-sparql-graph').val().trim();
    var exec_cmd = { cmd:'actionSPARQL_Upload', 
                     baseURI: gData.baseURL,
                     data:[], 
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
      if (DOM.qSel(`${v}-chk`).checked) {
        var dt = await prepare_data(true, v, fmt);
        if (dt)
          exec_cmd.data.push(dt);
      }
    }

    if (document.querySelector('#save-sparql-check-res').checked) {
      exec_cmd.sparql_check = (new Settings()).createSparqlUrl(sparql_graph, sparqlendpoint);
    }

    Browser.api.runtime.sendMessage(exec_cmd);

  } 
  else 
  {
    var retdata = await prepare_data(false, selectedTab, fmt);
    if (!retdata)
      return;

    if (retdata && retdata.error.length > 0) {
      showInfo(retdata.error);
//??--      return;
    }
    
    if (action==="export-rww") {
        if (callback)
          callback(retdata.txt);
    }
    else if (action==="filesave") 
    {
      blob = new Blob([retdata.txt + retdata.error], {type: "text/plain;charset=utf-8"});
      saveAs(blob, fname);
    }
    else if (action==="fileupload") 
    {
     var contentType = "text/plain;charset=utf-8";

     if (fmt==="jsonld")
       contentType = "application/ld+json;charset=utf-8";
     else if (fmt==="json")
       contentType = "application/json;charset=utf-8";
     else if (fmt==="rdf")
       contentType = "application/rdf+xml;charset=utf-8";
     else
       contentType = "text/turtle;charset=utf-8";

      putResource(gOidc, fname, retdata.txt, contentType, null)
        .then(response => {
          showInfo('Saved');
        })
        .catch(error => {
          console.error('Error saving document', error)

          let message

          switch (error.status) {
            case 0:
            case 405:
              message = 'this location is not writable'
              break
            case 401:
            case 403:
              message = 'you do not have permission to write here'
              break
            case 406:
              message = 'enter a name for your resource'
              break
            default:
              message = error.message
              break
          }
          showInfo('Unable to save:' +message);
        })
    }
    else {
      selectTab("#src");
      src_view.setValue(retdata.txt + retdata.error+"\n");
    }

  }
    
}


async function prepare_data(for_query, curTab, fmt)
{
  try{
    var block = null;

    if (curTab==="#jsonld")
      block = gData.jsonld;
    else if (curTab==="#json")
      block = gData.json;
    else if (curTab==="#turtle")
      block = gData.turtle;
    else if (curTab==="#micro")
      block = gData.micro;
    else if (curTab==="#rdfa")
      block = gData.rdfa;
    else if (curTab==="#rdf")
      block = gData.rdf;
    else if (curTab==="#posh")
      block = gData.posh;
    else if (curTab==="#csv")
      block = gData.csv;
    else if (curTab==="#rss" && gData.links.rss && gData.links.rss.loaded())
      block = gData.links.rss.block;
    else if (curTab==="#atom" && gData.links.atom && gData.links.atom.loaded())
      block = gData.links.atom.block;
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





