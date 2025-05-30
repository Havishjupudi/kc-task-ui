import React, { useState, useEffect, useRef } from "react";
import { Sun, Moon } from "lucide-react";
import { Clipboard } from "lucide-react";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import LoginPage from "./LoginPage";

// Format ISO date to "Month Day, Year" (e.g., May 27, 2025)
function formatDateForDisplay(isoDate) {
  if (!isoDate) return "";
  const options = { year: "numeric", month: "long", day: "numeric" };
  return new Date(isoDate).toLocaleDateString(undefined, options);
}

export default function StaffDashboard() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (window.innerWidth <= 768) return true; // Force dark mode on mobile
    const savedMode = localStorage.getItem("darkMode");
    return savedMode ? JSON.parse(savedMode) : true; // Default to dark otherwise
  });

  const [rows, setRows] = useState([
    /* your initial row state */
  ]);
  const menuRef = useRef(null);
  const [editingRowId, setEditingRowId] = useState(null);
  const [sheetTitle, setSheetTitle] = useState("Loading...");

  const rowsPerPage = 10;

  const [docContentMap, setDocContentMap] = useState({});

  const [sheetList, setSheetList] = useState(() => {
    return JSON.parse(localStorage.getItem("sheetList") || "[]");
  });
  const [showMenu, setShowMenu] = useState(false);

  const [copiedMap, setCopiedMap] = useState({});

  const [currentPage, setCurrentPage] = useState(() => {
    const saved = localStorage.getItem("currentPage");
    return saved ? parseInt(saved, 10) : 1;
  });

  const totalPages = Math.ceil(rows.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const visibleRows = rows.slice(startIndex, startIndex + rowsPerPage);

  const extractSheetId = (url) => {
    if (!url) return null; // Add this null check
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  function copyToClipboard(text, setCopied) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    });
  }

  function transformComment(raw) {
    if (!raw) return "";

    try {
      const postRegex = /POST\s*=\s*(https?:\/\/[^\n]+)/i;
      const commentRegex =
        /Comment to be posted\s*:\s*\n([\s\S]*?)\n\nThe First Link Will Be Placed In Anchor:/i;
      const anchorTextRegex =
        /The First Link Will Be Placed In Anchor:\s*\n(.+?)\n\nFirst URL:/i;
      const urlRegex = /First URL:\s*\n(.+)/i;

      const postMatch = raw.match(postRegex);
      const commentMatch = raw.match(commentRegex);
      const anchorTextMatch = raw.match(anchorTextRegex);
      const urlMatch = raw.match(urlRegex);

      if (commentMatch && anchorTextMatch && urlMatch) {
        const commentBody = commentMatch[1].trim();
        const anchor = anchorTextMatch[1].trim();
        const url = urlMatch[1].trim();

        const finalComment = commentBody.replace(anchor, `[${anchor}]{${url}}`);
        return finalComment;
      }

      // If pattern doesn't match completely, show raw
      return raw.trim();
    } catch (e) {
      return raw.trim();
    }
  }

  function extractGoogleDocId(text) {
    const match = text.match(
      /https:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9-_]+)/
    );
    return match ? match[1] : null;
  }

  async function fetchPublicGoogleDocText(docId) {
    const response = await fetch(
      `https://docs.google.com/document/d/${docId}/export?format=txt`
    );
    const rawText = await response.text();
    const lines = rawText.split("\n");

    let heading = "";
    let contentStarted = false;
    const paragraphLines = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (!contentStarted && trimmed) {
        heading = trimmed;
        contentStarted = true;
        continue;
      }

      if (contentStarted) {
        paragraphLines.push(line);
      }
    }

    while (paragraphLines.length > 0 && paragraphLines[0].trim() === "") {
      paragraphLines.shift();
    }
    while (
      paragraphLines.length > 0 &&
      paragraphLines[paragraphLines.length - 1].trim() === ""
    ) {
      paragraphLines.pop();
    }

    const paragraph = paragraphLines.join("\n");
    return { heading, paragraph };
  }

  useEffect(() => {
    const MAX_DOCS = 50;
    const ids = Object.keys(docContentMap);

    if (ids.length > MAX_DOCS) {
      // Keep only visible rows (current page)
      const keepIds = visibleRows.map((r) => r.id);
      const newMap = {};

      for (const id of keepIds) {
        if (docContentMap[id]) {
          newMap[id] = docContentMap[id];
        }
      }

      setDocContentMap(newMap); // trim to only what's visible
    }
  }, [visibleRows, docContentMap]);

  useEffect(() => {
    const fetchSheetData = async () => {
      const token = localStorage.getItem("accessToken");
      const sheetUrl = localStorage.getItem("sheetUrl");

      // Add this check - if no sheetUrl, don't proceed
      if (!sheetUrl) {
        console.log("No sheet URL found, skipping fetch");
        return;
      }

      const sheetId = extractSheetId(sheetUrl);

      // Add this check - if no valid sheetId, don't proceed
      if (!sheetId) {
        console.log("Invalid sheet URL, cannot extract ID");
        return;
      }

      try {
        // Rest of your existing code...
        // 1. Fetch A1 for title
        const titleRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/User1!A1`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const titleData = await titleRes.json();
        const title = titleData.values?.[0]?.[0] || "Untitled";
        setSheetTitle(title);

        // 2. Fetch rows for the dashboard table
        const range = "User1!A3:L";
        const response = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();
        if (data.values) {
          const formattedRows = data.values.map((row, idx) => ({
            id: idx + 1,
            serial: row[0] || "",
            threadUrl: row[1] || "",
            comment: row[2] || "",
            type: row[4] || "",
            status: row[9] || "",
            commentLink: row[10] || "",
            commentDate: row[11] ? row[11].split("T")[0] : "",
          }));
          setRows(formattedRows);
        }
      } catch (error) {
        console.error("❌ Error fetching sheet data or title:", error);
      }
    };

    fetchSheetData();
  }, []);

  useEffect(() => {
    const fetchDocs = async () => {
      const visibleDocsToFetch = visibleRows.filter((row) => {
        const docId = extractGoogleDocId(row.comment);
        return docId && !docContentMap[row.id]; // only fetch if not cached
      });

      if (visibleDocsToFetch.length === 0) return;

      const fetchPromises = visibleDocsToFetch.map(async (row) => {
        const docId = extractGoogleDocId(row.comment);
        if (!docId) return null;

        try {
          const res = await fetch(
            `https://docs.google.com/document/d/${docId}/export?format=txt`
          );
          const text = await res.text();

          const lines = text.split("\n");

          let heading = "";
          let contentStarted = false;
          const paragraphLines = [];

          for (const line of lines) {
            const trimmed = line.trim();

            if (!contentStarted && trimmed) {
              heading = trimmed;
              contentStarted = true;
              continue;
            }

            if (contentStarted) {
              paragraphLines.push(line);
            }
          }

          // Trim leading and trailing blank lines from the paragraph block
          while (paragraphLines.length > 0 && paragraphLines[0].trim() === "") {
            paragraphLines.shift();
          }
          while (
            paragraphLines.length > 0 &&
            paragraphLines[paragraphLines.length - 1].trim() === ""
          ) {
            paragraphLines.pop();
          }

          const paragraph = paragraphLines.join("\n");
          return { rowId: row.id, heading, paragraph };

          return { rowId: row.id, heading, paragraph };
        } catch (e) {
          console.error(`Error fetching doc ${docId}:`, e);
          return null;
        }
      });

      const results = await Promise.all(fetchPromises);
      const newContentMap = {};

      for (const result of results) {
        if (result) {
          newContentMap[result.rowId] = {
            heading: result.heading,
            paragraph: result.paragraph,
          };
        }
      }

      setDocContentMap((prev) => ({ ...prev, ...newContentMap }));
    };

    fetchDocs();
  }, [visibleRows]);

  useEffect(() => {
    const prefetchNextPageDocs = async () => {
      const nextPage = currentPage + 1;
      const startIndex = (nextPage - 1) * rowsPerPage;
      const nextPageRows = rows.slice(startIndex, startIndex + rowsPerPage);

      const docsToFetch = nextPageRows.filter((row) => {
        const docId = extractGoogleDocId(row.comment);
        return docId && !docContentMap[row.id];
      });

      if (docsToFetch.length === 0) return;

      const fetchPromises = docsToFetch.map(async (row) => {
        const docId = extractGoogleDocId(row.comment);
        if (!docId) return null;

        try {
          const res = await fetch(
            `https://docs.google.com/document/d/${docId}/export?format=txt`
          );
          const text = await res.text();

          const lines = text.split("\n");

          let heading = "";
          let contentStarted = false;
          const paragraphLines = [];

          for (const line of lines) {
            const trimmed = line.trim();

            if (!contentStarted && trimmed) {
              heading = trimmed;
              contentStarted = true;
              continue;
            }

            if (contentStarted) {
              paragraphLines.push(line);
            }
          }

          // Trim leading and trailing blank lines from the paragraph block
          while (paragraphLines.length > 0 && paragraphLines[0].trim() === "") {
            paragraphLines.shift();
          }
          while (
            paragraphLines.length > 0 &&
            paragraphLines[paragraphLines.length - 1].trim() === ""
          ) {
            paragraphLines.pop();
          }

          const paragraph = paragraphLines.join("\n");
          return { rowId: row.id, heading, paragraph };

          return { rowId: row.id, heading, paragraph };
        } catch (e) {
          console.error(`❌ Prefetch failed for doc ${docId}:`, e);
          return null;
        }
      });

      const results = await Promise.all(fetchPromises);
      const newMap = {};

      for (const result of results) {
        if (result) {
          newMap[result.rowId] = {
            heading: result.heading,
            paragraph: result.paragraph,
          };
        }
      }

      setDocContentMap((prev) => ({ ...prev, ...newMap }));
    };

    prefetchNextPageDocs();
  }, [currentPage, rows]);

  const [sheetTitles, setSheetTitles] = useState({});

  useEffect(() => {
    const fetchAllSheetTitles = async () => {
      const token = localStorage.getItem("accessToken");
      const titles = {};

      for (const url of sheetList) {
        const id = extractSheetId(url);

        // Add null check here too
        if (!id) {
          titles[url] = "Invalid URL";
          continue;
        }

        try {
          const res = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/User1!A1`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          const json = await res.json();
          titles[url] = json.values?.[0]?.[0] || "Untitled Sheet";
        } catch (err) {
          titles[url] = "Unavailable";
        }
      }

      setSheetTitles(titles);
    };

    // Only fetch if there are sheets in the list
    if (sheetList.length > 0) {
      fetchAllSheetTitles();
    }
  }, [sheetList]);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem("darkMode", JSON.stringify(newMode));
  };

  const updateRow = async (id, field, value) => {
    const updatedRows = rows.map((row) =>
      row.id === id ? { ...row, [field]: value } : row
    );
    setRows(updatedRows);

    localStorage.setItem("lastEditedRowId", id);

    // ✅ NEW CODE ↓
    const sheetUrl = localStorage.getItem("sheetUrl");
    const sheetId = extractSheetId(sheetUrl);
    const colMap = {
      serial: "A",
      threadUrl: "B",
      comment: "C",
      type: "E",
      status: "J",
      commentLink: "K",
      commentDate: "L",
    };
    const col = colMap[field];
    const rowIndex = id + 2; // Adjust based on your header offset
    const range = `User1!${col}${rowIndex}`;
    const token = localStorage.getItem("accessToken");

    try {
      const response = await fetch("http://localhost:3000/update-cell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetId,
          range,
          value,
          token,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        console.error("❌ Sheet update failed:", result);
      } else {
        console.log("✅ Sheet update success:", result);
      }
    } catch (error) {
      console.error("❌ Network or auth error updating sheet:", error);
    }
  };

  const handleInputFocus = (e, isDarkMode) => {
    e.target.style.transform = "translateY(-2px)";
    e.target.style.boxShadow = isDarkMode
      ? "0 8px 25px rgba(0,0,0,0.4), inset 0 2px 4px rgba(0,0,0,0.3)"
      : "0 8px 25px rgba(0,0,0,0.12), inset 0 2px 4px rgba(0,0,0,0.06)";
    e.target.style.backgroundColor = isDarkMode ? "#262626" : "#ffffff";
  };

  const handleInputBlur = (e, isDarkMode) => {
    e.target.style.transform = "translateY(0)";
    e.target.style.boxShadow = isDarkMode
      ? "inset 0 2px 4px rgba(0,0,0,0.3)"
      : "inset 0 2px 4px rgba(0,0,0,0.06)";
    e.target.style.backgroundColor = isDarkMode ? "#1a1a1a" : "#f8fafc";
  };

  const handleRowHover = (e, isDarkMode) => {
    e.currentTarget.style.backgroundColor = isDarkMode ? "#171717" : "#f8fafc";
    e.currentTarget.style.transform = "translateY(-2px)";
    e.currentTarget.style.boxShadow = isDarkMode
      ? "0 10px 30px rgba(0,0,0,0.5)"
      : "0 10px 30px rgba(0,0,0,0.08)";
  };

  const handleRowLeave = (e, isDarkMode) => {
    e.currentTarget.style.backgroundColor = isDarkMode ? "#0a0a0a" : "#ffffff";
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "none";
  };

  const labelStyle = {
    fontSize: "11px",
    fontWeight: "bold",
    color: "#999",
    marginBottom: "4px",
    padding: "1rem",
  };

  const commentBoxStyle = {
    fontSize: "13px",
    whiteSpace: "pre-wrap",
    overflowY: "auto",
    textOverflow: "ellipsis",
    maxHeight: "100px",
    padding: "6px 10px",
    border: "1px solid #333",
    borderRadius: "6px",
    background: "transparent",
    lineHeight: "1.5",
    marginBottom: "8px",
    paddingRight: "28px", // leave room for the copy icon
  };

  return (
    <>
      <style>
        {`
          @media (max-width: 768px) {
            table thead,
            td[data-label],
            td:not(.mobile-flex-row) {
              display: none !important;
            }

            td.mobile-flex-row {
              display: table-cell !important;
              width: 50%;
              padding: 12px;
              background: #0a0a0a;
              border-radius: 12px;
              border: 1px solid #222;
              overflow-wrap: break-word;
  word-break: break-word;
  white-space: normal;
              
            }

            table, tbody, tr {
              display: block;
              width: 100%;
            }

            tr {
              margin-bottom: 16px;
              border-radius: 12px;
              background-color: #0a0a0a;
              padding: 12px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            }

            td {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 8px 12px;
              font-size: 13px;
              border-bottom: 1px solid #222;
            }

            td:last-child {
              border-bottom: none;
            }

            td input, td select, td span {
              flex: 2;
              max-width: 65%;
              font-size: 12px;
            }

            td input[type="text"],
            td select {
              width: 100%;
            }

            td pre {
              font-size: 13px;
              line-height: 1.6;
              width: 90%;
            }

            .custom-datepicker {
              width: 100%;
              padding: 12px 16px;
              border: none;
              border-radius: 12px;
              font-size: 13px;
              background-color: rgb(26, 26, 26);
              color: rgb(255, 255, 255);
              outline: none;
              transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
              font-family: inherit;
              text-align: center;
              box-sizing: border-box;
              box-shadow: rgba(0, 0, 0, 0.3) 0px 2px 4px inset;
            }

            body {
              font-size: 12px;
            }

            input, select, pre, label {
              font-size: 12px !important;
            }

            @media (max-width: 768px) {
              .react-datepicker__header,
              .react-datepicker {
                background-color: #1a1a1a;
                border-color: #333;
              }

              .react-datepicker__day,
              .react-datepicker__day-name,
              .react-datepicker__current-month {
                color: #eee;
              }

              .react-datepicker__day--selected,
              .react-datepicker__day--keyboard-selected {
                background-color: #3b82f6;
                color: #fff;
              }

              .react-datepicker__day:hover {
                background-color: #2d2d2d;
              }

              .react-datepicker__triangle {
                border-bottom-color: #1a1a1a !important;
              }

              .react-datepicker__month-container {
                background-color: #1a1a1a;
              }

              .react-datepicker__navigation-icon::before {
                border-color: #eee;
              }
            }


          }
        `}
      </style>
      <style>
        {`
          @media (min-width: 769px) and (max-width: 1440px) {
            body {
              font-size: 13px;
            }

            input, select, pre, label, span, button {
              font-size: 13px !important;
            }

            table th, table td {
              padding: 6px 8px !important;
            }

            .custom-datepicker {
              font-size: 13px !important;
              padding: 6px 10px !important;
            }

            button {
              padding: 6px 10px !important;
            }

            .react-datepicker {
              font-size: 13px !important;
            }
          }
        `}
      </style>

      <div style={styles.container(isDarkMode)}>
        <div style={styles.header(isDarkMode)}>
          <h1 style={styles.title(isDarkMode)}>{sheetTitle}</h1>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              position: "relative",
            }}
          >
            {window.innerWidth > 768 && (
              <button
                onClick={toggleDarkMode}
                style={styles.toggleButton(isDarkMode)}
                onMouseEnter={(e) => (e.target.style.transform = "scale(1.1)")}
                onMouseLeave={(e) => (e.target.style.transform = "scale(1)")}
              >
                {isDarkMode ? (
                  <Sun size={24} color="#fbbf24" />
                ) : (
                  <Moon size={24} color="#374151" />
                )}
              </button>
            )}

            <button
              onClick={() => setShowMenu((prev) => !prev)}
              style={styles.menuButton(isDarkMode)}
              title="Account Menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke={isDarkMode ? "#fff" : "#000"}
                style={{ width: 24, height: 24 }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0"
                />
              </svg>
            </button>

            {showMenu && (
              <div ref={menuRef} style={styles.dropdownMenu(isDarkMode)}>
                {sheetList.map((url, index) => (
                  <div
                    key={index}
                    style={styles.menuItem(isDarkMode)}
                    onClick={() => {
                      localStorage.setItem("sheetUrl", url);
                      window.location.reload();
                    }}
                  >
                    {sheetTitles[url] || `Sheet ${index + 1}`}
                  </div>
                ))}
                <div
                  style={styles.menuItem(isDarkMode)}
                  onClick={() => {
                    localStorage.setItem("addingNewSheet", "true");
                    window.location.href = "/";
                  }}
                >
                  ➕ Add Sheet
                </div>
                <div
                  style={styles.menuItem(isDarkMode)}
                  onClick={() => {
                    localStorage.removeItem("accessToken");
                    localStorage.removeItem("sheetUrl");
                    localStorage.removeItem("sheetList");
                    window.location.href = "/";
                  }}
                >
                  🚪 Logout
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={styles.tableContainer(isDarkMode)}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.headerCell(isDarkMode), width: "60px" }}>
                  Serial
                </th>
                <th
                  style={{ ...styles.headerCell(isDarkMode), width: "160px" }}
                >
                  Thread URL
                </th>
                <th
                  style={{ ...styles.headerCell(isDarkMode), width: "350px" }}
                >
                  Comment
                </th>
                <th
                  style={{ ...styles.headerCell(isDarkMode), width: "120px" }}
                >
                  Type
                </th>
                <th style={{ ...styles.headerCell(isDarkMode), width: "90px" }}>
                  Status
                </th>
                <th
                  style={{ ...styles.headerCell(isDarkMode), width: "160px" }}
                >
                  Comment Link
                </th>
                <th
                  style={{ ...styles.headerCell(isDarkMode), width: "110px" }}
                >
                  Date
                </th>
              </tr>
            </thead>

            <tbody>
              {visibleRows.map((row) => (
                <tr
                  key={row.id}
                  id={`row-${row.id}`}
                  style={styles.row(isDarkMode)}
                  onMouseEnter={(e) => handleRowHover(e, isDarkMode)}
                  onMouseLeave={(e) => handleRowLeave(e, isDarkMode)}
                >
                  <td style={styles.cell(isDarkMode)} data-label="Serial">
                    <input
                      type="text"
                      value={row.serial}
                      onChange={(e) =>
                        updateRow(row.id, "serial", e.target.value)
                      }
                      style={styles.input(isDarkMode)}
                      placeholder="###"
                      maxLength="3"
                      onFocus={(e) => handleInputFocus(e, isDarkMode)}
                      onBlur={(e) => handleInputBlur(e, isDarkMode)}
                    />
                  </td>
                  <td style={styles.cell(isDarkMode)} data-label="Thread URL">
                    <input
                      type="text"
                      value={row.threadUrl}
                      readOnly
                      onClick={() => {
                        if (row.threadUrl.startsWith("http")) {
                          window.open(row.threadUrl, "_blank");
                        }
                      }}
                      style={styles.urlInput(isDarkMode)}
                      placeholder="https://example.com/..."
                      title={row.threadUrl}
                    />
                  </td>

                  <td style={styles.cell(isDarkMode)} data-label="Comment">
                    {extractGoogleDocId(row.comment) ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                          width: "100%",
                        }}
                      >
                        {/* Heading box with copy icon */}
                        <div style={{ position: "relative" }}>
                          <div
                            style={{
                              backgroundColor: isDarkMode
                                ? "#2d2d2d"
                                : "#f0f0f0",
                              padding: "12px 24px 12px 12px", // extra right space
                              borderRadius: "10px",
                              fontWeight: "bold",
                              whiteSpace: "pre-wrap",
                              wordWrap: "break-word",
                              color: isDarkMode ? "#fff" : "#000",
                            }}
                          >
                            {docContentMap[row.id]?.heading || "Loading..."}
                          </div>

                          <Clipboard
                            size={16}
                            style={{
                              position: "absolute",
                              top: "6px",
                              right: "6px",
                              cursor: "pointer",
                              color: isDarkMode ? "#aaa" : "#666",
                            }}
                            onClick={() =>
                              navigator.clipboard.writeText(
                                docContentMap[row.id]?.heading || ""
                              )
                            }
                          />
                        </div>

                        {/* Paragraph box with copy icon */}
                        <div style={{ position: "relative" }}>
                          <div
                            style={{
                              backgroundColor: isDarkMode
                                ? "#1a1a1a"
                                : "#ffffff",
                              padding: "12px 24px 12px 12px", // extra right space
                              borderRadius: "10px",
                              fontSize: "13px",
                              color: isDarkMode ? "#e5e5e5" : "#111",
                              whiteSpace: "pre-wrap",
                              wordWrap: "break-word",
                            }}
                          >
                            {docContentMap[row.id]?.paragraph || ""}
                          </div>

                          <Clipboard
                            size={16}
                            style={{
                              position: "absolute",
                              top: "6px",
                              right: "6px",
                              cursor: "pointer",
                              color: isDarkMode ? "#aaa" : "#666",
                            }}
                            onClick={() =>
                              navigator.clipboard.writeText(
                                docContentMap[row.id]?.paragraph || ""
                              )
                            }
                          />
                        </div>
                      </div>
                    ) : (
                      <div style={{ position: "relative", width: "100%" }}>
                        <pre
                          style={{
                            width: "100%",
                            maxHeight: "140px",
                            overflowY: "auto",
                            whiteSpace: "pre-wrap",
                            wordWrap: "break-word",
                            fontFamily: "inherit",
                            background: isDarkMode ? "#1a1a1a" : "#f8fafc",
                            color: isDarkMode ? "#e5e5e5" : "#111",
                            padding: "12px",
                            borderRadius: "10px",
                            fontSize: "13px",
                            lineHeight: "1.5",
                          }}
                        >
                          {transformComment(row.comment)}
                        </pre>
                        <Clipboard
                          size={16}
                          style={{
                            position: "absolute",
                            top: "6px",
                            right: "6px",
                            cursor: "pointer",
                            color: isDarkMode ? "#aaa" : "#666",
                          }}
                          onClick={() =>
                            navigator.clipboard.writeText(
                              transformComment(row.comment)
                            )
                          }
                        />
                      </div>
                    )}
                  </td>

                  <td style={styles.cell(isDarkMode)} data-label="Status">
                    <input
                      type="text"
                      value={row.type}
                      onChange={(e) =>
                        updateRow(row.id, "type", e.target.value)
                      }
                      style={styles.input(isDarkMode)}
                      placeholder="Type"
                      onFocus={(e) => handleInputFocus(e, isDarkMode)}
                      onBlur={(e) => handleInputBlur(e, isDarkMode)}
                    />
                  </td>
                  <td style={styles.cell(isDarkMode)} data-label="Comment Link">
                    <select
                      value={row.status}
                      onChange={(e) =>
                        updateRow(row.id, "status", e.target.value)
                      }
                      style={styles.select(isDarkMode, row.status)}
                      onFocus={(e) => handleInputFocus(e, isDarkMode)}
                      onBlur={(e) => handleInputBlur(e, isDarkMode)}
                    >
                      <option value="">Select</option>
                      <option value="Pending">Pending</option>
                      <option value="Posted">Posted</option>
                    </select>
                  </td>
                  <td style={styles.cell(isDarkMode)} data-label="Date">
                    <input
                      type="text"
                      value={row.commentLink}
                      onChange={(e) =>
                        updateRow(row.id, "commentLink", e.target.value)
                      }
                      style={styles.linkInput(isDarkMode)}
                      placeholder="https://comment-link..."
                      title={row.commentLink}
                      onFocus={(e) => handleInputFocus(e, isDarkMode)}
                      onBlur={(e) => handleInputBlur(e, isDarkMode)}
                    />
                  </td>
                  <td style={styles.cell(isDarkMode)}>
                    {editingRowId === row.id ? (
                      <input
                        type="date"
                        value={row.commentDate}
                        onChange={(e) =>
                          updateRow(row.id, "commentDate", e.target.value)
                        }
                        style={{
                          ...styles.dateInput(isDarkMode),
                          border: "1px solid #ccc",
                          borderRadius: "6px",
                          padding: "6px",
                          color: isDarkMode ? "white" : "#000",
                          backgroundColor: isDarkMode ? "#333" : "#fff",
                        }}
                        onBlur={() => setEditingRowId(null)}
                        autoFocus
                      />
                    ) : (
                      <span
                        onClick={() => setEditingRowId(row.id)}
                        style={{
                          display: "inline-block",
                          fontFamily: "inherit",
                          padding: "12px 16px",
                          borderRadius: "12px",
                          backgroundColor: isDarkMode
                            ? "rgb(26, 26, 26)"
                            : "#f9f9f9",
                          color: isDarkMode ? "#fff" : "#000",
                          cursor: "pointer",
                          boxShadow: "rgba(0, 0, 0, 0.06) 0px 2px 4px inset",
                        }}
                      >
                        {row.commentDate
                          ? new Date(row.commentDate).toLocaleDateString(
                              undefined,
                              {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              }
                            )
                          : "Select date"}
                      </span>
                    )}
                  </td>
                  <td className="mobile-flex-row" style={{ display: "none" }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "8px",
                      }}
                    >
                      {/* LEFT: Serial, Type, Date */}
                      <div
                        style={{
                          flex: "1 1 45%",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                        }}
                      >
                        <div>
                          <label style={labelStyle}>Serial</label>
                          <input
                            type="text"
                            value={row.serial}
                            onChange={(e) =>
                              updateRow(row.id, "serial", e.target.value)
                            }
                            style={styles.input(isDarkMode)}
                            placeholder="###"
                            maxLength="3"
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Type</label>
                          <input
                            type="text"
                            value={row.type}
                            onChange={(e) =>
                              updateRow(row.id, "type", e.target.value)
                            }
                            style={styles.input(isDarkMode)}
                          />
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                          }}
                        >
                          <label style={{ ...labelStyle, marginBottom: 0 }}>
                            Date
                          </label>
                          <div
                            onClick={() => setEditingRowId(row.id)}
                            style={{ flex: 1 }}
                          >
                            {editingRowId === row.id ? (
                              <DatePicker
                                selected={
                                  row.commentDate
                                    ? new Date(row.commentDate)
                                    : null
                                }
                                onChange={(date) => {
                                  updateRow(
                                    row.id,
                                    "commentDate",
                                    date.toISOString().split("T")[0]
                                  );
                                  setEditingRowId(null);
                                }}
                                dateFormat="yyyy-MM-dd"
                                autoFocus
                                className="custom-datepicker"
                                wrapperClassName="datepicker-wrapper"
                                onBlur={() => setEditingRowId(null)}
                              />
                            ) : (
                              <span
                                style={{
                                  display: "inline-block",
                                  fontFamily: "inherit",
                                  padding: "10px 14px",
                                  borderRadius: "12px",
                                  backgroundColor: isDarkMode
                                    ? "#1a1a1a"
                                    : "#f9f9f9",
                                  color: isDarkMode ? "#fff" : "#000",
                                  cursor: "pointer",
                                  fontSize: "13px",
                                  boxShadow:
                                    "inset 0px 2px 4px rgba(0,0,0,0.06)",
                                }}
                              >
                                {row.commentDate
                                  ? new Date(
                                      row.commentDate
                                    ).toLocaleDateString("en-GB", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    })
                                  : "Select date"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* CENTER: Comment */}
                      <div style={{ flex: "1 1 100%" }}>
                        <label
                          style={{
                            ...labelStyle,
                            fontSize: "13px",
                            marginBottom: "6px",
                          }}
                        >
                          Comment
                        </label>

                        {/* Google Doc: Heading */}
                        {extractGoogleDocId(row.comment) &&
                          docContentMap[row.id]?.heading && (
                            <div style={{ position: "relative" }}>
                              <pre style={commentBoxStyle}>
                                {docContentMap[row.id].heading}
                              </pre>
                              <Clipboard
                                size={16}
                                style={{
                                  position: "absolute",
                                  top: "6px",
                                  right: "6px",
                                  cursor: "pointer",
                                  color: "#aaa",
                                }}
                                onClick={() =>
                                  navigator.clipboard.writeText(
                                    docContentMap[row.id].heading || ""
                                  )
                                }
                              />
                            </div>
                          )}

                        {/* Google Doc: Paragraph */}
                        {extractGoogleDocId(row.comment) &&
                          docContentMap[row.id]?.paragraph && (
                            <div style={{ position: "relative" }}>
                              <pre style={commentBoxStyle}>
                                {docContentMap[row.id].paragraph}
                              </pre>
                              <Clipboard
                                size={16}
                                style={{
                                  position: "absolute",
                                  top: "6px",
                                  right: "6px",
                                  cursor: "pointer",
                                  color: "#aaa",
                                  backgroundColor: "#000",
                                  padding: "2px", // ← optional for spacing inside the icon
                                  borderRadius: "4px", // ← optional to match desktop feel
                                }}
                                onClick={() =>
                                  navigator.clipboard.writeText(
                                    docContentMap[row.id].paragraph || ""
                                  )
                                }
                              />
                            </div>
                          )}

                        {/* Raw comment fallback (not Google Doc) */}
                        {!extractGoogleDocId(row.comment) && row.comment && (
                          <div style={{ position: "relative" }}>
                            <pre style={commentBoxStyle}>
                              {transformComment(row.comment)}
                            </pre>
                            <Clipboard
                              size={16}
                              style={{
                                position: "absolute",
                                top: "6px",
                                right: "6px",
                                cursor: "pointer",
                                color: "#aaa",
                                backgroundColor: "#000",
                                padding: "2px", // ← optional for spacing inside the icon
                                borderRadius: "4px", // ← optional to match desktop feel
                                zIndex: 2,
                              }}
                              onClick={() =>
                                navigator.clipboard.writeText(
                                  transformComment(row.comment)
                                )
                              }
                            />
                          </div>
                        )}
                      </div>

                      {/* RIGHT: Thread URL + Status side by side, Comment Link below */}
                      <div
                        style={{
                          flex: "1 1 30%",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            gap: "10px",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ flex: "1 1 50%" }}>
                            <label style={labelStyle}>Thread URL</label>
                            <input
                              type="text"
                              value={row.threadUrl}
                              readOnly
                              onClick={() => {
                                if (row.threadUrl.startsWith("http")) {
                                  window.open(row.threadUrl, "_blank");
                                }
                              }}
                              style={styles.urlInput(isDarkMode)}
                            />
                          </div>
                          <div style={{ flex: "1 1 50%" }}>
                            <label style={labelStyle}>Status</label>
                            <Select
                              value={
                                row.status
                                  ? { value: row.status, label: row.status }
                                  : null // this allows the placeholder to show
                              }
                              onChange={(opt) =>
                                updateRow(row.id, "status", opt.value)
                              }
                              options={[
                                {
                                  value: "",
                                  label: "Select",
                                  isDisabled: true,
                                },
                                { value: "Pending", label: "Pending" },
                                { value: "Posted", label: "Posted" },
                              ]}
                              placeholder="Select"
                              styles={selectStyles}
                            />
                          </div>
                        </div>

                        <div>
                          <label style={labelStyle}>Comment Link</label>
                          <input
                            type="text"
                            value={row.commentLink}
                            onChange={(e) =>
                              updateRow(row.id, "commentLink", e.target.value)
                            }
                            style={styles.input(isDarkMode)}
                          />
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: "20px", textAlign: "center" }}>
            {Array.from({ length: totalPages }, (_, index) => {
              const page = index + 1;
              const isCurrent = page === currentPage;
              const show =
                page === 1 ||
                page === totalPages ||
                Math.abs(currentPage - page) <= 2;

              if (!show) {
                if (
                  (page === currentPage - 3 && page > 1) ||
                  (page === currentPage + 3 && page < totalPages)
                ) {
                  return <span key={`ellipsis-${page}`}>...</span>;
                }
                return null;
              }

              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  style={{
                    margin: "0 4px",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: isCurrent
                      ? "#3b82f6"
                      : isDarkMode
                      ? "#333"
                      : "#eee",
                    color: isCurrent ? "#fff" : isDarkMode ? "#eee" : "#111",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  {page}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

const selectStyles = {
  control: (base, state) => {
    const status = state.selectProps.value?.value;

    let textColor, borderColor;

    if (status === "Posted") {
      textColor = "#34d399"; // green-400
      borderColor = "#065f46"; // emerald-900
    } else if (status === "Pending") {
      textColor = "#f87171"; // red-400
      borderColor = "#991b1b"; // red-900
    } else {
      textColor = "#9ca3af"; // gray-400
      borderColor = "#333"; // neutral border
    }

    return {
      ...base,
      width: "50%",
      padding: "0px",
      border: `2px solid ${borderColor}`,
      borderRadius: "12px",
      fontSize: "13px",
      backgroundColor: "rgb(26, 26, 26)",
      color: textColor,
      outline: "none",
      fontFamily: "inherit",
      textAlign: "center",
      fontWeight: "600",
      boxSizing: "border-box",
      boxShadow: "inset 0 2px 4px rgba(0,0,0,0.3)",
    };
  },

  singleValue: (base, state) => {
    const status = state.selectProps.value?.value;

    let color = "#9ca3af"; // default gray
    if (status === "Posted") color = "#34d399";
    else if (status === "Pending") color = "#f87171";

    return {
      ...base,
      color,
      textAlign: "center",
      width: "100%",
    };
  },

  menu: (base) => ({
    ...base,
    backgroundColor: "rgb(26, 26, 26)",
    fontSize: "13px",
    color: "rgb(255, 255, 255)",
    zIndex: 1000,
  }),

  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? "#333" : "transparent",
    color: "rgb(255, 255, 255)",
    cursor: "pointer",
    textAlign: "center",
  }),
};

const styles = {
  container: (isDarkMode) => ({
    minHeight: "100vh",
    width: "100vw",
    backgroundColor: isDarkMode ? "#000000" : "#ffffff",
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    transition: "background-color 0.3s ease",
    padding: "10px", // reduced from 20px
    fontSize: "13px", // reduce font size slightly
    boxSizing: "border-box",
  }),

  header: (isDarkMode) => ({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "30px",
    paddingBottom: "20px",
    borderBottom: `2px solid ${isDarkMode ? "#333333" : "#e5e5e5"}`,
    padding: "10px", // from 20px
    fontSize: "11px", // from 12px
  }),

  title: (isDarkMode) => ({
    fontSize: window.innerWidth <= 768 ? "24px" : "32px", // 📱 Smaller on mobile
    fontWeight: "700",
    color: isDarkMode ? "#ffffff" : "#000000",
    margin: 0,
    letterSpacing: "-0.5px",
  }),

  toggleButton: (isDarkMode) => ({
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
  }),

  tableContainer: (isDarkMode) => ({
    backgroundColor: isDarkMode ? "#0a0a0a" : "#ffffff",
    borderRadius: "24px",
    overflowX: "auto", // ⬅️ allow horizontal scroll
    WebkitOverflowScrolling: "touch",
    border: "none",
    width: "100%",
    boxShadow: isDarkMode
      ? "0 20px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)"
      : "0 20px 40px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.05)",
  }),

  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: "0",
    fontSize: "14px",
    padding: "20px",
  },

  headerCell: (isDarkMode) => ({
    backgroundColor: "transparent",
    color: isDarkMode ? "#ffffff" : "#1f2937",
    padding: "20px",
    textAlign: "center",
    fontWeight: "800",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "1.5px",
    border: "none",
    borderBottom: `2px solid ${isDarkMode ? "#333333" : "#e5e7eb"}`,
  }),

  cell: (isDarkMode) => ({
    padding: "10px",
    border: "none",
    borderBottom: `1px solid ${isDarkMode ? "#1f1f1f" : "#f3f4f6"}`,
    verticalAlign: "middle",
    textAlign: "center",
  }),

  input: (isDarkMode) => ({
    width: "100%",
    padding: "12px 16px",
    border: "none",
    borderRadius: "12px",
    fontSize: "13px",
    backgroundColor: isDarkMode ? "#1a1a1a" : "#f8fafc",
    color: isDarkMode ? "#ffffff" : "#1e293b",
    outline: "none",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    fontFamily: "inherit",
    textAlign: "center",
    boxSizing: "border-box",
    boxShadow: isDarkMode
      ? "inset 0 2px 4px rgba(0,0,0,0.3)"
      : "inset 0 2px 4px rgba(0,0,0,0.06)",
  }),

  dateInput: (isDarkMode) => ({
    width: "100%",
    padding: "12px 16px",
    border: "none",
    borderRadius: "12px",
    fontSize: "13px",
    backgroundColor: isDarkMode ? "#1a1a1a" : "#f8fafc",
    color: isDarkMode ? "#ffffff" : "#1e293b",
    outline: "none",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    fontFamily: "inherit",
    textAlign: "center",
    boxSizing: "border-box",
    boxShadow: isDarkMode
      ? "inset 0 2px 4px rgba(0,0,0,0.3)"
      : "inset 0 2px 4px rgba(0,0,0,0.06)",
    colorScheme: isDarkMode ? "dark" : "light",
  }),

  linkInput: (isDarkMode) => ({
    width: "100%",
    padding: "12px 16px",
    border: "none",
    borderRadius: "12px",
    fontSize: "12px",
    backgroundColor: isDarkMode ? "#1a1a1a" : "#f8fafc",
    color: isDarkMode ? "#ffffff" : "#1e293b",
    outline: "none",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    fontFamily: "inherit",
    textAlign: "left",
    boxSizing: "border-box",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    boxShadow: isDarkMode
      ? "inset 0 2px 4px rgba(0,0,0,0.3)"
      : "inset 0 2px 4px rgba(0,0,0,0.06)",
  }),

  urlInput: (isDarkMode) => ({
    width: "100%",
    padding: "12px 16px",
    border: "none",
    borderRadius: "12px",
    fontSize: "12px",
    backgroundColor: isDarkMode ? "#1a1a1a" : "#f8fafc",
    color: "#3b82f6", // 🔵 Link blue
    textDecoration: "underline", // 🔗 Underlined like a link
    cursor: "pointer", // 🔄 Pointer cursor
    outline: "none",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    fontFamily: "inherit",
    textAlign: "left",
    boxSizing: "border-box",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    boxShadow: isDarkMode
      ? "inset 0 2px 4px rgba(0,0,0,0.3)"
      : "inset 0 2px 4px rgba(0,0,0,0.06)",
  }),

  textarea: (isDarkMode) => ({
    width: "100%",
    border: "none",
    fontSize: "13px",
    whiteSpace: "pre-wrap",
    wordWrap: "break-word",
    maxHeight: "100px", // ⬅️ Reduce height
    overflowY: "auto", // ⬅️ Enable scroll for long content
    lineHeight: "1.4", // ⬅️ Tighten line spacing
    padding: "10px 24px 10px 12px", // ⬅️ Slightly smaller padding
    borderRadius: "10px",
    backgroundColor: isDarkMode ? "#1a1a1a" : "#ffffff",
    color: isDarkMode ? "#e5e5e5" : "#111",
    overflow: "hidden",
    boxShadow: isDarkMode
      ? "inset 0 2px 4px rgba(0,0,0,0.3)"
      : "inset 0 2px 4px rgba(0,0,0,0.06)",
  }),

  select: (isDarkMode, status) => {
    let textColor, borderColor;

    if (status === "Posted") {
      textColor = isDarkMode ? "#34d399" : "#16a34a";
      borderColor = isDarkMode ? "#065f46" : "#bbf7d0";
    } else if (status === "Pending") {
      textColor = isDarkMode ? "#f87171" : "#dc2626";
      borderColor = isDarkMode ? "#991b1b" : "#fecaca";
    } else {
      textColor = isDarkMode ? "#9ca3af" : "#64748b";
      borderColor = isDarkMode ? "#333" : "#e5e7eb";
    }

    return {
      width: "100%",
      padding: "10px 12px",
      border: `2px solid ${borderColor}`,
      borderRadius: "12px",
      fontSize: "11px",
      backgroundColor: isDarkMode ? "#1a1a1a" : "#f8fafc", // constant background
      color: textColor,
      outline: "none",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      fontFamily: "inherit",
      cursor: "pointer",
      textAlign: "center",
      fontWeight: "600",
      boxSizing: "border-box",
      boxShadow: "inset 0 2px 4px rgba(0,0,0,0.06)",
    };
  },

  menuButton: (isDarkMode) => ({
    backgroundColor: "transparent",
    border: `1px solid ${isDarkMode ? "#4b5563" : "#cbd5e1"}`,
    borderRadius: "50%",
    padding: "8px",
    cursor: "pointer",
    transition: "all 0.2s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }),

  dropdownMenu: (isDarkMode) => ({
    position: "absolute",
    top: "48px",
    right: 0,
    minWidth: "180px",
    backgroundColor: isDarkMode ? "#1a1a1a" : "#ffffff",
    border: `1px solid ${isDarkMode ? "#333" : "#ddd"}`,
    borderRadius: "8px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
    zIndex: 1000,
  }),

  menuItem: (isDarkMode) => ({
    padding: "10px 16px",
    cursor: "pointer",
    fontSize: "14px",
    color: isDarkMode ? "#f1f5f9" : "#1f2937",
    borderBottom: `1px solid ${isDarkMode ? "#333" : "#eee"}`,
    transition: "background-color 0.2s",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  }),

  row: (isDarkMode) => ({
    backgroundColor: isDarkMode ? "#0a0a0a" : "#ffffff",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  }),
};
