import mongoose from "mongoose";
import { MongoClient, type MongoClientOptions } from "mongodb";

declare global {
  var mongooseCache:
    | {
        conn: typeof mongoose | null;
        promise: Promise<typeof mongoose> | null;
      }
    | undefined;
  var mongoClientCache:
    | {
        client: MongoClient | null;
        promise: Promise<MongoClient> | null;
      }
    | undefined;
}

const MONGODB_URI = process.env.MONGODB_URI;

function getMongoUri(): string {
  if (!MONGODB_URI) {
    throw new Error("Missing MONGODB_URI environment variable.");
  }
  return MONGODB_URI;
}

const mongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
};

global.mongooseCache = mongooseCache;

const mongoClientOptions: MongoClientOptions = {};

const mongoClientCache = global.mongoClientCache ?? {
  client: null,
  promise: null,
};

global.mongoClientCache = mongoClientCache;

/**
 * Cached Mongoose connection for Next.js hot reload.
 */
export async function connectMongoDB(): Promise<typeof mongoose> {
  if (mongooseCache.conn) {
    return mongooseCache.conn;
  }

  if (!mongooseCache.promise) {
    mongooseCache.promise = mongoose.connect(getMongoUri(), {
      bufferCommands: false,
    });
  }

  mongooseCache.conn = await mongooseCache.promise;
  return mongooseCache.conn;
}

/**
 * Cached MongoClient promise for the NextAuth MongoDB adapter.
 */
export async function getMongoClient(): Promise<MongoClient> {
  if (mongoClientCache.client) {
    return mongoClientCache.client;
  }

  if (!mongoClientCache.promise) {
    mongoClientCache.promise = MongoClient.connect(
      getMongoUri(),
      mongoClientOptions,
    ).then((client) => {
      mongoClientCache.client = client;
      return client;
    });
  }

  return mongoClientCache.promise;
}

export default getMongoClient;
