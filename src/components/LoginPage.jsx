import React, { useState, useEffect, useRef } from "react";
import { Sun, Moon, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import StaffDashboard from "./StaffDashBoard";

const CLIENT_ID = import.meta.env.VITE_REACT_APP_GOOGLE_CLIENT_ID;
const SCOPES = import.meta.env.VITE_REACT_APP_GOOGLE_SCOPES;

export default function GoogleSheetsLogin() {
  const [sheetUrl, setSheetUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const tokenClientRef = useRef(null);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    return window.innerWidth <= 768 ? true : false;
  });

  // React Router navigation hook
  const navigate = useNavigate();

  useEffect(() => {
    // Auto-login if access token and sheet URL are stored
    const token = localStorage.getItem("accessToken");
    const storedSheetUrl = localStorage.getItem("sheetUrl");
    const addingNew = localStorage.getItem("addingNewSheet");

    if (token && storedSheetUrl && !addingNew) {
      // Navigate to LoginPage using React Router
      navigate("/");
    }

    // Initialize Google Identity Services
    if (window.google) {
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
          if (response.access_token) {
            localStorage.setItem("accessToken", response.access_token);
            localStorage.setItem("sheetUrl", sheetUrl);

            // Save to sheetList if not already included
            const existingSheets = JSON.parse(
              localStorage.getItem("sheetList") || "[]"
            );
            if (!existingSheets.includes(sheetUrl)) {
              existingSheets.push(sheetUrl);
              localStorage.setItem("sheetList", JSON.stringify(existingSheets));
            }

            localStorage.removeItem("addingNewSheet");

            // Navigate to LoginPage using React Router
            navigate("/StaffDashBoard");
          }
        },
      });
    }
  }, [sheetUrl, navigate]); // Include navigate in dependencies

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const isValidGoogleSheetUrl = (url) =>
    /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+/.test(url);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!isValidGoogleSheetUrl(sheetUrl)) {
      setErrorMessage("Please enter a valid Google Sheet URL.");
      return;
    }
    setErrorMessage("");
    tokenClientRef.current?.requestAccessToken();
  };

  // ... rest of your styling code remains the same ...
  const containerStyle = {
    height: "100vh",
    width: "100vw",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: isDarkMode ? "#1a1a1a" : "#f5f5f5",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    transition: "background-color 0.3s ease",
    position: "relative",
    padding: "20px",
    margin: 0,
    overflow: "hidden",
  };

  const toggleButtonStyle = {
    position: "fixed",
    top: "20px",
    right: "20px",
    backgroundColor: isDarkMode ? "#333" : "#fff",
    border: `1px solid ${isDarkMode ? "#555" : "#ddd"}`,
    borderRadius: "50%",
    width: "50px",
    height: "50px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: isDarkMode
      ? "0 2px 10px rgba(0,0,0,0.3)"
      : "0 2px 10px rgba(0,0,0,0.1)",
    zIndex: 1000,
  };

  const cardStyle = {
    backgroundColor: isDarkMode ? "#2a2a2a" : "#ffffff",
    borderRadius: "12px",
    padding: window.innerWidth <= 768 ? "24px" : "40px", // 📱 smaller padding on mobile
    width: "80%",
    maxWidth: window.innerWidth <= 768 ? "340px" : "420px", // 📱 smaller max width on mobile
    boxShadow: isDarkMode
      ? "0 10px 25px rgba(0,0,0,0.3)"
      : "0 10px 25px rgba(0,0,0,0.1)",
    transition: "all 0.3s ease",
    border: isDarkMode ? "1px solid #333" : "none",
  };

  const titleStyle = {
    fontSize: "28px",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: "8px",
    color: isDarkMode ? "#ffffff" : "#1a1a1a",
  };

  const subtitleStyle = {
    fontSize: "16px",
    textAlign: "center",
    marginBottom: "32px",
    color: isDarkMode ? "#cccccc" : "#666666",
  };

  const inputGroupStyle = {
    marginBottom: "20px",
  };

  const inputContainerStyle = {
    position: "relative",
  };

  const inputStyle = {
    width: "100%",
    padding: window.innerWidth <= 768 ? "10px 14px" : "12px 16px", // smaller padding
    paddingRight: "14px", // remove space previously used by the eye icon
    border: `2px solid ${isDarkMode ? "#444" : "#e1e1e1"}`,
    borderRadius: "8px",
    fontSize: window.innerWidth <= 768 ? "14px" : "16px", // smaller font
    backgroundColor: isDarkMode ? "#333" : "#ffffff",
    color: isDarkMode ? "#ffffff" : "#1a1a1a",
    outline: "none",
    transition: "all 0.3s ease",
    boxSizing: "border-box",
  };

  const buttonStyle = {
    width: "100%",
    padding: window.innerWidth <= 768 ? "10px 12px" : "14px",
    backgroundColor: isDarkMode ? "#4a5568" : "#2d3748",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontSize: window.innerWidth <= 768 ? "14px" : "16px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
  };

  const errorStyle = {
    color: "#e53e3e",
    fontSize: "14px",
    marginBottom: "12px",
    textAlign: "center",
  };

  return (
    <div style={containerStyle}>
      {window.innerWidth > 768 && (
        <button
          onClick={toggleDarkMode}
          style={toggleButtonStyle}
          onMouseEnter={(e) => {
            e.target.style.transform = "scale(1.1)";
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = "scale(1)";
          }}
        >
          {isDarkMode ? (
            <Sun size={24} color="#fbbf24" />
          ) : (
            <Moon size={24} color="#374151" />
          )}
        </button>
      )}

      <div style={cardStyle}>
        <h1 style={titleStyle}>Welcome Back</h1>
        <p style={subtitleStyle}>Connect to your Google Sheet</p>

        <div>
          <div style={inputGroupStyle}>
            <div style={inputContainerStyle}>
              <input
                type="text"
                placeholder="Enter your Google Sheet URL"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                style={inputStyle}
                onFocus={(e) => {
                  e.target.style.borderColor = isDarkMode
                    ? "#66b3ff"
                    : "#007bff";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = isDarkMode ? "#444" : "#e1e1e1";
                }}
              />
            </div>
          </div>

          {errorMessage && <div style={errorStyle}>{errorMessage}</div>}

          <button
            onClick={handleLogin}
            style={buttonStyle}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = isDarkMode
                ? "#5a6c7d"
                : "#1a202c";
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = isDarkMode
                ? "0 6px 20px rgba(0,0,0,0.3)"
                : "0 6px 20px rgba(0,0,0,0.15)";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = isDarkMode
                ? "#4a5568"
                : "#2d3748";
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "none";
            }}
          >
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
}
