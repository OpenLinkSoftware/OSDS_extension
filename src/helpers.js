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

const Actions = {
    clear: async function() {
        const settings = new Settings();
        await settings.setValue('g.SuperLinks', '');
        await settings.setValue('g.SPARQL_Uploads', '');
    },
    isSuperLinks: async function() {
        const settings = new Settings();
        const v = await settings.getValue('g.SuperLinks');
        return v ? true : false;
    },
    isSPARQL_Uploads: async function() {
        const settings = new Settings();
        const v = await settings.getValue('g.SPARQL_Uploads');
        return v ? true : false;
    },
    setSuperLinks: async function() {
        const settings = new Settings();
        await settings.setValue('g.SuperLinks', '1');
    },
    setSPARQL_Uploads: async function() {
        const settings = new Settings();
        await settings.setValue('g.SPARQL_Uploads','1');
    },
}

const GVars = {
    clear: async function() {
        const settings = new Settings();
        await settings.setValue('g.Pages', '{}');
        await settings.setValue('g.ChatTab', '');
        await settings.setValue('g.ChatTabAsk', '');
    },
    updatePage: async function(tabId, val) {
        const settings = new Settings();
        try {
          const v = await settings.getValue('g.Pages');
          var pages = JSON.parse(v);
          pages[tabId] = val;
          await settings.setValue('g.Pages', JSON.stringify(pages));
        } catch(ex) {
        }
    },
    deletePage: async function(tabId) {
        const settings = new Settings();
        try {
          const v = await settings.getValue('g.Pages');
          var pages = JSON.parse(v);
          delete pages[tabId];
          await settings.setValue('g.Pages', JSON.stringify(pages));
        } catch(ex) {
        }
    },
    getPage: async function(tabId) {
        const settings = new Settings();
        try {
          const v = await settings.getValue('g.Pages');
          var pages = JSON.parse(v);
          return pages[tabId];
        } catch(ex) {
        }
    }
}

class SPARQL_Upload {
  constructor(tab, req)
  {
    this.oidc = new OidcWeb();
    this.state = 'init';
    this.init(tab, req);
  }

  async save_state()
  {
    const v = {
      qdata: this.qdata,
      sparql_ep: this.sparql_ep,
      baseURI: this.baseURI,
      sparql_graph: this.sparql_graph,
      sparql_check: this.sparql_check,
      tab: this.tab,
      state: this.state,
      idp_url: this.idp_url
    }
    const settings = new Settings();
    await settings.setValue('g.SPARQL_Upload', JSON.stringify(v));
  }

  async load_state()
  {
     const settings = new Settings();
     const state = await settings.getValue('g.SPARQL_Upload');
     if (state) {
       try {
         const v = JSON.parse(state);
         if (v.state)
           this.state = v.state
           this.tab = v.tab;
           this.qdata = v.qdata;
           this.sparql_ep = v.sparql_ep;
           this.baseURI = v.baseURI;
           this.sparql_graph = v.sparql_graph;
           this.sparql_check = v.sparql_check;
           this.idp_url = v.idp_url;
       } catch(_) {
       }
     }
  }


  async init(tab, req)
  {
    this.tab = tab;
    if (req) {
      this.qdata = req.qdata;
      this.sparql_ep = req.sparql_ep;
      this.baseURI = req.baseURI;
      this.sparql_graph = req.sparql_graph;
      this.sparql_check = req.sparql_check;
      var u = new URL(this.sparql_ep);
      this.idp_url = u.origin;
    }

    this.messages = 
       { 
         throbber_show: (txt) => {
            Browser.api.tabs.sendMessage(this.tab.id, { cmd: 'super_links_msg_show', message: txt });
         },
         throbber_hide: () => {
            Browser.api.tabs.sendMessage(this.tab.id, { cmd: 'super_links_msg_hide' });
         },
         snackbar_show: (msg1, msg2) => {
            Browser.api.tabs.sendMessage(this.tab.id, { cmd: 'super_links_snackbar', msg1, msg2 });
         },
         msg_show: (msg) => {
            Browser.api.tabs.sendMessage(this.tab.id, { cmd: 'osds_msg_show', message: msg });
         },
         msg_hide: () => {
            Browser.api.tabs.sendMessage(this.tab.id, { cmd: 'osds_msg_hide' });
         }
       }
  }
  

