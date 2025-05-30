import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./components/LoginPage";
import Home from "./components/StaffDashBoard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/StaffDashBoard" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
