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
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

// Middleware to verify Firebase token
const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) return res.status(401).send({ message: "Unauthorized! Token missing." });

  const token = authorization.split(" ")[1];
  try {
    const decodedUser = await admin.auth().verifyIdToken(token);
    req.user = decodedUser;
    next();
  } catch (error) {
    res.status(401).send({ message: "Unauthorized access." });
  }
};

async function run() {
  try {
    const db = client.db("habit-tracker-db");
    const habitCollection = db.collection("habits");

    app.post("/habits", verifyToken, async (req, res) => {
      try {
        const data = req.body;
        data.created_at = new Date().toISOString();
        data.created_by = req.user.email;
        data.isPublic = data.isPublic ?? true; 
        data.completionHistory = data.completionHistory ?? [];
        const result = await habitCollection.insertOne(data);
        res.send({ success: true, result });
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

  
    app.get("/habits", async (req, res) => {
      try {
        const result = await habitCollection
          .find({ $or: [{ isPublic: true }, { isPublic: { $exists: false } }] })
          .toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    app.get("/latest-habits", async (req, res) => {
      try {
        const result = await habitCollection
          .find()
          .sort({ created_at: -1 })
          .limit(6)
          .toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    
    app.get("/habits/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id;
        const result = await habitCollection.findOne({ _id: objectId });
        if (!result) return res.status(404).send({ success: false, message: "Habit not found" });
        res.send({ success: true, result });
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    
    app.get("/my-habits", verifyToken, async (req, res) => {
      try {
        const email = req.user.email;
        const result = await habitCollection.find({ created_by: email }).toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    
    app.put("/habits/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const data = req.body;
      try {
        const objectId = new ObjectId(id);
        const filter = { _id: objectId, created_by: req.user.email };
        const update = { $set: data };
        const result = await habitCollection.updateOne(filter, update);
        res.send({ success: true, result });
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    
    app.delete("/habits/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      try {
        const objectId = new ObjectId(id);
        const result = await habitCollection.deleteOne({ _id: objectId, created_by: req.user.email });
        res.send({ success: true, result });
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    
    app.post("/habits/:id/complete", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        const { date } = req.body;
        const objectId = ObjectId.isValid(id) ? new ObjectId(id) : id;
        const habit = await habitCollection.findOne({ _id: objectId });
        if (!habit) return res.status(404).send({ success: false, message: "Habit not found" });

        const todayStr = date || new Date().toISOString().split("T")[0];
        if (habit.completionHistory?.includes(todayStr))
          return res.status(400).send({ success: false, message: "Already completed today" });

        const updatedHistory = [...(habit.completionHistory || []), todayStr];
        await habitCollection.updateOne({ _id: objectId }, { $set: { completionHistory: updatedHistory } });
        res.send({ success: true, result: { ...habit, completionHistory: updatedHistory } });
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    console.log("Connected to MongoDB habit-tracker-db successfully!");
  } finally {
    
  }
}

run().catch(console.dir);


app.get("/", (req, res) => {
  res.send("Habit Tracker Server is running fine!");
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
