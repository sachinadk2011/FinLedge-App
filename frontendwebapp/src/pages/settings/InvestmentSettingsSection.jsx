import { SettingsDisabledPanel, SettingsPlaceholder } from "./SettingsPanels.jsx";
export default function InvestmentSettingsSection({}) {
  return <SettingsDisabledPanel title="Investment" detail="Interest rate settings will be available in a future update." actions={[{
    label: "Interest rate settings"
  }]} />;
}
