const axios = require('axios');

exports.sendSlackNotification = async (userId, text) => {
  try {
    await axios.post('https://slack.com/api/chat.postMessage', {
      channel: userId, // Direct message to the intern
      text: text,
    }, {
      headers: { 
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error("Slack Notification Error:", error);
  }
};