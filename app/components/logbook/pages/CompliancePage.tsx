import { useI18n } from "../../../lib/i18n";
import { legalRequirements } from "../../../templates/compliance";

export function CompliancePage() {
  const { t } = useI18n();
  return (
    <section className="sheet-detail module-panel">
      <div className="page-heading">
        <div>
          <h1>{t("nav.compliance")}</h1>
          <p>{t("compliance.subtitle")}</p>
        </div>
        <button className="secondary-action" type="button">
          {t("compliance.download")}
        </button>
      </div>
      <article className="compliance-board">
        <section className="compliance-summary">
          <h3>{t("compliance.progress")}</h3>
          <div className="progress-layout">
            <div className="progress-ring">
              <strong>72%</strong>
              <span>{t("compliance.complete")}</span>
            </div>
            <dl>
              <div>
                <dt>{t("compliance.youHave")}</dt>
                <dd>2,173 nm</dd>
              </div>
              <div>
                <dt>{t("compliance.required")}</dt>
                <dd>3,000 nm</dd>
              </div>
              <div>
                <dt>{t("compliance.remaining")}</dt>
                <dd>827 nm</dd>
              </div>
            </dl>
          </div>
        </section>
        <section className="requirement-panel">
          <h3>{t("compliance.checklist")}</h3>
          {legalRequirements.map((requirement, index) => (
            <div className="requirement-row" key={requirement}>
              <span>✓</span>
              <strong>{requirement}</strong>
              <progress
                value={[2173, 1650, 1020, 1250, 1120, 860][index] ?? 860}
                max={[3000, 1500, 1000, 1000, 1400, 500][index] ?? 500}
              />
            </div>
          ))}
        </section>
      </article>
      <div className="mileage-breakdown">
        <article>
          <span>△</span>
          <strong>{t("compliance.sailMiles")}</strong>
          <b>1,650 nm</b>
          <small>70%</small>
        </article>
        <article>
          <span>✚</span>
          <strong>{t("compliance.motorMiles")}</strong>
          <b>523 nm</b>
          <small>24%</small>
        </article>
        <article>
          <span>⛵</span>
          <strong>{t("compliance.oceanPassages")}</strong>
          <b>1,120 nm</b>
          <small>30%</small>
        </article>
        <article>
          <span>♙</span>
          <strong>{t("compliance.asSkipper")}</strong>
          <b>860 nm</b>
          <small>40%</small>
        </article>
      </div>
    </section>
  );
}
