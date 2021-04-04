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
        micro:{ json_text:null },
        jsonld:{ json_text:null },
        rdfa:{ ttl_text:null },
        turtle:{ ttl_text:null },
        rdf:{ text:null },
        json:{ json_text:null },

        ttl_nano :{ ttl_text:null},
        jsonld_nano :{ json_text:null },
        rdf_nano :{ rdf_text:null },
        json_nano :{ json_text:null },
        csv_nano :{ ttl_text:null, text:null },
        posh:{ ttl_text:null },
        tab_index: null,
        tabs:[],
        baseURL: null
      };
var src_view = null;
var g_RestCons = new Rest_Cons();
var gOidc = new OidcWeb();




function showPopup(tabId)
{
  //Request the data from the client (foreground) tab.
  if (Browser.isFirefoxWebExt) {
     Browser.api.tabs.sendMessage(tabId, { property: 'doc_data' });
  } else {
     Browser.api.tabs.sendMessage(tabId, { property: 'doc_data'},
        function(response) { });
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
    g_RestCons.show();
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
    g_RestCons.yasqe.obj.setSize("100%", 150);
  } catch(e) {
  }
  
  if (doc_URL)
    g_RestCons.load(doc_URL);

  $('#rest_exec').click(function() {
    g_RestCons.exec(doc_URL, gData.tab_index);
  });
  $('#rest_exit').click(function(){
    if (prevSelectedTab)
      selectTab(prevSelectedTab);
    return false;
  });
  $('#rest_add').button({
    icons: { primary: 'ui-icon-plusthick' },
    text: false
  });
  $('#rest_add').click(function() {
    g_RestCons.add_empty_row();
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


  var hashName = null;
  var href = e.currentTarget.href;
  var hashPos = href.lastIndexOf('#');

  if (hashPos!=-1 && hashPos!=href.length-1)
    hashName = href.substring(hashPos+1);

  var url = new URL(document.baseURI);
  url.hash = '';
  url = url.toString();

  if (href.startsWith(url+"#sc")) {
    return true;
  }
  else if (check_URI(href) && hashName) {
    var el = $('a[name = "'+hashName+'"]');
    if (el.length > 0)
      el[0].scrollIntoView();
    return false;
  }
  else if (href === doc_URL) {
    return false;
  }
  else {
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
  $('#tabs a[href="#src"]').hide();
  $('#tabs a[href="#cons"]').hide();
}



function show_Data(dData)
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
  var html = "";
  var err_tabs = [];

  gData.tabs = [];
  wait_data = $('table.wait').hide();


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

  function add_item(tabname, title, val)
  {
    $(`#${tabname}_items #docdata_view`).remove();
    $(`#${tabname}_items`).append("<div id='docdata_view' class='alignleft'/>");
    var html = "";
    if (val.expanded!==null && val.expanded.trim().length > 0) {
        html += val.expanded;
        gData.tabs.push(`#${tabname}`);
    }
    if (val.error) {
        var err_msg = create_err_msg(title, val.error);
        if (err_msg) {
          html += err_msg;
          err_tabs.push(`#${tabname}`);
        }
    }
    if (html.length > 0 && html.replace(/\s/g, "").length > 0) {
        $(`#${tabname}_items #docdata_view`).append(html);
        return true;
    } else {
      return false;
    }
  }

  micro = add_item('micro', 'Microdata', dData.micro);
  jsonld = add_item('jsonld', 'JSON-LD', dData.jsonld);
  turtle = add_item('turtle', 'Turtle', dData.turtle);
  rdfa = add_item('rdfa', 'RDFa', dData.rdfa);
  rdf = add_item('rdf', 'RDF/XML', dData.rdf);
  posh = add_item('posh', 'POSH', dData.posh);
  json = add_item('json', 'JSON', dData.json);
  csv = add_item('csv', 'CSV', dData.csv_nano);


  if (gData.tabs.length > 0)
    selectTab(gData.tabs[0]);
  else if (err_tabs.length > 0)
    selectTab(err_tabs[0]);


  if (!micro)
    $('#tabs a[href="#micro"]').hide();
  if (!jsonld)
    $('#tabs a[href="#jsonld"]').hide();
  if (!turtle)
    $('#tabs a[href="#turtle"]').hide();
  if (!rdfa)
    $('#tabs a[href="#rdfa"]').hide();
  if (!rdf)
    $('#tabs a[href="#rdf"]').hide();
  if (!posh)
    $('#tabs a[href="#posh"]').hide();
  if (!json)
    $('#tabs a[href="#json"]').hide();
  if (!csv)
    $('#tabs a[href="#csv"]').hide();

  gData_showed = true;
}



async function check_Microdata(val)
{
    if (val.d.micro.data)
    {
      try {
        var handler = new Handle_Microdata();
        gData.micro.json_text = [JSON.stringify(val.d.micro.data, undefined, 2)];
        var ret = handler.parse(val.d.micro.data, gData.baseURL);

        if (ret.errors.length > 0)
          val.d.micro.error = val.d.micro.error.concat(ret.errors);

        if (ret.data)
          val.d.micro.expanded = ret.data;

        return {d:val.d, start_id:0};

      } catch(ex) {
        val.d.micro.error.push(ex.toString());
        return {d:val.d, start_id:0};
      }
    }
    else
      return {d:val.d, start_id:0};
}




async function check_JSON_LD(val)
{
  if (val.d.jsonld.text!==null && val.d.jsonld.text.length > 0)
  {
    try {
      var handler = new Handle_JSONLD();
      var ret = await handler.parse(val.d.jsonld.text, gData.baseURL);

      gData.jsonld.json_text = val.d.jsonld.text;

      if (ret.errors.length > 0)
        val.d.jsonld.error = val.d.jsonld.error.concat(ret.errors);

      if (ret.data) {
        if (val.d.jsonld.expanded) 
          val.d.jsonld.expanded += ret.data;
        else
          val.d.jsonld.expanded = ret.data;
      }
      return {d:val.d, start_id:handler.start_id};

    } catch(ex) {
      val.d.jsonld.error.push(ex.toString());
      return {d:val.d, start_id:0};
    }
  }
  else
  {
    return {d:val.d, start_id:0};
  }
}


async function check_JsonLD_Nano(val)
{
  if (val.d.jsonld_nano.text!==null && val.d.jsonld_nano.text.length > 0)
  {
    try {
      var handler = new Handle_JSONLD();
      handler.start_id = val.start_id;
      var ret = await handler.parse(val.d.jsonld_nano.text, gData.baseURL);

      gData.jsonld_nano.json_text = val.d.jsonld_nano.text;

      if (ret.errors.length > 0)
        val.d.jsonld.error = val.d.jsonld.error.concat(ret.errors);

      if (ret.data) {
        if (val.d.jsonld.expanded) 
          val.d.jsonld.expanded += ret.data;
        else
          val.d.jsonld.expanded = ret.data;
      }
      return {d:val.d, start_id:0};
      
    } catch(ex) {
      val.d.jsonld.error.push(ex.toString());
      return {d:val.d, start_id:0};
    }
  }
  else
  {
    return {d:val.d, start_id:0};
  }
}



async function check_Json_Nano(val)
{
  if (val.d.json_nano.text!==null && val.d.json_nano.text.length > 0)
  {
    try {
      var handler = new Handle_JSON();
      handler.start_id = val.start_id;
      var ret = await handler.parse(val.d.json_nano.text, gData.baseURL);

      gData.json_nano.json_text = ret.text;

      if (ret.errors.length > 0)
        val.d.json.error = val.d.json.error.concat(ret.errors);

      if (ret.data)
        val.d.json.expanded = ret.data;

      return {d:val.d, start_id:0};

    } catch(ex) {
      val.d.json.error.push(ex.toString());
      return {d:val.d, start_id:0};
    }
  }
  else
  {
    return {d:val.d, start_id:0};
  }
}



async function check_Turtle(val)
{
  if (val.d.turtle.text!==null && val.d.turtle.text.length > 0)
  {
    try {
      var handler = new Handle_Turtle();
      var ret = await handler.parse(val.d.turtle.text, gData.baseURL);

      gData.turtle.ttl_text = val.d.turtle.text;

      if (ret.errors.length>0)
        val.d.turtle.error = val.d.turtle.error.concat(ret.errors);

      if (ret.data) {
        if (val.d.turtle.expanded)
          val.d.turtle.expanded += ret.data;
        else
          val.d.turtle.expanded = ret.data;
      }
      return {d:val.d, start_id:handler.start_id};

    } catch (ex) {
      val.d.turtle.error.push(ex.toString());
      return {d:val.d, start_id:0};
    }
  }
  else
  {
    return {d:val.d, start_id:0};
  }
}


async function check_Turtle_Nano(val)
{
  if (val.d.ttl_nano.text!==null && val.d.ttl_nano.text.length > 0)
  {
    var fix = new Fix_Nano();
    var output = await fix.parse(val.d.ttl_nano.text);
    
    val.d.ttl_nano.text = output;

    if (val.d.ttl_nano.text!==null && val.d.ttl_nano.text.length > 0) {
      try {
        var handler = new Handle_Turtle(val.start_id);
        var ret = await handler.parse_nano(val.d.ttl_nano.text, gData.baseURL);
      
        gData.ttl_nano.ttl_text = val.d.ttl_nano.text;

        if (ret.errors.length>0)
          val.d.turtle.error = val.d.turtle.error.concat(ret.errors);
                
        if (ret.data) {
          if (val.d.turtle.expanded)
            val.d.turtle.expanded += ret.data;
          else
            val.d.turtle.expanded = ret.data;
        }

        return {d:val.d, start_id:0};

      } catch (ex) {
        val.d.turtle.error.push(ex.toString());
        return {d:val.d, start_id:0};
      }
    }
    else
      return {d:val.d, start_id:0};
  }
  else
  {
    return {d:val.d, start_id:0};
  }
}



async function check_POSH(val)
{
  if (val.d.posh.text!==null && val.d.posh.text.length > 0)
  {
    try {
      var handler = new Handle_Turtle();
      var ret = await handler.parse([val.d.posh.text], gData.baseURL);

      gData.posh.ttl_text = val.d.posh.text;

      if (ret.errors.length>0)
        val.d.posh.error = val.d.posh.error.concat(ret.errors);
                
      if (ret.data) {
        val.d.posh.expanded = ret.data;
      }
      return {d:val.d, start_id:0};

    } catch (ex) {
      val.d.posh.error.push(ex.toString());
      return {d:val.d, start_id:0};
    }
  }
  else
  {
    return {d:val.d, start_id:0};
  }
}



async function check_RDFa(val)
{
  if (val.d.rdfa.data)
  {
    try {
      var handler = new Handle_RDFa();
      var ret = handler.parse(val.d.rdfa.data, gData.baseURL);

      if (ret.errors.length>0)
        val.d.rdfa.error = val.d.rdfa.error.concat(ret.errors);
                
      if (ret.data) {
        val.d.rdfa.expanded = ret.data;
        gData.rdfa.ttl_text = [val.d.rdfa.ttl];
      }
      return {d:val.d, start_id:0};

    } catch (ex) {
      val.d.rdfa.error.push(ex.toString());
      return {d:val.d, start_id:0};
    }
  }
  else
  {
    return {d:val.d, start_id:0};
  }
}



async function check_RDF_XML(val)
{
  if (val.d.rdf.text && val.d.rdf.text.length > 0)
  {
    try {
      var handler = new Handle_RDF_XML();
      var ret = await handler.parse(val.d.rdf.text, gData.baseURL);

      gData.rdf.text = val.d.rdf.text;

      if (ret.errors.length>0)
        val.d.rdf.error = val.d.rdf.error.concat(ret.errors);
                
      if (ret.data) {
        if (val.d.rdf.expanded)
          val.d.rdf.expanded += ret.data;
        else
          val.d.rdf.expanded = ret.data;
      }
      return {d:val.d, start_id:0};

    } catch (ex) {
      val.d.rdf.error.push(ex.toString());
      return {d:val.d, start_id:0};
    }
  }
  else
  {
    return {d:val.d, start_id:0};
  }
}


async function check_RDF_XML_Nano(val)
{
  if (val.d.rdf_nano.text!==null && val.d.rdf_nano.text.length > 0)
  {
    try {
      var handler = new Handle_RDF_XML();
      var ret = await handler.parse(val.d.rdf_nano.text, gData.baseURL);

      gData.rdf_nano.rdf_text = val.d.rdf_nano.text;

      if (ret.errors.length>0)
        val.d.rdf.error = val.d.rdf.error.concat(ret.errors);
                
      if (ret.data) {
        if (val.d.rdf.expanded)
          val.d.rdf.expanded += ret.data;
        else
          val.d.rdf.expanded = ret.data;
      }
      return {d:val.d, start_id:0};

    } catch (ex) {
      val.d.rdf.error.push(ex.toString());
      return {d:val.d, start_id:0};
    }
  }
  else
  {
    return {d:val.d, start_id:0};
  }
}


async function check_CSV_Nano(val)
{
  if (val.d.csv_nano.text!==null && val.d.csv_nano.text.length > 0)
  {
    try {
      var handler = new Handle_CSV();
      handler.start_id = val.start_id;
      var ret = await handler.parse(val.d.csv_nano.text, gData.baseURL);

      gData.csv_nano.ttl_text = ret.ttl_data;

      if (ret.errors.length>0)
        val.d.csv_nano.error = val.d.csv_nano.error.concat(ret.errors);
                
      if (ret.data) {
        val.d.csv_nano.expanded = ret.data;
      }
      return {d:val.d, start_id:0};

    } catch (ex) {
      val.d.csv_nano.error.push(ex.toString());
      return {d:val.d, start_id:0};
    }
  }
  else
  {
    return {d:val.d, start_id:0};
  }
}



async function parse_Data(dData)
{
  dData.micro.expanded = null;
  dData.micro.error = [];
  dData.jsonld.expanded = null;
  dData.jsonld.error = [];
  dData.json.expanded = null;
  dData.json.error = [];
  dData.turtle.expanded = null;
  dData.turtle.error = [];
  dData.rdfa.expanded = null;
  dData.rdfa.error = [];
  dData.ttl_nano.expanded = null;
  dData.ttl_nano.error = null;
  dData.jsonld_nano.expanded = null;
  dData.jsonld_nano.error = null;
  dData.json_nano.expanded = null;
  dData.json_nano.error = null;
  dData.csv_nano.expanded = null;
  dData.csv_nano.error = [];
  dData.posh.expanded = null;
  dData.posh.error = [];
  dData.rdf.expanded = null;
  dData.rdf.error = [];
  dData.rdf_nano.expanded = null;
  dData.rdf_nano.error = null;
  doc_URL = dData.doc_URL;

  var url = new URL(doc_URL);
  url.hash ='';
  url.search = '';
  gData.baseURL = url.toString();

  var val = {d:dData, start_id:0};

  try {
    val = await check_Microdata(val);
    val = await check_JSON_LD(val);
    val = await check_JsonLD_Nano(val);
    val = await check_Json_Nano(val);
    val = await check_Turtle(val);
    val = await check_Turtle_Nano(val);
    val = await check_POSH(val);
    val = await check_RDFa(val);
    val = await check_RDF_XML(val);
    val = await check_RDF_XML_Nano(val);
    val = await check_CSV_Nano(val);
    return val.d;
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
          dData = await parse_Data(dData);
          show_Data(dData);
        } catch(ex) {
          console.log("OSDS: Error="+ex);
          $('#tabs a[href="#micro"]').hide();
          $('#tabs a[href="#jsonld"]').hide();
          $('#tabs a[href="#turtle"]').hide();
          $('#tabs a[href="#rdfa"]').hide();
          $('#tabs a[href="#rdf"]').hide();
          $('#tabs a[href="#posh"]').hide();
          $('#tabs a[href="#json"]').hide();
          $('#tabs a[href="#csv"]').hide();
          selectedTab = null;
        }
      }
      else
      {
        $('#tabs a[href="#micro"]').hide();
        $('#tabs a[href="#jsonld"]').hide();
        $('#tabs a[href="#turtle"]').hide();
        $('#tabs a[href="#rdfa"]').hide();
        $('#tabs a[href="#rdf"]').hide();
        $('#tabs a[href="#posh"]').hide();
        $('#tabs a[href="#json"]').hide();
        $('#tabs a[href="#csv"]').hide();
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



function fetchWithTimeout(url, options, timeout) 
{
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeout)
    )
  ]);
}



