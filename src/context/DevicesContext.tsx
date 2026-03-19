import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Device } from "../types";

// null = offline, number = latency ms, undefined = not yet pinged
export type PingStatus = number | null | undefined;

interface DevicesContextValue {
  devices: Device[];
  status: Record<string, PingStatus>;
  refreshing: boolean;
  reload: () => Promise<void>;
  pingAll: (list?: Device[]) => void;
  setDeviceConnected: (id: string) => void;
}

const DevicesContext = createContext<DevicesContextValue>({
  devices: [],
  status: {},
  refreshing: false,
  reload: async () => {},
  pingAll: () => {},
  setDeviceConnected: () => {},
});

export function DevicesProvider({ children }: { children: React.ReactNode }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [status, setStatus] = useState<Record<string, PingStatus>>({});
  const [refreshing, setRefreshing] = useState(false);
  const loadedOnce = useRef(false);

  const pingAll = (list?: Device[]) => {
    const targets = list ?? devices;
    if (targets.length === 0) return;
    setRefreshing(true);
    Promise.all(
      targets.map((d) =>
        api.pingDevice(d.host, d.port)
          .then((ms) => [d.id, ms] as const)
          .catch(() => [d.id, null] as const)
      )
    ).then((results) => {
      setStatus(Object.fromEntries(results));
      setRefreshing(false);
    });
  };

  const reload = async () => {
    const list = await api.listDevices();
    setDevices(list);
    pingAll(list);
  };

  // Load once on app start
  useEffect(() => {
    if (loadedOnce.current) return;
    loadedOnce.current = true;
    reload();
  }, []);

  const setDeviceConnected = (id: string) => {
    const now = new Date().toISOString();
    setDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, last_connected: now } : d))
    );
    // Persist last_connected to disk
    setDevices((prev) => {
      const device = prev.find((d) => d.id === id);
      if (device) {
        api.saveDevice({ ...device, last_connected: now }).catch(() => {});
      }
      return prev;
    });
  };

  return (
    <DevicesContext.Provider value={{ devices, status, refreshing, reload, pingAll, setDeviceConnected }}>
      {children}
    </DevicesContext.Provider>
  );
}

export function useDevices() {
  return useContext(DevicesContext);
}
