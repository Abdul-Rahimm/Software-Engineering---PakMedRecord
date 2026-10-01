const Notification = require('../models/NotificationModel');

// Signed-in user's notifications, newest first
const list = async (req, res) => {
  try {
    const { role, cnic } = req.user;
    const [notifications, unread] = await Promise.all([
      Notification.find({ role, cnic }).sort({ createdAt: -1 }).limit(50),
      Notification.countDocuments({ role, cnic, read: false }),
    ]);
    res.status(200).json({ notifications, unread });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const markRead = async (req, res) => {
  try {
    const { role, cnic } = req.user;
    await Notification.updateOne({ _id: req.params.id, role, cnic }, { read: true });
    res.status(200).json({ message: 'Marked as read' });
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const markAllRead = async (req, res) => {
  try {
    const { role, cnic } = req.user;
    await Notification.updateMany({ role, cnic, read: false }, { read: true });
    res.status(200).json({ message: 'All marked as read' });
  } catch (error) {
    console.error('Error updating notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { list, markRead, markAllRead };
