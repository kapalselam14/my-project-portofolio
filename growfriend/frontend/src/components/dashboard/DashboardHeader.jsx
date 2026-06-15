import '@/styles/dashboard/DashboardHeader.css';
import CoinBadge from "../ui/CoinBadge";
import UserMenu from "../userconfig/UserMenu";

function DashboardHeader({ coins = 0 }) {
    return (
        <header className="dashboard-header">
            <h1 className="app-title">🐣 GrowFriend</h1>
            <nav className="dashboard-nav">
                <div className="coin-display">
                    <CoinBadge amount={coins} />
                </div>
                <UserMenu />
            </nav>
        </header>
    );
}

export default DashboardHeader;