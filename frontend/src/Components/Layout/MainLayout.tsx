import mainLogo from "../../assets/images/mainlogo.svg";
import { NavLink, Outlet } from "react-router-dom";
import { SIDEBAR_NAV } from "./sidebarNav";
import { TopBar } from "./TopBar";
import "./mainLayout.css";

const NAV_ICON_PROPS = {
  size: 20,
  strokeWidth: 1.75,
  className: "mainLayout__navIcon",
  "aria-hidden": true as const,
};

export function MainLayout() {
  return (
    <div className="mainLayout">
      <aside className="mainLayout__sidebar" aria-label="Main navigation">
        <div className="mainLayout__brand">
          <img
            src={mainLogo}
            alt=""
            className="mainLayout__brandLogo"
            width={44}
            height={44}
          />
          <div className="mainLayout__brandText">
            <span className="mainLayout__brandTitle">AI-Q</span>
            <span className="mainLayout__brandTagline">AI RISK INTELLECT</span>
          </div>
        </div>
        <nav className="mainLayout__nav">
          {SIDEBAR_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `mainLayout__navLink${isActive ? " mainLayout__navLink--active" : ""}`
                }
              >
                <Icon {...NAV_ICON_PROPS} />
                <span className="mainLayout__navLabel">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <div className="mainLayout__main">
        <TopBar />
        <div className="mainLayout__scroll">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
