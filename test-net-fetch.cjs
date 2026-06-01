const { app, protocol, net } = require('electron');
const { pathToFileURL } = require('url');

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

app.whenReady().then(async () => {
  protocol.handle('media', (request) => {
    const rawUrl = request.url.slice('media://'.length);
    const decodedPath = decodeURIComponent(rawUrl);
    console.log('Fetching:', pathToFileURL(decodedPath).toString());
    return net.fetch(pathToFileURL(decodedPath).toString());
  });

  const res = await net.fetch('media://' + encodeURIComponent(__filename));
  const text = await res.text();
  console.log('Result length:', text.length);
  app.quit();
});
