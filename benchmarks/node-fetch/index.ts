import { createServer } from 'http';
import { isScenario, scenarios } from './scenarios';

const host = process.env.HOST || 'localhost';
const port = 50001;
const httpbinUrl = `http://${host}:50000/anything`;

const server = createServer(async (req, res) => {
  try {
    if (req.url?.endsWith('activeHandles')) {
      return res.writeHead(200, { 'content-type': 'text/plain' }).end(
        String(
          process
            // @ts-expect-error _getActiveHandles does exist
            ._getActiveHandles().length,
        ),
      );
    }

    if (req.url?.includes('/scenarios/')) {
      const scenario = req.url.split('/').pop();
      if (isScenario(scenario)) {
        await scenarios[scenario](httpbinUrl);
        return res.writeHead(200).end();
      }
    }

    return res.writeHead(404).end();
  } catch (err) {
    console.error(err);
    return res.writeHead(500).end();
  }
});

server.listen(port);

console.log(`Server listening at http://${host}:${port}`);
console.debug(`Available scenarios: ${Object.keys(scenarios).join(', ')}`);
