import { Factory, Exporter, Logger } from 'reggol';
import { URL } from 'node:url';
import {
  BroadcastMessage, GETData,
  GETSchema,
  POSTData, POSTResponse,
  POSTResponseSchema,
} from './api.js';
import {
  CommonWsListener,
  DefaultEvent,
  emit,
  EventSchema,
  WsEventMap,
} from './iws.js';
import { WebSocket } from 'ws';

export interface BotConfig {
  id: string;
  name: string;
  messageCacheLimit: number;
  baseUrl: string;
}

export default class Bot {
  messages: BroadcastMessage[] = [];
  config: BotConfig;
  baseUrl: URL;
  socket: WebSocket | null = null;
  eventListeners: CommonWsListener;
  #heartbeatTimer: number | null = null;
  #wsWaitTimes = 0;
  #wsEcho = true;
  #loggerFactory = new Factory();
  #logger: Logger;

  constructor(config: BotConfig) {
    this.#loggerFactory.addExporter(new Exporter.Console());
    this.#logger = this.#loggerFactory.createLogger('bot');
    WebSocket.prototype.myEmit = emit;
    this.eventListeners = new CommonWsListener();
    this.eventListeners.register('heartbeat', async (e) => {
      if (e.data.heartbeat == 'pong') {
        this.#wsEcho = true;
      }
    });
    this.config = config;
    this.baseUrl = new URL(this.config.baseUrl);
    if (config.name.trim().length < 3) {
      this.#logger.error('名称至少3个字符');
      throw new Error('Bot name too short');
    }
  }

  async #submitName() {
    const body: POSTData = {
      username: this.config.name,
    };
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        cookie: `chat-token=${ this.config.id }`
      }
    });
    const data = await res.json();
    if (data) {
      const user: POSTResponse = POSTResponseSchema.parse(data);
      this.config.name = user.username;
    }
  }

  #initSocket() {
    this.socket?.close();
    const wsUrl = isHttps(this.baseUrl) ? `wss://${ this.baseUrl.host }` : `ws://${ this.baseUrl.host }`;
    this.socket = new WebSocket(wsUrl,{
      headers: {
        cookie: `chat-token=${ this.config.id }`
      }
    });
    this.socket.addEventListener('message', async (e) => {
      const data = EventSchema.safeParse(JSON.parse(e.data as string));
      if (data.success) {
        await this.eventListeners.resolve(data.data as DefaultEvent);
      }
    });
    this.#initHeartbeat();
    this.#logger.info('WebSocket 连接成功');
  }

  #initHeartbeat() {
    if (this.#heartbeatTimer) clearInterval(this.#heartbeatTimer);
    this.#heartbeatTimer =
      setInterval(async () => {
        try {
          if (this.#wsEcho) {
            this.#wsWaitTimes = 0;
            this.socket?.myEmit('heartbeat', { heartbeat: 'ping' });
            this.#wsEcho = false;
          } else {
            this.#wsWaitTimes++;
          }
        } catch (e) {
          this.#logger.warn('链接已断开，尝试重连');
          this.#clearSocket();
          await this.init();
        }
        if (this.#wsWaitTimes > 3) {
          this.#logger.warn('链接超时，尝试重连');
          this.#clearSocket();
          await this.init();
        }
      }, 20000) as unknown as number;
  }

  #clearSocket() {
    if (this.#heartbeatTimer) clearInterval(this.#heartbeatTimer);
    this.socket?.close();
    this.socket = null;
  }

  async init() {
    const res = await fetch(this.baseUrl, {
      method: 'GET',
      headers: {
        cookie: `chat-token=${ this.config.id }`
      }
    });
    const data = await res.json();
    if (data) {
      const get: GETData = GETSchema.parse(data);
      this.messages = get.messages;
      if (!get.exists) {
        await this.#submitName();
      }
    }
    this.#logger.info(`Bot ${ this.config.name } 登录成功`);
    this.#initSocket();
  }

  send(message: string) {
    if (this.socket) {
      this.socket.myEmit('send-message', message);
    }
  }

  on<T extends keyof WsEventMap>(event: T, callback: (event: WsEventMap[T]['data']) => Promise<void>) {
    this.eventListeners.register(event, async (event: WsEventMap[T]) => {
      await callback(event.data);
    });
  }

  getLogger(name: string) {
    return this.#loggerFactory.createLogger(name);
  }
}

function isHttps(url: URL) {
  return url.href.startsWith('https://');
}

