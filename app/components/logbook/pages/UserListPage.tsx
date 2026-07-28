import { useMemo } from "react";
import { useI18n } from "../../../lib/i18n";
import { ListPagination, ListSearch, SortableColumnHeader, useSortableList } from "../SortableList";

type SocialUser = {
  id: string;
  username: string;
  sailMiles: number;
  motorMiles: number;
  logbookSheets: number;
  boats: number;
};

export function UserListPage({
  users,
  defaultPageSize,
}: {
  users: SocialUser[];
  defaultPageSize: number;
}) {
  const { t } = useI18n();
  const columns = useMemo(() => [
    { key: "username", value: (user: SocialUser) => user.username },
    { key: "totalMileage", value: (user: SocialUser) => user.sailMiles + user.motorMiles },
    { key: "sailMiles", value: (user: SocialUser) => user.sailMiles },
    { key: "motorMiles", value: (user: SocialUser) => user.motorMiles },
    { key: "sheets", value: (user: SocialUser) => user.logbookSheets },
    { key: "boats", value: (user: SocialUser) => user.boats },
  ], []);
  const list = useSortableList(users, columns, defaultPageSize);
  const header = (key: string, label: string) => <SortableColumnHeader columnKey={key} activeKey={list.sort.key} direction={list.sort.direction} onSort={list.setSortKey}>{label}</SortableColumnHeader>;
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
              {t("users.directoryHelp")}
            </p>
          </div>
          <ListSearch value={list.query} onChange={list.setQuery} />
        </div>
        <div className="table-scroll">
          <table className="logbook-table users-table">
            <thead>
              <tr>
                {header("username", t("users.username"))}
                {header("totalMileage", t("users.totalMileage"))}
                {header("sailMiles", t("users.totalSail"))}
                {header("motorMiles", t("users.totalMotor"))}
                {header("sheets", t("users.sheets"))}
                {header("boats", t("users.boats"))}
              </tr>
            </thead>
            <tbody>
              {list.pageItems.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.username}</strong>
                  </td>
                  <td>{(user.sailMiles + user.motorMiles).toLocaleString()} nm</td>
                  <td>{user.sailMiles.toLocaleString()} nm</td>
                  <td>{user.motorMiles.toLocaleString()} nm</td>
                  <td>{user.logbookSheets}</td>
                  <td>{user.boats}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ListPagination list={list} />
      </article>
    </section>
  );
}
