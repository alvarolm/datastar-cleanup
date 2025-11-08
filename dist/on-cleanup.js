// on-cleanup.ts
function install(engine) {
  const { attribute, beginBatch, endBatch } = engine;
  attribute({
    name: "on-cleanup",
    requirement: {
      key: "denied",
      // No key allowed (e.g., data-on-cleanup:click is invalid)
      value: "must"
      // Value is required (the expression to execute)
    },
    apply({ rx }) {
      const callback = () => {
        beginBatch();
        rx();
        endBatch();
      };
      return callback;
    }
  });
  console.log("[datastar-on-cleanup] Plugin registered");
}
export {
  install
};
