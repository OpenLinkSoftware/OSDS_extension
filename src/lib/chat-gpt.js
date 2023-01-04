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

class ExpiryMap {
  constructor(maxAge) {
    this.maxAge = maxAge;
    this.data = new Map();
  }

  get(key) {
    const v = this.data.get(key);
    if (v && v.maxAge < Date.now())
      return v.data;
    return;
  }

  set(key, val) {
    this.data.set(key, {
      maxAge: Date.now() + this.maxAge,
      data: val});
    return this; 
  }

}


const cache = new ExpiryMap(10 * 1000);
const KEY_ACCESS_TOKEN = "accessToken";


class chat_gpt {
  constructor() {
    this.chat_uuid = null
    this.parentID = fetchSse.uuidv4()
  }

  async getAccessToken() {
    if (cache.get(KEY_ACCESS_TOKEN)) {
      return {accessToken:cache.get(KEY_ACCESS_TOKEN), ok:true};
    }
    try {
      const resp = await fetch("https://chat.openai.com/api/auth/session", {})
      if (!resp.ok)
        return {ok:resp.ok, message:resp.status};

      const data = await resp.json();
      if (!data.accessToken) {
        return {ok:false, message:"UNAUTHORIZED"};
      }

      cache.set(KEY_ACCESS_TOKEN, data.accessToken);
      return {accessToken: data.accessToken, ok: true};
    } catch(e) {
      return {ok:false, message:e.message};
    }
  }

  async send(content, callback) {
    const {accessToken, ok} = await this.getAccessToken();
    if (!ok || !accessToken)
      return;

    const payload = {
      action: "next",
      messages: [
        {
          id: fetchSse.uuidv4(),
          role: "user",
          content: {
            content_type: "text",
            parts: [content],
          },
        },
      ],
      model: "text-davinci-002-render",
      parent_message_id: this.parentID  
    };
    if (this.chat_uuid)
      payload.conversation_id = this.chat_uuid

    try {
      await fetchSse.fetchSSE("https://chat.openai.com/backend-api/conversation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
        onMessage: callback,
      });
    } catch (e) {
      callback("[ERROR]="+e.message);
    }
  }

  async sendMessage(content, callback) {
    const messages = [];
    return new Promise((resolve, reject) => {
        this.send(content, (message) => {
          if (message.startsWith("[ERROR]")) {
            reject(new Error(message.substring(8)));
          }
          else if (message === "[DONE]") {
            const lastMessage = messages.pop();
            const data = JSON.parse(lastMessage);
            if (data.error) {
              reject(new Error(data.error));
            } else {
              this.chat_uuid = data.conversation_id;
              this.parentID = data.message.id;
              // console.log(data);
              resolve(data.message);
            }
          } else {
            messages.push(message);
            if (callback) {
              try {
                const data = JSON.parse(message);
                callback(data);
              } catch(e) {}
            }
          }
        })
    });
  }

  async getAnswer(question, callback) {
    const response = await this.sendMessage(question, callback);
    return response.content.parts[0];
  }

}