////////////////////////////////////////////////////
async function SuperLinks_exec()
{
  if (doc_URL!==null) {
    var setting = new Settings();
    var link_query = setting.getValue("ext.osds.super_links.query");
    var link_timeout = parseInt(setting.getValue("ext.osds.super_links.timeout"), 10);

    if (Browser.isFirefoxWebExt) {
      Browser.api.tabs.query({active:true, currentWindow:true})
        .then(async (tabs) => {
          if (tabs.length > 0) {

            var data = await request_superlinks(tabs[0].url);

            Browser.api.tabs.sendMessage(tabs[0].id, 
              {
                property: 'super_links_data',
                data : data
              });
            window.close();
          }
        });
    } else {

      Browser.api.tabs.query({active:true, currentWindow:true}, async function(tabs) {
        if (tabs.length > 0) {
          var data = await request_superlinks(tabs[0].url);

          Browser.api.tabs.sendMessage(tabs[0].id, 
            {
              property: 'super_links_data',
              data : data
            },
            function(response) {
            });
          window.close();
        }
      });
    }
  }

  return false;
}


async function request_superlinks(doc_url)
{
  var LOGIN_URL = "https://linkeddata.uriburner.com/rdfdesc/login.vsp";
  var REDIR_URL = LOGIN_URL + "?returnto="+doc_url;
  
  var setting = new Settings();
  var links_query = setting.getValue("ext.osds.super_links.query");
  var links_timeout = parseInt(setting.getValue("ext.osds.super_links.timeout"), 10);
  var sponge_type = setting.getValue('ext.osds.super-links-sponge');
  var sponge_mode = setting.getValue('ext.osds.super-links-sponge-mode');
  var url_sponge;


  if (sponge_type) {
    url_sponge = setting.createSpongeCmdFor(sponge_type, sponge_mode, doc_url);
  } else {
    var rc = doc_url.match(/^((\w+):\/)?\/?(.*)$/);
    url_sponge = "https://linkeddata.uriburner.com/about/html/http/"+rc[3]+"?sponger:get=add";
  }

 $(".super_links_msg").css("display","flex");

  var options = {
       headers: {
          'Accept': 'text/html',
          'Cache-control': 'no-cache'
       },
       credentials: 'include',
      };

  try  {
    var rc = await fetchWithTimeout(url_sponge, options, 30000);
    if (rc.ok && rc.status == 200) {
      if (rc.redirected && rc.url.lastIndexOf(LOGIN_URL, 0) === 0) {
        alert("Could not sponge data for current page with: "+url_sponge+"\nTry Login and execute sponge again");
        Browser.openTab(REDIR_URL);
        alert("Login to https://linkeddata.uriburner.com and call SupeLinks again");
        return;
      }
      return await exec_super_links_query(doc_url, links_query, links_timeout);

    } else {
      if (rc.status==401 || rc.status==403 || rc.status==404) {
        Browser.openTab(REDIR_URL);
        alert("Sponge error:"+rc.status+"\nLogin to https://linkeddata.uriburner.com and call SupeLinks again");
        return;
      } else {
        alert("Sponge error:"+rc.status+" ["+rc.statusText+"]");
        return await exec_super_links_query(doc_url, links_query, links_timeout);
      }
    }

  } catch(e) {
    $(".super_links_msg").css("display","none");
    alert("Sponge "+e);
    console.log(e);
  }

  return null;
}


