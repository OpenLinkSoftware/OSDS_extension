#!/bin/bash
EXT_DIRNAME=./Safari/Shared\ \(Extension\)/Resources


export SRC_DIR=./
export DST_DIR="./Safari/Shared (Extension)/Resources"

#copy info files
for I_DIR in AUTHORS COPYING CREDITS; do
  cp -va $SRC_DIR/$I_DIR "$DST_DIR/"
done


SRC_DIR=./src


#copy common files                                       
for I_DIR in background.js background_web.js chat-inject.js chat-srv.js content.css converters.js datablock.js; do
  cp -va $SRC_DIR/$I_DIR "$DST_DIR/"
done

for I_DIR in dataview.css frame_scan.js frame_text.js handlers.js helpers.js helpers_ui.js html_gen.js ; do
  cp -va $SRC_DIR/$I_DIR "$DST_DIR/"
done

for I_DIR in oidc-webid-inject.js OidcWebid.js options.html options.js page_panel.html page_panel.js ; do
  cp -va $SRC_DIR/$I_DIR "$DST_DIR/"
done

for I_DIR in panel.html panel.js settings.js sniffer.js sniffer_nano.js social_sniffer.js super_links.js ; do
  cp -va $SRC_DIR/$I_DIR "$DST_DIR/"
done

for I_DIR in service_worker_sf.js tabs.css ttl_gen.js utils.js ; do
  cp -va $SRC_DIR/$I_DIR "$DST_DIR/"
done

#copy Safari related files
cp -va $SRC_DIR/manifest.json.sf "$DST_DIR/manifest.json"
cp -va $SRC_DIR/browser_sf.js "$DST_DIR/browser.js"

for I_DIR in images lib; do
  mkdir -pv "$DST_DIR/$I_DIR"
  tar --exclude 'original' -cf - -C $SRC_DIR/$I_DIR .|tar -xf - -C "$DST_DIR/$I_DIR"
done

rm "$DST_DIR/lib/solid-client-authn.bundle.js.map"

