const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Use a variable for the API key so it can be updated at runtime
let graphhopperApiKey = "5c4d6228-0f78-46be-a6ac-178d1d85fb3d"; // Replace with your key

app.post("/api/route", async (req, res) => {
  const { start, end, profile } = req.body;
  if (!start || !end) return res.status(400).json({ error: "Missing start or end" });

  const vehicle = profile || "car";
  const url = "https://graphhopper.com/api/1/route";
  try {
    const ghResp = await axios.get(url, {
      params: {
        point: [`${start.lat},${start.lng}`, `${end.lat},${end.lng}`],
        vehicle: vehicle,
        locale: "en",
        points_encoded: false,
        key: graphhopperApiKey,
      },
      paramsSerializer: params => {
        const qs = [];
        for (const key in params) {
          if (Array.isArray(params[key])) {
            params[key].forEach(val => qs.push(`${key}=${encodeURIComponent(val)}`));
          } else {
            qs.push(`${key}=${encodeURIComponent(params[key])}`);
          }
        }
        return qs.join('&');
      }
    });

    if (!ghResp.data.paths || ghResp.data.paths.length === 0) {
      return res.status(404).json({ error: "No route found" });
    }

    const path = ghResp.data.paths[0];
    const route = path.points.coordinates.map(([lng, lat]) => ({ lat, lng }));
    const distance = path.distance / 1000;
    const duration = path.time / 60000;

    res.json({
      route,
      info: {
        distance: distance.toFixed(2),
        time: duration.toFixed(2),
      }
    });
  } catch (e) {
    console.error("GraphHopper API error:", e.response?.data || e.message);
    res.status(500).json({
      error: "Failed to fetch route",
      details: e.response?.data || e.message,
    });
  }
});

// Route to update the API key at runtime (for development/testing)
app.post("/api/update-key", (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ error: "Missing apiKey" });
  graphhopperApiKey = apiKey;
  res.json({ success: true, message: "API key updated for this server session." });
});

app.listen(5000, () => {
  console.log("Backend listening on port 5000");
});