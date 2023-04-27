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




OidcWeb = function(data) {
  this.storage = null;
  this.session = null;
  this.jstore = new myStore();
  this.IdP = null;

  const options = Browser.is_safari ? { solid: true, store: this.jstore} : { solid: true } ;

  this.authClient = solidClientAuthentication.default;
  this.login_url = 'https://openlinksoftware.github.io/solid-client-authn-js/Auth/login.html#relogin';
  this.login2_url = 'https://openlinksoftware.github.io/solid-client-authn-js/Auth/login.html';
}


OidcWeb.prototype = {
  logout : async function()
  {
    const session = this.authClient.getDefaultSession();
    if (session && session.info && session.info.isLoggedIn) {
      await this.authClient.logout();
    }
  },

  login: function(idp_url, autologin) {
     const width = 650;
     const height = 400;
     const alogin = autologin ? '&autologin=1' : ''


     const _url = idp_url ? this.login2_url+'?idp='+encodeURIComponent(idp_url)+alogin+'#relogin'
                         : this.login_url;

     if (Browser.is_ff) {
       const left = window.screenX + (window.innerWidth - width) / 2;
       const top = window.screenY + (window.innerHeight - height) / 2;

       Browser.api.windows.create({
         url: _url,
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
       this.popupCenter({url: _url, title:"Login", w:width, h:height});
     }

     if (Browser.is_safari)
       window.close();
  },

  login2: function(idp_url) {
     const width = 650;
     const height = 400;

//     const url = this.login2_url+'?idp='+encodeURIComponent('https://linkeddata.uriburner.com')+'&slogin=1#relogin';
     const url = this.login2_url+'?idp='+encodeURIComponent(idp_url)+'&slogin=1#relogin';

     if (Browser.is_ff) {
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

     } else {
       this.popupCenter({url, title:"Login", w:width, h:height});
     }

     if (Browser.is_safari)
       window.close();
  },

  popupCenter: function({url, title, w, h})
  {
    // Fixes dual-screen position                         Most browsers      Firefox  
    var dualScreenLeft = window.screenLeft != undefined ? window.screenLeft : screen.left;  
    var dualScreenTop = window.screenTop != undefined ? window.screenTop : screen.top;  
              
    width = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth ? document.documentElement.clientWidth : screen.width;  
    height = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height;  
              
    var left = ((width / 2) - (w / 2)) + dualScreenLeft;  
    var top = ((height / 2) - (h / 2)) + dualScreenTop;  
    var newWindow = window.open(url, title, 'scrollbars=yes, width=' + w + ', height=' + h + ', top=' + top + ', left=' + left);  
    
    // Puts focus on the newWindow  
    if (window.focus && newWindow) {  
        newWindow.focus();  
    }  
  },

  extractIdp: function(url, data)
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
  },

  restoreConn: async function()
  {
    const settings = new Settings();
    this.IdP = null;

    try {
      const oidc_code = await settings.getValue('oidc_code');
      if (oidc_code && oidc_code.length > 0) {
        await settings.setValue('oidc_code', '');
        const data = JSON.parse(atob(oidc_code));

        for(var key in data) {
          if (key.startsWith('issuerConfig:') || key.startsWith('solidClientAuthenticationUser:') || key.startsWith('oidc.'))
            localStorage.setItem(key, data[key]);
        }

        this.IdP = this.extractIdp(data.url, data);

        const ret = await this.authClient.handleIncomingRedirect({url:data.url, restorePreviousSession: true});
        //??console.log('ret = ', ret);
        //??if (ret && ret.tokens)
        //??  localStorage.setItem('myTokens', JSON.stringify(ret.tokens));

        const session = this.authClient.getDefaultSession();
        if (session.info && session.info.isLoggedIn && session.info.webId)
          return session.info.webId;
      }
    } catch(e) {
      console.log(e);
    }
    return null;
  },


  isSessionForIdp: function(idp)
  {
    const session = this.authClient.getDefaultSession();
    return (session && session.info && session.info.isLoggedIn && this.IdP && this.IdP.startsWith(idp));
  },
  
  getWebId: function()
  {
    const session = this.authClient.getDefaultSession();
    return (session && session.info && session.info.isLoggedIn) ? session.info.webId : null;
  },
  
  fetch: async function(url, options)
  {
    return this.authClient.fetch(url, options);
  },

  checkSession: async function() 
  {
  },

  localStore_save: async function(key, val) 
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
  },

  localStore_get: async function(key) 
  {
    if (Browser.is_chrome) {
      return new Promise(function (resolve, reject) {
        Browser.api.storage.local.get(key, (rec) => {
          resolve(rec)
        });
      })
    } else {
      return Browser.api.storage.local.get(key);
    }
  },

  localStore_remove: async function(key) 
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


}


