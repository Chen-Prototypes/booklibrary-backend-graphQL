const server = require("./src/app");
const mongoose = require("mongoose");
const { startStandaloneServer } = require("@apollo/server/standalone");

require("dotenv").config();
const MONGODB_URI = process.env.MONGODB_URI;

console.log("connecting to", MONGODB_URI);
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("connected to MongoDB");
  })
  .catch((error) => {
    console.log("error connection to MongoDB:", error.message);
  });

startStandaloneServer(server, {
  listen: { port: 4000 },
}).then(({ url }) => {
  console.log(`Server ready at ${url}`);
});
