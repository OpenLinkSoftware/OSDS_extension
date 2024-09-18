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

 
class myStore {
  constructor()
  {
    this.s = window.localStorage;
    this.data = {};
    this.keys = [];
  }

  sync()
  {
    this.keys = Object.keys(this.data);
  }

  key(idx) 
  {
    if (idx < 0 || idx >= this.keys.length)
      return null;
    return this.keys[idx];
  }

  setItem(key, val)
  {
    this.data[key] = val;
    this.sync();
  }

  getItem(key)
  {
    return this.data[key];
  } 

  removeItem(key)
  {
    delete this.data[key];
    this.sync();
  }

  get length()
  {
    return this.keys.length;
  }

}




class OidcWeb {
  constructor(data) 
  {
    this.storage = null;
    this.session = null;
    this.jstore = new myStore();
    this.IdP = null;

    const options = Browser.is_safari ? { solid: true, store: this.jstore} : { solid: true } ;

    this.authClient = solidClientAuthentication.default;
    this.login_url = 'https://openlinksoftware.github.io/solid-client-authn-js/Auth/login1.html'
                    +`?app=osds&mode=${Browser.is_ff||Browser.is_safari?"Bearer":"DPop"}#relogin`;
    this.login2_url = 'https://openlinksoftware.github.io/solid-client-authn-js/Auth/login1.html'
                     +`?app=osds&mode=${Browser.is_ff||Browser.is_safari?"Bearer":"DPop"}`;
  }


  async logout()
  {
    const session = this.authClient.getDefaultSession();
    if (session && session.info && session.info.isLoggedIn) {
      await this.localStore_remove('oidc_saved_tokens');
      await this.localStore_remove('oidc_code');
      await this.authClient.logout();
    }
  }

  login(idp_url, autologin) 
  {
     const width = 700;
     const height = 500;
     const alogin = autologin ? '&autologin=1' : ''

     const url = idp_url ? this.login2_url+'&idp='+encodeURIComponent(idp_url)+alogin+'#relogin'
                         : this.login_url;

     if (Browser.is_chrome_v3 || Browser.is_ff_v3) {
       let args = {
         url,
         type: 'popup',
         height,
         width,
         focused: true
       }
       if (Browser.is_ff_v3)
         args['allowScriptsToClose'] = true;
       Browser.api.windows.create(args);
     } 
     else if (Browser.is_ff) {
       const left = window.screenX + (window.innerWidth - width) / 2;
       const top = window.screenY + (window.innerHeight - height) / 2;

       Browser.api.windows.create({
         url,
         type: 'popup',
         height,
         width,
         top,
         left,
         allowScriptsToClose : true,
         focused: true
       });
     }
     else {
       this.popupCenter({url, title:"Login", w:width, h:height});
     }
  }

  login2(idp_url) 
  {
     const width = 700;
     const height = 500;

     const url = this.login2_url+'&idp='+encodeURIComponent(idp_url)+'&slogin=1#relogin';

     if (Browser.is_chrome_v3 || Browser.is_ff_v3) {
       let args = {
         url,
         type: 'popup',
         height,
         width,
         focused: true
       }
       if (Browser.is_ff_v3)
         args['allowScriptsToClose'] = true;
       Browser.api.windows.create(args);
     } 
     else if (Browser.is_ff) {
       const left = window.screenX + (window.innerWidth - width) / 2;
       const top = window.screenY + (window.innerHeight - height) / 2;

       Browser.api.windows.create({
         url,
         type: 'popup',
         height,
         width,
         top,
         left,
         allowScriptsToClose : true,
         focused: true
       });
     } 
     else {
       this.popupCenter({url, title:"Login", w:width, h:height});
     }
  }

  popupCenter({url, title, w, h})
  {
    // Fixes dual-screen position                         Most browsers      Firefox  
    var dualScreenLeft = window.screenLeft != undefined ? window.screenLeft : screen.left;  
    var dualScreenTop = window.screenTop != undefined ? window.screenTop : screen.top;  
              
    let width = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth ? document.documentElement.clientWidth : screen.width;  
    let height = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height;  
              
    var left = ((width / 2) - (w / 2)) + dualScreenLeft;  
    var top = ((height / 2) - (h / 2)) + dualScreenTop;  
    var newWindow = window.open(url, title, 'scrollbars=yes, width=' + w + ', height=' + h + ', top=' + top + ', left=' + left);  
    
    // Puts focus on the newWindow  
    if (window.focus && newWindow) {  
        newWindow.focus();  
    }  
  }

