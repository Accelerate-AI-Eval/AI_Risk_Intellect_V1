import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import {
  UserPlus,
  X,
  Loader2,
  Mail,
  CircleX,
  Send,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  UserRound,
  AtSign,
  BadgeCheck,
  Activity,
  RefreshCw,
} from "lucide-react";
import { DataTablePagination } from "../../common/DataTablePagination";
import { PageHeading } from "../../Layout/PageHeading";
import { authFetch } from "../../../utils/authFetch";
import { setDocumentPageTitle } from "../../../utils/pageTitle";
import { usePagination } from "../../../utils/usePagination";
import "./usersPage.css";

type UserRow = {
  id: string;
  email: string;
  username: string;
  fullName: string | null;
  accountStatus: "pending" | "completed" | "expired";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function userInitials(u: UserRow): string {
  const name = u.fullName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (
        parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)
      ).toUpperCase();
    }
    const single = parts[0] ?? "";
    if (single.length >= 2) return single.slice(0, 2).toUpperCase();
    if (single.length === 1) return single.toUpperCase();
  }
  const un = u.username?.trim() ?? "";
  if (un.length >= 2) return un.slice(0, 2).toUpperCase();
  if (un.length === 1) return un.toUpperCase();
  const em = u.email?.trim() ?? "";
  if (em.length >= 1) return em.charAt(0).toUpperCase();
  return "?";
}

function displayName(u: UserRow): string {
  return u.fullName?.trim() || "—";
}

function accountStatusLabel(s: UserRow["accountStatus"]): string {
  switch (s) {
    case "pending":
      return "Pending";
    case "completed":
      return "Completed";
    case "expired":
      return "Expired";
    default:
      return s;
  }
}

function accountStatusBadgeClass(s: UserRow["accountStatus"]): string {
  switch (s) {
    case "pending":
      return "usersPage__badge usersPage__badge--acctPending";
    case "completed":
      return "usersPage__badge usersPage__badge--acctCompleted";
    case "expired":
      return "usersPage__badge usersPage__badge--acctExpired";
    default:
      return "usersPage__badge";
  }
}

function normalizeUsersFromApi(raw: unknown): UserRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const u = item as Partial<UserRow>;
    const status = u.accountStatus;
    const accountStatus: UserRow["accountStatus"] =
      status === "pending" || status === "expired" || status === "completed"
        ? status
        : "completed";
    return { ...u, accountStatus } as UserRow;
  });
}

/** Same identifiers as sign-in (`userEmail`, `userName` in sessionStorage). */
function isLoggedInUserRow(u: UserRow): boolean {
  const sessionEmail =
    sessionStorage.getItem("userEmail")?.trim().toLowerCase() ?? "";
  const sessionUsername =
    sessionStorage.getItem("userName")?.trim().toLowerCase() ?? "";
  const email = u.email?.trim().toLowerCase() ?? "";
  const username = u.username?.trim().toLowerCase() ?? "";
  if (sessionEmail && email && sessionEmail === email) return true;
  if (sessionUsername && username && sessionUsername === username)
    return true;
  return false;
}

