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
for I_DIR in background.html background.js content.css converters.js frame.js datablock.js; do
  cp -va $SRC_DIR/$I_DIR "$DST_DIR/"
done

for I_DIR in handlers.js html_gen.js OidcWebid.js oidc-webid-inject.js options.html options.js; do
  cp -va $SRC_DIR/$I_DIR "$DST_DIR/"
done

for I_DIR in page_panel.html page_panel.js panel.html panel.js dataview.css; do
  cp -va $SRC_DIR/$I_DIR "$DST_DIR/"
done

for I_DIR in settings.js sniffer.css sniffer.js ttl_gen.js utils.js webrequest.js; do
  cp -va $SRC_DIR/$I_DIR "$DST_DIR/"
done

for I_DIR in helpers.js helpers_ui.js; do
  cp -va $SRC_DIR/$I_DIR "$DST_DIR/"
done

#copy Firefox related files
cp -va $SRC_DIR/manifest.json.sf "$DST_DIR/manifest.json"
cp -va $SRC_DIR/browser_sf.js "$DST_DIR/browser.js"

for I_DIR in images lib; do
  mkdir -pv "$DST_DIR/$I_DIR"
  tar --exclude 'original' -cf - -C $SRC_DIR/$I_DIR .|tar -xf - -C "$DST_DIR/$I_DIR"
done

rm "$DST_DIR/lib/oidc-web.min.js.map"
rm "$DST_DIR/lib/rss-parser.js.map"
