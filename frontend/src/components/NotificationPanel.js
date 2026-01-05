import React, { useEffect, useState } from 'react';
import { useNotification } from '../context/NotificationContext';
import { FiX, FiCheckCircle, FiAlertCircle, FiInfo, FiAlertTriangle, FiBell, FiBellOff } from 'react-icons/fi';

const NotificationPanel = () => {
  const { 
    notifications, 
    backendNotifications,
    unreadCount,
    loading,
    removeNotification, 
    clearAll,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotification();
  
  const [showBackendNotifications, setShowBackendNotifications] = useState(false);

  useEffect(() => {
    // Fetch notifications when component mounts
    fetchNotifications();
    // RELIABILITY: Poll for new notifications every 60 seconds (reduced frequency to prevent resource exhaustion)
    // Only poll if backend is reachable (errors are handled silently in fetchNotifications)
    const interval = setInterval(() => {
      fetchNotifications();
    }, 60000); // Increased from 30s to 60s to reduce load
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const getIcon = (type) => {
    switch (type) {
      case 'success':
      case 'upload':
      case 'download':
        return <FiCheckCircle className="text-green-500" />;
      case 'error':
        return <FiAlertCircle className="text-red-500" />;
      case 'warning':
        return <FiAlertTriangle className="text-yellow-500" />;
      case 'delete':
        return <FiAlertCircle className="text-orange-500" />;
      default:
        return <FiInfo className="text-blue-500" />;
    }
  };

  const getBgColor = (type) => {
    switch (type) {
      case 'success':
      case 'upload':
      case 'download':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'delete':
        return 'bg-orange-50 border-orange-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  // Show bell icon if no notifications are visible
  if (notifications.length === 0 && (!showBackendNotifications || backendNotifications.length === 0)) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => {
            setShowBackendNotifications(!showBackendNotifications);
            if (!showBackendNotifications) {
              fetchNotifications();
            }
          }}
          className="relative p-3 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors"
        >
          {unreadCount > 0 ? (
            <>
              <FiBell className="text-2xl text-primary-600" />
              <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </>
          ) : (
            <FiBellOff className="text-2xl text-gray-400" />
          )}
        </button>
      </div>
    );
  }

  const displayNotifications = showBackendNotifications ? backendNotifications : notifications;

  return (
    <div className="fixed bottom-4 right-4 z-40 space-y-3 max-w-md">
      {/* Toast Notifications (temporary) */}
      {!showBackendNotifications && notifications.map((notification, index) => (
        <div
          key={notification.id}
          className={`${getBgColor(
            notification.type
          )} border rounded-xl shadow-lg p-4 flex items-start space-x-3 animate-slide-up backdrop-blur-sm ${!notification.read ? 'border-l-4 border-l-primary-500' : ''}`}
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          <div className="flex-shrink-0 mt-0.5">
            {getIcon(notification.type)}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800">{notification.message}</p>
          </div>
          <button
            onClick={() => removeNotification(notification.id)}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX />
          </button>
        </div>
      ))}
    </div>
  );
};

export default NotificationPanel;