export function UsersPage() {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<"active" | "inactive">("active");
  const [pageSize, setPageSize] = useState(10);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">(
    "idle",
  );

  const [rowMenuOpenId, setRowMenuOpenId] = useState<string | null>(null);
  const [rowMenuAnchor, setRowMenuAnchor] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const [viewUser, setViewUser] = useState<UserRow | null>(null);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editDraft, setEditDraft] = useState({
    fullName: "",
    username: "",
    email: "",
    isActive: true,
  });

  useEffect(() => {
    setDocumentPageTitle("Users");
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) {
      setUsers([]);
      setLoadState("idle");
      return;
    }

    let cancelled = false;
    setLoadState("loading");

    void (async () => {
      try {
        const res = await authFetch("/api/users");
        const data = (await res.json().catch(() => ({}))) as {
          users?: UserRow[];
          error?: { message?: string };
        };
        if (cancelled) return;
        if (res.status === 401) {
          setLoadState("idle");
          return;
        }
        if (!res.ok) {
          setLoadState("error");
          toast.error(
            data.error?.message ?? "Could not load users.",
            { autoClose: 4000 },
          );
          return;
        }
        setUsers(normalizeUsersFromApi(data.users));
        setLoadState("idle");
      } catch {
        if (!cancelled) {
          setLoadState("error");
          toast.error("Could not load users.", { autoClose: 4000 });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const closeRowMenu = useCallback(() => {
    setRowMenuOpenId(null);
    setRowMenuAnchor(null);
  }, []);

  const activeCount = useMemo(
    () => users.reduce((n, u) => n + (u.isActive ? 1 : 0), 0),
    [users],
  );
  const inactiveCount = useMemo(
    () => users.length - activeCount,
    [users.length, activeCount],
  );

  const usersInTab = useMemo(
    () =>
      users.filter((u) =>
        statusTab === "active" ? u.isActive : !u.isActive,
      ),
    [users, statusTab],
  );

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return usersInTab;
    return usersInTab.filter((u) => {
      const hay = [
        u.email,
        u.username,
        u.fullName ?? "",
        u.id,
        u.isActive ? "active" : "inactive",
        u.accountStatus,
        accountStatusLabel(u.accountStatus).toLowerCase(),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [usersInTab, search]);

  const userPager = usePagination({
    items: filteredUsers,
    pageSize,
    resetKey: `${statusTab}|${search}`,
  });

  const rowMenuUser = useMemo(() => {
    if (!rowMenuOpenId) return null;
    return filteredUsers.find((u) => u.id === rowMenuOpenId) ?? null;
  }, [filteredUsers, rowMenuOpenId]);

  useEffect(() => {
    if (rowMenuOpenId && !rowMenuUser) {
      closeRowMenu();
    }
  }, [rowMenuOpenId, rowMenuUser, closeRowMenu]);

  useEffect(() => {
    closeRowMenu();
  }, [userPager.page, closeRowMenu]);

  useEffect(() => {
    if (!rowMenuOpenId) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      const wrap = document.querySelector(
        `[data-users-row-menu="${rowMenuOpenId}"]`,
      );
      const portal = document.querySelector(
        `[data-users-row-menu-portal="${rowMenuOpenId}"]`,
      );
      if (wrap?.contains(t) || portal?.contains(t)) return;
      closeRowMenu();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [rowMenuOpenId, closeRowMenu]);

  useEffect(() => {
    if (!rowMenuOpenId) return;
    const onScrollOrResize = () => {
      closeRowMenu();
    };
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [rowMenuOpenId, closeRowMenu]);

  useEffect(() => {
    if (editUser) {
      setEditDraft({
        fullName: editUser.fullName?.trim() ?? "",
        username: editUser.username,
        email: editUser.email,
        isActive: editUser.isActive,
      });
    }
  }, [editUser]);

  useEffect(() => {
    if (!inviteOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInviteOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [inviteOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (viewUser) setViewUser(null);
      else if (editUser) setEditUser(null);
      else if (rowMenuOpenId) closeRowMenu();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [viewUser, editUser, rowMenuOpenId, closeRowMenu]);

  useEffect(() => {
    if (inviteOpen) {
      dialogRef.current?.querySelector<HTMLInputElement>("input[type=email]")?.focus();
    } else {
      setEmail("");
      setSending(false);
    }
  }, [inviteOpen]);

  const openInvite = () => setInviteOpen(true);
  const closeInvite = () => {
    if (sending) return;
    setInviteOpen(false);
  };

  async function postInviteToEmail(targetEmail: string): Promise<{
    ok: boolean;
    message?: string;
    error?: string;
  }> {
    const trimmed = targetEmail.trim();
    if (!trimmed) {
      return { ok: false, error: "Enter an email address." };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { ok: false, error: "Enter a valid email address." };
    }
    const token = sessionStorage.getItem("accessToken");
    if (!token) {
      return { ok: false, error: "Sign in again to send invites." };
    }
    try {
      const res = await authFetch("/api/users/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: { message?: string };
      };
      if (res.status === 401) {
        return { ok: false, error: "Your session has expired. Sign in again." };
      }
      if (!res.ok) {
        return {
          ok: false,
          error: data.error?.message ?? "Could not send invitation.",
        };
      }
      return {
        ok: true,
        message: data.message ?? `Invitation sent to ${trimmed}.`,
      };
    } catch {
      return { ok: false, error: "Could not reach the server." };
    }
  }

  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Enter an email address.", { autoClose: 4000 });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Enter a valid email address.", { autoClose: 4000 });
      return;
    }
    setSending(true);
    try {
      const result = await postInviteToEmail(trimmed);
      if (!result.ok) {
        toast.error(result.error ?? "Could not send invitation.", {
          autoClose: 6000,
        });
        return;
      }
      toast.success(result.message ?? `Invitation sent to ${trimmed}.`, {
        autoClose: 4000,
      });
      setInviteOpen(false);
    } finally {
      setSending(false);
    }
  };

  const handleRowSendEmail = async (u: UserRow) => {
    if (u.accountStatus !== "expired") {
      toast.info(
        "Send email is only available when account status is Expired.",
        { autoClose: 4000 },
      );
      closeRowMenu();
      return;
    }
    closeRowMenu();
    const result = await postInviteToEmail(u.email);
    if (!result.ok) {
      toast.error(result.error ?? "Could not send invitation.", {
        autoClose: 6000,
      });
      return;
    }
    toast.success(result.message ?? `Invitation sent to ${u.email}.`, {
      autoClose: 4000,
    });
  };

  const refetchUsers = () => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) return;
    setLoadState("loading");
    void authFetch("/api/users")
      .then(async (res) => {
        if (res.status === 401) {
          setLoadState("idle");
          return;
        }
        const data = (await res.json().catch(() => ({}))) as {
          users?: UserRow[];
        };
        if (res.ok) {
          setUsers(normalizeUsersFromApi(data.users));
          setLoadState("idle");
        } else {
          setLoadState("error");
        }
      })
      .catch(() => setLoadState("error"));
  };

  const noToken = !sessionStorage.getItem("accessToken");

  return (
    <main className="mainLayout__content usersPage">
      <div className="usersPage__header">
        <PageHeading id={titleId} className="mainLayout__pageTitle">
          Users
        </PageHeading>
        <button
          type="button"
          className="usersPage__inviteBtn"
          onClick={openInvite}
        >
          <UserPlus size={18} strokeWidth={2} aria-hidden />
          Invite user
        </button>
      </div>
      {/*
      <p className="mainLayout__pageHint usersPage__intro">
        Manage organization users. Invitations can be sent from here when
        delivery is connected.
      </p>
      */}

      <div className="usersPage__toolbar">
        <div
          className="usersPage__tabs"
          role="tablist"
          aria-label="Filter users by account status"
        >
          <button
            type="button"
            role="tab"
            id="users-tab-active"
            aria-selected={statusTab === "active"}
            aria-controls="users-table-panel"
            tabIndex={statusTab === "active" ? 0 : -1}
            aria-label={`Active, ${activeCount} user${activeCount === 1 ? "" : "s"}`}
            className={`usersPage__tab${statusTab === "active" ? " usersPage__tab--selected" : ""}`}
            onClick={() => setStatusTab("active")}
          >
            Active
            <span className="usersPage__tabCount" aria-hidden>
              {activeCount}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            id="users-tab-inactive"
            aria-selected={statusTab === "inactive"}
            aria-controls="users-table-panel"
            tabIndex={statusTab === "inactive" ? 0 : -1}
            aria-label={`Inactive, ${inactiveCount} user${inactiveCount === 1 ? "" : "s"}`}
            className={`usersPage__tab${statusTab === "inactive" ? " usersPage__tab--selected" : ""}`}
            onClick={() => setStatusTab("inactive")}
          >
            Inactive
            <span className="usersPage__tabCount" aria-hidden>
              {inactiveCount}
            </span>
          </button>
        </div>
        <div className="usersPage__searchWrap">
          <Search
            className="usersPage__searchIcon"
            size={18}
            strokeWidth={2}
            aria-hidden
          />
          <input
            type="search"
            className="usersPage__searchInput"
            placeholder="Search by name, email, username…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search users"
          />
        </div>
      </div>

      <div
        className="usersPage__tableCard"
        id="users-table-panel"
        role="tabpanel"
        aria-labelledby={
          statusTab === "active" ? "users-tab-active" : "users-tab-inactive"
        }
      >
        {loadState === "loading" ? (
          <div className="usersPage__tableState" role="status">
            <Loader2 className="usersPage__spinner usersPage__spinner--lg" size={28} aria-hidden />
            <span>Loading users…</span>
          </div>
        ) : loadState === "error" ? (
          <div className="usersPage__tableState usersPage__tableState--error">
            <p>Could not load the user list.</p>
            <button
              type="button"
              className="usersPage__btn usersPage__btn--primary"
              onClick={refetchUsers}
            >
              Retry
            </button>
          </div>
        ) : noToken ? (
          <div className="usersPage__tableState">
            <p>Sign in to view users.</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="usersPage__tableState">
            <p>
              {users.length === 0
                ? "No users found."
                : usersInTab.length === 0
                  ? statusTab === "active"
                    ? "No active users."
                    : "No inactive users."
                  : "No users match your search."}
            </p>
          </div>
        ) : (
          <>
            <div className="usersPage__tableScroll">
              <table className="usersPage__table">
                <thead>
                  <tr>
                    <th scope="col" className="usersPage__thName">
                      Name
                    </th>
                    <th scope="col">Email</th>
                    <th scope="col">Username</th>
                    <th scope="col">Account</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="usersPage__thActions">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {userPager.pageItems.map((u) => {
                    const isSelf = isLoggedInUserRow(u);
                    return (
                    <tr key={u.id}>
                    <td className="usersPage__nameCell">
                      <div className="usersPage__nameCellInner">
                        <span className="usersPage__avatar" aria-hidden>
                          {userInitials(u)}
                        </span>
                        <span className="usersPage__nameText">
                          {displayName(u)}
                        </span>
                      </div>
                    </td>
                    <td>
                      {u.email?.trim() ? (
                        <a
                          className="usersPage__emailLink"
                          href={`mailto:${u.email.trim()}`}
                        >
                          {u.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{u.username}</td>
                    <td>
                      <span className={accountStatusBadgeClass(u.accountStatus)}>
                        {accountStatusLabel(u.accountStatus)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`usersPage__badge${u.isActive ? " usersPage__badge--active" : " usersPage__badge--inactive"}`}
                      >
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="usersPage__actionsCell">
                      <div
                        className="usersPage__rowMenuWrap"
                        data-users-row-menu={u.id}
                      >
                        <button
                          type="button"
                          className="usersPage__kebabBtn"
                          aria-haspopup="menu"
                          aria-expanded={rowMenuOpenId === u.id}
                          aria-label={
                            isSelf
                              ? "Actions unavailable for your own account"
                              : `Actions for ${u.username}`
                          }
                          title={
                            isSelf
                              ? "Not available for your own account."
                              : undefined
                          }
                          disabled={isSelf}
                          onClick={(e) => {
                            if (isSelf) return;
                            const btn = e.currentTarget;
                            if (rowMenuOpenId === u.id) {
                              closeRowMenu();
                              return;
                            }
                            const r = btn.getBoundingClientRect();
                            setRowMenuAnchor({
                              top: r.bottom,
                              right: r.right,
                            });
                            setRowMenuOpenId(u.id);
                          }}
                        >
                          <MoreHorizontal size={18} strokeWidth={2} aria-hidden />
                        </button>
                      </div>
                    </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <DataTablePagination
              className="usersPage__pager"
              page={userPager.page}
              pageCount={userPager.pageCount}
              total={userPager.total}
              pageSize={userPager.pageSize}
              from={userPager.from}
              to={userPager.to}
              onPageChange={userPager.setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>

      {inviteOpen ? (
        <div
          className="usersPage__overlay"
          role="presentation"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) closeInvite();
          }}
        >
          <div
            ref={dialogRef}
            className="usersPage__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${titleId}-invite`}
          >
            <div className="usersPage__dialogHead">
              <h2 id={`${titleId}-invite`} className="usersPage__dialogTitle">
                Invite user
              </h2>
              <button
                type="button"
                className="usersPage__dialogClose"
                onClick={closeInvite}
                disabled={sending}
                aria-label="Close"
              >
                <X size={18} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            <form className="usersPage__dialogBody" onSubmit={submitInvite}>
              <label
                className="usersPage__label usersPage__label--withIcon"
                htmlFor="invite-email"
              >
                <Mail
                  className="usersPage__labelIcon"
                  size={16}
                  strokeWidth={2}
                  aria-hidden
                />
                <span>Email</span>
              </label>
              <input
                id="invite-email"
                type="email"
                className="usersPage__input"
                autoComplete="email"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={sending}
              />
              <div className="usersPage__dialogActions">
                <button
                  type="button"
                  className="usersPage__btn usersPage__btn--logoutTone"
                  onClick={closeInvite}
                  disabled={sending}
                >
                  <CircleX size={16} strokeWidth={1.75} aria-hidden />
                  Cancel
                </button>
                <button
                  type="submit"
                  className="usersPage__btn usersPage__btn--primary usersPage__btn--inviteSend"
                  disabled={sending}
                >
                  {sending ? (
                    <>
                      <Loader2
                        className="usersPage__spinner"
                        size={18}
                        aria-hidden
                      />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send size={16} strokeWidth={2} aria-hidden />
                      Send invite
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {viewUser ? (
        <div
          className="usersPage__overlay"
          role="presentation"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) setViewUser(null);
          }}
        >
          <div className="usersPage__dialog usersPage__dialog--wide" role="dialog" aria-modal="true">
            <div className="usersPage__dialogHead">
              <h2 className="usersPage__dialogTitle">User details</h2>
              <button
                type="button"
                className="usersPage__dialogClose"
                onClick={() => setViewUser(null)}
                aria-label="Close"
              >
                <X size={18} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            <div className="usersPage__detailBody">
              <dl className="usersPage__detailList">
                <div className="usersPage__detailItem">
                  <dt className="usersPage__detailLabel">
                    <UserRound
                      className="usersPage__labelIcon"
                      size={15}
                      strokeWidth={2}
                      aria-hidden
                    />
                    <span>Full name</span>
                  </dt>
                  <dd>{viewUser.fullName?.trim() || "—"}</dd>
                </div>
                <div className="usersPage__detailItem">
                  <dt className="usersPage__detailLabel">
                    <Mail
                      className="usersPage__labelIcon"
                      size={15}
                      strokeWidth={2}
                      aria-hidden
                    />
                    <span>Email</span>
                  </dt>
                  <dd>{viewUser.email}</dd>
                </div>
                <div className="usersPage__detailItem">
                  <dt className="usersPage__detailLabel">
                    <AtSign
                      className="usersPage__labelIcon"
                      size={15}
                      strokeWidth={2}
                      aria-hidden
                    />
                    <span>Username</span>
                  </dt>
                  <dd>{viewUser.username}</dd>
                </div>
                <div className="usersPage__detailItem">
                  <dt className="usersPage__detailLabel">
                    <BadgeCheck
                      className="usersPage__labelIcon"
                      size={15}
                      strokeWidth={2}
                      aria-hidden
                    />
                    <span>Account</span>
                  </dt>
                  <dd>{accountStatusLabel(viewUser.accountStatus)}</dd>
                </div>
                <div className="usersPage__detailItem usersPage__detailItem--span2">
                  <dt className="usersPage__detailLabel">
                    <Activity
                      className="usersPage__labelIcon"
                      size={15}
                      strokeWidth={2}
                      aria-hidden
                    />
                    <span>Status</span>
                  </dt>
                  <dd>{viewUser.isActive ? "Active" : "Inactive"}</dd>
                </div>
              </dl>
              <div className="usersPage__dialogActions">
                <button
                  type="button"
                  className="usersPage__btn usersPage__btn--logoutTone"
                  onClick={() => setViewUser(null)}
                >
                  <X size={16} strokeWidth={1.75} aria-hidden />
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editUser ? (
        <div
          className="usersPage__overlay"
          role="presentation"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) setEditUser(null);
          }}
        >
          <div className="usersPage__dialog usersPage__dialog--wide" role="dialog" aria-modal="true">
            <div className="usersPage__dialogHead">
              <h2 className="usersPage__dialogTitle">Edit user</h2>
              <button
                type="button"
                className="usersPage__dialogClose"
                onClick={() => setEditUser(null)}
                aria-label="Close"
              >
                <X size={18} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            <form
              className="usersPage__dialogBody"
              onSubmit={(e) => {
                e.preventDefault();
                toast.info(
                  "Saving user changes is not connected to the API yet.",
                  { autoClose: 5000 },
                );
                setEditUser(null);
              }}
            >
              <div className="usersPage__formGrid">
                <div className="usersPage__formField">
                  <label
                    className="usersPage__label usersPage__label--withIcon"
                    htmlFor="edit-fullName"
                  >
                    <UserRound
                      className="usersPage__labelIcon"
                      size={16}
                      strokeWidth={2}
                      aria-hidden
                    />
                    <span>Full name</span>
                  </label>
                  <input
                    id="edit-fullName"
                    className="usersPage__input"
                    value={editDraft.fullName}
                    onChange={(e) =>
                      setEditDraft((d) => ({ ...d, fullName: e.target.value }))
                    }
                  />
                </div>
                <div className="usersPage__formField">
                  <label
                    className="usersPage__label usersPage__label--withIcon"
                    htmlFor="edit-email"
                  >
                    <Mail
                      className="usersPage__labelIcon"
                      size={16}
                      strokeWidth={2}
                      aria-hidden
                    />
                    <span>Email</span>
                  </label>
                  <input
                    id="edit-email"
                    type="email"
                    className="usersPage__input usersPage__input--readonly"
                    readOnly
                    aria-readonly="true"
                    value={editDraft.email}
                  />
                </div>
                <div className="usersPage__formField">
                  <label
                    className="usersPage__label usersPage__label--withIcon"
                    htmlFor="edit-username"
                  >
                    <AtSign
                      className="usersPage__labelIcon"
                      size={16}
                      strokeWidth={2}
                      aria-hidden
                    />
                    <span>Username</span>
                  </label>
                  <input
                    id="edit-username"
                    className="usersPage__input"
                    value={editDraft.username}
                    onChange={(e) =>
                      setEditDraft((d) => ({ ...d, username: e.target.value }))
                    }
                  />
                </div>
                <div className="usersPage__formField">
                  <label
                    className="usersPage__label usersPage__label--withIcon"
                    htmlFor="edit-status"
                  >
                    <Activity
                      className="usersPage__labelIcon"
                      size={16}
                      strokeWidth={2}
                      aria-hidden
                    />
                    <span>Status</span>
                  </label>
                  <select
                    id="edit-status"
                    className="usersPage__input usersPage__select"
                    value={editDraft.isActive ? "active" : "inactive"}
                    onChange={(e) =>
                      setEditDraft((d) => ({
                        ...d,
                        isActive: e.target.value === "active",
                      }))
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="usersPage__dialogActions">
                <button
                  type="button"
                  className="usersPage__btn usersPage__btn--logoutTone"
                  onClick={() => setEditUser(null)}
                >
                  <CircleX size={16} strokeWidth={1.75} aria-hidden />
                  Cancel
                </button>
                <button type="submit" className="usersPage__btn usersPage__btn--primary">
                  <RefreshCw size={16} strokeWidth={2} aria-hidden />
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {rowMenuOpenId && rowMenuAnchor && rowMenuUser
        ? createPortal(
            <div
              className="usersPage__rowMenu usersPage__rowMenu--portal"
              role="menu"
              aria-orientation="vertical"
              data-users-row-menu-portal={rowMenuOpenId}
              style={{
                top: rowMenuAnchor.top + 4,
                left: rowMenuAnchor.right,
              }}
            >
              <button
                type="button"
                role="menuitem"
                className="usersPage__rowMenuItem"
                onClick={() => {
                  closeRowMenu();
                  setViewUser(rowMenuUser);
                }}
              >
                <Eye size={16} strokeWidth={2} aria-hidden />
                View
              </button>
              <button
                type="button"
                role="menuitem"
                className="usersPage__rowMenuItem"
                onClick={() => {
                  closeRowMenu();
                  setEditUser(rowMenuUser);
                }}
              >
                <Pencil size={16} strokeWidth={2} aria-hidden />
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                className="usersPage__rowMenuItem"
                disabled={rowMenuUser.accountStatus !== "expired"}
                title={
                  rowMenuUser.accountStatus === "expired"
                    ? undefined
                    : "Send email is only available when account status is Expired."
                }
                onClick={() => void handleRowSendEmail(rowMenuUser)}
              >
                <Mail size={16} strokeWidth={2} aria-hidden />
                Send email
              </button>
            </div>,
            document.body,
          )
        : null}
    </main>
  );
}
