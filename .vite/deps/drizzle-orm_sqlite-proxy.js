import {
  BaseSQLiteDatabase,
  SQLiteAsyncDialect,
  SQLitePreparedQuery,
  SQLiteSession,
  SQLiteTransaction,
  createTableRelationsHelpers,
  entityKind,
  extractTablesRelationalConfig,
  fillPlaceholders,
  mapResultRow,
  sql
} from "./chunk-5EAMHAHP.js";
import {
  __publicField
} from "./chunk-DC5AMYBS.js";

// node_modules/.pnpm/drizzle-orm@0.36.4_@types+react@18.3.31_react@18.3.1/node_modules/drizzle-orm/logger.js
var _a;
_a = entityKind;
var ConsoleLogWriter = class {
  write(message) {
    console.log(message);
  }
};
__publicField(ConsoleLogWriter, _a, "ConsoleLogWriter");
var _a2;
_a2 = entityKind;
var DefaultLogger = class {
  constructor(config) {
    __publicField(this, "writer");
    this.writer = (config == null ? void 0 : config.writer) ?? new ConsoleLogWriter();
  }
  logQuery(query, params) {
    const stringifiedParams = params.map((p) => {
      try {
        return JSON.stringify(p);
      } catch {
        return String(p);
      }
    });
    const paramsStr = stringifiedParams.length ? ` -- params: [${stringifiedParams.join(", ")}]` : "";
    this.writer.write(`Query: ${query}${paramsStr}`);
  }
};
__publicField(DefaultLogger, _a2, "DefaultLogger");
var _a3;
_a3 = entityKind;
var NoopLogger = class {
  logQuery() {
  }
};
__publicField(NoopLogger, _a3, "NoopLogger");

// node_modules/.pnpm/drizzle-orm@0.36.4_@types+react@18.3.31_react@18.3.1/node_modules/drizzle-orm/sqlite-proxy/session.js
var _a4, _b;
var SQLiteRemoteSession = class extends (_b = SQLiteSession, _a4 = entityKind, _b) {
  constructor(client, dialect, schema, batchCLient, options = {}) {
    super(dialect);
    __publicField(this, "logger");
    this.client = client;
    this.schema = schema;
    this.batchCLient = batchCLient;
    this.logger = options.logger ?? new NoopLogger();
  }
  prepareQuery(query, fields, executeMethod, isResponseInArrayMode, customResultMapper) {
    return new RemotePreparedQuery(
      this.client,
      query,
      this.logger,
      fields,
      executeMethod,
      isResponseInArrayMode,
      customResultMapper
    );
  }
  async batch(queries) {
    const preparedQueries = [];
    const builtQueries = [];
    for (const query of queries) {
      const preparedQuery = query._prepare();
      const builtQuery = preparedQuery.getQuery();
      preparedQueries.push(preparedQuery);
      builtQueries.push({ sql: builtQuery.sql, params: builtQuery.params, method: builtQuery.method });
    }
    const batchResults = await this.batchCLient(builtQueries);
    return batchResults.map((result, i) => preparedQueries[i].mapResult(result, true));
  }
  async transaction(transaction, config) {
    const tx = new SQLiteProxyTransaction("async", this.dialect, this, this.schema);
    await this.run(sql.raw(`begin${(config == null ? void 0 : config.behavior) ? " " + config.behavior : ""}`));
    try {
      const result = await transaction(tx);
      await this.run(sql`commit`);
      return result;
    } catch (err) {
      await this.run(sql`rollback`);
      throw err;
    }
  }
  extractRawAllValueFromBatchResult(result) {
    return result.rows;
  }
  extractRawGetValueFromBatchResult(result) {
    return result.rows[0];
  }
  extractRawValuesValueFromBatchResult(result) {
    return result.rows;
  }
};
__publicField(SQLiteRemoteSession, _a4, "SQLiteRemoteSession");
var _a5, _b2;
var _SQLiteProxyTransaction = class _SQLiteProxyTransaction extends (_b2 = SQLiteTransaction, _a5 = entityKind, _b2) {
  async transaction(transaction) {
    const savepointName = `sp${this.nestedIndex}`;
    const tx = new _SQLiteProxyTransaction("async", this.dialect, this.session, this.schema, this.nestedIndex + 1);
    await this.session.run(sql.raw(`savepoint ${savepointName}`));
    try {
      const result = await transaction(tx);
      await this.session.run(sql.raw(`release savepoint ${savepointName}`));
      return result;
    } catch (err) {
      await this.session.run(sql.raw(`rollback to savepoint ${savepointName}`));
      throw err;
    }
  }
};
__publicField(_SQLiteProxyTransaction, _a5, "SQLiteProxyTransaction");
var SQLiteProxyTransaction = _SQLiteProxyTransaction;
var _a6, _b3;
var RemotePreparedQuery = class extends (_b3 = SQLitePreparedQuery, _a6 = entityKind, _b3) {
  constructor(client, query, logger, fields, executeMethod, _isResponseInArrayMode, customResultMapper) {
    super("async", executeMethod, query);
    __publicField(this, "method");
    this.client = client;
    this.logger = logger;
    this.fields = fields;
    this._isResponseInArrayMode = _isResponseInArrayMode;
    this.customResultMapper = customResultMapper;
    this.customResultMapper = customResultMapper;
    this.method = executeMethod;
  }
  getQuery() {
    return { ...this.query, method: this.method };
  }
  run(placeholderValues) {
    const params = fillPlaceholders(this.query.params, placeholderValues ?? {});
    this.logger.logQuery(this.query.sql, params);
    return this.client(this.query.sql, params, "run");
  }
  mapAllResult(rows, isFromBatch) {
    if (isFromBatch) {
      rows = rows.rows;
    }
    if (!this.fields && !this.customResultMapper) {
      return rows;
    }
    if (this.customResultMapper) {
      return this.customResultMapper(rows);
    }
    return rows.map((row) => {
      return mapResultRow(
        this.fields,
        row,
        this.joinsNotNullableMap
      );
    });
  }
  async all(placeholderValues) {
    const { query, logger, client } = this;
    const params = fillPlaceholders(query.params, placeholderValues ?? {});
    logger.logQuery(query.sql, params);
    const { rows } = await client(query.sql, params, "all");
    return this.mapAllResult(rows);
  }
  async get(placeholderValues) {
    const { query, logger, client } = this;
    const params = fillPlaceholders(query.params, placeholderValues ?? {});
    logger.logQuery(query.sql, params);
    const clientResult = await client(query.sql, params, "get");
    return this.mapGetResult(clientResult.rows);
  }
  mapGetResult(rows, isFromBatch) {
    if (isFromBatch) {
      rows = rows.rows;
    }
    const row = rows;
    if (!this.fields && !this.customResultMapper) {
      return row;
    }
    if (!row) {
      return void 0;
    }
    if (this.customResultMapper) {
      return this.customResultMapper([rows]);
    }
    return mapResultRow(
      this.fields,
      row,
      this.joinsNotNullableMap
    );
  }
  async values(placeholderValues) {
    const params = fillPlaceholders(this.query.params, placeholderValues ?? {});
    this.logger.logQuery(this.query.sql, params);
    const clientResult = await this.client(this.query.sql, params, "values");
    return clientResult.rows;
  }
  /** @internal */
  isResponseInArrayMode() {
    return this._isResponseInArrayMode;
  }
};
__publicField(RemotePreparedQuery, _a6, "SQLiteProxyPreparedQuery");

