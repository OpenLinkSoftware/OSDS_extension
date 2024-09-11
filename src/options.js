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

var gPref = null;
var yasqe_slinks = null;
var yasqe_srv = null;
var gPromptId = 0;
var g_prompt_view = null;

DOM.ready(() => { init(); })

async function init()
{
  // Tabs
  document.getElementById("c_year").innerText = new Date().getFullYear();

  gPref = new Settings();

  $("#revert-confirm").hide();
  $("#users-edit").hide();
  $('#users_add').click(addUsersEmpty);
  $('#users_add').button({
	icons: { primary: 'ui-icon-plusthick' },
	text: false
  });


  $('#tabs').tabs({
    activate: function( event, ui ) {
	if (ui.newPanel[0].id == "tabs-2") {
	   var s = yasqe_srv.getValue();
	   yasqe_srv.setValue(s);
	}
	else if (ui.newPanel[0].id == "tabs-3") {
           var s = yasqe_slinks.getValue();
           yasqe_slinks.setValue(s);
	}
	else if (ui.newPanel[0].id == "tabs-4") {
           var s = g_prompt_view.getValue();
           g_prompt_view.setValue(s);
	}
    }
  });

  try{
    yasqe_slinks = YASQE.fromTextArea(document.getElementById('super-links-query'), {
       lineNumbers: true,
      lineWrapping: false,
            sparql: { showQueryButton: false },
       createShortLink : null,
       createShareLink : null,
	     persistent: null,
    });
    yasqe_slinks.setSize("100%", 280);

    yasqe_srv = YASQE.fromTextArea(document.getElementById('sparql-query'), {
			lineNumbers: true,
			lineWrapping: false,
			sparql: { showQueryButton: false },
			createShortLink : null,
			createShareLink : null,
			persistent: null,
    });
    yasqe_srv.setSize("100%", 420);

    g_prompt_view = CodeMirror.fromTextArea(DOM.qSel('textarea#prompt-injects'), {
      lineNumbers: true
    });
    g_prompt_view.setSize("100%", "250");

  } catch(e) {
    console.log(e);
  }

  try {
    await loadPref();
  } catch(e) {
    console.log(e);
  }

  DOM.iSel('uiterm-mode').onchange = async (e) => {
      var cmd = DOM.qSel('#sparql-cmd option:checked').id;
      yasqe_srv.setValue(await createSparqlQuery(cmd));
  };

  DOM.iSel('import-srv').onchange = (e) => {
	setTimeout(enableCtrls,200);
  };

  DOM.iSel('sparql-cmd').onchange = async (e) => {
	var cmd = DOM.qSel('#sparql-cmd option:checked').id;
	yasqe_srv.setValue(await createSparqlQuery(cmd));
  };

  DOM.iSel('chk_try_handle_all').onchange = () => { changeHandleAll() };
  DOM.iSel('OK_btn').onclick = () => { savePref() }
  DOM.iSel('Cancel_btn').onclick = () => { closeOptions() }

  DOM.iSel('import-set-def').onclick = () => { setImportDefaults() }
  DOM.iSel('rww-set-def').onclick = () => { setRWWDefaults() }
  DOM.iSel('sparql-set-def').onclick = () => { setSparqlDefaults() }
  DOM.iSel('super-links-set-def').onclick = () => { setSuperLinksDefaults() }

  DOM.iSel('call_edit_users').onclick = () => { call_edit_users() }

  DOM.iSel('prompt_add').onclick = click_prompt_add;
  DOM.iSel('prompt-set-def').onclick = click_prompt_default;
  DOM.iSel('prompt-query').onfocusout = prompt_out;

  DOM.iSel('add_selection').onclick = () => {
   typeInTextarea('{selected_text}', DOM.qSel('#prompt-query'));
  }
  DOM.iSel('add_page_url').onclick = () => {
   typeInTextarea('{page_url}', DOM.qSel('#prompt-query'));
  }

  DOM.iSel('prompt-validate').onclick = () => { 
    validate_prompt_injects(true);
  }
  
  await enableCtrls();

  $('#ext_ver').text('Version: '+ Browser.api.runtime.getManifest().version);


}


