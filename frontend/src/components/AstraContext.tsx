"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { astraApi, AstronautSummary, SystemStatusResponse } from "@/lib/api";

interface AstraContextValue {
  astronautId: string;
  setAstronautId: (id: string) => void;
  astronauts: AstronautSummary[];
  systemStatus: SystemStatusResponse | null;
  refreshGlobal: () => Promise<void>;
  backendReachable: boolean;
}

const AstraContext = createContext<AstraContextValue>({
  astronautId: "AST-001",
  setAstronautId: () => {},
  astronauts: [],
  systemStatus: null,
  refreshGlobal: async () => {},
  backendReachable: true,
});

export function AstraProvider({ children }: { children: React.ReactNode }) {
  const [astronautId, setAstronautId] = useState<string>("AST-001");
  const [astronauts, setAstronauts] = useState<AstronautSummary[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatusResponse | null>(null);
  const [backendReachable, setBackendReachable] = useState<boolean>(true);

  const refreshGlobal = useCallback(async () => {
    try {
      const [crew, sys] = await Promise.all([
        astraApi.listAstronauts(),
        astraApi.getSystemStatus(),
      ]);
      setAstronauts(crew);
      setSystemStatus(sys);
      setBackendReachable(true);
      if (crew.length > 0 && !crew.some((c) => c.astronaut_id === astronautId)) {
        setAstronautId(crew[0].astronaut_id);
      }
    } catch {
      setBackendReachable(false);
    }
  }, [astronautId]);

  useEffect(() => {
    refreshGlobal();
  }, [refreshGlobal]);

  return (
    <AstraContext.Provider
      value={{
        astronautId,
        setAstronautId,
        astronauts,
        systemStatus,
        refreshGlobal,
        backendReachable,
      }}
    >
      {children}
    </AstraContext.Provider>
  );
}

export function useAstra() {
  return useContext(AstraContext);
}
