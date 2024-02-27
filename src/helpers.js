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

class SPARQL_Upload {
  constructor(tab, messages, req)
  {
    this.data = req.data;
    this.sparql_ep = req.sparql_ep;
    this.baseURI = req.baseURI;
    this.sparql_graph = req.sparql_graph;
    this.sparql_check = req.sparql_check;

    this.tab = tab;
    this.messages = messages;
    this.state = 'init';
    this.oidc = new OidcWeb();
    var u = new URL(this.sparql_ep);
    this.idp_url = u.origin;
  }


  async check_login(relogin)
  {
    try {
      this.messages.throbber_show("&nbsp;Initializing...");

      if (relogin) 
      {
        await this.oidc.logout();
        this.state = 'login';
        this.oidc.login2(this.idp_url);
        return false;
      } 
      else 
      {
        const rc = await this.oidc.restoreConn();

        if (!rc || !this.oidc.isSessionForIdp(this.idp_url)) {
            await this.oidc.logout();
        }
        if (!this.oidc.getWebId()) {
          this.state = 'login';
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
    await this.oidc.logout();
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

    var handler = new Convert_Turtle();
    try {
      for(var v of this.data) {
        this.messages.throbber_show('&nbsp;Preparing&nbsp;data...');

        if (v.error.length > 0 && v.txt.length == 0) {
          
          this.messages.snackbar_show('Unable prepare data:' +v.error);

        } else if (v.txt.length > 0) {
          
          var ttl_data = await handler.prepare_query(v.txt, this.baseURI);
          for(var i=0; i < ttl_data.length; i++) {

            var ret = await this.exec_sparql(ttl_data[i].prefixes, ttl_data[i].triples);

            this.messages.throbber_hide();

            if (!ret.rc) {
              if (ret.status === 401 || ret.status === 403) {
                 this.logout();
                 this.state = 'init';
                 this.messages.msg_show(ret.error);
                 return false;

              } else {
                 this.state = 'init';
                 this.messages.msg_show(ret.error);
                 return false;
              }
            }
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
    var insert_cmd = this.sparql_graph.length > 1
                 ? 'INSERT INTO GRAPH <' + this.sparql_graph + '> {\n'
                 : 'INSERT DATA { \n';

    pref += "base <"+this.baseURI+"> \n";
    pref += "prefix : <#> \n";

    prefixes = prefixes || {};
    triples = triples || "";

    pref_sz = pref.length;

    for(var key in prefixes) {
      var item = "prefix "+key+": <"+prefixes[key]+"> \n";
      pref += item;
      pref_len++;
      pref_sz += item.length;
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
  constructor(url, tabId, messages)
  {
    this.oidc = new OidcWeb();
    this.doc_url = url;
    this.tabId = tabId;
    this.messages = messages;
    this.state = 'init';
    this.idp_url = 'https://linkeddata.uriburner.com';
  }

  async check_login(relogin)
  {
    try {
      this.messages.throbber_show("&nbsp;Initializing...");

      if (relogin) 
      {
        await this.oidc.logout();
        this.state = 'login';
        this.oidc.login2(this.idp_url);
        return false;
      } 
      else 
      {
        const rc = await this.oidc.restoreConn();

        if (!rc || !this.oidc.isSessionForIdp(this.idp_url)) {
            await this.oidc.logout();
        }
        if (!this.oidc.getWebId()) {
          this.state = 'login';
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
    await this.oidc.logout();
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
//              alert("Empty SuperLinks resultSet was received from server");
              return {statusCode: rc.status, data: null};
            }
          } catch(e) {
            console.log(e);
          }
        }
        
        this.state = null;
        return {statusCode: rc.status, data: data};
  
      } else {
        this.messages.throbber_hide();
        if (rc.status==401 || rc.status==403) {
          this.logout();
          this.check_login(true); // Browser.openTab(REDIR_URL);
        } else {
          this.state = 'init';
          this.messages.snackbar_show("Could not load data from: "+SPARQL_URL, "Error:"+rc.status); 
        }
        return {statusCode: rc.status, data: null};
      }
  
    } 
    catch(e) {
      this.messages.throbber_hide();
      this.state = 'init';
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
//??--      alert("Empty SuperLinks resultSet was received from server");
      if (rc.statusCode == 401 || rc.statusCode == 403) {
        this.logout();
        this.check_login(true);
      }
    }

    return false;
  }

}



