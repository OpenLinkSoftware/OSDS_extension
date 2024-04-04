#!/bin/bash
EXT_DIRNAME=./OSDS_Chrome
EXT_SRC=./src

rm -rf $EXT_DIRNAME

mkdir -pv $EXT_DIRNAME


SRC_DIR=./
DST_DIR=$EXT_DIRNAME

#copy info files
for I_DIR in AUTHORS COPYING CREDITS; do
  cp -va $SRC_DIR/$I_DIR $DST_DIR/
done


SRC_DIR=$EXT_SRC
DST_DIR=$EXT_DIRNAME

#copy common files
for I_DIR in background.html background.js chat-inject.js chat-srv.js content.css converters.js datablock.js; do
  cp -va $SRC_DIR/$I_DIR $DST_DIR/
done

for I_DIR in dataview.css frame_scan.js frame_text.js handlers.js helpers.js helpers_ui.js html_gen.js ; do
  cp -va $SRC_DIR/$I_DIR $DST_DIR/
done

for I_DIR in oidc-webid-inject.js OidcWebid.js options.html options.js page_panel.html page_panel.js ; do
  cp -va $SRC_DIR/$I_DIR $DST_DIR/
done

for I_DIR in panel.html panel.js settings.js sniffer.js sniffer_nano.js social_sniffer.js super_links.js ; do
  cp -va $SRC_DIR/$I_DIR $DST_DIR/
done

for I_DIR in tabs.css ttl_gen.js utils.js ; do
  cp -va $SRC_DIR/$I_DIR $DST_DIR/
done


#copy Chrome related files
cp -va $SRC_DIR/manifest.json $DST_DIR/
cp -va $SRC_DIR/browser.js $DST_DIR/browser.js

for I_DIR in images lib; do
  mkdir -pv $DST_DIR/$I_DIR
  tar --exclude 'original' -cf - -C $SRC_DIR/$I_DIR .|tar -xf - -C $DST_DIR/$I_DIR
done
