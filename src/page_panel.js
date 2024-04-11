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


var items;
var $ = jQuery;
var gData_showed = false;
var doc_URL = null;
var prevSelectedTab = null;

var gData = {
        text: null,
        type: null,
        url: null,
        ext: null,
        baseURL: null,
        block: null
      };

var src_view = null;
var g_RestCons = new Rest_Cons();
var gMutationObserver = new MutationObserver((mlist, observer) => g_RestCons.update())
var gOidc = new OidcWeb();


DOM.ready(() =>
{
  DOM.iSel("c_year").innerText = new Date().getFullYear();

  selectTab('micro');

  gOidc.restoreConn().then(rc => {
    Download_exec_update_state();
  })

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

  $("#save-confirm").hide();
  $("#alert-dlg").hide();
  $("#login-dlg").hide();

  DOM.iSel("login_btn").onclick = (e) => { Login_exec() }
  DOM.iSel("import_btn").onclick = (e) => { Import_doc() }
  DOM.iSel("rww_btn").onclick = (e) => { Rww_exec(); }
  DOM.iSel("sparql_btn").onclick = (e) => { Sparql_exec(); }

  DOM.iSel("rest_btn").onclick = (e) => { 
    selectTab('cons');
    g_RestCons.show();
    var node = DOM.iSel("rest_query");
    gMutationObserver.observe(node, {attributes:true, childList:true, subtree:true});
  }

  DOM.iSel("download_btn").onclick = (e) => { Download_exec() }

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
    g_RestCons.yasqe.obj.setSize("98%", 300);
  } catch(e) { }

  $("#query_place").hide();

  DOM.iSel("rest_exec").onclick = (e) => { g_RestCons.exec(); }
  DOM.iSel("rest_exit").onclick = (e) => { 
      gMutationObserver.disconnect();
      selectTab(prevSelectedTab);
      return false;
  }

  DOM.iSel("src_exit").onclick = (e) => { selectTab(prevSelectedTab); return false; }

  load_data_from_url(document.location);

  DOM.iSel("ext_ver").innerText = '\u00a0ver:\u00a0'+ Browser.api.runtime.getManifest().version;


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


  Browser.api.runtime.onMessage.addListener(function (request, sender, sendResponse) {
      if (request.cmd == "super_links_msg_show") {
          if (request.message) {
            DOM.qSel('.super_links_msg #super_links_msg_text').innerHTML = request.message;
            $(".super_links_msg").css("display","flex");
          }
      }
      else if (request.cmd == "super_links_msg_hide") {
          $(".super_links_msg").css("display","none");
      }
      else if (request.cmd == "super_links_snackbar") {
          if (request.msg1) {
            showSnackbar(request.msg1, request.msg2);
          }
      }
      else if (request.cmd === "osds_msg_show") {
          if (request.message) {
            DOM.qSel('.osds_popup #osds_popup_msg').innerText = request.message;
            DOM.qSel('.osds_popup').style.display = 'block';
          }
      }
      else if (request.cmd === "osds_msg_hide") {
          var el = DOM.qSel('.osds_popup');
          if (el)
            el.style.display = 'none';
      }
  });

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

  var url = new URL(gData.baseURL);
  url.hash = '';
  url = url.toString();

  if (href.lastIndexOf(url+"#sc", 0) === 0) {
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


function load_data_from_url(loc)
{
    function parseUrlQuery(loc)
    {
      var data = {};
      if(loc.search) {
        var pair = (loc.search.substr(1)).split('&');
        for(var i = 0; i < pair.length; i ++) {
            var param = pair[i].split('=');
            data[param[0]] = param[1];
        }
      }
      return data;
    }

    var params = parseUrlQuery(loc);
    if (!params["url"])
      return;

    var url = decodeURIComponent(params.url);
    var type = params.type;
    var ext = params.ext;

    var hdr_accept = "";

    if (type==="atom")
      hdr_accept = 'application/rss+xml, application/rdf+xml;q=0.8, application/atom+xml;q=0.6, application/xml;q=0.4, text/xml;q=0.4';
    else if (type==="rss")
      hdr_accept = 'application/rss+xml, application/rdf+xml;q=0.8, application/atom+xml;q=0.6, application/xml;q=0.4, text/xml;q=0.4';
    else if (type==="turtle")
      hdr_accept = 'text/turtle,text/n3;q=1.0,text/plain;q=0.5,text/html;q=0.5,*/*;q=0.1';
    else if (type==="jsonld")
      hdr_accept = 'application/ld+json;q=1.0,text/plain;q=0.5,text/html;q=0.5,*/*;q=0.1';
    else if (type==="rdf")
      hdr_accept = 'application/rdf+xml;q=1.0,text/plain;q=0.5,text/html;q=0.5,*/*;q=0.1';
    else if (type==="xml")
      hdr_accept = 'application/xml;text/xml;q=0.9,text/html;application/xhtml+xml;q=0.5,*/*;q=0.1';
    else if (type==="json")
      hdr_accept = 'application/sparql-results+json;q=1.0,text/plain;q=0.5,text/html;q=0.5,*/*;q=0.1';
    else if (type==="jsonl")
      hdr_accept = 'application/jsonl;q=1.0,text/plain;q=0.5,text/html;q=0.5,*/*;q=0.1';
    else if (type==="csv")
      hdr_accept = 'text/csv,application/csv;q=1.0,text/plain;q=0.5,text/html;q=0.5,*/*;q=0.1';

    if (Browser.is_safari) {
      var options = {
            headers: {
              'Accept': hdr_accept,
              'Cache-control': 'no-cache'
            },
          };

      fetchWithTimeout(url, options, 30000)
      .then(rc => {
        if (!rc.ok) {  // not a 2xx level response
          var msg = "Could not load data from: "+url+"\nError: "+rc.statusText;
          alert(msg);
          show_Data(msg, '');
        }
        rc.text().then(txt => {
          start_parse_data(txt, type, url, ext);
        })
      })
      .catch( e => {
          var msg = "Could not load data from: "+url+"\nError: "+e;
          alert(msg);
          show_Data(msg, '');
      })

    }
    else 
    {

      jQuery.ajaxSetup({
         dataType: "text",
         headers:{'Accept': hdr_accept,
                  'Cache-control': 'no-cache'},
         timeout: 30000
      });

      jQuery.get(url, function(data, status){
          start_parse_data(data, type, url, ext);
      }, "text").fail(function(msg) {
          var msg = "Could not load data from: "+url+"\nError: "+msg.statusText;
          alert(msg);
          show_Data(msg, '');
      });
    }
}


async function start_parse_data(data_text, data_type, data_url, ext)
{
  var test_xml = /^\s*<\?xml/gi;
  var test_rdf = /^\s*<rdf:RDF/gi;
  var test_rdf1 = /^\s*<\?xml[\s\S]*>\s*<rdf:RDF/gi;

  var test_rss = /^\s*<rdf:rss/gi;
  var test_rss1 = /^\s*<\?xml[\s\S]*>\s*<rdf:rss/gi;
  var test_rss2 = /^\s*<rss/gi;
  var test_rss3 = /^\s*<\?xml[\s\S]*>\s*<rss/gi;

  var test_atom = /^\s*<rdf:feed/gi;
  var test_atom1 = /^\s*<\?xml[\s\S]*>\s*<rdf:feed/gi;
  var test_atom2 = /^\s*<feed/gi;
  var test_atom3 = /^\s*<\?xml[\s\S]*>\s*<feed/gi;
  var test_atom4 = /^\s*<\?xml[\s\S]*>\s*<atom:entry/gi;

  if (data_type === "rdf") {
    if (test_xml.exec(data_text)===null && test_rdf.exec(data_text)===null)
      data_type = "turtle";
  } 
  else if (data_type === "xml") {
    if (test_rdf.exec(data_text)!==null || test_rdf1.exec(data_text)!==null)
      data_type = "rdf";
    else if (test_rss.exec(data_text)!==null || test_rss1.exec(data_text)!==null || 
             test_rss2.exec(data_text)!==null || test_rss3.exec(data_text)!==null)
      data_type = "rss";
    else if (test_atom.exec(data_text)!==null || test_atom1.exec(data_text)!==null || 
             test_atom2.exec(data_text)!==null || test_atom3.exec(data_text)!==null ||
             test_atom4.exec(data_text)!==null)
      data_type = "atom";
  }


  gData.text = data_text;
  gData.type = data_type;
  gData.url = data_url;
  gData.ext = ext;

  doc_URL = data_url;

  var url = new URL(doc_URL);
  url.hash ='';
  gData.baseURL = url.toString();

  g_RestCons.load(doc_URL);

  if (data_type==="turtle")
    {
      gData.block = new DataBlock(gData.baseURL, [data_text], true);
    }
  else if (data_type==="jsonld")
    {
      gData.block = new JSONLD_Block(gData.baseURL, [data_text]);
    }
  else if (data_type==="rdf")
    {
      gData.block = new RDF_Block(gData.baseURL, [data_text]);
    }
  else if (data_type==="json")
    {
      gData.block = new JSON_Block(gData.baseURL, [data_text]);
    }
  else if (data_type==="jsonl")
    {
      gData.block = new JSONL_Block(gData.baseURL, [data_text]);
    }
  else if (data_type==="csv")
    {
      gData.block = new CSV_Block(gData.baseURL, [data_text]);
    }
  else if (data_type==="rss" || data_type==="atom")
    {
      gData.block = new RSS_Block(gData.baseURL, [data_text], data_type==="atom");
    }
  else
    {
//    location.href = data_url+"#osds";  // we don't close original tab, so just close OSDS viewer
      window.close();
    }

  if (gData.block) 
    {
      var rc = await gData.block.to_html({}, 0)
      show_Data(rc.error, rc.html);
    }
  else
    {
      window.close();
    }


}


function selectTab(tab)
{
  prevSelectedTab = getSelectedTab();
  var el = DOM.qSel(`#tab-${tab} input`);
  el.checked = true;
  $(el).parent().show();
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
    $(v).hide();
  }
}


function show_Data(data_error, html_data)
{
  var html = "";

  wait_data = $('table.wait').hide();

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

  
  function show_item(tabname, title)
  {
      $(`#${tabname}_items #docdata_view`).remove();
      $(`#${tabname}_items`).append("<div id='docdata_view' class='alignleft'/>");
      html = "";
      if (data_error.length > 0) {
        html += create_err_msg(title, data_error);
      } else {
        html += html_data;
      }

      if (html.length > 0)
          $(`#${tabname}_items #docdata_view`).append(html);

      $(`#tab-${tabname}`).parent().show();
      selectTab(`${tabname}`);
  }

  hideDataTabs();

  if (gData.type === "turtle")
    show_item('turtle', 'Turtle');
  else if (gData.type === "jsonld")
    show_item('jsonld', 'JSON-LD');
  else if (gData.type === "rdf")
    show_item('rdf', 'RDF/XML');
  else if (gData.type === "json")
    show_item('json', 'JSON');
  else if (gData.type === "jsonl")
    show_item('jsonl', 'JSONL');
  else if (gData.type === "csv")
    show_item('csv', 'CSV');
  else if (gData.type === "rss")
    show_item('rss', 'RSS');
  else if (gData.type === "atom")
    show_item('atom', 'Atom');

  gData_showed = true;
}




//////////////////////////////////////////////////////////////////////////////

async function Import_doc()
{
  if (doc_URL!==null) {
     var settings = new Settings();
     var _url = await settings.createImportUrl(doc_URL);
     Browser.api.tabs.create({url:_url});
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
      u.hash = '';
      u.search = '';
      var settings = new Settings();
      var _url = await settings.createSparqlUrl(u.toString());
      Browser.api.tabs.create({url:_url});
  }

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
  else if (fmt == "ttl") 
    filename = cmd==="fileupload" ? "turtle_data.ttl" : "turtle_data.txt";
  else
    filename = "rdf_data.rdf";

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

  await Download_exec_update_state(1);

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

  if (gData.type == "jsonld") {
    filename = "jsonld_data.txt";
    fmt = "jsonld";
  }
  else if (gData.type == "turtle") {
    filename = "turtle_data.txt";
    fmt = "ttl";
  }
  else if (gData.type == "rdf") {
    filename = "rdf_data.rdf";
    fmt = "rdf";
  }
  else if (gData.type == "json" || gData.type == "jsonl") {
    filename = "json_data.txt";
    fmt = "json";
    $('#save-fmt #json').prop('disabled', false);
  }
  else if (gData.type == "csv") {
    filename = "turtle_data.txt";
    fmt = "ttl";
  }
  else if (gData.type == "rss") {
    filename = "turtle_data.txt";
    fmt = "ttl";
  }
  else if (gData.type == "atom") {
    filename = "turtle_data.txt";
    fmt = "ttl";
  }

  var oidc_url = document.getElementById('oidc-url');
  oidc_url.value = gOidc.storage + (filename || '');


  if (filename!==null) {
    $('#save-filename').val(filename);

    var cur_fmt = $('#save-fmt option:selected').attr('id');
    $('#'+cur_fmt,'#save-fmt').removeProp('selected');
    $('#'+fmt,'#save-fmt').prop('selected',true);

    DOM.iSel('save-sparql-endpoint').value = await settings.getValue('upload_sparql_endpoint');

    $( "#save-confirm" ).dialog({
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
           .then(() => {$('#save-confirm').dialog( "destroy" )});
        },
        Cancel: function() {
          $(this).dialog( "destroy" );
        }
      }
    });
  } else {
//    showInfo("No data for saving");
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
    
    var dt = await prepare_data(true, getSelectedTab(), fmt);
    if (dt)
      exec_cmd.data.push(dt);

    if (document.querySelector('#save-sparql-check-res').checked) {
      var settings = new Settings();
      exec_cmd.sparql_check = await settings.createSparqlUrl(sparql_graph, sparqlendpoint);
    }

    Browser.api.runtime.sendMessage(exec_cmd);

  } 
  else 
  {
    var retdata = await prepare_data(false, getSelectedTab(), fmt);
    if (!retdata)
      return;

    if (retdata && retdata.error.length > 0) {
      showInfo(retdata.error);
      return;
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
      src_view.setValue(retdata.txt + retdata.error+"\n");
    }

  }
    
}


async function prepare_data(for_query, curTab, fmt)
{
  try{
    var block = gData.block;

    if (block == null)
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
    height:180,
    modal: true,
    buttons: {
      "OK": function() {
        $(this).dialog('destroy');
      }
    }
  });
}


Browser.api.runtime.onMessage.addListener(function(request, sender, sendResponse)
{
  try {
    if (request.cmd === "store_updated" && request.key === "oidc_code")
    {
      gOidc.restoreConn().then(rc => {
        Download_exec_update_state(1); 
      })
    }
 

  } catch(e) {
    console.log("OSDS: onMsg="+e);
  }

});