async function exec_super_links_query(doc_url, links_query, links_timeout)
{
  var SPARQL_URL = "https://linkeddata.uriburner.com/sparql";
  var LOGIN_URL = "https://linkeddata.uriburner.com/rdfdesc/login.vsp";
  var REDIR_URL = LOGIN_URL + "?returnto="+doc_url;

  var url = new URL(doc_url);
  url.hash = '';
  //url.search = '';
  var iri = url.toString();

  var br_lang = navigator.language || navigator.userLanguage;
  if (br_lang && br_lang.length>0) {
    var i = br_lang.indexOf('-');
    if (i!=-1)
       br_lang = br_lang.substr(0,i);
  } else {
    br_lang = 'en';
  }

  var links_sparql_query = (new Settings()).createSuperLinksQuery(links_query, iri, br_lang);

  $(".super_links_msg").css("display","flex");

  var get_url = new URL(SPARQL_URL);
  var params = get_url.searchParams;
  params.append('format', 'application/json');
  params.append('query', links_sparql_query);
  params.append('CXML_redir_for_subjs', 121);
  params.append('timeout', links_timeout);
  params.append('_', Date.now());

  var options = {
        headers: {
          'Accept': 'application/json',
          'Cache-control': 'no-cache'
        },
        credentials: 'include',
      };

  try  {
    var rc = await fetchWithTimeout(get_url, options, links_timeout);
    if (rc.ok && rc.status == 200) {
      var data;
      try {
        data = await rc.text();
      } catch(e) {
        console.log(e);
      } finally {
        $(".super_links_msg").css("display","none");
      }

      if (data) {
        try {
          var val = JSON.parse(data);
          var links = val.results.bindings;
          if (links.length == 0) {
            alert("Empty SuperLinks resultSet was received from server");
            return null;
          }
        } catch(e) {
          console.log(e);
        }
      }
      
      return data;

    } else {
      $(".super_links_msg").css("display","none");
      if (rc.status==401 || rc.status==403) {
        Browser.openTab(REDIR_URL);
        alert("Login to https://linkeddata.uriburner.com and call SupeLinks again");
        return null;
      } else {
        alert("Could not load data from: "+SPARQL_URL+"\nError: "+rc.status);
        return null;
      }
/***
          if (rc.status == 403) {
            alert("Could not execute SPARQL query againts: "+SPARQL_URL+"\nTry Login and execute query again");
            var redir = "https://linkeddata.uriburner.com/rdfdesc/login.vsp?returnto="+location.href;
            document.location.href = redir;
          } else {
            alert("Could not load data from: "+SPARQL_URL+"\nError: "+rc.status);
          }
***/
    }

  } catch(e) {
    $(".super_links_msg").css("display","none");
    alert("Could not load data from: "+SPARQL_URL+"\n"+e);
    return null;
  } finally {
    $(".super_links_msg").css("display","none");
  }
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
      u.hash = '';
      u.search = '';
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
  } else {
    $('#oidc-login').hide();
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

  var oidc_url = document.getElementById('oidc-url');
  oidc_url.value = (gOidc.storage || '') + (filename || '');

  var save_filename = document.getElementById('save-filename');
  save_filename.value = filename || '';
}


