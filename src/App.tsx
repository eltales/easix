import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Editor from "./pages/Editor";
import Preview from "./pages/Preview";
import Deploy from "./pages/Deploy";
import Devices from "./pages/Devices";
import { DevicesProvider } from "./context/DevicesContext";

export default function App() {
  return (
    <DevicesProvider>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/editor/:name" element={<Editor />} />
        <Route path="/preview" element={<Preview />} />
        <Route path="/deploy" element={<Deploy />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </DevicesProvider>
  );
}
