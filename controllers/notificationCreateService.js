const Notification = require("../models/Notification");

const admin = require("firebase-admin");

exports.sendNotification = async ({
  user = "",
  to_id = "",
  description = "",
  type = "",
  title = "",
  fcmtoken = "",
  event = "",
  purchase = "",
  support = "",
  transferId = "",
}) => {
  try {
    // Create an object to store the fields to be updated
    const updateFields = Object.fromEntries(
      Object.entries({
        user,
        to_id,
        type,
        description,
        title,
        event,
        purchase,
        support,
        transferId,
      }).filter(([key, value]) => value !== ""),
    );

    const notification = new Notification(updateFields);
    await notification.save();
    if (fcmtoken) {
      const message = {
        token: fcmtoken,
        notification: {
          title: title,
          body: description,
        },
        data: support
          ? {
              support: support.toString(),
            }
          : {},
        android: {
          notification: {
            sound: "default",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
            },
          },
        },
      };
      await admin
        .messaging()
        .send(message)
        .catch((error) => {
          console.log(error);
        });
    }
  } catch (error) {
    console.log(error);
  }
};
