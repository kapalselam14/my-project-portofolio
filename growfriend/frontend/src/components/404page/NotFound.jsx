import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/landingpage', { replace: true });
    }, 2000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return <h2>404 - Page Not Found<br />Redirecting to Landing Page...</h2>;
}