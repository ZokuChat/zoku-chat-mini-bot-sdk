import Bot from './index.js';

const name = '俗手的机器人';

const bot = new Bot({
  id: '自己随机个UUID写这',
  name,
  messageCacheLimit: 10,
  baseUrl: 'http://47.96.107.255:11451/',
});

(async () => {
  await bot.init();
  const logger = bot.getLogger(name);
  bot.on('receive-message', async (event) => {
    if (!event.self) {
      const { content: message } = event;
      if (message.startsWith('echo')) {
        logger.info(`echo: ${ message }`);
        bot.send(message.slice(5));
      }
    }
  });
})();