import '@/styles/dashboard/DashboardShortcuts.css';

function DashboardShortcuts({ openModal, modalType, closeModal }) {
    const shortcutConfig = [
        {
            key: 'p2p',
            icon: '/dashboardicons/board-1.png',
            alt: 'P2P Task',
            title: 'P2P Tasks',
            description: 'Get other player tasks and earn coin by completing them.'
        },
        {
            key: 'system',
            icon: '/dashboardicons/calendar_pixel_perfect.png',
            alt: 'System Task',
            title: 'System Tasks',
            description: 'View and complete system-generated tasks to progress in the game.'
        },
        {
            key: 'mytask',
            icon: '/dashboardicons/scroll_freepik.png',
            alt: 'My Task',
            title: 'My Tasks',
            description: 'Check your taken tasks (Quest) and manage your created tasks.'
        },
        {
            key: 'inventory',
            icon: '/dashboardicons/backpack_freepik.png',
            alt: 'Inventory',
            title: 'Inventory',
            description: 'Manage your foods for your pet and check your pet collection.'
        },
        {
            key: 'store',
            icon: '/dashboardicons/shop_goerge_cresnar.png',
            alt: 'Store',
            title: 'Store',
            description: 'Buy various types of food for your pet or buy a new pet after maxing out your previous pet.'
        }
    ];

    return (
        <div className="dashboard-shortcuts">
            {shortcutConfig.map((shortcut) => (
                <button
                    key={shortcut.key}
                    className="shortcut-btn"
                    onClick={() => openModal(shortcut.key)}
                    aria-label={shortcut.title}
                >
                    <img className="shortcut-icon" src={shortcut.icon} alt={shortcut.alt} />
                    <span className="shortcut-tooltip" role="tooltip">
                        <span className="tooltip-title">{shortcut.title}</span>
                        <span className="tooltip-description">{shortcut.description}</span>
                    </span>
                </button>
            ))}
        </div>
    )
}

export default DashboardShortcuts;
