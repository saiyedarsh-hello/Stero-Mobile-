const { app, protocol } = require('electron');

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
    const rawUrl = request.url.slice('media://'.length);
    console.log('Sliced:', rawUrl);
    console.log('Decoded:', decodeURIComponent(rawUrl));
    app.quit();
    return new Response('OK');
  });

  fetch('media://' + encodeURIComponent('C:\\Test\\Path\\file.jpg')).catch(e => console.error(e));
});