async function Download_exec()
{
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

  if (selectedTab==="#jsonld" && (gData.jsonld.json_text!==null || gData.jsonld_nano.json_text!==null)) {
    filename = "jsonld_data.txt";
    fmt = "jsonld";
  }
  else if (selectedTab==="#turtle" && (gData.turtle.ttl_text!==null || gData.ttl_nano.ttl_text!==null)) {
    filename = "turtle_data.txt";
    fmt = "ttl";
  }
  else if (selectedTab==="#micro" && gData.micro.json_text!==null) {
    filename = "microdata_data.txt";
    fmt = "jsonld";
  }
  else if (selectedTab==="#rdfa" && gData.rdfa.ttl_text!==null) {
    filename = "rdfa_data.txt";
    fmt = "ttl";
  }
  else if (selectedTab==="#rdf" && (gData.rdf.text!==null || gData.rdf_nano.rdf_text!==null)) {
    filename = "rdf_xml_data.txt";
    fmt = "rdf";
  }
  else if (selectedTab==="#posh" && gData.posh.ttl_text!==null) {
    filename = "posh_data.txt";
    fmt = "ttl";
  }
  else if (selectedTab==="#json" && (gData.json.json_text!==null || gData.json_nano.json_text!==null)) {
    filename = "json_data.txt";
    fmt = "json";
    $('#save-fmt #json').prop('disabled', false);
  }
  else if (selectedTab==="#csv" && (gData.csv_nano.ttl_text!==null)) {
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
      height:300,
      modal: true,
      buttons: {
        "OK": function() {
          var action = $('#save-action option:selected').attr('id');
          var fmt = $('#save-fmt option:selected').attr('id');
          var fname = action ==='fileupload' ? $('#oidc-url').val().trim(): $('#save-filename').val().trim();
          save_data(action, fname, fmt)
           .then(() => {$(this).dialog( "destroy" )});
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
  var sparqlendpoint = $('#save-sparql-endpoint').val().trim();
  var sparql_graph = $('#save-sparql-graph').val().trim();


  function out_from(for_query, data, error, skipped_error)
  {
    var retdata = {txt:"", error:""};
    var outdata = [];
    var errors = [];

    if (data) {
      if ($.isArray(data))
        outdata = outdata.concat(data);
      else
        outdata.push(data);
    }

    if (error) {
      errors.push("\n"+error);
    }

    if (skipped_error && skipped_error.length>0) {
      errors = errors.concat(skipped_error);
    }

    if (for_query) {
      retdata.txt = outdata;
    } else {
      for(var i=0; i < outdata.length; i++)
        retdata.txt += outdata[i]+"\n\n";
    }

    for(var i=0; i < errors.length; i++)
      retdata.error += errors[i]+"\n\n";

    return retdata;
  }

  async function exec_action(action, rc)
  {
    if (action==="sparqlupload") {
     retdata = out_from(true, rc.data, rc.error, rc.skipped_error);
     await upload_to_sparql(retdata, sparqlendpoint, sparql_graph);
    } else {

      retdata = out_from(false, rc.data, rc.error, rc.skipped_error);

      if (action==="export-rww") {
        if (retdata.error.length > 0) {
          showInfo(retdata.error);
        } else {
          if (callback)
            callback(retdata.txt);
        }
      }
      else if (action==="filesave") {
        blob = new Blob([retdata.txt + retdata.error], {type: "text/plain;charset=utf-8"});
        saveAs(blob, fname);
      }
      else if (action==="fileupload") {
       var contentType = "text/plain;charset=utf-8";

       if (fmt==="jsonld")
         contentType = "application/ld+json;charset=utf-8";
       else if (fmt==="json")
         contentType = "application/json;charset=utf-8";
       else if (fmt==="rdf")
         contentType = "application/rdf+xml;charset=utf-8";
       else
         contentType = "text/turtle;charset=utf-8";

        putResource(gOidc.fetch, fname, retdata.txt, contentType, null)
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

  
  
  try{
    var data = [];
    var quad_data = [];
    var blob = null;
    var src_fmt = null;

    if (action === "sparqlupload") {
      fmt = "ttl";

      if (!sparqlendpoint || sparqlendpoint.length < 1) {
        showInfo('SPARQL endpoint is empty');
        return;
      }
    }
    
    
    if (selectedTab==="#jsonld" && (gData.jsonld.json_text!==null || gData.jsonld_nano.json_text!==null)) {
      src_fmt = "jsonld";

      if (gData.jsonld.json_text!==null)
        data = data.concat(gData.jsonld.json_text);

      if (gData.jsonld_nano.json_text!==null)
        data = data.concat(gData.jsonld_nano.json_text);
    }
    else if (selectedTab==="#json" && (gData.json.json_text!==null || gData.json_nano.json_text!==null)) {
      src_fmt = "json";

      if (gData.json.json_text!==null)
        data = data.concat(gData.json.json_text);

      if (gData.json_nano.json_text!==null)
        data = data.concat(gData.json_nano.json_text);
    }
    else if (selectedTab==="#turtle" && (gData.turtle.ttl_text!==null || gData.ttl_nano.ttl_text!==null)) {
      src_fmt = "ttl";
      if (gData.turtle.ttl_text!==null)
        data = data.concat(gData.turtle.ttl_text);

      if (gData.ttl_nano.ttl_text!==null)
        quad_data = quad_data.concat(gData.ttl_nano.ttl_text);
    }
    else if (selectedTab==="#micro" && gData.micro.json_text!==null) {
      src_fmt = "jsonld";
      data = data.concat(gData.micro.json_text);
    }
    else if (selectedTab==="#rdfa" && gData.rdfa.ttl_text!==null) {
      src_fmt = "ttl";
      data = data.concat(gData.rdfa.ttl_text);
    }
    else if (selectedTab==="#rdf" && (gData.rdf.text!==null || gData.rdf_nano.rdf_text!==null)) {
      src_fmt = "rdf";
      if (gData.rdf.text!==null)
        data = data.concat(gData.rdf.text);

      if (gData.rdf_nano.rdf_text!==null)
        data = data.concat(gData.rdf_nano.rdf_text);
    }
    else if (selectedTab==="#posh" && gData.posh.ttl_text!==null) {
      src_fmt = "ttl";
      data = data.concat(gData.posh.ttl_text);
    }
    else if (selectedTab==="#csv" && gData.csv_nano.ttl_text!==null) {
      src_fmt = "ttl";
      data = data.concat(gData.csv_nano.ttl_text);
    }
    else
      return;

    if (data.length==0 && quad_data.length==0)
      return;


    if (selectedTab==="#micro" && data.length > 0)
    {
      var handler = new Handle_Microdata(true);
      var ret = handler.parse(JSON.parse(data[0]), gData.baseURL);
      if (ret.errors.length > 0) {
        exec_action(action, {data:null, error:ret.errors, skipped_error:null});
        return;
      }
      if (ret.data==null)
        return;

      var ttl_data = ret.data;

      if (fmt==="ttl") {
        exec_action(action, {data:ttl_data, error:null, skipped_errors:null});
      }
      else if (fmt==="jsonld") { // json
        var conv = new Convert_Turtle();
        var text_data = await conv.to_jsonld([ttl_data], null, gData.baseURL);
        exec_action(action, {data:text_data, error:null, skipped_error:conv.skipped_error}); 
      }
      else {
        var conv = new Convert_Turtle();
        var text_data = await conv.to_rdf([ttl_data], null, gData.baseURL);
        exec_action(action, {data:text_data, error:null, skipped_error:conv.skipped_error}); 
      }
    }
    else if (selectedTab==="#rdfa" && data.length > 0)
    {
      var handler = new Convert_Turtle();
      var ttl_data = await handler.fix_ttl(data, gData.baseURL);
      if (handler.skipped_error.length > 0) {
        exec_action(action, {data:null, error, skipped_error:handler.skipped_error});
        return;
      }
      if (ttl_data && ttl_data.length > 0) 
      {
          if (fmt==="ttl") {
            exec_action(action, {data:ttl_data, error:null, skipped_error:null});
          }
          else if (fmt==="jsonld") { // json
            var conv = new Convert_Turtle();
            var text_data = await conv.to_jsonld(ttl_data, null, gData.baseURL);
            exec_action(action, {data: text_data, error:null, skipped_error:conv.skipped_error});
          }
          else {
            var conv = new Convert_Turtle();
            var text_data = await conv.to_rdf(ttl_data, null, gData.baseURL);
            exec_action(action, {data:text_data, error:null, skipped_error:conv.skipped_error});
          }
      }
    }
    else if (src_fmt!==fmt)
    {
      if (src_fmt==="ttl") {
        var conv = new Convert_Turtle();
        if (fmt==="jsonld") {
          var text_data = await conv.to_jsonld(data, quad_data, gData.baseURL);
          exec_action(action, {data:text_data, error:null, skipped_error:conv.skipped_error});
        } else if (fmt==="rdf") {
          var text_data = await conv.to_rdf(data, quad_data, gData.baseURL);
          exec_action(action, {data:text_data, error:null, skipped_error:conv.skipped_error});
        }
      }
      else if (src_fmt==="jsonld"){
        var conv = new Convert_JSONLD();
        if (fmt==="ttl"){
          var text_data = await conv.to_ttl(data, gData.baseURL);
          exec_action(action, {data: text_data, error:null, skipped_error:conv.skipped_error});
        } else if (fmt==="rdf"){
          var text_data = await conv.to_rdf(data, gData.baseURL);
          exec_action(action, {data:text_data, error:null, skipped_error:conv.skipped_error});
        }
      }
      else if (src_fmt==="json"){
        var conv = new Convert_JSON();
        if (fmt==="ttl"){
          var text_data = await conv.to_ttl(data, gData.baseURL);
          exec_action(action, {data:text_data, error:null, skipped_error:conv.skipped_error});
        } else if (fmt==="rdf"){
          var text_data = await conv.to_rdf(data, gData.baseURL);
          exec_action(action, {data:text_data, error:null, skipped_error:conv.skipped_error});
        } else if (fmt==="jsonld"){
          var text_data = await conv.to_jsonld(data, gData.baseURL);
          exec_action(action, {data:text_data, error:null, skipped_error:conv.skipped_error});
        }
      }
      else if (src_fmt==="rdf"){
        var conv = new Convert_RDF_XML();
        if (fmt==="ttl") {
          var text_data = await conv.to_ttl(data, gData.baseURL);
          exec_action(action, {data:text_data, error:null, skipped_error:conv.skipped_error});

        } else if (fmt==="jsonld"){
          var text_data = await conv.to_jsonld(data, gData.baseURL);
          exec_action(action, {data:text_data, error:null, skipped_error:conv.skipped_error});
        }
      }
    } else {
      data = data.concat(quad_data);
      exec_action(action, {data, error:null, skipped_error:null});
    }

  } catch(ex) {
    showInfo(ex);
  }
}


async function upload_to_sparql(data, sparqlendpoint, sparql_graph)
{
  const _fetch = gOidc.fetch || fetch;;

  if (data.error.length > 0) {
     showInfo(data.error);
     return;
  }

  var handler = new Convert_Turtle();
  var ttl_data = await handler.prepare_query(data.txt, gData.baseURL);

  for(var i=0; i < ttl_data.length; i++) {

    var contentType = "application/sparql-update;utf-8";

    var rc;
    var query = ttl_data[i].pref+'\n';

    query += sparql_graph.length > 1
              ? 'INSERT INTO GRAPH <' + sparql_graph + '> \n{\n' + ttl_data[i].ttl + '\n }'
              : 'INSERT DATA { '+ttl_data[i].ttl+' }';

    var options = {
      method: 'POST',
      headers: {
        'Content-type': 'application/sparql-update;utf-8'
      },
      credentials: 'include',
      body: query
    }

    try {
      rc = await _fetch(sparqlendpoint, options);
      if (!rc.ok) {
        var message;
        switch(rc.status) {
          case 0:
          case 405:
            message = ''+rc.status +' this location is not writable'
            break
          case 401:
          case 403:
            message = ''+rc.status +' you do not have permission to write here'
            break
          case 406:
            message = ''+rc.status +' enter a name for your resource'
            break
          default:
            message = ''+rc.status +' '+rc.statusText;
            break
        }
        showInfo('Unable to save:' +message);
        return;
      }
    } catch (e) {
      console.log(e);
      showInfo('Unable to save:' +e.toString());
      return;
    }

  }
  
  showInfo('Saved');
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





