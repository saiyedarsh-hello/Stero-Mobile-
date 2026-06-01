const { app, protocol, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

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
    fs.writeFileSync('C:\\Users\\saiye\\Desktop\\Player\\protocol_output.txt', request.url);
    app.quit();
    return new Response('OK');
  });

  const win = new BrowserWindow();
  const testUrl = 'media://' + encodeURIComponent('C:\\Test\\Path\\file.jpg');
  
  // Write a dummy HTML file to disk to load via file://
  const htmlPath = path.join(__dirname, 'test-file-context.html');
  fs.writeFileSync(htmlPath, `<img src="${testUrl}">`);
  
  win.loadFile(htmlPath);
});
