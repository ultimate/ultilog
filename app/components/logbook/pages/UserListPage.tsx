import { useI18n } from "../../../lib/i18n";

type SocialUser = {
  username: string;
  sailMiles: number;
  motorMiles: number;
  logbookSheets: number;
  boats: number;
};

export function UserListPage({
  mockSocialUsers,
}: {
  mockSocialUsers: SocialUser[];
}) {
  const { t } = useI18n();
  return (
    <section className="module-panel" aria-label={t("users.aria")}>
      <div className="page-heading">
        <div>
          <h1>{t("users.title")}</h1>
          <p>
            {t("users.subtitle")}
          </p>
        </div>
      </div>
      <article className="table-card">
        <div className="table-header">
          <div>
            <p className="eyebrow">{t("users.directory")}</p>
            <h3>{t("users.all")}</h3>
            <p>
              {t("users.mockHelp")}
            </p>
          </div>
        </div>
        <div className="table-scroll">
          <table className="logbook-table users-table">
            <thead>
              <tr>
                <th>{t("users.username")}</th>
                <th>{t("users.totalSail")}</th>
                <th>{t("users.totalMotor")}</th>
                <th>{t("users.sheets")}</th>
                <th>{t("users.boats")}</th>
              </tr>
            </thead>
            <tbody>
              {mockSocialUsers.map((user) => (
                <tr key={user.username}>
                  <td>
                    <strong>{user.username}</strong>
                  </td>
                  <td>{user.sailMiles.toLocaleString()} nm</td>
                  <td>{user.motorMiles.toLocaleString()} nm</td>
                  <td>{user.logbookSheets}</td>
                  <td>{user.boats}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
