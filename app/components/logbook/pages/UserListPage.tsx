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
  return (
    <section className="module-panel" aria-label="Users page">
      <div className="page-heading">
        <div>
          <h1>Users</h1>
          <p>
            Discover other ultilog sailors and compare high-level logbook
            activity.
          </p>
        </div>
      </div>
      <article className="table-card">
        <div className="table-header">
          <div>
            <p className="eyebrow">Community directory</p>
            <h3>All users</h3>
            <p>
              Mocked summary data until shared profile statistics are connected.
            </p>
          </div>
        </div>
        <div className="table-scroll">
          <table className="logbook-table users-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Total sail mileage</th>
                <th>Total motor mileage</th>
                <th>Logbook sheets</th>
                <th>Boats</th>
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