  async check_login(relogin)
  {
    try {
      this.messages.throbber_show("&nbsp;Initializing...");

      if (relogin) 
      {
        try {
          await this.oidc.logout();
        } catch(_) {}
        this.state = 'login';
        await this.save_state();
        this.oidc.login2(this.idp_url);
        return false;
      } 
      else 
      {
        const rc = await this.oidc.restoreConn();

        if (!rc || !this.oidc.isSessionForIdp(this.idp_url)) {
          try { 
            await this.oidc.logout();
          } catch(_) {}
        }
        if (!this.oidc.getWebId()) {
          this.state = 'login';
          await this.save_state();
          this.oidc.login2(this.idp_url);
          return false;
        }
      }
      return true;
    } finally {
      this.messages.throbber_hide();
    }
  }

  
  async logout()
  {
    try {
      await this.oidc.logout();
    } catch(_) {}
  }

  
  async reexec()
  {
    if (this.state === 'init' || this.state === 'login') {
      const webId = await this.oidc.restoreConn();

      var rc = await this.check_login(webId===null);
      if (rc) {
        return await this.mexec();
      }
    } 
    else if (this.state === 'query') 
    {
      return await this.mexec();
    } 
    return false;
  }


  async mexec()
  {
    this.state = `query`;
    await this.save_state();

    try {
      this.messages.throbber_show('&nbsp;Preparing&nbsp;data...');
      for(var v of this.qdata) {

        var ret = await this.exec_sparql(v.prefixes, v.triples);

        this.messages.throbber_hide();

        if (!ret.rc) {
          if (ret.status === 401 || ret.status === 403) {
             this.logout();
             this.state = 'init';
             await this.save_state();
             this.messages.msg_show(ret.error);
             return false;

          } else {
             this.state = 'init';
             await this.save_state();
             this.messages.msg_show(ret.error);
             return false;
          }
        }
      }
      if (this.sparql_check) {
        if (this.tab)
          Browser.api.tabs.create({'url':this.sparql_check, 'index': this.tab.index+1});
        else
          Browser.api.tabs.create({'url':this.sparql_check});
      }
      
    } finally {
      this.messages.throbber_hide();
    }
  
    return true;
  }


  async exec_sparql(prefixes, triples)
  {
    var setting = new Settings();
    var timeout = parseInt(await setting.getValue('upload_sparql_timeout'), 10);
    
    var pref = "";
    var max_bytes = 30000;
    var pref_len = 10;
    var pref_sz;
    var insert_cmd = this.sparql_graph?.length > 1
                 ? 'INSERT INTO GRAPH <' + this.sparql_graph + '> {\n'
                 : 'INSERT DATA { \n';

    if (prefixes.base)
      pref += "base <"+prefixes.base+"> \n";
    else
      pref += "base <"+this.baseURI+"> \n";

    pref += "prefix : <#> \n";

    prefixes = prefixes || {};
    triples = triples || "";

    pref_sz = pref.length;

    for(var key in prefixes) {
      if (key!=='base') {
        let item = "prefix "+key+": <"+prefixes[key]+"> \n";
        pref += item;
        pref_len++;
        pref_sz += item.length;
      }
    }
  
    var max_count = 1000 - pref_len;
    var count = 0;
    var data = [];
    var qry_sz = pref_sz;
    var z = 1;
    for(var i=0; i < triples.length; i++) 
    {
      if (qry_sz + triples[i].length >= max_bytes || count+1 >= max_count) {
        this.messages.throbber_show('&nbsp;Uploading&nbsp;data&nbsp;...'+z);  z++;

        var ret = await this.send_sparql(pref + "\n" + insert_cmd + data.join('\n') + ' }', timeout);
        if (!ret.rc)
          return ret;

        count = 0;
        data = [];
        qry_sz = pref_sz;
      }

      data.push(triples[i]);
      count++;
      qry_sz += triples[i].length + 1;

    }

    if (count > 0) 
    {
      this.messages.throbber_show('&nbsp;Uploading&nbsp;data&nbsp;...'+z);  z++;

      var ret = await this.send_sparql(pref + "\n" + insert_cmd + data.join('\n') + ' }', timeout);
      if (!ret.rc)
        return ret;
    }

    return {rc: true};
  }


