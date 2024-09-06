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
      if (v.nodeName !== 'SCRIPT' 
          && v.nodeName !== 'STYLE' 
          && v.nodeName !== 'NOSCRIPT' 
          && v.nodeName !== 'IFRAME') 
        lst.push(v.innerText);
    }
    return lst.join('');
  }

  function frame_text()
  {
    var txt = document.body ? getContent() : null;

    if (txt === undefined || (txt!==null && txt.length==0))
      txt = frame_getSelectionString(document.body);

    return txt? txt : " ";
  }
  
  
frame_text();
