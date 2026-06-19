import { MongoClient, ServerApiVersion } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined");
    }

    await client.connect();
    await client.db("admin").command({ ping: 1 });

    console.log("\u2705 MongoDB Connected Successfully");
  } catch (error) {
    console.error("\u274C MongoDB Connection Failed");
    console.error(error.message);
    process.exit(1);
  }
};

export { connectDB, client };
