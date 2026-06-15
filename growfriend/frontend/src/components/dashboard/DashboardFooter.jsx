import DashboardShortcuts from './DashboardShortcuts';
import '@/styles/dashboard/DashboardFooter.css';

function DashboardFooter({ openModal, modalType, closeModal }){
    return(
        <footer className = "dashboard-footer">
                <div className = "copyright">
                    <p className='copyright'>&copy; 2026 GrowFriend. All rights reserved.</p>
                </div>
                <DashboardShortcuts openModal={openModal} modalType={modalType} closeModal={closeModal} />
        </footer>
    )
}

export default DashboardFooter;