try {

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


