  function frame_getSelectionString(el, win) 
  {
    win = win || window;
    var doc = win.document, sel, range, prevRange, selString;

    if (win.getSelection && doc.createRange) {
        sel = win.getSelection();
        if (sel && sel.rangeCount) {
          prevRange = sel.getRangeAt(0);
        }
        range = doc.createRange();
        range.selectNodeContents(el);
        sel.removeAllRanges();
        sel.addRange(range);
        selString = sel.toString();
        sel.removeAllRanges();
        prevRange && sel.addRange(prevRange);
    } 
    else if (doc.body.createTextRange) {
        range = doc.body.createTextRange();
        range.moveToElementText(el);
        range.select();
    }
    return selString;
  }

  function getContent()
  {
    let lst = [];
    for(const v of document.body.childNodes) {
      if (v.nodeName !== 'SCRIPT' && v.nodeName !== 'STYLE')
        lst.push(v.innerText);
    }
    return lst.join('');
  }

  function scan_dom()
  {
    let page_content = getContent(); // document.body.innerText;

    if (!page_content|| (page_content && page_content.length == 0))
      page_content = frame_getSelectionString(document.body);

    page_content = cleanText(page_content);

    try {
      let ancs = {}
      for(const v of document.querySelectorAll('a')) 
        if (v.href)
          ancs[v.textContent] = v.href

      let links = [];
      for(const text of Object.keys(ancs))
      { 
        if (text) { 
            const name = this.cleanText(text);
            const text_href = ancs[text];

            if (name.length < 3 || text.length < 3) {
              links.push({name, href:text_href});
              continue;
            }

            if (page_content.indexOf(text)!==-1) {
              page_content = page_content.replaceAll(text, `[${name}](${text_href})`);
            }
            else if (name && page_content.indexOf(name)!==-1) {
              page_content = page_content.replaceAll(name, `[${name}](${text_href})`);
            }
            else if (name && text_href)
              links.push({name, href:text_href});
        }
      }

      let page_add = [];
      page_add.push('Links:');
      for(const v of links) {
        const name = cleanText(v.name);
        if (!v.href || !name)
          continue;
        page_add.push(` [${name}](${v.href})`);
      }

      let images = {};
      for(const v of document.querySelectorAll('img')) 
        if (!v.src.endsWith('.svg') && v.src.startsWith('https:'))
          images[v.src]=1;

      for(const v of document.querySelectorAll('video')) 
        if (v.src.startsWith('https:'))
          images[v.src]=2;

      for(const v of Object.keys(images)) 
      { 
        if (images[v] === 2)
          page_add.push(` ![Video](${v})`);
        else
          page_add.push(` ![Image](${v})`);
      }

      return page_content+'\n'+page_add.join('\n');
    } catch(e) {
      console.log(e);
      return page_content;
    }
  }


  function cleanText(text)
  {
    if (!text)
      return text;

    return text.trim()
      .replace(/(\n){4,}/g, "\n\n\n")
      // .replace(/\n\n/g, " ")
      .replace(/ {3,}/g, "  ")
      .replace(/\t/g, "")
      .replace(/\n+(\s*\n)*/g, "\n")
  }

scan_dom();