async function validate_prompt_injects(showOk)
{
    try {
      const s = g_prompt_view.getValue();
      const v = gPref.validate_prompt_injects(s);
      if (v.rc !== 1)
        alert(v.err);
      else {
        if (showOk) {
          alert("Descripton is Valid!");
          const chat = await gPref.getValue("ext.osds.chat-srv")
          load_chat_list(s, chat);
        }
      }
      return v.rc;
    } catch(e) { 
      return 0;
    }
}

function load_chat_list(data, sel)
{
    try {
      const chat_list = JSON.parse(data);
      const chat_keys = Object.keys(chat_list);
      const dd = DOM.qSel('#chat-srv')
      let dd_html = [];
      for(const key of chat_keys) {
        const v = chat_list[key]
        if (v["prompt.selector"])
          dd_html.push(`<option id="${key}" > ${v.name} </option>`);
      }
      dd.innerHTML = dd_html.join('\n');
    } catch(e) { console.log(e)}

    const el = DOM.qSel('#chat-srv #'+sel)
    if (el)
      el.selected = true;
}



function typeInTextarea(newText, el) {
  const [start, end] = [el.selectionStart, el.selectionEnd];
  el.setRangeText(newText, start, end, 'select');
}


function changeHandleAll()
{
   if (1==1)
     return;

   var v = DOM.iSel('chk_try_handle_all').checked ? false : true;
     DOM.iSel('chk_try_handle_xml').disabled =  v;
     DOM.iSel('chk_try_handle_csv').disabled = v;
     DOM.iSel('chk_try_handle_json').disabled = v;
}

function closeOptions()
{
    if (Browser.is_ff) {
      Browser.api.tabs.getCurrent()
        .then((tab) => {
          Browser.api.tabs.remove(tab.id);
        });
    } else {
      window.close();
    }
}

function setImportDefaults()
{
    $( "#revert-confirm" ).dialog({
      resizable: false,
      height:160,
      modal: true,
      buttons: {
        "OK": function() {

          DOM.qSel('#import-srv #'+gPref.def_import_srv).selected=true;
          var h_url = gPref.createDefaultImportCmdFor(gPref.def_import_srv, gPref.def_import_url.trim());
          DOM.iSel('import-url').value = h_url;
          enableCtrls();

          $(this).dialog( "close" );
        },
        Cancel: function() {
          $(this).dialog( "close" );
        }
      }
    });
};

function setRWWDefaults()
{
    $( "#revert-confirm" ).dialog({
      resizable: false,
      height:160,
      modal: true,
      buttons: {
        "OK": function() {

          DOM.iSel('rww-store-url').value = "";
          DOM.iSel('rww-edit-url').value = gPref.def_rww_edit_url;

          $(this).dialog( "close" );
        },
        Cancel: function() {
          $(this).dialog( "close" );
        }
      }
    });
};

async function setSparqlDefaults()
{
    async function revert(_this) {
          DOM.qSel('#sparql-cmd #'+gPref.def_sparql_cmd).selected=true;
          DOM.iSel('sparql-url').value = gPref.def_sparql_url;
          yasqe_srv.setValue(await createSparqlQuery(gPref.def_sparql_cmd));

          $(_this).dialog( "close" );
    }

    $( "#revert-confirm" ).dialog({
      resizable: false,
      height:160,
      modal: true,
      buttons: {
        "OK": function() {
            revert(this);
        },
        Cancel: function() {
          $(this).dialog( "close" );
        }
      }
    });
};


function setSuperLinksDefaults()
{
    $( "#revert-confirm" ).dialog({
      resizable: false,
      height:160,
      modal: true,
      buttons: {
        "OK": function() {
          DOM.iSel('super-links-timeout').value = gPref.def_super_links_timeout;
          yasqe_slinks.setValue(gPref.def_super_links_query);
          DOM.qSel('#super-links-sponge #describe-ssl').selected = true;
          DOM.qSel('#super-links-sponge-mode #xxx').selected = true;
          DOM.qSel('#super-links-viewer #html-fb').selected = true;
          DOM.qSel('#super-links-highlight #all').selected = true;

          DOM.iSel('super-links-retries').value = gPref.def_super_links_retries;
          DOM.iSel('super-links-retries-timeout').value = gPref.def_super_links_retries_timeout;

          $(this).dialog( "close" );
        },
        Cancel: function() {
          $(this).dialog( "close" );
        }
      }
    });
};

