const { app, protocol, BrowserWindow } = require('electron');
const path = require('path');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      bypassCSP: true,
      stream: true,
      secure: true,
      corsEnabled: true,
      supportFetchAPI: true
    }
  }
]);

app.whenReady().then(() => {
  protocol.handle('media', (request) => {
    console.log('Incoming:', request.url);
    app.quit();
    return new Response('OK');
  });

  const win = new BrowserWindow();
  const testUrl = 'media://' + encodeURIComponent('C:\\Test\\Path\\file.jpg');
  win.loadURL('data:text/html,<img src="' + testUrl + '">');
});
