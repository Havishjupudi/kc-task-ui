import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";


dotenv.config();


const app = express();
const PORT = 3000;

const allowedOrigin = process.env.ALLOWED_ORIGIN;
app.use(cors({ origin: allowedOrigin }));

app.use(express.json());

app.post("/update-cell", async (req, res) => {
  const { sheetId, range, value, token } = req.body;

  if (!sheetId || !range || !value || !token) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
    range
  )}?valueInputOption=USER_ENTERED`;

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [[value]] }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Google Sheets API error:", data);
      return res.status(response.status).json(data);
    }

    console.log("✅ Cell updated:", data);
    res.json(data);
  } catch (error) {
    console.error("❌ Network or server error:", error);
    res.status(500).json({ error: "Server error", detail: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Proxy server running at http://localhost:${PORT}`);
});