async function load_pref_user()
{
    var pref_user = await gPref.getValue("ext.osds.pref.user");

    var list = [];
    try {
      var v = await gPref.getValue('ext.osds.pref.user.list');
      if (v)
        list = JSON.parse(v);
    } catch(e){}

    $('#pref_user')[0].options.length = 0;
    $.each(list, function (i, item) {
        if (pref_user === item)
          $('#pref_user').append($('<option>', {
            value: 'uid'+i,
            text : item,
            selected: 1
          }));
        else
          $('#pref_user').append($('<option>', {
            value: 'uid'+i,
            text : item
          }));
    });

   pref_user = $('#pref_user option:selected').text();
   await gPref.setValue("ext.osds.pref.user", pref_user);
}


async function loadPref()
{
    var uiterm_mode = await gPref.getValue("ext.osds.uiterm.mode");
    DOM.qSel('#uiterm-mode #'+uiterm_mode).selected=true;

    var chk_user = await gPref.getValue("ext.osds.pref.user.chk");
    DOM.iSel("chk_pref_user").checked = (chk_user==="1");

    load_pref_user();

    var chk_action = await gPref.getValue("ext.osds.pref.show_action");
    DOM.iSel("chk_show_action_for_url_with_params").checked = (chk_action==="1");

    var chk_a_discovery = await gPref.getValue("ext.osds.auto_discovery");
    DOM.iSel("chk_auto_discovery").checked = (chk_a_discovery==="1");

    var chk_jsonld_compact_rel = await gPref.getValue("ext.osds.jsonld_compact_rel");
    DOM.iSel("chk_jsonld_compact_rel").checked = (chk_jsonld_compact_rel==="1");

    var chk_xml = await gPref.getValue("ext.osds.handle_xml");
    DOM.iSel("chk_try_handle_xml").checked = (chk_xml==="1");

    var chk_csv = await gPref.getValue("ext.osds.handle_csv");
    DOM.iSel("chk_try_handle_csv").checked = (chk_csv==="1");

    var chk_json = await gPref.getValue("ext.osds.handle_json");
    DOM.iSel("chk_try_handle_json").checked = (chk_json==="1");
/**
    if (Browser.is_safari) {
      DOM.iSel("chk_try_handle_all").checked = false;
      DOM.iSel("chk_try_handle_all").disabled = true;

      DOM.iSel("chk_try_handle_xml").checked = true;
      DOM.iSel("chk_try_handle_csv").checked = true;
      DOM.iSel("chk_try_handle_json").checked = true;
    } 
    else 
**/
    {
      var chk_all = await gPref.getValue("ext.osds.handle_all");
      DOM.iSel("chk_try_handle_all").checked = (chk_all==="1");

      var chk_xml = await gPref.getValue("ext.osds.handle_xml");
      DOM.iSel("chk_try_handle_xml").checked = (chk_xml==="1");

      var chk_csv = await gPref.getValue("ext.osds.handle_csv");
      DOM.iSel("chk_try_handle_csv").checked = (chk_csv==="1");

      var chk_json = await gPref.getValue("ext.osds.handle_json");
      DOM.iSel("chk_try_handle_json").checked = (chk_json==="1");
    }

    changeHandleAll();

    var sparql_ep = await gPref.getValue("upload_sparql_endpoint");
    DOM.iSel('upload_sparql_endpoint').value = sparql_ep;

    var sparql_tm = await gPref.getValue("upload_sparql_timeout");
    if (sparql_tm)
      DOM.iSel('upload_sparql_timeout').value = sparql_tm;

    var sparql_gr = await gPref.getValue("upload_sparql_graph");
    DOM.iSel('upload_sparql_graph').value = sparql_gr;

    var import_url = await gPref.getValue("ext.osds.import.url");
    var import_srv = await gPref.getValue("ext.osds.import.srv");

    DOM.qSel('#import-srv #'+import_srv).selected=true;
    DOM.iSel('import-url').value = import_url;


    var rww_edit_url = await gPref.getValue("ext.osds.rww.edit.url");
    if (rww_edit_url)
        DOM.iSel('rww-edit-url').value = rww_edit_url;

    var rww_store_url = await gPref.getValue("ext.osds.rww.store.url");
    if (rww_store_url)
        DOM.iSel('rww-store-url').value = rww_store_url;


    var sparql_url = await gPref.getValue("ext.osds.sparql.url");
    DOM.iSel('sparql-url').value = sparql_url;

    var sparql_cmd = await gPref.getValue("ext.osds.sparql.cmd");
    DOM.qSel('#sparql-cmd #'+sparql_cmd).selected=true;


    yasqe_srv.setValue(await gPref.getValue("ext.osds.sparql.query")+"\n");
    yasqe_slinks.setValue(await gPref.getValue("ext.osds.super_links.query")+"\n");

    DOM.iSel('super-links-timeout').value = await gPref.getValue("ext.osds.super_links.timeout");

    var sponge = await gPref.getValue("ext.osds.super-links-sponge");
    if (sponge)
      DOM.qSel('#super-links-sponge #'+sponge).selected = true;

    var sponge_mode = await gPref.getValue("ext.osds.super-links-sponge-mode");
    if (sponge_mode)
      DOM.qSel('#super-links-sponge-mode #'+sponge_mode).selected = true;

    var viewer = await gPref.getValue("ext.osds.super-links-viewer");
    if (viewer)
      DOM.qSel('#super-links-viewer #'+viewer).selected = true;

    var mode = await gPref.getValue("ext.osds.super-links-highlight");
    if (mode)
      DOM.qSel('#super-links-highlight #'+mode).selected = true;

    DOM.iSel('super-links-retries').value = await gPref.getValue("ext.osds.super_links.retries");
    DOM.iSel('super-links-retries-timeout').value = await gPref.getValue("ext.osds.super_links.retries_timeout");

    var model = await gPref.getValue("osds.chatgpt_model");
    model = model.replaceAll('.','\\.');
    DOM.qSel('#chatgpt-model #'+model).selected = true; 
    DOM.iSel('chatgpt_max_tokens').value = await gPref.getValue("osds.chatgpt_max_tokens");
    DOM.iSel('chatgpt_temp').value = await gPref.getValue("osds.chatgpt_temp");
    DOM.iSel('chatgpt_token').value = await gPref.getValue("osds.chatgpt_openai_token");
    DOM.iSel('chatgpt_prompt').value = await gPref.getValue("osds.chatgpt_prompt");

    // tab ChatGPT
    const data = await gPref.getValue("ext.osds.def_prompt_inject")
    var chat = await gPref.getValue("ext.osds.chat-srv")

    load_chat_list(data, chat);
    g_prompt_view.setValue(data);

    var tokens = await gPref.getValue("ext.osds.gpt-tokens");
    DOM.qSel('#gpt-max-tokens').value=tokens;

    var lst = await gPref.getValue("ext.osds.prompt-lst");
    var myid_checked = lst.length == 0 ? 'jsonld': '';
    for(const i of lst) {
      if (i.myid && i.checked) {
        myid_checked = i.myid;
        break;
      }
    }

    gPromptId = 0;

    var myid = 'jsonld';
    add_prompt_row({name:'JSON-LD', text: gPref.def_prompt_query_jsonld, myid}, myid_checked===myid);
    gPromptId++;

    myid = 'turtle';
    add_prompt_row({name:'Turtle', text: gPref.def_prompt_query_turtle, myid}, myid_checked===myid);
    gPromptId++;

    for(const i of lst) {
      if (!i.myid) {
        add_prompt_row({name:i.name, text:i.text, myid:''}, i.checked);
        gPromptId++;
      }
    }
}


