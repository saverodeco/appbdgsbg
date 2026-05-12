import { useAuth } from '../hooks/useAuth';
import pkg from '../package.json';

export default function Home() {
  const { user, logout } = useAuth();

  return (
    <div>
      <h1>Warehouse Management System</h1>
      <p>Version: {pkg.version}</p>
    </div>
  );
}
