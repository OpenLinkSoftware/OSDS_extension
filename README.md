# OpenLink Structured Data Sniffer

## Intro
The OpenLink Structured Data Sniffer (OSDS) is an extension for
[Google Chrome](http://www.google.com/chrome/browser/),
[Mozilla Firefox](http://www.mozilla.org/firefox/),
[Apple Safari](http://www.apple.com/safari/),
[Microsoft Edge](https://www.microsoft.com/microsoft-edge),
[Opera](http://www.opera.com/)
and other Chromium-based browsers,
that detects, presents, and offers interaction interfaces for
structured data (such as Knowledge Graphs) embedded in
web pages using any of the following formats:

- **CSV**
- **JSON**
- **JSON-LD**
- **Microdata**
- **Plain Old Semantic HTML (POSH)**
- **RDFa**
- **RDF-Turtle**
- **RDF-XML**
- **JSON**
- **CSV**
- **RSS**
- **Atom**
- **Markdown Tables**

## License
Copyright 2015-2022 [OpenLink Software](mailto:opensource@openlinksw.com)

This software is licensed under the GNU General Public License (see
[COPYING](https://github.com/OpenLinkSoftware/OSDS_extension/blob/develop/COPYING)).

**Note**: that the only valid version of the GPL license as far as this project is concerned is the
original GNU General Public License Version 2, dated June 1991.

## Deployment
To deploy this extension on your local machine you can either *clone the git source tree* or
*download a source archive* and then *install the extension* into your Chrome or Opera browser on
the same system.

### Clone the git source tree
Clone the sources from github using the following commands, which will automatically download the latest develop branch:
```shell
$ cd src
$ git clone https://github.com/OpenLinkSoftware/OSDS_extension
```

### Download a source archive
Download and extract a `.tar.gz` or `.zip`, either from one of the
[stable releases](https://github.com/OpenLinkSoftware/OSDS_extension/tags),
or directly from one of the following links:

- [latest stable `.tar.gz`](https://github.com/OpenLinkSoftware/OSDS_extension/archive/master.tar.gz)
- [latest stable `.zip`](https://github.com/OpenLinkSoftware/OSDS_extension/archive/master.zip)
- [latest development `.tar.gz`](https://github.com/OpenLinkSoftware/OSDS_extension/archive/develop.tar.gz)
- [latest development `.zip`](https://github.com/OpenLinkSoftware/OSDS_extension/archive/develop.zip)


### Install the extension in Chrome
To install this extension manually, take the following steps:

1. Open the Chrome browser
1. Select from menu: **Chrome** -> **Preferences** -> **Extensions**
1. Check the [X] **Developer mode** box
1. Choose the option **Load unpacked extension...**
1. Navigate to the folder containing the extracted source code
1. Press the **Select** button

### Install the extension in Microsoft Edge
To install this extension manually, take the following steps:

1. Open the Edge browser
1. Select from menu: **Edge** -> **Preferences** -> **Extensions**
1. Check the [X] **Developer mode** box
1. Choose the option **Load unpacked extension...**
1. Navigate to the folder containing the extracted source code
1. Press the **Select** button

### Install the extension in Opera
To install this extension manually use the following steps:

1. Open the Opera browser
1. In address bar type in **opera:extensions**
1. Press the **Developer Mode** button
1. Choose the option **Load unpacked extension...**
1. Navigate to the folder containing the extracted source
1. Press the **Select** button

### Install the extension in Firefox
Download the [Firefox OSDS .zip](https://github.com/OpenLinkSoftware/OSDS_extension/releases/download/v2.16.1/OSDS_FF.zip)
file and extract the .xpi file.

NOTE: Only temporary install is possible for unsigned .xpi file in last versions of Firefox.

To install this extension manually in Firefox, use the following steps:

1. Open the **Firefox** browser
1. In address bar type: **about:addons** or choose menu ** Add-ons**
1. Click on Gear icon and choose **Debug Add-ons**
1. Click on **Load Temporary Add-on**
1. Navigate to the directory where you extracted the OSDS_FF.xpi file, select this file and press the **Open** button


### Examples
Navigate to a page containing structured data such as any of those below, and click on the sniffer icon that appears in the address bar:

  - [OpenLink Software Homepage](http://www.openlinksw.com/)
  - [BBC News Homepage](http://www.bbc.com/news)
  - [Ted.com talk by Susan Etlinger](https://www.ted.com/talks/susan_etlinger_what_do_we_do_with_all_this_big_data)
  - [DBpedia article on Semantic Web](http://dbpedia.org/page/Semantic_Web)

