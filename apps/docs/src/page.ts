const scalarVersion = "1.73.1";

export function page(title: string): string {
  const config = {
    url: "/openapi.json",
    proxyUrl: "/proxy",
    defaultHttpClient: { targetKey: "shell", clientKey: "curl" },
    documentDownloadType: "json",
    hideModels: true,
    metaData: { title },
  };
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="icon" href="https://cdn.atlair.cloud/assets/logo/atlair-puff-logo.png" />
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@${scalarVersion}"></script>
    <script>Scalar.createApiReference("#app", ${JSON.stringify(config)});</script>
  </body>
</html>
`;
}
