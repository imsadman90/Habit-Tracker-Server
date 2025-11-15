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
            app.get("/habits", async (req, res) => {
                  const result = await habitCollection.find().toArray();
                  res.send(result);
            });

            app.get("/habits/:id", async (req, res) => {
                  const { id } = req.params;
                  let result = null;

                  try {
                        if (ObjectId.isValid(id)) result = await habitCollection.findOne({ _id: new ObjectId(id) });
                        if (!result) result = await habitCollection.findOne({ _id: id });
                        if (!result) return res.status(404).send({ success: false, message: "Habit not found" });

                        res.send({ success: true, result });
                  } catch (err) {
                        console.error(err);
                        res.status(500).send({ success: false, message: "Server error" });
                  }
            });

            app.post("/habits", async (req, res) => {
                  const data = req.body;
                  const result = await habitCollection.insertOne(data);
                  res.send({ success: true, result });
            });

            app.put("/habits/:id", async (req, res) => {
                  const { id } = req.params;
                  const data = req.body;
                  const objectId = new ObjectId(id);
                  const filter = { _id: objectId };
                  const update = { $set: data };
                  const result = await habitCollection.updateOne(filter, update);
                  res.send({ success: true, result });
            });
            app.delete("/habits/:id", async (req, res) => {
                  const { id } = req.params;
                  const result = await habitCollection.deleteOne({ _id: new ObjectId(id) });
                  res.send({ success: true, result });
            });

            app.get("/latest-habits", async (req, res) => {
                  const result = await habitCollection
                        .find()
                        .sort({ created_at: -1 })
                        .limit(6)
                        .toArray();
                  res.send(result);
            });

            app.get("/my-habits", async (req, res) => {
                  const email = req.query.email;
                  const result = await habitCollection.find({ created_by: email }).toArray();
                  res.send(result);
            });

            app.get("/search", async (req, res) => {
                  const search_text = req.query.search;
                  const result = await habitCollection
                        .find({ name: { $regex: search_text, $options: "i" } })
                        .toArray();
                  res.send(result);
            });