// node_modules/.pnpm/drizzle-orm@0.36.4_@types+react@18.3.31_react@18.3.1/node_modules/drizzle-orm/sqlite-proxy/driver.js
var _a7, _b4;
var SqliteRemoteDatabase = class extends (_b4 = BaseSQLiteDatabase, _a7 = entityKind, _b4) {
  async batch(batch) {
    return this.session.batch(batch);
  }
};
__publicField(SqliteRemoteDatabase, _a7, "SqliteRemoteDatabase");
function drizzle(callback, batchCallback, config) {
  const dialect = new SQLiteAsyncDialect({ casing: config == null ? void 0 : config.casing });
  let logger;
  let _batchCallback;
  let _config = {};
  if (batchCallback) {
    if (typeof batchCallback === "function") {
      _batchCallback = batchCallback;
      _config = config ?? {};
    } else {
      _batchCallback = void 0;
      _config = batchCallback;
    }
    if (_config.logger === true) {
      logger = new DefaultLogger();
    } else if (_config.logger !== false) {
      logger = _config.logger;
    }
  }
  let schema;
  if (_config.schema) {
    const tablesConfig = extractTablesRelationalConfig(
      _config.schema,
      createTableRelationsHelpers
    );
    schema = {
      fullSchema: _config.schema,
      schema: tablesConfig.tables,
      tableNamesMap: tablesConfig.tableNamesMap
    };
  }
  const session = new SQLiteRemoteSession(callback, dialect, schema, _batchCallback, { logger });
  return new SqliteRemoteDatabase("async", dialect, session, schema);
}
export {
  RemotePreparedQuery,
  SQLiteProxyTransaction,
  SQLiteRemoteSession,
  SqliteRemoteDatabase,
  drizzle
};
//# sourceMappingURL=drizzle-orm_sqlite-proxy.js.map
