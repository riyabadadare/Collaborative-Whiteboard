import React from "react";
import "../styles/auth.css";

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="authPage">
      <div className="authCard">
        <h1 className="authTitle">{title}</h1>
        {subtitle && <p className="authSub">{subtitle}</p>}
        {children}
        {footer && <div className="authFooter">{footer}</div>}
      </div>
    </div>
  );
}
