import '../../styles/components/CoinBadge.css';
import coinImg from '@/assets/coin_popo2021.png'


function CoinBadge({amount}){
    return(
        <div className="coin-badge">
            <img className = "coin-badge-icon" src={coinImg} alt="Coin" />
            <span className="coin-badge-amount">{amount}</span>
        </div>
    )
}

export default CoinBadge