// ============================================================
//   Landing Page – route: /landingpage
// ============================================================
import '../styles/landingpage.css';
import dashboardPreview from '../assets/dashboard_preview_placeholder.gif';
import LoginForm from '../components/landingpage/LoginForm';

export default function LandingPage() {
  return (
    <div className="landing-page">
      {/* ---- Left Panel ---- */}
      <div className="landing-left">
        {/* Logo */}
        <div className="landing-logo">
          <span className="landing-logo-title">🐣 GROWFRIEND</span>
          <span className="landing-logo-sub">grow together!</span>
        </div>

        {/* App preview image */}
        <div className="landing-preview">
          <img
            src={dashboardPreview}
            alt="GrowFriend app preview"
            className="landing-preview-img"
          />
        </div>

        {/* Tagline */}
        <p className="landing-tagline">
          Team up with a buddy for your quest.<br />
          Gather coins and unlock their evolution!
        </p>
      </div>

      {/* ---- Right Panel ---- */}
      <div className="landing-right">
        <LoginForm />
      </div>
    </div>
  );
}
