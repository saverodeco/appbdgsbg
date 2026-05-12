import Link from 'next/link';
import { useAuth } from '../hooks/useAuth';
import { useState, useEffect, Children, cloneElement } from 'react';
import { supabase } from '../supabase/client'; // Import supabase client

const Layout = ({ children }) => {
  const { user, loading, logout } = useAuth() || {};
  const [permissions, setPermissions] = useState(null); // Local state for permissions
  const [plant, setPlant] = useState('7025');
  const [openMenu, setOpenMenu] = useState(null);

  // Fetch permissions when the user is loaded
  useEffect(() => {
    if (user) {
      const fetchPermissions = async () => {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('permissions')
          .eq('id', user.id)
          .single();
        
        if (data) {
          setPermissions(data.permissions);
        }
      };
      fetchPermissions();
    } else {
      // Clear permissions if user logs out
      setPermissions(null);
    }
  }, [user]);

  const handlePlantChange = (event) => {
    setPlant(event.target.value);
  };

  const toggleMenu = (menu) => {
    setOpenMenu(openMenu === menu ? null : menu);
  };

  const childrenWithProps = Children.map(children, child => {
    if (child && typeof child.type === 'function') {
      return cloneElement(child, { plant });
    }
    return child;
  });

  const menuItems = {
    "Paper Roll": {
      prefix: "pr-",
      items: [
        { href: "/paper-roll/pr-dashboard", label: "Dashboard", permission: "pr-dashboard" },
        { href: "/paper-roll/pr-stock", label: "Inventory Stock", permission: "pr-stock" },
        { href: "/paper-roll/pr-stock-pivot", label: "Stock Pivot", permission: "pr-stock-pivot" },
        { href: "/paper-roll/pr-map", label: "Warehouse Map", permission: "pr-map" },
        { href: "/paper-roll/pr-issue", label: "Goods Issue", permission: "pr-issue" },
        { href: "/paper-roll/pr-movement", label: "Goods Movement", permission: "pr-movement" },
        { href: "/paper-roll/pr-receive", label: "Goods Receive", permission: "pr-receive" },
        { href: "/paper-roll/pr-return", label: "Goods Return", permission: "pr-return" },
        { href: "/paper-roll/pr-printlabel", label: "Print Label", permission: "pr-printlabel" },
        { href: "/paper-roll/pr-movement-history", label: "Movement History", permission: "pr-movement-history" },
        { href: "/paper-roll/pr-opname-report", label: "Opname Report", permission: "pr-opname-report" },
        { href: "/paper-roll/pr-stock-opname", label: "Stock Opname", permission: "pr-stock-opname" },
        { href: "/paper-roll/pr-upload-stock", label: "Upload Stock", permission: "pr-upload-stock" },
      ]
    },
    "Logistic": {
      prefix: "fg-",
      items: [
        { href: "/logistic/fg-outstanding", label: "Delivery Outstanding", permission: "fg-outstanding" },
        { href: "/logistic/fg-delivery-schedule", label: "Delivery Schedule", permission: "fg-delivery-schedule" },
        { href: "/logistic/fg-loading", label: "Goods Issue", permission: "fg-loading" },
        { href: "/logistic/fg-loadingdock", label: "FG Loading Dock", permission: "fg-loadingdock" },
        { href: "/logistic/fg-receive", label: "Goods Receive", permission: "fg-receive" },
        { href: "/logistic/fg-stock", label: "Goods Stock Data", permission: "fg-stock" },
        { href: "/logistic/fg-movement-history", label: "Movement History", permission: "fg-movement-history" },
        { href: "/logistic/fg-upload-delivery-schedule", label: "Upload Delivery Schedule", permission: "fg-upload-delivery-schedule" },
        { href: "/logistic/fg-transporter", label: "Transporter", permission: "fg-transporter" },
      ]
    },
    "Account": {
      prefix: "ac-",
      items: [
        { href: "/account/ac-edit-account", label: "Edit Account", permission: "ac-edit-account" },
        { href: "/account/ac-authority-manager", label: "Authority Manager", permission: "ac-authority-manager" }
      ]
    },
  };

  // Use the local 'permissions' state for checks
  const hasPermission = (permission) => {
    if (permission === 'ac-edit-account') {
      return true;
    }
    return permissions?.includes(permission) ?? false;
  };

  const hasMenuAccess = (prefix) => {
    if (prefix === 'ac-') {
      return true;
    }
    return permissions?.some(p => p.startsWith(prefix)) ?? false;
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container">
      <aside className="sidebar">
        <div className="sidebar-header">
          Navigation
        </div>
        <nav>
          <ul>
            {user ? (
              <>
                {/* Render menus only if permissions are loaded */}
                {permissions && Object.keys(menuItems)
                  .filter(menu => hasMenuAccess(menuItems[menu].prefix))
                  .map(menu => (
                  <li key={menu}>
                    <a onClick={() => toggleMenu(menu)} style={{ cursor: 'pointer' }}>
                      {menu}
                    </a>
                    {openMenu === menu && (
                      <ul>
                        {menuItems[menu].items
                          .filter(item => hasPermission(item.permission))
                          .map(item => (
                          <li key={item.href} style={{ marginLeft: '1rem' }}>
                            <Link href={item.href} legacyBehavior><a>{item.label}</a></Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
                <li>
                  <button onClick={logout}>Log Out</button>
                </li>
                <li>
                <select value={plant} onChange={handlePlantChange}>
                  <option value="7025">7025</option>
                  <option value="7027">7027</option>
                </select>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link href="/signup" legacyBehavior><a>Sign Up</a></Link>
                </li>
                <li>
                  <Link href="/login" legacyBehavior><a>Login</a></Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      </aside>
      <main className="main">
        <div className="header">
          <h1>WMS</h1>
          {user && <span>Welcome, {user?.user_metadata?.display_name}</span>}
        </div>
        <div className="content">
          {childrenWithProps}
        </div>
      </main>
    </div>
  );
};

export default Layout;