function putResource (oidc, url, data, contentType, links, options = {}) 
{
  const DEFAULT_CONTENT_TYPE = 'text/html; charset=utf-8'
  const LDP_RESOURCE = '<http://www.w3.org/ns/ldp#Resource>; rel="type"'

  if (!url) {
    return Promise.reject(new Error('Cannot PUT resource - missing url'))
  }

  options.method = 'PUT'
  options.body = data

  if (!options.noCredentials) {
    options.credentials = 'include'
  }

  options.headers = options.headers || {}

  options.headers['Content-Type'] = contentType || DEFAULT_CONTENT_TYPE

  links = links
    ? LDP_RESOURCE + ', ' + links
    : LDP_RESOURCE

  options.headers['Link'] = links

  return oidc.fetch(url, options)
    .then(response => {
      if (!response.ok) {  // not a 2xx level response
        let error = new Error('Error writing resource: ' +
          response.status + ' ' + response.statusText)
        error.status = response.status
        error.response = response

        throw error
      }

      return response
    })
}



function getWebIdProfile(url) 
{
  var PIM = $rdf.Namespace("http://www.w3.org/ns/pim/space#");
  var FOAF = $rdf.Namespace("http://xmlns.com/foaf/0.1/");
  var LDP = $rdf.Namespace("http://www.w3.org/ns/ldp#");
  var AS = $rdf.Namespace("http://www.w3.org/ns/activitystreams#");

  var promise = new Promise(function(resolve, reject) {
      // Load main profile
      getGraph(url).then(
          function(graph) {
              // set WebID
              var docURI = (url.indexOf('#') >= 0)?url.slice(0, url.indexOf('#')):url;
              var webid = graph.any($rdf.sym(docURI), FOAF('primaryTopic'));

              // find additional resources to load
              var inbox = graph.statementsMatching(webid, LDP('inbox'), undefined);
              var storage = graph.statementsMatching(webid, PIM('storage'), undefined);
              var outbox = graph.statementsMatching(webid, AS('outbox'), undefined);

              var profile = {webid};
              if (inbox && inbox.length > 0)
                profile.storage = inbox[0].object.value;
              else if (storage && storage.length > 0) 
                profile.storage = storage[0].object.value;
              else if (outbox && outbox.length > 0)
                profile.storage = outbox[0].object.value;

              return resolve(profile);
          }
      )
      .catch(
          function(err) {
              reject(err);
          }
      );
  });

  return promise;
}

function getGraph(url)
{
  const timeout = 5000;

  var promise = new Promise(function(resolve, reject) {
      var g = new $rdf.graph();
      var f = new $rdf.fetcher(g, timeout);

      var docURI = (url.indexOf('#') >= 0)?url.slice(0, url.indexOf('#')):url;
      f.nowOrWhenFetched(docURI,undefined,function(ok, body, xhr) {
          if (!ok) {
              reject({status: (xhr? xhr.status :0), xhr: xhr});
          } else {
              resolve(g);
          }
      });
  });

  return promise;
}




