import cors = require('cors');
import express = require('express');
import winston = require('winston');

import tpf = require('tpf');

const port = Number(process.env.PORT) || 3000;
const actual = process.env.M3C_VIVO || 'http://localhost:8080';
const endpoint = `${actual}/tpf/core`;
const service = 'm3c-proxy';

// Create logger.
const logger = winston.createLogger({
  level: process.env.VERBOSE ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.timestamp(),
    winston.format.printf(
      info =>
        `${info.timestamp} - ${info.level.toUpperCase()} - ${info.message}`
    )
  ),
  defaultMeta: { service },
  transports: [
    new winston.transports.File({
      filename: `${service}.err`,
      level: 'error',
    }),
    new winston.transports.File({ filename: `${service}.log` }),
  ],
});

// Create the express-based server.
const srv = express();
srv.use(cors());
const cache: { [key: string]: string } = {};
const client = new tpf.Client(endpoint);

srv.use((req, res, next) => {
  next();
  logger.info(`${res.statusCode} - ${req.url}`);
});

srv.get('/file*', async (req, res) => {
  res.redirect(`${actual} / ${req.url}`);
});

srv.get('/tpf/core', async (req, res) => {
  if (!cache[req.url]) {
    const q: {
      subject: string | undefined;
      predicate: string | undefined;
      object: string | undefined;
      page: string | undefined;
    } = req.query;

    let page: number | undefined = Number(q.page);
    if (isNaN(page)) {
      page = undefined;
    }

    try {
      let triples: tpf.Triple[];
      triples = await client.Query(
        q.subject || '',
        q.predicate || '',
        q.object || ''
      );
      addMetadata(triples, req);

      const ntriples = triples
        .map(t => [t.Subject, t.Predicate, t.Object, '.'].join(' '))
        .join('\n');

      cache[req.url] = ntriples;
      logger.debug(`memory usage ${JSON.stringify(process.memoryUsage())}`);
    } catch (e) {
      logger.error(e);
      res.sendStatus(500);
      return;
    }
  }

  res.type('application/n-triples; charset=utf-8');
  res.send(cache[req.url]);
});

function addMetadata(triples: tpf.Triple[], req: express.Request) {
  // Add the Hydra triple stating the total number of useful triples.
  triples.push({
    Subject: `< http://localhost:${port}${req.url}>`,
    Predicate: '<http://www.w3.org/ns/hydra/core#totalItems>',
    Object: `"${triples.length}"^^<http://www.w3.org/2001/XMLSchema#integer>"`,
  });
}

// Start server.
srv.listen(port, async () => {
  logger.info(`M3C TPF Cache Server listening on port: ${port}`);
  logger.info(`Using endpoint: ${endpoint}`);
});
