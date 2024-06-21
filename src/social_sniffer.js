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
      let i_content = el.querySelector('div[data-testid="tweetText"]')?.innerText
      let i_id = el.querySelector('a:has(time)')
      let i_id_href = (i_id? i_id.href : '');
      const lst = el.querySelectorAll('a[role="link"] div[dir="ltr"]')
      const i_author = lst.length > 0 ? lst[0].textContent : '';
      const i_timestamp = i_id?.querySelector('time')?.getAttribute('datetime')

      if (i_content) {
        const lst_a = el.querySelectorAll('a');
        for (var anc of lst_a) {
          if (anc.innerText.startsWith('https://') || anc.innerText.startsWith('http://'))
            i_content = i_content.replaceAll(anc.innerText,`[${anc.innerText}](${anc.href} "Link")`)
        }
      }
      if (i_id_href)
        page_content.push(`### ${i_id_href}`);
      if (i_author)
        page_content.push(`### ${i_author}`);
      if (i_timestamp)
        page_content.push(`### Timestamp - ${i_timestamp}`)
      if (i_content)
        page_content.push(`\n${i_content}`);

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
          
        if (i_v_href && i_v_href.startsWith('blob:http'))
          i_v_href = i_id_href //use tweet ref

        if (i_poster)
          page_content.push(`![Image](${i_poster})`)
        if (i_v_href )
          page_content.push(`![Video](${i_v_href})`)
      }

      // add image links
      lst_v = el.querySelectorAll('div[data-testid="tweetPhoto"] img');
      for (var v of lst_v) {
        if (v.src)
          page_content.push(`![Image](${v.src})`)
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

    // Scaffold
    const sf = DOM.qSel('main div[data-scaffold-immersive-reader] article');
    if (sf) {
       const thdr = sf.querySelector('section.series-reader-header')
       if (thdr) {
         const thdr_img_href = thdr.querySelector('img')?.src
         const thdr_href = thdr.querySelector('a')?.href
         const thdr_text = thdr.innerText

         if (thdr_href)
           page_content.push(`### ${thdr_href}`)
       
         page_content.push(`### Team: ${thdr_text}`)

         if (thdr_img_href)
           page_content.push(`![Image](${thdr_img_href})`)

         page_content.push('')
       }
         
       const hdr = sf.querySelector('header')
       if (hdr) {
         const hdr_text = hdr.innerText
         const hdr_img_href = hdr.querySelector('img')?.src

         page_content.push(`### ${hdr_text}`)

         if (hdr_img_href)
           page_content.push(`![Image](${hdr_img_href})`)

         page_content.push('')
       }

       const auth = sf.querySelector('div.reader-author-info__container > div > div > div')
       if (auth) {
         const auth_img_href = auth.querySelector('a > img')?.src
         const auth_name = auth.querySelector('a > h2')
         const auth_href = auth_name?.parentNode?.href
         const auth_title = auth_name?.parentNode?.parentNode?.children[1]

         if (auth_name)
           page_content.push(`### Author - ${auth_name.innerText}  ${auth_href?auth_href:''}`);
         if (auth_title)
           page_content.push(`### ${auth_title}`);
         if (auth_img_href)
           page_content.push(`![Image](${auth_img_href})`)

         page_content.push('')
       }

       const post = sf.querySelector('div[data-scaffold-immersive-reader-content]')
       const post_content = post?.innerText
       if (post_content)
          page_content.push(post_content)

       const img_lst = post?.querySelectorAll('img')
       for(const v of img_lst) {
          page_content.push(`![Image](${v.src})`)
       }
       
       page_content.push('\n\n')
    }

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

      const i_author = i_auth_link.innerText;

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
          page_content.push(`![Video](${i_v_href})`)
      }

      const i_lst_ve = el.querySelectorAll('iframe.w-main-feed-card-media');
      for(var it of i_lst_ve) {
        const i_v_href = it.src ? it.src : it.getAttribute("data-delayed-url");
        //if (i_v_href)
        page_content.push(`![Video](${i_v_href})`)
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

        if (i_poster_url)
          page_content.push(`![Image](${i_poster_url})`)
        if (i_v_href)
          page_content.push(`![Video](${i_v_href})`)
      }

      i_v = el.querySelector('div.update-components-linkedin-video')
      if (i_v) {
        const i_video = i_v.querySelector('video');
        if (i_video) {
          let i_poster_url = i_video.poster;
          let i_v_href = i_video.src;

          if (i_v_href && i_v_href.startsWith('blob:'))
            i_v_href = i_v_href.substring(5);

          if (i_poster_url)
            page_content.push(`![Image](${i_poster_url})`)
          if (i_v_href)
            page_content.push(`![Video](${i_v_href})`)
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

    // == Comments
    const comments = DOM.qSelAll('article.comments-comment-item')
    for (var el of comments) {
      let i_cont_1 = el.querySelector('div.comments-comment-item-content-body')
      let i_cont_2 = el.querySelector('div.comments-reply-item-content-body')
      let i_content = '';

      if (i_cont_1)
        i_content = i_cont_1.innerText
      else if (i_cont_2)
        i_content = i_cont_2.innerText

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


  scan_github(loc)
  {
    let page_content = []; 
    const base = loc.href
    const title = document.querySelector('div#show_issue h1')?.innerText;
    const auth_ref = document.querySelector('div#show_issue a.author')
    const auth = auth_ref?.parentNode.innerText;
    const auth_href = auth_ref.href;

    if (title)
      page_content.push(`### Issue ${title}`);
    if (auth && auth_href)
        page_content.push(`### ${auth}  ${auth_href}\n`);

    const items = document.querySelectorAll('div.TimelineItem');
    for(var el of items) {
      const i_ref = el.querySelector('h3 > div > a[href]');
      const i_title = el.querySelector('h3 strong a[href]');
      const i_author = i_title?.innerText;
      const i_author_href = i_title?.href;
      const i_href = i_ref?.href;
      const i_date = i_ref?.querySelector('relative-time')?.attributes['datetime']?.value;

      if (i_href)
        page_content.push(`### ${i_href}`);
      if (i_author && i_author_href)
        page_content.push(`### Author - ${i_author}  ${i_author_href}`);
      if (i_date)
        page_content.push(`### Timestamp - ${i_date}`)

      const list = el.querySelector('task-lists td')?.childNodes;
      if (list)
        for(var c of list) {
          if (c) {
            switch(c.nodeName) 
            {
            case 'A':
              const i_img = c.querySelector('img')
              if (i_img)
                page_content.push(`![Image](${i_img.src})`);
              else if (c.innerText)
                page_content.push(c.innerText);
              break;
            case 'DIV':
              if (c.innerText)
                page_content.push(c.innerText);
              break;
            case 'DETAILS':
              // video ignore, vider URL could not be reused
              break;
            default:
              if (c.innerText)
                page_content.push(c.innerText);
            }
          }
        }
      
      page_content.push('\n');
    }

    if (page_content.length> 0)
      return page_content.join('\n');
    else
      return null;
  }


  scan_reddit_1(loc) 
  {
    let page_content = []; 
    const base = loc.href

    // === for  /comments/  =====
    const post = document.querySelector('div[data-testid="post-container"]')
    const auth_el = post?.querySelector('a[data-testid="post_author_link"]')
    const auth = auth_el?.innerText
    const auth_href = auth_el?.href;
    const title = post.querySelector('div[data-adclicklocation="title"] h1')?.innerText

    const post_ts = post?.querySelector('span[data-textid="post_timestamp"]')
    const post_vote = post?.querySelector('[id^=vote-arrows]').innerText
    const post_video = post?.querySelectorAll('shreddit-player')  // .src
    const post_imgs = post?.querySelectorAll('img[role="presentation"]')  // .style.height!=='1px'
    const post_text = post?.querySelectorAll('div > p') // .innerText 

    if (title)
      page_content.push(`### ${title}`);
    if (post_ts)
      page_content.push(`### Datetime: ${post_ts}`);
    if (post_vote)
      page_content.push(`### Votes: ${post_vote}`);
    if (auth && auth_href)
      page_content.push(`### Author ${auth}  ${auth_href}\n`);
    
    if (post_text)
      for(const v of post_text)
        page_content.push(v.innerText)
    if (post_imgs)
      for(const v of post_imgs) {
        if (v.style.height!=='1px')
          page_content.push(`![Image](${v.src})`);  
      }
    if (post_video)
      for(const v of post_video)
        page_content.push(`![Video](${v.src})`);  

    const parent = post?.parentNode
    if (parent) {
      const comm_el = parent.children[parent.children.length-1];
      const comm_list = comm_el.querySelectorAll('div.Comment')
      
      page_content.push('\n');

      if (comm_list)
        for(const c of comm_list) 
        {
          const hdr = c.querySelector('div[data-testid="post-comment-header"]')
          const auth =  hdr?.querySelector('a[data-testid="comment_author_link"]')  //  .href  .innerText
          const ts = hdr?.querySelector('a[data-testid="comment_timestamp"]')?.innerText
          const txt = c.querySelector('div[data-testid="comment"]')?.innerText
          const vote = c.querySelector('[id^=vote-arrows]')?.innerText

          if (auth)
            page_content.push(`##### ${auth.innerText}  ${auth.href}`);
          if (ts)
            page_content.push(`##### Datetime: ${ts} `);
          if (vote)
            page_content.push(`##### Votes: ${vote} `);
          if (txt)
            page_content.push(txt);

          page_content.push('\n');
        }
    }

    if (page_content.length> 0)
      return page_content.join('\n');
    else
      return null;
  }



  scan_reddit_2(loc) 
  {
    let page_content = []; 
    const base = loc.href

    const feed = document.querySelectorAll('div[data-testid="post-container"]')
    if (feed)
      for(const post of feed)
      {
        const title = post.querySelector('div[data-adclicklocation="title"] h3')?.innerText
        const auth_el = post.querySelector('a[data-testid="post_author_link"]')
        const auth = auth_el?.innerText
        const auth_href = auth_el?.href;
        const post_ts = post.querySelector('span[data-testid="post_timestamp"]')
        const post_vote = post.querySelector('[id^=vote-arrows]').innerText
        const post_text = post.querySelectorAll('div > p') // .innerText 

        const post_video = post.querySelectorAll('shreddit-player')  // .src
        const post_imgs = post.querySelectorAll('img[role="presentation"]')  // .style.height!=='1px'

        const comments = post.querySelector('a[data-test-id="comments-page-link-num-comments"]')

        if (title)
          page_content.push(`### ${title}`);
        if (post_ts)
          page_content.push(`### Datetime: ${post_ts}`);
        if (post_vote)
          page_content.push(`### Votes: ${post_vote}`);
        if (auth && auth_href)
          page_content.push(`### Author ${auth}  ${auth_href}\n`);
        if (comments)
          page_content.push(`### ${comments.href}  ${comments.innerText}\n`);
    
        if (post_text)
          for(const v of post_text)
            page_content.push(v.innerText)
        if (post_imgs)
          for(const v of post_imgs) {
            if (v.style.height!=='1px')
              page_content.push(`![Image](${v.src})`);  
          }
        if (post_video)
          for(const v of post_video)
            page_content.push(`![Video](${v.src})`);  

        page_content.push('\n\n');
      }

    if (page_content.length> 0)
      return page_content.join('\n');
    else
      return null;
  }



  scan_threads(loc) 
  {
    let page_content = []; 
    const base = loc.href

    // === for  /post/  =====
    const items = document.querySelectorAll('time');
    for(const p of items)
    {
      const ts = p.getAttribute('datetime');
      const root = p.parentNode.parentNode.parentNode.parentNode.parentNode.parentNode;
      const txt = root.querySelectorAll('div > div > div > span')[2]?.innerText
      const imgs = root.querySelectorAll('picture img') // .src
      const vids = root.querySelectorAll('video') // .src

      const links = root.querySelectorAll('a[href^="/@"]')
      let auth = null;
      let auth_href = null;
      let post_href = null
      for(const l of links) {
        const uri = new URL(l.href);
        if (uri.pathname.startsWith('/@')) {
          if (uri.pathname.indexOf('/post')===-1) {
            auth_href = l.href
            auth = l.innerText
          }
          else
            post_href = l.href
        }
      }

      if (auth && auth_href)
        page_content.push(`### Author ${auth}  ${auth_href}`);
      if (ts)
        page_content.push(`### Datetime: ${ts}`);
    
      if (txt)
        page_content.push(txt)
      if (imgs)
        for(const v of imgs) {
          page_content.push(`![Image](${v.src})`);  
        }
      if (vids)
        for(const v of vids) {
          page_content.push(`![Video](${v.src})`);  
          page_content.push(`![Image](${v.getAttribute('poster')})`);  
        }

      page_content.push('\n\n')
    }

    if (page_content.length> 0)
      return page_content.join('\n');
    else
      return null;
  }



  scan(loc)
  {
    let rc = null;
    try {
      if (loc.origin === 'https://twitter.com' || loc.origin === 'https://x.com') 
        rc = this.scan_twitter(loc);
      else if (loc.origin === 'https://www.linkedin.com')
        rc = this.scan_linkedin(loc);
      else if (loc.origin === 'https://mastodon.social')
        rc = this.scan_mastodon(loc);
      else if (loc.origin === 'https://github.com' && loc.pathname.indexOf('/issues/')!=-1)
        rc = this.scan_github(loc);
      else if (loc.origin === 'https://www.reddit.com') {
        if (loc.pathname.indexOf('/comments/')!=-1)
          rc = this.scan_reddit_1(loc);
        else
          rc = this.scan_reddit_2(loc);
      }
      else if (loc.origin === 'https://www.threads.net')
        rc = this.scan_threads(loc);
    } catch(e) {
      console.log(e);
    }
    if (rc)
      return {text:rc, dom:0};

    let page_content = this.getContent(); //document.body.innerText;

    if (!page_content|| (page_content && page_content.length == 0))
      page_content = this.getSelectionString(document.body, window);

    page_content = this.cleanText(page_content);

    try {
      let ancs = {}
      for(const v of document.querySelectorAll('a')) 
        if (v.href)
          ancs[v.innerText] = v.href

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


  fix_innerText(n)
  {
    if (n)
      return this.fix_label(n.innerText);
    else
      return '';
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

  
  getContent()
  {
    let lst = [];
    for(const v of document.body.childNodes) {
      if (v.nodeName !== 'SCRIPT' && v.nodeName !== 'NOSCRIPT' && v.nodeName !== 'STYLE')
        lst.push(v.innerText);
    }
    return lst.join('');
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
