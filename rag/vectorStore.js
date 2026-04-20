function createVectorStore() {
  const records = [];

  return {
    upsert(items) {
      records.push(...items);
      return records.length;
    },
    search() {
      return [];
    },
  };
}

module.exports = { createVectorStore };
