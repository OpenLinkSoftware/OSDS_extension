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

  
  function makeResizableTable(tableId, columns_css, containerId) {
     var table = DOM.qSel(tableId);
     var popup = DOM.qSel(containerId);
     var headerResized;
     const columns = [];

     table.style.gridTemplateColumns = columns_css.join(' ');

     function onMouseMove(e)
     {
       window.requestAnimationFrame(() => {
         // Calculate the desired width
         if (headerResized===null)
           return;

         var horizontalScrollOffset = document.documentElement.scrollLeft;
         const width = (horizontalScrollOffset + e.clientX) - popup.offsetLeft - headerResized.offsetLeft;
       
         // Update the column object with the new size value
         const column = columns.find(({ header }) => header === headerResized);
         column.size = Math.max(100, width) + 'px'; // Enforce our minimum
  
         // For the other headers which don't have a set width, fix it to their computed width
         columns.forEach((column) => {
           if(column.size.startsWith('minmax')){ // isn't fixed yet (it would be a pixel value otherwise)
             column.size = parseInt(column.header.clientWidth, 10) + 'px';
           }
         })

         // Update the column sizes
         // Reminder: grid-template-columns sets the width for all columns in one value
         table.style.gridTemplateColumns = columns
           .map(({ header, size }) => size)
           .join(' ');
       });
     }

     function onMouseUp(e)
     {
        if (headerResized)
           headerResized.classList.remove('super_links_table-header--being-resized');

        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        headerResized.classList.remove('super_links_table-header--being-resized');
        headerResized = null;
     }


     var lst = DOM.qSelAll(tableId+' th');
     var i = 0;

     for(const header of lst)
     {
       columns.push({ 
         header, 
         size: columns_css[i],
       });

       header.querySelector('.super_links_table-resize-handle').onmousedown = (e) => {
          headerResized = e.target.parentNode;
          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
          headerResized.classList.add('super_links_table-header--being-resized');
       } 
     }
  }


  function dragElement(el, elHeader) {
    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    var vpH = 0, vpW = 0;


    if (elHeader) {
      // if present, the header is where you move the DIV from:
      elHeader.onmousedown = onMouseDown;
    } else {
      // otherwise, move the DIV from anywhere inside the DIV:
      el.onmousedown = onMouseDown;
    }

    function onMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      // get the mouse cursor position at startup:
      pos3 = e.clientX;
      pos4 = e.clientY;

      vpWH = getViewPortWidthHeight();
      vpW = vpWH[0];
      vpH = vpWH[1];

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }

    function onMouseMove(e) {
      e = e || window.event;
      e.preventDefault();
      // calculate the new cursor position:
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      // set the element's new position:
      var top = (el.offsetTop - pos2);
      var left = (el.offsetLeft - pos1);

      top = top<0? 0: top;
      top = top>vpH-20? vpH-20: top;
      left = left<0? 0: left;
      left = left>vpW-30? vpW-30: left;

      el.style.top = top + "px";
      el.style.left = left + "px";
    }

    function onMouseUp() {
      // stop moving when mouse button is released:
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }
  }

  function makeResizable(el, elResizer) 
  {
    var orig_height = 0;
    var orig_width = 0;
    var orig_mouse_x = 0;
    var orig_mouse_y = 0;

    elResizer.onmousedown = (e) => {
        e.preventDefault();
        orig_width = parseFloat(getComputedStyle(el, null).getPropertyValue('width').replace('px', ''));
        orig_height = parseFloat(getComputedStyle(el, null).getPropertyValue('height').replace('px', ''));
        orig_mouse_x = e.pageX;
        orig_mouse_y = e.pageY;

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }
    
    function onMouseMove(e) {
      el.style.width = Math.max(orig_width + (e.pageX - orig_mouse_x), 600) + 'px';
      el.style.height = Math.max(orig_height + (e.pageY - orig_mouse_y), 150) + 'px';
    }
    
    function onMouseUp() {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }
  }

  function positionPopupOnPage(popupId, evt )
  {
      var vpWH = [];
      var vpW, vpH;
      var intCoordX = evt.clientX;
      var intCoordY = evt.clientY;
      var intXOffset = intCoordX;
      var intYOffset = intCoordY;

      vpWH = getViewPortWidthHeight();
      vpW = vpWH[0];
      vpH = vpWH[1];

      var popup = $(popupId);
      popup.css("position","fixed");
      // if not display: block, .offsetWidth & .offsetHeight === 0
      popup.css("display","block");
      popup.css("zIndex","2147483647");

      if ( intCoordX > vpW/2 )
        intXOffset -= popup.width();

      if ( intCoordY > vpH/2 )
        intYOffset -= popup.height();

      if ( vpW <= 500 )
        intXOffset = ( vpW - popup.width() ) / 2;

      if ( vpH <= 500 )
        intYOffset = (vpH - popup.height() ) / 2;

      var rpos = intXOffset + popup.outerWidth() + 5;
      if (rpos > vpW)
        intXOffset -= rpos - vpW;

      if (intXOffset < 0 )
        intXOffset = 2;

      if (intYOffset < 0 )
        intYOffset = 2;

      popup.css("top", intYOffset + 'px');
      popup.css("left", intXOffset + 'px');
      popup.css("visibility", 'visible');
  }


  function getViewPortWidthHeight()
  {
      var viewPortWidth;
      var viewPortHeight;

 	// the more standards compliant browsers (mozilla/netscape/opera/IE7)
 	// use window.innerWidth and window.innerHeight
      if (typeof window.innerWidth != 'undefined')
      {
        viewPortWidth = window.innerWidth;
        viewPortHeight = window.innerHeight;
      }
      
      return [viewPortWidth, viewPortHeight];
  }