function add_prompt_row(item, selected)
{
  const checked = selected ? 'checked="checked"' : '';

  const tbody = DOM.qSel('#prompt-list');
  var r = tbody.insertRow(-1);
  var readonly = '';
  var del = '<button id="prompt_del" class="prompt_del" width="20" height="20"><img src="lib/css/img/trash.png"/></button>';

  if (item.myid === 'jsonld' || item.myid === 'turtle') {
    readonly = 'readonly="readonly"';
    del = '';
  }

  r.innerHTML = `<td><input id="chk" class="prompt_chk" type="checkbox" ${checked}></td>`
               +`<td><input style="width:100px" id="name" ${readonly} value="${item.name}"></td>`
               +`<td>${del}</td>`;
  r.setAttribute('myid', item.myid);
  r.setAttribute('name', item.name);
  r.setAttribute('text', item.text);
  r.querySelector('.prompt_chk').onclick = click_prompt;
  r.onclick = click_prompt_row;

  if (checked) 
    r.classList.add('prompt_checked');

  if (selected)
    r.querySelector('.prompt_chk').dispatchEvent(new Event('click'));

  if (del) {
    r.querySelector('.prompt_del').onclick = click_prompt_del;
    r.querySelector('input#name').onfocusout = prompt_name_out;
  }
}

