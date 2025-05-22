import React, { useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";
import L from "leaflet";
import "./App.css";

// Fix Leaflet marker icon issue for React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function LocationSelector({ onSelect, disabled }) {
  useMapEvents({
    click(e) {
      if (!disabled) onSelect(e.latlng);
    }
  });
  return null;
}

// Nominatim OpenStreetMap Search API for address autocomplete
const nominatimSearch = async (query) => {
  if (!query) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`;
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.map(place => ({
    display_name: place.display_name,
    lat: parseFloat(place.lat),
    lon: parseFloat(place.lon)
  }));
};

function AddressInput({ label, value, setValue, setLatLng, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [input, setInput] = useState(value ? value.display_name : "");

  // Handle change in input
  const handleChange = async (e) => {
    const newValue = e.target.value;
    setInput(newValue);
    if (newValue.length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    const results = await nominatimSearch(newValue);
    setSuggestions(results);
    setShowDropdown(true);
  };

  const handleSelect = (item) => {
    setInput(item.display_name);
    setValue(item);
    setLatLng({ lat: item.lat, lng: item.lon });
    setSuggestions([]);
    setShowDropdown(false);
  };

  return (
    <div style={{ marginBottom: 16, position: "relative" }}>
      <label className="address-label">{label}:</label>
      <input
        type="text"
        className="address-input"
        value={input}
        onChange={handleChange}
        placeholder={placeholder}
        onFocus={() => input.length >= 3 && setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        autoComplete="off"
      />
      {showDropdown && suggestions.length > 0 && (
        <ul className="autofill-dropdown">
          {suggestions.map((item, idx) => (
            <li key={idx}
                onMouseDown={() => handleSelect(item)}>
              {item.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function App() {
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [route, setRoute] = useState([]);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // For typed origin/destination
  const [originInput, setOriginInput] = useState(null);
  const [destInput, setDestInput] = useState(null);

  // Add origin from address input
  const handleSetOrigin = (latlng) => {
    setStart(latlng);
    setRoute([]);
    setInfo(null);
    setError("");
  };

  // Add destination from address input
  const handleSetDest = (latlng) => {
    setEnd(latlng);
    setRoute([]);
    setInfo(null);
    setError("");
  };

  // Add by clicking map: first click = origin, second = destination, reset after both
  const [clickStep, setClickStep] = useState(0);
  const handleMapClick = (latlng) => {
    if (clickStep === 0) {
      setStart(latlng);
      setEnd(null);
      setRoute([]);
      setInfo(null);
      setError("");
      setClickStep(1);
    } else if (clickStep === 1) {
      setEnd(latlng);
      setRoute([]);
      setInfo(null);
      setError("");
      setClickStep(0);
    }
  };

  const handleReset = () => {
    setStart(null);
    setEnd(null);
    setRoute([]);
    setInfo(null);
    setError("");
    setOriginInput(null);
    setDestInput(null);
    setClickStep(0);
  };

  const handleFindRoute = async () => {
    if (!start || !end) {
      setError("Please provide both origin and destination.");
      return;
    }
    setLoading(true);
    setError("");
    setRoute([]);
    setInfo(null);
    try {
      const response = await axios.post(
        "http://localhost:5000/api/route",
        { start, end }
      );
      setRoute(response.data.route.map(coord => [coord.lat, coord.lng]));
      setInfo(response.data.info);
    } catch (err) {
      setError("Could not fetch route. Make sure your backend is running and you have not exceeded API quota.");
    } finally {
      setLoading(false);
    }
  };

  // For map centering, try to fit both points
  const mapCenter = start
    ? [start.lat, start.lng]
    : [51.505, -0.09];

  return (
    <div>
      <div className="route-card">
        <h2 className="route-title">Find your optimized route at Snowdin!</h2>
        <div>
          <AddressInput
            label="Origin"
            value={originInput}
            setValue={setOriginInput}
            setLatLng={handleSetOrigin}
            placeholder="Type address or place..."
          />
          <AddressInput
            label="Destination"
            value={destInput}
            setValue={setDestInput}
            setLatLng={handleSetDest}
            placeholder="Type address or place..."
          />
        </div>
        <div className="route-tip">
          Or click on the map to set origin, then destination.
        </div>
        <div className="route-btn-group">
          <button onClick={handleReset} className="route-btn">
            Reset
          </button>
          <button
            onClick={handleFindRoute}
            disabled={!start || !end || loading}
            className="route-btn primary"
          >
            {loading ? "Finding Route..." : "Find Optimized Route"}
          </button>
        </div>
        {(start || end) && (
          <div className="route-stops">
            <strong>Stops:</strong>
            <ol>
              {start && <li><b>Origin:</b> {start.lat.toFixed(5)}, {start.lng.toFixed(5)}</li>}
              {end && <li><b>Destination:</b> {end.lat.toFixed(5)}, {end.lng.toFixed(5)}</li>}
            </ol>
          </div>
        )}
        {error && <div className="route-error">{error}</div>}
        {info && (
          <div className="route-info">
            <p><strong>Distance:</strong> {info.distance} km</p>
            <p><strong>Estimated Time:</strong> {info.time} mins</p>
          </div>
        )}
      </div>
      <MapContainer
        center={mapCenter}
        zoom={start ? 13 : 11}
        style={{
          height: "100vh",
          width: "100vw",
          filter: "brightness(0.97)"
        }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
        />
        <LocationSelector onSelect={handleMapClick} disabled={loading} />
        {start && (
          <Marker position={start}>
            <Popup>Origin</Popup>
          </Marker>
        )}
        {end && (
          <Marker position={end}>
            <Popup>Destination</Popup>
          </Marker>
        )}
        {route.length > 1 && <Polyline positions={route} color="#4172a6" weight={5} opacity={0.67} />}
      </MapContainer>
      <div className="route-footer">
        <span>
          © {new Date().getFullYear()} <a href="https://github.com/turtlespeedv" style={{ color: "#4172a6", textDecoration: "none" }}>Snowdin</a>
        </span>
      </div>
    </div>
  );
}

export default App;