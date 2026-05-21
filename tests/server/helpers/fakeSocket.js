const sinon = require("sinon");

// Simple fake socket.io instance for testing
const createFakeIo = () => {
    const emit = sinon.spy();
    const to = sinon.stub().returns({ emit });
    return { to, emit };
};

module.exports = { createFakeIo };