function click_prompt_row(ev) 
{
  const row = ev.target.closest('tr');
  if (row && row.parentNode) {
    const chk = row.querySelector('input.prompt_chk');
    chk.checked = true;
    chk.dispatchEvent(new Event('click'));
  }
}

function click_prompt(ev) 
{
  var chk = ev.target;
  var row;

  if (chk.checked) {
    const tbody = DOM.qSel('#prompt-list');
    var lst = tbody.querySelectorAll('.prompt_chk');
    for(const i of lst) {
      if (i !== chk) {
        i.checked = false;
        row = i.closest('table tr');
        row.classList.remove('prompt_checked');
      }
    }

    row = chk.closest('table tr');
    if (row) {
      row.classList.add('prompt_checked');

      const prompt_query = DOM.iSel('prompt-query');
      const myid = row.attributes.myid.value;

      prompt_query.value = row.attributes.text.value;
      if (myid === 'jsonld' || myid === 'turtle')
        prompt_query.setAttribute('readonly', true);
      else
        prompt_query.removeAttribute('readonly');
    }
  }
  else {
    ev.preventDefault();
  }
}


function click_prompt_add(ev) 
{
  gPromptId++;
  const text = 'Disregard any previous instructions. \n'
            +'.....\n'
            +'"""\n'
            +'{selected_text}\n'
            +'"""\n\n';
  const prompt = {name:'New_'+gPromptId, text, myid:''};
  add_prompt_row(prompt, true);
}

function click_prompt_del(ev) 
{
  var btn = ev.target;
  var row = btn.closest('table tr');
  var checked = row.querySelector('input.prompt_chk').checked;
  row.remove();
  if (checked) {
    const lst = DOM.qSelAll('tbody#prompt-list input.prompt_chk');
    if (lst.length > 1) {
      lst[0].checked = true;
      lst[0].dispatchEvent(new Event('click'));
    }
  }
}

function click_prompt_default(ev) 
{
  const lst = DOM.qSelAll('tbody#prompt-list input.prompt_chk');
  if (lst.length > 1) {
    lst[0].checked = true;
    lst[0].dispatchEvent(new Event('click'));
  }

  g_prompt_view.setValue(gPref.def_prompt_inject);
  validate_prompt_injects();
  DOM.qSel('#gpt-max-tokens').value='4096';
}

function prompt_out(ev)
{
 const row = DOM.qSel('tbody#prompt-list tr.prompt_checked');
 row.attributes.text.value = DOM.qSel('#prompt-query').value;
}

function prompt_name_out(ev)
{
  const name = ev.target;
  const lst = DOM.qSelAll('tbody#prompt-list tr input#name');
  for(const i of lst ) {
    if (i !== name && i.value === name.value) {
      ev.preventDefault();
      alert(`Prompt name ${name.value} exists already in list`);
      name.focus();
      break;
    }
  }
}

function prompt_to_lst()
{
  var myprompt;
  var lst = [];
  const rows = DOM.qSelAll('tbody#prompt-list tr');
  for(const i of rows ) {
    const name = i.querySelector('input#name').value;
    const text = i.attributes.text.value;
    const myid = i.attributes.myid.value;
    const checked = i.querySelector('input.prompt_chk').checked;
    var item = {name, checked};

    if (myid)
      item['myid'] = myid;
    else
      item['text'] = text;

    lst.push(item);

    if (checked) {
      myprompt = item;
    }
  }
  return {myprompt, lst};
}




