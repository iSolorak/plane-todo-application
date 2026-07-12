import { Redirect } from "expo-router";
import { isSetupComplete, useConfig } from "../src/data/config";
import { Loading, Screen } from "../src/components/ui";

export default function Index() {
  const { config, ready } = useConfig();
  if (!ready) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  return <Redirect href={isSetupComplete(config) ? "/(tabs)/today" : "/setup"} />;
}
