const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
require("dotenv").config();
const serviceAccount = require("./serviceKey.json");

const app = express();
const port = 5001;

app.use(cors());
app.use(express.json());

admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
});

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.tyfwyby.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
      serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
      },
});

const verifyToken = async (req, res, next) => {
      const authorization = req.headers.authorization;
      if (!authorization) {
            return res.status(401).send({ message: "unauthorized access. Token not found!" });
      }
      const token = authorization.split(" ")[1];
      try {
            await admin.auth().verifyIdToken(token);
            next();
      } catch (error) {
            res.status(401).send({ message: "unauthorized access." });
      }
};

async function run() {
      try {
            const db = client.db("habit-tracker-db");
            const habitCollection = db.collection("habits");
