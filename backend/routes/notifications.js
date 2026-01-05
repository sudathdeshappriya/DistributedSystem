const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification
} = require('../services/etcdService');

const router = express.Router();

// Get user notifications
router.get('/list', authenticate, async (req, res) => {
  try {
    const unreadOnly = req.query.unreadOnly === 'true';
    const notifications = await getUserNotifications(req.user.id, unreadOnly);
    
    res.json({ notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Mark notification as read
router.put('/read/:notificationId', authenticate, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const notification = await markNotificationAsRead(req.user.id, notificationId);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({ notification });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.put('/read-all', authenticate, async (req, res) => {
  try {
    const notifications = await markAllNotificationsAsRead(req.user.id);
    res.json({ 
      message: 'All notifications marked as read',
      count: notifications.length 
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Delete notification
router.delete('/delete/:notificationId', authenticate, async (req, res) => {
  try {
    const { notificationId } = req.params;
    await deleteNotification(req.user.id, notificationId);
    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Get unread count
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const unreadNotifications = await getUserNotifications(req.user.id, true);
    res.json({ count: unreadNotifications.length });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

module.exports = router;