async function savePref()
{
   const rc = await validate_prompt_injects();
   if (rc!==1) {
     alert("Changes weren't saved");
     return;
   }
   
   var uiterm_mode = DOM.qSel('#uiterm-mode option:checked').id;
   await gPref.setValue("ext.osds.uiterm.mode", uiterm_mode);

   const uid_chk = DOM.iSel('chk_pref_user').checked?"1":"0";
   await gPref.setValue("ext.osds.pref.user.chk", uid_chk);

   await gPref.setValue("ext.osds.pref.show_action", DOM.iSel('chk_show_action_for_url_with_params').checked?"1":"0");
   await gPref.setValue("ext.osds.auto_discovery", DOM.iSel('chk_auto_discovery').checked?"1":"0");

   await gPref.setValue("ext.osds.jsonld_compact_rel", DOM.iSel('chk_jsonld_compact_rel').checked?"1":"0");


   await gPref.setValue("ext.osds.handle_xml", DOM.iSel('chk_try_handle_xml').checked?"1":"0");
   await gPref.setValue("ext.osds.handle_csv", DOM.iSel('chk_try_handle_csv').checked?"1":"0");
   await gPref.setValue("ext.osds.handle_json",DOM.iSel('chk_try_handle_json').checked?"1":"0");
   await gPref.setValue("ext.osds.handle_all", DOM.iSel('chk_try_handle_all').checked?"1":"0");

   const pref_user = DOM.qSel('#pref_user option:checked');
   if (pref_user) {
     await gPref.setValue("ext.osds.pref.user", pref_user.text);
     await setRule_OnBehalfOf(uid_chk, pref_user.text);
   }
   else
     await setRule_OnBehalfOf(uid_chk, '');


   var import_srv = DOM.qSel('#import-srv option:checked').id;
   await gPref.setValue("ext.osds.import.srv", import_srv);
   await gPref.setValue("ext.osds.import.url", DOM.iSel('import-url').value.trim());

   await gPref.setValue("upload_sparql_endpoint", DOM.iSel('upload_sparql_endpoint').value.trim());
   await gPref.setValue("upload_sparql_timeout", DOM.iSel('upload_sparql_timeout').value.trim());
   await gPref.setValue("upload_sparql_graph", DOM.iSel('upload_sparql_graph').value.trim());


   await gPref.setValue("ext.osds.rww.edit.url", DOM.iSel('rww-edit-url').value.trim());
   await gPref.setValue("ext.osds.rww.store.url", DOM.iSel('rww-store-url').value.trim());


   var sparql_cmd = DOM.qSel('#sparql-cmd option:checked').id;
   await gPref.setValue("ext.osds.sparql.cmd", sparql_cmd);
   await gPref.setValue("ext.osds.sparql.url", DOM.iSel('sparql-url').value.trim());

   await gPref.setValue("ext.osds.sparql.query", yasqe_srv.getValue());

   await gPref.setValue("ext.osds.super_links.query", yasqe_slinks.getValue());

   var timeout = DOM.iSel('super-links-timeout').value.trim();
   await gPref.setValue("ext.osds.super_links.timeout", parseInt(timeout, 10));

   var v; 
   v = DOM.qSel('#super-links-sponge option:checked').id;
   await gPref.setValue("ext.osds.super-links-sponge", v);

   v = DOM.qSel('#super-links-sponge-mode option:checked').id;
   await gPref.setValue("ext.osds.super-links-sponge-mode", v);

   v = DOM.qSel('#super-links-viewer option:checked').id;
   await gPref.setValue("ext.osds.super-links-viewer", v);

   v = DOM.qSel('#super-links-highlight option:checked').id;
   await gPref.setValue("ext.osds.super-links-highlight", v);

   v = DOM.iSel('super-links-retries').value.trim();
   await gPref.setValue("ext.osds.super_links.retries", parseInt(v, 10));

   v = DOM.iSel('super-links-retries-timeout').value.trim();
   await gPref.setValue("ext.osds.super_links.retries_timeout", parseInt(v, 10));

   await gPref.setValue("ext.osds.chat-srv", DOM.qSel('#chat-srv option:checked').id);
   await gPref.setValue("osds.chatgpt_model", DOM.qSel('#chatgpt-model option:checked').id);

   v = DOM.iSel('chatgpt_max_tokens').value.trim();
   await gPref.setValue("osds.chatgpt_max_tokens", parseInt(v, 10));
   await gPref.setValue("osds.chatgpt_temp", DOM.iSel('chatgpt_temp').value.trim());
   await gPref.setValue("osds.chatgpt_openai_token", DOM.iSel('chatgpt_token').value.trim());
   await gPref.setValue("osds.chatgpt_prompt", DOM.iSel('chatgpt_prompt').value.trim());


    // tab ChatGPT
   gPref.setValue('ext.osds.def_prompt_inject', g_prompt_view.getValue()); //??--  DOM.qSel('textarea#prompt-injects').value);
   await gPref.setValue("ext.osds.gpt-tokens", DOM.iSel('gpt-max-tokens').value);

   v = prompt_to_lst();
   await gPref.setValue("ext.osds.prompt-lst", v.lst);
   await gPref.setValue("ext.osds.prompt", v.myprompt);


   Browser.api.runtime.sendMessage({'cmd': 'reloadSettings'});
   alert("Settings were Saved !");
}



