const config = require('./config/env')
const app = require('./app')

const PORT = config.PORT

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
