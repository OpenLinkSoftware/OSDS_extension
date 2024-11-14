class wStore {
  constructor()
  {
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



var window = {};
var localStorage = new wStore();
var gpt3encoder;

  window.localStorage = localStorage;


try {

  importScripts(
                "./lib/gpt3-encoder.js",
                "./browser.js",
                "./settings.js",
                "./utils.js",
                "./helpers.js",
                "./lib/solid-client-authn.bundle.js",
                "./OidcWebid.js",
                "./chat-srv.js",
                "./background_web.js",
                "./background.js"
  );

  gpt3encoder = window.gpt3encoder;

  //=====================================

  async function setUID() 
  {
    const settings = new Settings();
    const chk = await settings.getValue('ext.osds.pref.user.chk');
    const pref_user = await settings.getValue('ext.osds.pref.user');
    await setRule_OnBehalfOf(chk, pref_user);
  }
      
  Browser.api.runtime.onInstalled.addListener(async (details) => {
    if(details.reason !== "install" && details.reason !== "update") return;
    try {
      await setUID();
      await Actions.clear();
      await GVars.clear();
    } catch(ex) {
      console.log(ex);
    }
  });

} catch(ex) {
  console.log(ex);
}

