const uws = require('uWebSockets.js');

module.exports = {
  createUWS() {
    let handler;
    let uwsApp = uws.App().any('/*', (...args) => {
      const res = handler(...args);
      handler = undefined;
      return res;
    });
    let listenSocket;
    return {
      getApp() {
        return uwsApp;
      },
      start() {
        return new Promise(function (resolve, reject) {
          uwsApp.listen(0, function (newListenSocket) {
            if (newListenSocket) {
              listenSocket = newListenSocket;
              resolve(uws.us_socket_local_port(listenSocket));
            } else {
              reject(new Error('uWS App cannot start'));
            }
          });
        });
      },
      stop() {
        if (listenSocket) {
          uws.us_listen_socket_close(listenSocket);
          uwsApp.close();
        }
      },
      get port() {
        if (listenSocket) {
          return uws.us_socket_local_port(listenSocket);
        }
      },
      addOnceHandler(newHandler) {
        handler = newHandler;
      },
    };
  },
};
