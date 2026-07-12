import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ConfigContext,
  type AppConfig,
  type ConfigContextValue,
} from "../data/config";
import { clearConfig, loadConfig, saveConfig } from "./secureConfig";

/**
 * Loads config from secure-store on mount and exposes save/clear. `ready`
 * flips true once the initial read completes so the router can avoid a setup
 * flash for already-configured users.
 */
export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    loadConfig()
      .then((loaded) => {
        if (active) setConfig(loaded);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<ConfigContextValue>(
    () => ({
      config,
      ready,
      save: async (next) => {
        await saveConfig(next);
        setConfig(next);
      },
      clear: async () => {
        await clearConfig();
        setConfig(null);
      },
    }),
    [config, ready],
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}
