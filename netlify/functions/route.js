const axios = require("axios");

exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  const { start, end, profile } = JSON.parse(event.body);
  if (!start || !end) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing start or end" }) };
  }

  const vehicle = profile || "car";
  const url = "https://graphhopper.com/api/1/route";
  const GRAPHHOPPER_API_KEY = process.env.GRAPHHOPPER_API_KEY; // Set in Netlify dashboard

  try {
    const ghResp = await axios.get(url, {
      params: {
        point: [`${start.lat},${start.lng}`, `${end.lat},${end.lng}`],
        vehicle: vehicle,
        locale: "en",
        points_encoded: false,
        key: GRAPHHOPPER_API_KEY,
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
      return { statusCode: 404, body: JSON.stringify({ error: "No route found" }) };
    }

    const path = ghResp.data.paths[0];
    const route = path.points.coordinates.map(([lng, lat]) => ({ lat, lng }));
    const distance = path.distance / 1000;
    const duration = path.time / 60000;

    return {
      statusCode: 200,
      body: JSON.stringify({
        route,
        info: {
          distance: distance.toFixed(2),
          time: duration.toFixed(2),
        }
      })
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to fetch route",
        details: e.response?.data || e.message
      })
    };
  }
};