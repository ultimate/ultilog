import { useI18n } from "../../../lib/i18n";
import { legalRequirements } from "../../../templates/compliance";

export function LicenseSection() {
  const { t } = useI18n();
  return <section aria-labelledby="license-progress-title">
    <div className="page-heading"><h2 id="license-progress-title">{t("compliance.licenseProgress")}</h2><button className="secondary-action" type="button">{t("compliance.download")}</button></div>
    <article className="compliance-board"><section className="compliance-summary"><h3>{t("compliance.progress")}</h3><div className="progress-layout"><div className="progress-ring"><strong>72%</strong><span>{t("compliance.complete")}</span></div><dl><div><dt>{t("compliance.youHave")}</dt><dd>2,173 nm</dd></div><div><dt>{t("compliance.required")}</dt><dd>3,000 nm</dd></div><div><dt>{t("compliance.remaining")}</dt><dd>827 nm</dd></div></dl></div></section>
      <section className="requirement-panel"><h3>{t("compliance.checklist")}</h3>{legalRequirements.map((requirement, index) => <div className="requirement-row" key={requirement}><span>✓</span><strong>{requirement}</strong><progress value={[2173,1650,1020,1250,1120,860][index] ?? 860} max={[3000,1500,1000,1000,1400,500][index] ?? 500} /></div>)}</section></article>
    <div className="mileage-breakdown">{[["△","compliance.sailMiles","1,650 nm","70%"],["✚","compliance.motorMiles","523 nm","24%"],["⛵","compliance.oceanPassages","1,120 nm","30%"],["♙","compliance.asSkipper","860 nm","40%"]].map(([icon,key,value,percent]) => <article key={key}><span>{icon}</span><strong>{t(key as Parameters<typeof t>[0])}</strong><b>{value}</b><small>{percent}</small></article>)}</div>
  </section>;
}
