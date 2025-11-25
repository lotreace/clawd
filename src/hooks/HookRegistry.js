class HookRegistry {
  constructor() {
    this.preRequestHooks = [];
  }

  registerPreRequest(hook) {
    this.preRequestHooks.push(hook);
  }

  executePreRequest(request, headers) {
    let result = request;
    for (const hook of this.preRequestHooks) {
      result = hook.execute(result, headers);
    }
    return result;
  }
}

export { HookRegistry };
