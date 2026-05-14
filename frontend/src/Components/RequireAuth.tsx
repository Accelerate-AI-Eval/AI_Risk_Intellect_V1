import { Navigate, Outlet, useLocation } from "react-router-dom";

/**
 * Renders child routes only when an access token exists; otherwise redirects to sign-in.
 */
export function RequireAuth() {
  const token = sessionStorage.getItem("accessToken");
  const location = useLocation();

  if (!token?.trim()) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
