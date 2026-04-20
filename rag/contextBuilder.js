function buildContext({ chunks = [], web = [] }) {
  return [...chunks, ...web].join("\n");
}

module.exports = { buildContext };
