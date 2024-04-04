/*
 *  This file is part of the OpenLink YouID
 *
 *  Copyright (C) 2015-2020 OpenLink Software
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
class Social {
  constructor() {
  }

  scan_twitter(loc)
  {
    let page_content = []; 
    const base = loc.href
    const items = DOM.qSelAll('article[data-testid="tweet"]');
    for (var el of items) {
      let i_content = el.querySelector('div[data-testid="tweetText"]')?.textContent
      let i_id = el.querySelector('a:has(time)')
      let i_id_href = (i_id? i_id.href : '');
      const lst = el.querySelectorAll('a[role="link"] div[dir="ltr"]')
      let i_author = lst.length > 0 ? lst[0].textContent : '';
      if (i_content) {
        const lst_a = el.querySelectorAll('a');
        for (var anc of lst_a) {
          if (anc.textContent.startsWith('https://') || anc.textContent.startsWith('http://'))
            i_content = i_content.replaceAll(anc.textContent,`[${anc.textContent}](${anc.href} "Link")`)
        }
      }
      page_content.push(`### ${i_id_href}\n### ${i_author}\n\n${i_content}`);
      // add video links
      let lst_v = el.querySelectorAll('video');
      for (var v of lst_v) {
        const i_poster = v.poster;
        const i_source = v.querySelector('source');
        let i_v_href = null;

        if (v.src && v.children.length==0)
          i_v_href = v.src
        else if (i_source)
          i_v_href = i_source.src;
          
        //const i_v_type = i_source ? i_source.type : null;
        if (i_v_href && i_v_href.startsWith('blob:http'))
          i_v_href = i_id_href
          //i_v_href = i_v_href.substring(5)

        if (i_poster && i_v_href )
          page_content.push(`[![Video](${i_poster})](${i_v_href} "Video")`)

      }
      // add image links
      lst_v = el.querySelectorAll('div[data-testid="tweetPhoto"] img');
      for (var v of lst_v) {
        let i_v_href = v.src ? v.src : null;

        if (i_v_href )
          page_content.push(`![Image](${i_v_href})`)
      }

      page_content.push('\n');
    }

    if (page_content.length> 0)
      return page_content.join('\n');
    else
      return null;
  }


  scan_linkedin(loc)
  {
    let page_content = []; 
    const base = loc.href

    // Logout state
    let items = DOM.qSelAll('article:is(.main-feed-activity-card, .feed-reshare-content)');
    for (var el of items) 
    {
      let i_content = el.querySelector('div.attributed-text-segment-list__container').textContent;

      const i_id = el.getAttribute('data-activity-urn');
      const i_id_href = (i_id ? `https://linkedin.com/feed/update/${i_id}` : '');

      const i_auth_link = el.querySelector('a:is([data-tracking-control-name="public_post_feed-actor-name"],'
                          +' [data-tracking-control-name="public_post_main-feed-card_feed-actor-name"],'
                          +' [data-tracking-control-name="public_post_reshare_feed-actor-name"],'
                          +' [data-tracking-control-name="public_post_main-feed-card_reshare_feed-actor-name"])')
      const i_auth_href = i_auth_link ? i_auth_link.href : ''

      const i_author = i_auth_link.textContent;

      page_content.push(`### ${i_id_href}\n### Author - ${i_author}  ${i_auth_href} \n\n${i_content}`);

      // images
      let i_lst = el.querySelectorAll('li[data-test-id="feed-images-content__list-item"]');
      for(var it of i_lst) {
        const i_img = it.querySelector('img');
        if (i_img) {
          let i_img_href = i_img.src.replaceAll('&amp;','&');
          page_content.push(`![Image](${i_img_href})`)
        }
      }
      i_lst = el.querySelectorAll('a:is([data-tracking-control-name="public_post_reshare_feed-article-content"],[data-tracking-control-name="public_post_main-feed-card_reshare_feed-article-content"])');
      for(var it of i_lst) {
        const i_img = it.querySelector('img');
        if (i_img) {
          let i_img_href = i_img.src.replaceAll('&amp;','&');
          page_content.push(`![Image](${i_img_href})`)
        }
      }
      // video
      const i_lst_v = el.querySelectorAll('div.w-main-feed-card-media');
      for(var it of i_lst_v) {
        const i_v = it.querySelector('video');
        let i_v_href = i_v ? i_v.src.replaceAll('&amp;','&') : '';
        if (i_v)
          page_content.push(`[![Video]](${i_v_href} "Video")`)
      }

      const i_lst_ve = el.querySelectorAll('iframe.w-main-feed-card-media');
      for(var it of i_lst_ve) {
        const i_v_href = it.src ? it.src : it.getAttribute("data-delayed-url");
        //if (i_v_href)
        page_content.push(`[![Video]](${i_v_href} "Video")`)
      }

      // comments
      const i_comments = el.querySelectorAll('section.comment');
      for(var i_comm of i_comments) {
         const i_auth_link = i_comm.querySelector('a.comment__author');
         const i_auth_href = i_auth_link ? i_auth_link.href : '';
         const i_author = i_auth_link ? i_auth_link.textContent : '';
         const i_text_lst = i_comm.querySelectorAll('p.comment__text');
         if (i_auth_href && i_author) {
           page_content.push(`#### Comment ${i_author}  ${i_auth_href}`);
           for(var i of i_text_lst) {
             page_content.push(i.textContent);
           }
         }
      }

      page_content.push('\n');
    }


    // Login state
    items = DOM.qSelAll('div.feed-shared-update-v2');
    for (var el of items) 
    {
      let i_content_el = el.querySelector('div.feed-shared-update-v2__description-wrapper,'
                                      +'div.feed-shared-update-v2__content,'
                                      +'div.comments-post-meta,'
                                      +'div.feed-shared-update-v2__update-content-wrapper');
      if (!i_content_el)
        continue;
        
      let i_content = i_content_el ? i_content_el.textContent : '';
      const i_id = el.getAttribute('data-urn');
      const i_id_href = (i_id ? `https://linkedin.com/feed/update/${i_id}` : '');
      const i_auth_link = el.querySelector('a.update-components-actor__meta-link')
      const i_auth_href = i_auth_link ? i_auth_link.href : ''
      const i_author = this.fix_textContent(el.querySelector('span.update-components-actor__name'));

      page_content.push(`### ${i_id_href}\n### Author - ${i_author}  ${i_auth_href} \n\n${i_content}`);

      // add video links
      let i_v = el.querySelector('a.external-video-viewer__play-link')
      if (i_v) {
        const i_v_href = i_v ? i_v.href : ''
        const i_poster = i_v.querySelector('div.video-s-loader__thumbnail');
        let i_poster_url = i_poster ? i_poster.style['backgroundImage'] : '';
        if (i_poster_url && i_poster_url.startsWith('url('))
          i_poster_url = i_poster_url.substring(5, i_poster_url.length-2);

        if (i_poster_url && i_v_href)
          page_content.push(`[![Video](${i_poster_url})](${i_v_href} "Video")`)
      }

      i_v = el.querySelector('div.update-components-linkedin-video')
      if (i_v) {
        const i_video = i_v.querySelector('video');
        if (i_video) {
          let i_poster_url = i_video.poster;
          let i_v_href = i_video.src;

          if (i_v_href && i_v_href.startsWith('blob:'))
            i_v_href = i_v_href.substring(5);

          if (i_poster_url && i_v_href)
            page_content.push(`[![Video](${i_poster_url})](${i_v_href} "Video")`)
        }
      }

      // add images links
      const i_img_container = el.querySelector('div.update-components-image__container')
      if (i_img_container) {
        const i_img = i_img_container.querySelector('img')
        const i_img_href = i_img ? i_img.src : ''

        if (i_img_href)
          page_content.push(`![Image](${i_img_href})`)
      }

      const i_anc = el.querySelector('a.update-components-article__image-link')
      if (i_anc) {
        const i_label = i_anc.getAttribute("aria-label")
        const i_img = i_anc.querySelector('img')
        const i_href = i_img ? i_img.src : ''

        if (i_href && i_label)
          page_content.push(`![${i_label}](${i_href})`)
      }

      const i_doc = el.querySelector('div.update-components-document__container iframe')
      if (i_doc) {
        const i_href = i_doc.src;
        const i_label = i_doc.title;

        if (i_href && i_label)
          page_content.push(`[${i_label}](${i_href})`)
      }

      page_content.push('\n');
    }


    const comments = DOM.qSelAll('article.comments-comment-item')
    for (var el of comments) {
      let i_cont_1 = el.querySelector('div.comments-comment-item-content-body')
      let i_cont_2 = el.querySelector('div.comments-reply-item-content-body')
      let i_content = '';

      if (i_cont_1)
        i_content = i_cont_1.textContent
      else if (i_cont_2)
        i_content = i_cont_2.textContent

      const i_auth_link = el.querySelector('a.comments-post-meta__actor-link')
      const i_auth_href = i_auth_link ? i_auth_link.href : ''
      const i_auth = el.querySelector('div.comments-post-meta__profile-info-wrapper span.comments-post-meta__name-text')
      const i_author = this.fix_textContent(i_auth);

      page_content.push(`### ${i_auth_href}\n### Author - ${i_author}  ${i_auth_href}\n\n${i_content}\n`);

      let img_lst = el.querySelectorAll('div.comments-hero-entity__image-container img')
      for(var i of img_lst)
        page_content.push(`![Image](${i.src})`)
    }


    // performing posts
    items = DOM.qSelAll('li.member-analytics-addon-entity-list__item');
    for(var el of items) {
       const i_link = el.querySelector('a');
       let i_link_label = '';
       let i_content = '';
       let i_img_href;
       let i_link_href;
       let i_author='';
       let i_stat_label='';
       let i_stat_count='';
       let i_sc_comm_count = '';
       let i_sc_react_count = ''

       if (i_link) 
       {
         i_link_href = i_link.href;
         const i_auth_link = i_link.querySelector('div > :is(span, a)[data-test-app-aware-link]:first-child');
         if (i_auth_link)
           i_author = i_auth_link.getAttribute('aria-label');

         const lst = i_link.querySelectorAll('div > div > :is(a, span)')
         for(var i of lst) {
           const lbl = i.getAttribute('aria-label')
           if (lbl.toLowerCase()!=='image') {
             i_content = lbl;
             break;
           }
         }

         const i_lst = i_link.querySelectorAll('div.feed-mini-update-content__card-wrapper :is(span,a)[data-test-app-aware-link]');
         for(var i_span of i_lst) {
           const node = i_span.querySelector('img');
           if (node)
             i_img_href = node.src;
           else
             i_link_label = i_span.getAttribute('aria-label');
         }

         const i_stat = i_link.querySelector('div.member-analytics-addon__mini-update-item--cta-item');
         if (i_stat) {
           try {
             i_stat_count = i_stat.querySelector('span.member-analytics-addon__cta-list-item-title')
             i_stat_label = i_stat.querySelector('span.member-analytics-addon__cta-list-item-text')
             i_stat_count = this.fix_textContent(i_stat_count);
             i_stat_label = this.fix_textContent(i_stat_label);
           } catch(e) {}
         }

         const i_sc_comm = i_link.querySelector('li.social-details-social-counts__comments');
         if (i_sc_comm) {
           i_sc_comm_count = i_sc_comm.querySelector('button.social-details-social-counts__count-value').getAttribute('aria-label');
         }
         const i_sc_react = i_link.querySelector('li.social-details-social-counts__reactions')
         if (i_sc_react) {
           i_sc_react_count = i_sc_react.querySelector('button.social-details-social-counts__count-value').getAttribute('aria-label');
         }

       }
       if (i_link_href) { 
         page_content.push(`### ${i_link_href}\n### Author - ${i_author}`);
         if (i_link_label)
           page_content.push(`#### ${i_link_label}`)
         if (i_content)
           page_content.push(i_content);
         if (i_img_href)
           page_content.push(`![Image](${i_img_href})`);
         if (i_stat_count && i_stat_label)
           page_content.push(`#### ${i_stat_label} ${i_stat_count}`);
         if (i_sc_comm_count)
           page_content.push(`#### Comments ${i_sc_comm_count}`);
         if (i_sc_react_count)
           page_content.push(`#### Social ${i_sc_react_count}`);
         page_content.push('\n');
       }
    }
        
    if (page_content.length> 0) {
//          blob = new Blob([page_content.join('\n')], {type: "text/plain;charset=utf-8"});
//          saveAs(blob, 'linkedin_eng.txt');
      return page_content.join('\n');
    }
    else
      return null;
  }


  scan_mastodon(loc)
  {
    let page_content = []; 
    const base = loc.href
    const items = DOM.qSelAll('div[role="feed"] article');
    for (var el of items) {
      let i_author = this.fix_textContent(el.querySelector('span.display-name bdi'));
      let i_account = this.fix_textContent(el.querySelector('span.display-name span.display-name__account'));
      let i_id = el.querySelector('a.status__relative-time');

      if (!i_id)
        continue;

      let i_id_href = i_id ? i_id.href : '';
      let i_timestamp = '';

      if (i_id) 
        i_timestamp = i_id.querySelector('time').title;

      let i_cont = el.querySelector('div.status__wrapper')
      let i_content = ''

      if (i_cont)
        i_content = i_cont.getAttribute('aria-label');

      let i_img = el.querySelector('img');

      page_content.push(`### ${i_id_href}\n### Author - ${i_author}  ${i_account}`);

      if (i_timestamp)
        page_content.push(`### Timestamp - ${i_timestamp}`)

      page_content.push(`${i_content}`);

      if (i_img)
        page_content.push(`![Image](${i_img.src})`);

      page_content.push('\n');
    }

    if (page_content.length> 0)
      return page_content.join('\n');
    else
      return null;
  }

  msave(s, id)
  {
    let blob = new Blob([s], {type: "text/plain;charset=utf-8"});
    saveAs(blob, 'my_log.txt'+id);
  }


  scan(loc)
  {
    let rc = null;
    try {
      if (loc.origin === 'https://twitter.com') 
        rc = this.scan_twitter(loc);
      else if (loc.origin === 'https://www.linkedin.com')
        rc = this.scan_linkedin(loc);
      else if (loc.origin === 'https://mastodon.social')
        rc = this.scan_mastodon(loc);
    } catch(e) {
      console.log(e);
    }
    if (rc)
      return {text:rc, dom:0};

    let page_content = document.body.innerText;

    if (!page_content|| (page_content && page_content.length == 0))
      page_content = this.getSelectionString(document.body, window);

    page_content = this.cleanText(page_content);

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
        const name = this.cleanText(v.name);
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

      return {text:page_content+'\n'+page_add.join('\n'), dom:1};
    } catch(e) {
      console.log(e);
      return {text:page_content, dom:1};
    }
  }


  fix_textContent(n)
  {
    if (n)
      return this.fix_label(n.textContent);
    else
      return '';
  }

  fix_label(s)
  {
    if (s)
      return s.replaceAll('\n','').trim();
    else
      return '';
  }

  cleanText(text)
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

  
  getSelectionString(el, win) 
  {
        win = win || window;
        var doc = win.document, sel, range, prevRange, selString;

        if (win.getSelection && doc.createRange) {
            sel = win.getSelection();
            if (sel.rangeCount) {
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


}
