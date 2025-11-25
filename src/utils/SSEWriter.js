class SSEWriter {
  constructor(res) {
    this.res = res;
    this._setupHeaders();
  }

  _setupHeaders() {
    this.res.setHeader('Content-Type', 'text/event-stream');
    this.res.setHeader('Cache-Control', 'no-cache');
    this.res.setHeader('Connection', 'keep-alive');
    this.res.flushHeaders();
  }

  writeEvent(eventType, data) {
    this.res.write(`event: ${eventType}\n`);
    this.res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  end() {
    this.res.end();
  }
}

export { SSEWriter };