async function enableCtrls()
{
    var srv = DOM.qSel('#import-srv option:checked').id;
    var h_url = gPref.createDefaultImportCmdFor(srv, DOM.iSel('import-url').value.trim());

    $('#import-url-bcast').show();
    DOM.iSel('import-url').value = h_url;
};



async function createSparqlQuery(cmd)
{
    var query = "";
    var uiterm_mode = DOM.qSel('#uiterm-mode option:checked').id;

    switch (cmd) {
      case 'select':
        query = await gPref.getSparqlQueryDefault(uiterm_mode);;
        break;
      case 'describe':
        query = "DESCRIBE <{url}> LIMIT 100";

        break;
      case 'construct':
        query = "CONSTRUCT  {<{url}> ?p ?o.   ?s ?p <{url}> .} \n"+
                "WHERE {  {<{url}> ?p ?o} union {?s ?p <{url}> } } LIMIT 100";
        break;
    }
    return query;
};


// ========== Users List ===========
async function call_edit_users()
{
    var list = [];
    try {
      var v = await gPref.getValue('ext.osds.pref.user.list');
      if (v)
        list = JSON.parse(v);
    } catch(e){}

    $( "#users-edit" )
    load_users_data(list);
    $( "#users-edit" ).dialog({
      resizable: false,
      height:300,
      width:450,
      modal: true,
      buttons: {
        "OK": function() {
          save_users_data();
          load_pref_user();
          $(this).dialog( "close" );
        },
        Cancel: function() {
          $(this).dialog( "close" );
        }
      }
    });
}


function createUsersRow(v)
{
  if (!v)
    v = "";
  var del = '<button id="users_del" class="users_del">Del</button>';
  return '<tr><td width="16px">'+del+'</td>'
            +'<td><input id="v" style="WIDTH: 98%" value="'+v+'"></td></tr>';
}


function addUsersEmpty()
{
  addUsersItem("");
}

function addUsersItem(v)
{
  $('#users_data').append(createUsersRow(v));
  $('.users_del').button({
    icons: { primary: 'ui-icon-minusthick' },
    text: false
  });
  $('.users_del').click(users_del);
}

function emptyUsers()
{
  var data = $('#users_data>tr');
  for(var i=0; i < data.length; i++) {
    $(data[i]).remove();
  }
}


function users_del(e) {
  //get the row we clicked on
  var row = $(this).parents('tr:first');
  $(row).remove();

  return true;
}

function load_users_data(params)
{
  emptyUsers();

  for(var i=0; i<params.length; i++) {
    addUsersItem(params[i]);
  }

  if (params.length == 0)
    addUsersItem("");
}

function save_users_data()
{
  var list = [];
  var rows = $('#users_data>tr');
  for(var i=0; i < rows.length; i++) {
    var r = $(rows[i]);
    var v = r.find('#v').val();
    if (v.length>0)
       list.push(v);
  }

  gPref.setValue('ext.osds.pref.user.list', JSON.stringify(list, undefined, 2));
}