  extractIdp(url, data)
  {
    try {
      const u = new URL(url);
      const state = u.searchParams.get("state");
      const session = JSON.parse(data['solidClientAuthenticationUser:'+state]);
      if (session && session.sessionId) {
        const session_data = JSON.parse(data['solidClientAuthenticationUser:'+session.sessionId]);
        if (session_data && session_data.issuer) 
          return session_data.issuer;
      }
    } catch (e) {
      console.log(e);
    }
    return null;
  }



  async restoreConn()
  {
    this.IdP = null;
    let oidc_saved_tokens = null;
    let authData = null;
    const storage = (window.localStorage) ? window.localStorage : window.sessionStorage

    try {
      oidc_saved_tokens = await this.localStore_get('oidc_saved_tokens');
      try {
        const oidc_code = await this.localStore_get('oidc_code');
        if (oidc_code) {
          authData = JSON.parse(atob(oidc_code));

          for(var key in authData) {
            if (key.startsWith('issuerConfig:') || key.startsWith('solidClientAuthenticationUser:') || key.startsWith('oidc.'))
              storage.setItem(key, authData[key]);
          }
        }
      } catch(e) { console.log(e) }

      if (authData) {
        this.IdP = this.extractIdp(authData.url, authData);

        var options = {url:authData.url, restorePreviousSession: true};
        if (oidc_saved_tokens)
          options['tokens'] = JSON.parse(oidc_saved_tokens);

        const ret = await this.authClient.handleIncomingRedirect(options);
        if (ret && ret.tokens) {
          await this.localStore_save('oidc_saved_tokens', JSON.stringify(ret.tokens));
        }
        this.authClient = solidClientAuthentication.default;
        const session = this.authClient.getDefaultSession();
        if (session.info && session.info.isLoggedIn && session.info.webId)
          return session.info.webId;
      }
    } catch(e) { console.log(e); }

    return null;
  }


  isSessionForIdp(idp)
  {
    const session = this.authClient.getDefaultSession();
    return (session && session.info && session.info.isLoggedIn && this.IdP && this.IdP.startsWith(idp));
  }
  
  getWebId()
  {
    const session = this.authClient.getDefaultSession();
    return (session && session.info && session.info.isLoggedIn) ? session.info.webId : null;
  }
  
  async fetch(url, options)
  {
    return this.authClient.fetch(url, options);
  }

  async checkSession() 
  {
    this.authClient = solidClientAuthentication.default;
    const session = this.authClient.getDefaultSession();
    if (session.info && session.info.isLoggedIn && session.info.webId) {
      const webid = session.info.webId
      this.storage = (new URL(webid)).origin + '/';
      var prof = await this.loadProfile(webid);

      if (prof.storage)
        this.storage = prof.storage;
      if (!this.storage.endsWith('/'))
        this.storage += '/';

      return webid;
    }
    else
      return null;
  }

  async localStore_save(key, val) 
  {
    var rec = {};
    rec[key]=val;
    if (Browser.is_chrome) {
      return new Promise(function (resolve, reject) {
        Browser.api.storage.local.set(rec, () => resolve());
      })
    } else {
      return Browser.api.storage.local.set(rec);
    }
  }

  async localStore_get(key) 
  {
    if (Browser.is_chrome) {
      return new Promise(function (resolve, reject) {
        Browser.api.storage.local.get(key, (rec) => {
          resolve(rec[key])
        });
      })
    } else {
      return (await Browser.api.storage.local.get(key))[key];
    }
  }

  async localStore_remove(key) 
  {
    if (Browser.is_chrome) {
      return new Promise(function (resolve, reject) {
        Browser.api.storage.local.remove(key, (rec) => {
          resolve(rec)
        });
      })
    } else {
      return Browser.api.storage.local.remove(key);
    }
  }