  async send_sparql(query, timeout)
  {
    var contentType = "application/sparql-update;utf-8";
    var ret;
    var options = {
      method: 'POST',
      headers: {
        'Content-type': 'application/sparql-update;utf-8'
      },
      credentials: 'include',
      body: query
    }

    if (!timeout || timeout < 1)
      timeout = 5;

    try {
      ret = await this.fetchWithTimeout(this.sparql_ep, options, timeout * 1000);

      if (!ret.ok) {
        var message = this.create_error(ret.status, ret.statusText);
        return {rc:false, error: message, status: ret.status} ;
      }
    } catch (e) {
      var message = this.create_error(e.statusCode, e.message);
      return {rc:false, error:message, status: e.statusCode };
    }

    return {rc: true};
  }


  fetchWithTimeout(url, options, timeout) 
  {
    return Promise.race([
      this.oidc.fetch(url, options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query execution timeout')), timeout)
      )
    ]);
  }



  create_error(status, statusText)
  {
    switch(status) {
      case 0:
      case 405: 
        return 'HTTP Error: '+status +' \nThis location is not writable';
      case 401:
      case 403:
        return 'HTTP Error: '+status +' \nYou do not have permission to execute SPARQL Insert query';
      case 406:
        return 'HTTP Error: '+status +' \nEnter a name for your resource';
    }
    return statusText;
  }


}


class SuperLinks {
  constructor(url, tabId)
  {
    this.oidc = new OidcWeb();
    this.state = 'init';
    this.idp_url = 'https://linkeddata.uriburner.com';
    this.init(url, tabId);
  }

  async save_state()
  {
    const v = {
      doc_url: this.doc_url,
      tabId: this.tabId,
      state: this.state
    }
    const settings = new Settings();
    await settings.setValue('g.SuperLinks', JSON.stringify(v));
  }

  async load_state()
  {
     const settings = new Settings();
     const state = await settings.getValue('g.SuperLinks');
     if (state) {
       try {
         const v = JSON.parse(state);
         if (v.state)
           this.state = v.state
           this.tabId = v.tabId;
           this.doc_url = v.doc_url;
       } catch(_) {
       }
     }
  }



  async init(url, tabId)
  {
    this.tabId = tabId;
    this.doc_url = url;
    this.messages = 
       { 
         throbber_show: (txt) => {
            Browser.api.tabs.sendMessage(this.tabId, { cmd: 'super_links_msg_show', message: txt });
         },
         throbber_hide: () => {
            Browser.api.tabs.sendMessage(this.tabId, { cmd: 'super_links_msg_hide' });
         },
         snackbar_show: (msg1, msg2) => {
            Browser.api.tabs.sendMessage(this.tabId, { cmd: 'super_links_snackbar', msg1, msg2 });
         },
       }
  }



