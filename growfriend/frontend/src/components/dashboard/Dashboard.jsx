import React, { useEffect, useState } from 'react';
import useModal from '../../hooks/useModal';
import { AcceptedTasksProvider } from '../../context/AcceptedTasksContext';
import { useApp } from '../../context/AppContext';
import ModalBase from '../taskSystemModals/ModalBase';
import MyTaskModal from '../taskSystemModals/MyTaskModal';
import P2PModal from '../taskSystemModals/P2PModal';
import CommunityModal from '../taskSystemModals/CommunityModal';
import StoreModal from '../taskSystemModals/StoreModal';
import InventoryModal from '../taskSystemModals/InventoryModal';
import DashboardHeader from './DashboardHeader';
import DashboardFooter from './DashboardFooter';
import DasboardMain from './DashboardMain';
import { ITEM_IMAGE_LIST } from '../../data/itemAssets';
import { getDashboard } from '../../utils/dashBoardApi';

const MODAL_CONTENTS = {
  mytask: <MyTaskModal />,
  p2p: <P2PModal />,
  system: <CommunityModal />,
};

function Dashboard() {
  const { currentUser, refreshCoins } = useApp();
  const { isOpen, modalType, openModal, closeModal } = useModal();
  const [questTargetId, setQuestTargetId] = useState(null);
  const [coins, setCoins] = useState(0);
  const [activePet, setActivePet] = useState(null);

  async function loadDashboardCoins() {
    const token = localStorage.getItem('token');

    if (!token) return;

    try {
      const response = await getDashboard(token);
      const currentCoins = response?.data?.userSummary?.coins;

      if (typeof currentCoins === 'number') {
        setCoins(currentCoins);
      }
    } catch (err) {
      console.error('Failed to load dashboard coins:', err);
    }
  }

  useEffect(() => {
    loadDashboardCoins();
    // Warm browser cache for store/inventory item images while user is on dashboard.
    ITEM_IMAGE_LIST.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  useEffect(() => {
    if (typeof currentUser?.coins === 'number') {
      setCoins(currentUser.coins);
    }
  }, [currentUser?.coins]);

  const openQuestDetail = (taskId) => {
    setQuestTargetId(taskId);
    openModal('mytask');
  };

  const handleCloseModal = () => {
    closeModal();
    setQuestTargetId(null);
  };

  return (
    <div className="app-container">
      <DashboardHeader coins={coins} />

      <DasboardMain
        onQuestDetails={openQuestDetail}
        activePet={activePet}
        onPetLoaded={setActivePet}
      ></DasboardMain>

      {/* <button className="btn-open-board" onClick={() => openModal('mytask')}>
        Open Task Board
      </button> */}

      {modalType === 'inventory' ? (
        isOpen && <InventoryModal onClose={handleCloseModal} />
      ) : modalType === 'store' ? (
        isOpen && (
          <StoreModal
            onClose={handleCloseModal}
            onPurchaseSuccess={async (response) => {
              const updatedCoins = response?.data?.coins;

              if (typeof updatedCoins === 'number') {
                setCoins(updatedCoins);
              }
              await refreshCoins();
              if (typeof updatedCoins !== 'number') await loadDashboardCoins();
            }}
          />
        )
      ) : (
        <ModalBase
          isOpen={isOpen}
          onClose={handleCloseModal}
          modalType={modalType}
          onChangeType={openModal}
        >
          {modalType && MODAL_CONTENTS[modalType] && React.cloneElement(MODAL_CONTENTS[modalType], {
            onClose: handleCloseModal,
            onNavigate: openModal,
            questTargetId: modalType === 'mytask' ? questTargetId : undefined,
          })}
        </ModalBase>
      )}

      <DashboardFooter openModal={openModal} modalType={modalType} closeModal={handleCloseModal} />
    </div>
  );
}

export default Dashboard;