  async putResource (url, data, contentType) 
  {
    const DEFAULT_CONTENT_TYPE = 'text/html; charset=utf-8'
    let options = { method: 'PUT', body:data};

    if (!url)
      return {rc:0, err:'Cannot PUT resource - missing url'}

    options.headers = options.headers || {}
    options.headers['Content-Type'] = contentType || DEFAULT_CONTENT_TYPE

    try {
      let rc = await this.authClient.fetch(url, options);
      if (!rc.ok) {
        switch(rc.status) {
          case 0:
          case 405:
            return {rc:0, err:'this location is not writable'};
          case 401:
          case 403:
            return {rc:0, err:'you do not have permission to write here'};
          case 406:
            return {rc:0, err:'enter a name for your resource'};
          default:
            return {rc:0, err:rc.statusText};
        }
      }
      else
        return {rc:1};
    } catch(e) {
      return {rc:0, err:e.toString()}
    }
  }


  async loadProfile(webId) 
  {
    var uri = new URL(webId);
    const uri_hash = uri.hash;

    uri.hash = uri.search = uri.query = '';
    const base = uri.toString();

    if (uri_hash === '#this')
      webId = base.toString();

    try {
      var rc = await this.fetchProfile(webId);
      if (!rc)
          return null;

      let mediaType = rc.content_type;
      let bodyText = rc.profile;

      if (mediaType.startsWith('text/html')) {
          let parser = new DOMParser();
          let doc = parser.parseFromString(bodyText, 'text/html');
          let storage_link = doc.querySelector(`*[itemid="${webId}"] > link[itemprop="http://www.w3.org/ns/pim/space#storage"]`);
          let inbox_link = doc.querySelector(`*[itemid="${webId}"] > link[itemprop="http://www.w3.org/ns/pim/space#inbox"]`);
          let name_meta = doc.querySelector(`*[itemid="${webId}"] > meta[itemprop="http://schema.org/name"]`);
          let storage_url = storage_link ? storage_link.href : inbox_link ? inbox_link.href : null;
          if (storage_url) {
              return {
                  webId,
                  storage: storage_url,
                  is_solid_id: false,
                  name: name_meta ? name_meta.content : null
              }
          }
      }

      const store = $rdf.graph()
      $rdf.parse(bodyText, store, base, mediaType);
      const LDP = $rdf.Namespace("http://www.w3.org/ns/ldp#");
      const PIM = $rdf.Namespace("http://www.w3.org/ns/pim/space#");
      const SOLID = $rdf.Namespace("http://www.w3.org/ns/solid/terms#");
      const FOAF = $rdf.Namespace("http://xmlns.com/foaf/0.1/");

      const s_webId = $rdf.sym(webId)

      var storage = store.any(s_webId, PIM('storage'));
      var inbox = store.any(s_webId, LDP('inbox'));
      var name = store.any(s_webId, FOAF('name'));

      var s_issuer = store.any(s_webId, SOLID('oidcIssuer'));
      var s_account = store.any(s_webId, SOLID('account'));
      var s_pubIndex = store.any(s_webId, SOLID('publicTypeIndex'));
      var is_solid_id = (s_issuer || s_account || s_pubIndex) ? true : false;
      let storage_url = storage ? storage.value : inbox ? inbox.value : null;
      return {
          storage: storage_url,
          is_solid_id: is_solid_id,
          name: name
      };

    } catch (e) {
      console.error('Error', e)
      return null;
    }
  }


  async fetchProfile(url) 
  {
    var _uri = new URL(url);

    const is_html =(_uri.pathname.endsWith('.htm') || _uri.pathname.endsWith('.html'))
    let options = {}

    if (!is_html)
      options['headers'] =  { 'Accept': 'text/turtle;q=1.0,application/ld+json;q=0.5,text/plain;q=0.2,text/html;q=0.5,*/*;q=0.1'}
    else
      options['headers'] =  { 'Accept': 'text/html'}

    var resp;
    try {
      resp = await fetchWithTimeout(url, options, 10000);
      if (resp.ok) {
          var body = await resp.text();
          var contentType = resp.headers.get('content-type');
          return { profile: body, content_type: contentType };
      }
      else {
          console.log("Error " + resp.status + " - " + resp.statusText)
      }
    }
    catch (e) {
      console.error('Request failed', e)
      return null;
    }
  }

}



/**
async function isDavSupported (url) 
{
  if (!url) 
    return false;

  try {
    rc = await authClient.fetch(url, { method: 'OPTIONS'});
    if (rc.ok) {
      if (rc.status != 204)
        return false;

      let dav = rc.headers.get('DAV');
      if (dav && dav.split(',').includes('1'))
        return true;
      else
        return false;
    }
  } catch(e) {
    console.log(e);
    return false;
  }
}
***/