  async check_login(relogin)
  {
    try {
      this.messages.throbber_show("&nbsp;Initializing...");

      if (relogin) 
      {
        try {
          await this.oidc.logout();
        } catch(_) {}
        this.state = 'login';
        await this.save_state();
        this.oidc.login2(this.idp_url);
        return false;
      } 
      else 
      {
        const rc = await this.oidc.restoreConn();

        if (!rc || !this.oidc.isSessionForIdp(this.idp_url)) {
          try {
            await this.oidc.logout();
          } catch(_) {}
        }
        if (!this.oidc.getWebId()) {
          this.state = 'login';
          await this.save_state();
          this.oidc.login2(this.idp_url);
          return false;
        }
      }
      return true;
    } finally {
      this.messages.throbber_hide();
    }
  }

  
  async logout()
  {
    try {
      await this.oidc.logout();
    } catch(_) {}
  }

  
  fetchWithTimeout(url, options, timeout) 
  {
    return Promise.race([
      this.oidc.fetch(url, options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeout)
      )
    ]);
  }


  async request_superlinks(iter)
  {
    this.state = 'sponge';
    await this.save_state();

    var LOGIN_URL = "https://linkeddata.uriburner.com/rdfdesc/login.vsp";
    
    var setting = new Settings();
    var sponge_type = await setting.getValue('ext.osds.super-links-sponge');
    var sponge_mode = await setting.getValue('ext.osds.super-links-sponge-mode');
    var links_timeout = parseInt(await setting.getValue("ext.osds.super_links.timeout"), 10);
    var url_sponge;
  
    if (sponge_type) {
      url_sponge = setting.createSpongeCmdFor(sponge_type, sponge_mode, this.doc_url);
    } else {
      var rc = this.doc_url.match(/^((\w+):\/)?\/?(.*)$/);
      url_sponge = "https://linkeddata.uriburner.com/about/html/http/"+rc[3]+"?sponger:get=add";
    }
  

    this.messages.throbber_show("&nbsp;Retrieving&nbsp;Information");

    var options = {
         headers: {
            'Accept': 'text/html',
            'Cache-control': 'no-cache'
         },
         credentials: 'include',
        };
  
    try  {
      var rc = await this.fetchWithTimeout(url_sponge, options, links_timeout);
      if (rc.ok && rc.status == 200) {
        if (rc.redirected && rc.url.lastIndexOf(LOGIN_URL, 0) === 0) {
          this.messages.throbber_hide();
          this.messages.snackbar_show("Could not retrieving information for current page with: "+url_sponge,"Trying Relogin and execute sponge again"); 
          this.logout();
          this.check_login(true); // Browser.openTab(REDIR_URL);
          return {statusCode: rc.status, data: null};
        }
        return await this.exec_super_links_query(iter);
  
      } else {
        if (rc.status==401 || rc.status==403) {
          this.messages.throbber_hide();
          this.messages.snackbar_show("Sponge error:"+rc.status,"Trying Relogin and execute sponge again"); 
          this.logout();
          this.check_login(true); // Browser.openTab(REDIR_URL);
          return {statusCode: rc.status, data: null};
        } else {
          this.messages.snackbar_show("Sponge error:"+rc.status, rc.statusText); 
          return await this.exec_super_links_query(iter);
        }
      }
  
    } catch(e) {
      this.messages.throbber_hide();
      if (e.statusCode == 403 || e.statusCode == 401) {
        this.logout();
        this.messages.snackbar_show("Sponge error:"+e.statusCode,"Trying Relogin and execute sponge again"); 
        this.check_login(true); // Browser.openTab(REDIR_URL);
      } else {
        this.messages.snackbar_show("Sponge error:"+e.toString(), null); 
      }
      console.log(e);
      return {statusCode: e.statusCode, data: null};
    }
  
    return {statusCode:0, data:null};
  }


  async exec_super_links_query(iter)
  {
    this.state = 'query';
    await this.save_state();

    var SPARQL_URL = "https://linkeddata.uriburner.com/sparql";

    var setting = new Settings();
    var links_query = await setting.getValue("ext.osds.super_links.query");
    var links_timeout = parseInt(await setting.getValue("ext.osds.super_links.timeout"), 10);

    
    var url = new URL(this.doc_url);
    url.hash = '';
    var iri = url.toString();
  
    var br_lang = navigator.language || navigator.userLanguage;
    if (br_lang && br_lang.length>0) {
      var i = br_lang.indexOf('-');
      if (i!=-1)
         br_lang = br_lang.substr(0,i);
    } else {
      br_lang = 'en';
    }
  
    var links_sparql_query = await setting.createSuperLinksQuery(links_query, iri, br_lang);
  
    this.messages.throbber_show("&nbsp;Preparing&nbsp;Super&nbsp;Links&nbsp;"+iter);
  
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
      var rc = await this.fetchWithTimeout(get_url, options, links_timeout);
      if (rc.ok && rc.status == 200) {
        var data;
        try {
          data = await rc.text();
        } catch(e) {
          console.log(e);
        } finally {
          this.messages.throbber_hide();
        }
  
        if (data) {
          try {
            var val = JSON.parse(data);
            var links = val.results.bindings;
            if (links.length == 0) {
              // Empty SuperLinks resultSet was received from server
              return {statusCode: rc.status, data: null};
            }
          } catch(e) {
            console.log(e);
          }
        }
        
        this.state = '';
        await this.save_state();
        return {statusCode: rc.status, data: data};
  
      } else {
        this.messages.throbber_hide();
        if (rc.status==401 || rc.status==403) {
          this.logout();
          this.check_login(true); // Browser.openTab(REDIR_URL);
        } else {
          this.state = 'init';
          await this.save_state();
          this.messages.snackbar_show("Could not load data from: "+SPARQL_URL, "Error:"+rc.status); 
        }
        return {statusCode: rc.status, data: null};
      }
  
    } 
    catch(e) {
      this.messages.throbber_hide();
      this.state = 'init';
      await this.save_state();
      if (e.statusCode == 403 || e.statusCode == 401) {
        this.logout();
        this.messages.snackbar_show("Fetch SuperLinks error:"+e.statusCode,"Trying Relogin and call SupeLinks again"); 
        this.check_login(true); // Browser.openTab(REDIR_URL);
      } else {
        this.messages.snackbar_show("Could not load data from: "+SPARQL_URL, e.toString());
      }
      return {statusCode: e.statusCode, data: null};
    } 
    finally {
      this.messages.throbber_hide();
    }
  }

  apply_super_links(data)
  {
    if (data)
      Browser.api.tabs.sendMessage(this.tabId, { cmd: 'super_links_data', data : data });
  }

  
  async reexec()
  {
    if (this.state === 'init' || this.state === 'login') {
      const webId = await this.oidc.restoreConn();

      var rc = await this.check_login(webId===null);
      if (rc) {
        return await this.mexec();
      }
    } 
    else if (this.state === 'sponge') 
    {
      return await this.mexec();
    } 
    else if (this.state === 'query') 
    {
      return await this.mexec_query();
    }
    return false;
  }


  async mexec()
  {
    var setting = new Settings();
    var retries = await setting.getValue("ext.osds.super_links.retries");
    var rtimeout = await setting.getValue("ext.osds.super_links.retries_timeout");

    if (retries < 3)
      retries = 3;

    if (rtimeout < 2)
      rtimeout = 2;

    var rc = null;

    for(var i=0; i < retries; i++)
    {
      if (i == 0)
         rc = await this.request_superlinks(i+1);
      else
         rc = await this.exec_super_links_query(i+1);

      if (this.state === 'login' || this.state === 'init')
        break;

      if (rc && rc.data) {
        this.apply_super_links(rc.data);
        return true;
      } 
      else {
        await sleep(rtimeout * 1000);
      }
    }

    if (!rc || (rc && !rc.data)) {
      if (rc.statusCode == 401 || rc.statusCode == 403) {
        this.logout();
        this.check_login(true);
      }
    }

    return false;
  }

  async mexec_query()
  {
    var setting = new Settings();
    var retries = await setting.getValue("ext.osds.super_links.retries");
    var rtimeout = await setting.getValue("ext.osds.super_links.retries_timeout");

    if (retries < 3)
      retries = 3;

    if (rtimeout < 2)
      rtimeout = 2;

    var rc = null;

    for(var i=0; i < retries; i++)
    {
      rc = await this.exec_super_links_query(i+1);

      if (this.state === 'login')
        break;

      if (rc && rc.data) {
        this.apply_super_links(data);
        return true;
      } 
      else {
        await sleep(rtimeout * 1000);
      }
    }

    if (!rc || (rc && !rc.data)) {
      // Empty SuperLinks resultSet was received from server
      if (rc.statusCode == 401 || rc.statusCode == 403) {
        this.logout();
        this.check_login(true);
      }
    }

    return false;
  }

}



