// lib/db.js
// Shared SQL Server connection pool — import in any pages/api/ route that
// needs the database. Reuses one pool across requests instead of opening a
// new connection every time.

import sql from 'mssql';

const config = {
  server: process.env.SQLSERVER_HOST,
  port: parseInt(process.env.SQLSERVER_PORT || '1433', 10),
  database: process.env.SQLSERVER_DATABASE,
  user: process.env.SQLSERVER_USER,
  password: process.env.SQLSERVER_PASSWORD,
  options: {
    encrypt: false, // local network — set true if the server requires TLS
    trustServerCertificate: true, // matches "Trust Server Certificate" in SSMS
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let poolPromise;

export function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .then((pool) => {
        console.log('SQL Server pool connected');
        return pool;
      })
      .catch((err) => {
        poolPromise = null; // allow retry on next call instead of caching a failure
        throw err;
      });
  }
  return poolPromise;
}

export { sql };
