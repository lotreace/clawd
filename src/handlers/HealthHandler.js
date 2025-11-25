class HealthHandler {
  handle(req, res) {
    res.json({
      status: 'ok',
      service: 'clawd',
      timestamp: new Date().toISOString()
    });
  }
}

export { HealthHandler };
